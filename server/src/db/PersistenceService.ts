/**
 * Persistence Service
 * Architectural boundary decoupling the real-time Authoritative Game Engine from PostgreSQL.
 * Manages player profile resolution, match records, and round scorecards asynchronously.
 * Never throws into the live game loop.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { getDbPool, isDatabaseConfigured, checkDbHealth, getLastDbError } from './dbPool';
import { PlayerRepository } from './repositories/PlayerRepository';
import { MatchRepository } from './repositories/MatchRepository';
import { RoundRepository } from './repositories/RoundRepository';
import {
  PersistenceStatus,
  PlayerProfileRecord,
  LeaderboardCategory,
  LeaderboardTimeframe,
  LeaderboardResponseDTO,
  TopWinItemDTO,
  AchievementDTO,
} from './types';
import { PlayerPosition } from '../../../src/models/player';
import { RoomParticipant } from '../../../src/models/multiplayer';
import { GameState, RoundScoreRecord } from '../../../src/models/gameState';

export class PersistenceService {
  private static instance: PersistenceService | null = null;
  private pool: Pool | null = null;
  private playerRepo: PlayerRepository | null = null;
  private matchRepo: MatchRepository | null = null;
  private roundRepo: RoundRepository | null = null;

  // In-memory cache for anonymous_client_id -> player_id to eliminate repeated DB reads
  private playerProfileCache = new Map<string, PlayerProfileRecord>();

  // In-memory bounded queue for failed persistence jobs
  private pendingQueue: Array<() => Promise<void>> = [];
  private readonly MAX_QUEUE_SIZE = 100;

  private constructor() {
    this.initPool();
  }

  public static getInstance(): PersistenceService {
    if (!PersistenceService.instance) {
      PersistenceService.instance = new PersistenceService();
    }
    return PersistenceService.instance;
  }

  private initPool(): void {
    if (isDatabaseConfigured()) {
      this.pool = getDbPool();
      if (this.pool) {
        this.playerRepo = new PlayerRepository(this.pool);
        this.matchRepo = new MatchRepository(this.pool);
        this.roundRepo = new RoundRepository(this.pool);
      }
    }
  }

  /**
   * Resets or reinitializes connection (useful for testing or env changes)
   */
  public reinitialize(): void {
    this.pool = null;
    this.playerRepo = null;
    this.matchRepo = null;
    this.roundRepo = null;
    this.playerProfileCache.clear();
    this.pendingQueue = [];
    this.initPool();
  }

  public isAvailable(): boolean {
    return Boolean(this.pool && this.playerRepo && this.matchRepo && this.roundRepo);
  }

  public async getStatus(): Promise<PersistenceStatus> {
    const enabled = isDatabaseConfigured();
    if (!enabled || !this.pool) {
      return {
        enabled: false,
        connected: false,
        driver: 'none',
        pendingQueueSize: 0,
        lastError: null,
      };
    }

    const health = await checkDbHealth();
    return {
      enabled: true,
      connected: health.connected,
      driver: 'postgres',
      pendingQueueSize: this.pendingQueue.length,
      lastError: health.error || getLastDbError(),
    };
  }

  /**
   * Resolves or creates a persistent player profile for an anonymous cb_player_id.
   * Safe to call on every table join; returns cached record if already resolved.
   */
  public async onPlayerJoin(
    anonymousClientId: string,
    displayName: string
  ): Promise<PlayerProfileRecord | null> {
    if (!this.isAvailable()) return null;

    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return null;

    // Check memory cache
    const cached = this.playerProfileCache.get(cleanAnonId);
    if (cached) {
      // If display name changed, fire background update
      if (displayName && displayName !== cached.display_name) {
        this.enqueue(async () => {
          const updated = await this.playerRepo!.findOrCreateByAnonymousId(cleanAnonId, displayName);
          this.playerProfileCache.set(cleanAnonId, updated);
        });
      }
      return cached;
    }

    try {
      const profile = await this.playerRepo!.findOrCreateByAnonymousId(cleanAnonId, displayName);
      this.playerProfileCache.set(cleanAnonId, profile);
      return profile;
    } catch (err: any) {
      console.error('[PersistenceService] onPlayerJoin failed:', err.message);
      return null;
    }
  }

  /**
   * Persists the start of a match. Returns a generated matchId.
   */
  public async onMatchStart(
    roomCode: string,
    totalRounds: number,
    participants: RoomParticipant[]
  ): Promise<string | null> {
    if (!this.isAvailable()) return null;

    const matchId = `m_${roomCode}_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;

    this.enqueue(async () => {
      // Resolve profiles for all human players
      const playerDtos: Array<{
        playerId?: string | null;
        seat: PlayerPosition;
        displayName: string;
        isHost: boolean;
        isBot: boolean;
      }> = [];

      for (const p of participants) {
        let dbPlayerId: string | null = null;
        if (!p.isBot) {
          const profile = await this.onPlayerJoin(p.id, p.name);
          dbPlayerId = profile ? profile.player_id : null;
        }

        playerDtos.push({
          playerId: dbPlayerId,
          seat: p.position,
          displayName: p.name,
          isHost: p.isHost,
          isBot: p.isBot,
        });
      }

      await this.matchRepo!.createMatch({
        matchId,
        roomCode,
        totalRounds,
        players: playerDtos,
      });

      console.log(`[PersistenceService] Persisted match start: ${matchId} (Room ${roomCode})`);
    });

    return matchId;
  }

  /**
   * Persists completed round scores and player bids.
   */
  public async onRoundComplete(
    matchId: string,
    roundNumber: number,
    dealerSeat: PlayerPosition,
    roundScoreRecord: RoundScoreRecord,
    bids: Record<PlayerPosition, number | null>,
    tricksWon: Record<PlayerPosition, number>,
    participants: RoomParticipant[]
  ): Promise<void> {
    if (!this.isAvailable() || !matchId) return;

    this.enqueue(async () => {
      const players: Array<{
        seat: PlayerPosition;
        playerId?: string | null;
        bid: number | null;
        tricksWon: number;
        roundScore: number;
      }> = [];

      for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
        const participant = participants.find((p) => p.position === pos);
        let dbPlayerId: string | null = null;
        if (participant && !participant.isBot) {
          const cached = this.playerProfileCache.get(participant.id);
          dbPlayerId = cached ? cached.player_id : null;
        }

        const scoreEntry = roundScoreRecord.scores ? roundScoreRecord.scores[pos] : undefined;

        players.push({
          seat: pos,
          playerId: dbPlayerId,
          bid: bids[pos] ?? null,
          tricksWon: tricksWon[pos] ?? 0,
          roundScore: scoreEntry ? scoreEntry.roundScore : 0,
        });
      }

      await this.roundRepo!.recordRoundResult({
        matchId,
        roundNumber,
        dealerSeat,
        players,
      });

      console.log(`[PersistenceService] Persisted round ${roundNumber} for match ${matchId}`);
    });
  }

  /**
   * Persists match completion, final player scores, and rankings.
   */
  public async onMatchComplete(
    matchId: string,
    gameState: GameState,
    participants: RoomParticipant[]
  ): Promise<void> {
    if (!this.isAvailable() || !matchId) return;

    this.enqueue(async () => {
      // Calculate final ranking from cumulative scores
      const positions = [
        PlayerPosition.SOUTH,
        PlayerPosition.WEST,
        PlayerPosition.NORTH,
        PlayerPosition.EAST,
      ];

      const scored = positions.map((pos) => {
        const score = gameState.cumulativeScores[pos] ?? 0;
        let totalTricks = 0;
        for (const round of gameState.roundScores) {
          const ps = round.scores ? round.scores[pos] : undefined;
          if (ps) totalTricks += ps.tricksWon;
        }
        return { pos, score, totalTricks };
      });

      // Sort by score descending (higher score = better rank)
      scored.sort((a, b) => b.score - a.score);

      const playerResults = scored.map((item, idx) => ({
        seat: item.pos,
        finalScore: item.score,
        tricksWon: item.totalTricks,
        finalRank: idx + 1,
      }));

      await this.matchRepo!.completeMatch({
        matchId,
        finishedAt: new Date(),
        playerResults,
      });

      console.log(`[PersistenceService] Persisted match completion: ${matchId}`);
    });
  }

  public async getPlayerProfileDashboard(anonymousClientId: string, limit: number = 20, offset: number = 0): Promise<any> {
    if (!this.isAvailable()) {
      return {
        profile: null,
        stats: { totalMatches: 0, wins: 0, losses: 0, winRate: 0, totalScore: 0, avgScore: 0, bestScore: 0, totalTricks: 0, avgTricks: 0 },
        matches: [],
        enabled: false,
      };
    }

    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return null;

    const profile = await this.playerRepo!.findByAnonymousId(cleanAnonId);
    if (!profile) {
      return {
        profile: { anonymous_client_id: cleanAnonId, display_name: 'Player', created_at: new Date() },
        stats: { totalMatches: 0, wins: 0, losses: 0, winRate: 0, totalScore: 0, avgScore: 0, bestScore: 0, totalTricks: 0, avgTricks: 0 },
        matches: [],
        enabled: true,
      };
    }

    const stats = await this.matchRepo!.getPlayerStatistics(profile.player_id);
    const matches = await this.matchRepo!.getPlayerMatches(profile.player_id, limit, offset);

    const losses = Math.max(0, stats.totalMatches - stats.wins);
    const winRate = stats.totalMatches > 0 ? Number(((stats.wins / stats.totalMatches) * 100).toFixed(1)) : 0;

    return {
      profile,
      stats: {
        totalMatches: stats.totalMatches,
        wins: stats.wins,
        losses,
        winRate,
        totalScore: stats.totalScore,
        avgScore: stats.totalMatches > 0 ? Number((stats.totalScore / stats.totalMatches).toFixed(1)) : 0,
        bestScore: stats.bestScore,
        totalTricks: stats.totalTricks,
        avgTricks: stats.totalMatches > 0 ? Number((stats.totalTricks / stats.totalMatches).toFixed(1)) : 0,
      },
      matches,
      enabled: true,
    };
  }

  public async getMatchScorecardDetails(anonymousClientId: string, matchId: string): Promise<any> {
    if (!this.isAvailable()) return null;
    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return null;

    const profile = await this.playerRepo!.findByAnonymousId(cleanAnonId);
    if (!profile) return null;

    const match = await this.matchRepo!.getMatchById(matchId);
    if (!match) return null;

    const players = await this.matchRepo!.getMatchPlayers(matchId);
    const participant = players.find(p => p.player_id === profile.player_id);
    if (!participant) {
      // Security: player didn't participate in this match
      return null;
    }

    const rounds = await this.roundRepo!.getMatchRoundsFull(matchId);

    return {
      match,
      players,
      rounds,
    };
  }

  public async getGlobalLeaderboard(
    category: LeaderboardCategory = 'overall',
    timeframe: LeaderboardTimeframe = 'all',
    limit: number = 20,
    offset: number = 0,
    anonymousClientId?: string | null
  ): Promise<LeaderboardResponseDTO> {
    if (!this.isAvailable()) {
      return {
        category,
        timeframe,
        items: [],
        totalCount: 0,
        limit,
        offset,
        self: null,
      };
    }

    let callerPlayerId: string | null = null;
    if (anonymousClientId && anonymousClientId.trim()) {
      const profile = await this.playerRepo!.findByAnonymousId(anonymousClientId.trim());
      if (profile) {
        callerPlayerId = profile.player_id;
      }
    }

    return await this.matchRepo!.getGlobalLeaderboard(category, timeframe, limit, offset, callerPlayerId);
  }

  public async getTopWins(
    timeframe: LeaderboardTimeframe = 'all',
    limit: number = 20,
    offset: number = 0
  ): Promise<TopWinItemDTO[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return await this.matchRepo!.getTopWins(timeframe, limit, offset);
  }

  public async getPlayerAchievements(anonymousClientId: string): Promise<AchievementDTO[]> {
    if (!this.isAvailable()) {
      return [];
    }
    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return [];

    const profile = await this.playerRepo!.findByAnonymousId(cleanAnonId);
    if (!profile) {
      return [];
    }

    return await this.matchRepo!.getPlayerAchievements(profile.player_id);
  }

  /**
   * Enqueues an asynchronous persistence job.
   * If a transient failure occurs, keeps going without crashing the engine.
   */
  private enqueue(job: () => Promise<void>): void {
    if (this.pendingQueue.length >= this.MAX_QUEUE_SIZE) {
      console.warn('[PersistenceService] Pending queue full; dropping oldest job');
      this.pendingQueue.shift();
    }

    this.pendingQueue.push(job);
    this.drainQueue();
  }

  private isDraining = false;
  private async drainQueue(): Promise<void> {
    if (this.isDraining) return;
    this.isDraining = true;

    while (this.pendingQueue.length > 0) {
      const job = this.pendingQueue.shift();
      if (!job) break;
      try {
        await job();
      } catch (err: any) {
        console.error('[PersistenceService] Persistence job failed:', err.message);
      }
    }

    this.isDraining = false;
  }
}
