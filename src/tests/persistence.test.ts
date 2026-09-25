/**
 * Persistence & PostgreSQL Foundation Test Suite
 * Validates:
 * 1. DATABASE_URL absent -> application starts and gameplay functions seamlessly in RAM
 * 2. DATABASE_URL absent -> PersistenceService degrades cleanly without error
 * 3. Player profile creation is idempotent
 * 4. Same anonymous_client_id maps to one persistent profile
 * 5. Match creation is persisted once
 * 6. Match players are persisted correctly with seats
 * 7. Round result persistence is correct
 * 8. Match completion is idempotent
 * 9. Duplicate completion does not duplicate records
 * 10. Persistence failure does not crash gameplay or match controller
 * 11. Foreign keys / uniqueness behave correctly
 * 12. No browser bundle contains database credentials or server DB modules
 */

import { TestHarness } from './testHarness';
import { PersistenceService } from '../../server/src/db/PersistenceService';
import { PlayerRepository } from '../../server/src/db/repositories/PlayerRepository';
import { MatchRepository } from '../../server/src/db/repositories/MatchRepository';
import { RoundRepository } from '../../server/src/db/repositories/RoundRepository';
import { isDatabaseConfigured, getDbPool } from '../../server/src/db/dbPool';
import { PlayerPosition } from '../models/player';
import { RoomManager } from '../../server/src/RoomManager';
import fs from 'fs';
import path from 'path';

/**
 * In-memory Mock PostgreSQL Pool for hermetic testing of SQL queries and constraints
 */
class MockPgPool {
  public tables = {
    player_profiles: new Map<string, any>(),
    matches: new Map<string, any>(),
    match_players: new Map<string, any>(),
    match_rounds: new Map<string, any>(),
    match_round_players: new Map<string, any>(),
    schema_migrations: new Map<string, any>(),
  };

  public async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = sql.trim();

    // 1. Transactions
    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }

    // 2. Health check
    if (trimmed === 'SELECT 1') {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }

    // 3. Player Profiles INSERT with ON CONFLICT
    if (trimmed.includes('INSERT INTO player_profiles')) {
      const [newId, anonId, displayName] = params;
      let existing = Array.from(this.tables.player_profiles.values()).find(
        (p) => p.anonymous_client_id === anonId
      );

      if (existing) {
        if (displayName && displayName !== existing.display_name) {
          existing.display_name = displayName;
          existing.updated_at = new Date();
        }
        return { rows: [existing], rowCount: 1 };
      }

      const record = {
        player_id: newId,
        anonymous_client_id: anonId,
        display_name: displayName,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.tables.player_profiles.set(newId, record);
      return { rows: [record], rowCount: 1 };
    }

    // 4. Player Profiles SELECT by anonymous_client_id
    if (trimmed.includes('FROM player_profiles') && trimmed.includes('WHERE anonymous_client_id = $1')) {
      const anonId = params[0];
      const match = Array.from(this.tables.player_profiles.values()).find(
        (p) => p.anonymous_client_id === anonId
      );
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // 5. Matches INSERT with ON CONFLICT
    if (trimmed.includes('INSERT INTO matches')) {
      const [matchId, roomCode, totalRounds] = params;
      if (this.tables.matches.has(matchId)) {
        return { rows: [], rowCount: 0 };
      }
      const record = {
        match_id: matchId,
        game_type: 'CALL_BREAK',
        room_code: roomCode,
        total_rounds: totalRounds,
        status: 'IN_PROGRESS',
        started_at: new Date(),
        finished_at: null,
        created_at: new Date(),
      };
      this.tables.matches.set(matchId, record);
      return { rows: [record], rowCount: 1 };
    }

    // 6. Match Players INSERT with ON CONFLICT
    if (trimmed.includes('INSERT INTO match_players')) {
      const [matchId, playerId, seat, isHost, isBot] = params;
      const key = `${matchId}_${seat}`;
      if (this.tables.match_players.has(key)) {
        return { rows: [], rowCount: 0 };
      }
      const record = {
        match_id: matchId,
        player_id: playerId || null,
        seat,
        is_host: Boolean(isHost),
        is_bot: Boolean(isBot),
        final_score: null,
        tricks_won: 0,
        final_rank: null,
      };
      this.tables.match_players.set(key, record);
      return { rows: [record], rowCount: 1 };
    }

    // 7. Complete Match: UPDATE matches
    if (trimmed.includes('UPDATE matches') && trimmed.includes("SET status = 'FINISHED'")) {
      const [matchId, finishedAt] = params;
      const match = this.tables.matches.get(matchId);
      if (match) {
        match.status = 'FINISHED';
        match.finished_at = finishedAt || new Date();
      }
      return { rows: [], rowCount: match ? 1 : 0 };
    }

    // 8. Complete Match: UPDATE match_players
    if (trimmed.includes('UPDATE match_players') && trimmed.includes('SET final_score = $3')) {
      const [matchId, seat, finalScore, tricksWon, finalRank] = params;
      const key = `${matchId}_${seat}`;
      const mp = this.tables.match_players.get(key);
      if (mp) {
        mp.final_score = finalScore;
        mp.tricks_won = tricksWon;
        mp.final_rank = finalRank;
      }
      return { rows: [], rowCount: mp ? 1 : 0 };
    }

    // 9. Match Rounds INSERT
    if (trimmed.includes('INSERT INTO match_rounds')) {
      const [matchId, roundNum, dealerSeat] = params;
      const key = `${matchId}_${roundNum}`;
      if (this.tables.match_rounds.has(key)) {
        return { rows: [], rowCount: 0 };
      }
      const record = {
        match_id: matchId,
        round_number: roundNum,
        dealer_seat: dealerSeat,
        created_at: new Date(),
      };
      this.tables.match_rounds.set(key, record);
      return { rows: [record], rowCount: 1 };
    }

    // 10. Match Round Players INSERT with ON CONFLICT
    if (trimmed.includes('INSERT INTO match_round_players')) {
      const [matchId, roundNum, playerId, seat, bid, tricksWon, roundScore] = params;
      const key = `${matchId}_${roundNum}_${seat}`;
      const record = {
        match_id: matchId,
        round_number: roundNum,
        player_id: playerId || null,
        seat,
        bid,
        tricks_won: tricksWon,
        round_score: roundScore,
      };
      this.tables.match_round_players.set(key, record);
      return { rows: [record], rowCount: 1 };
    }

    // 11. SELECT matches by match_id
    if (trimmed.includes('FROM matches') && trimmed.includes('WHERE match_id = $1')) {
      const match = this.tables.matches.get(params[0]) || null;
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // 12. SELECT match_players by match_id
    if (trimmed.includes('FROM match_players') && trimmed.includes('WHERE match_id = $1')) {
      const rows = Array.from(this.tables.match_players.values()).filter(
        (mp) => mp.match_id === params[0]
      );
      return { rows, rowCount: rows.length };
    }

    // 13. SELECT match_rounds by match_id and round_number
    if (trimmed.includes('FROM match_rounds') && trimmed.includes('round_number = $2')) {
      const key = `${params[0]}_${params[1]}`;
      const round = this.tables.match_rounds.get(key) || null;
      return { rows: round ? [round] : [], rowCount: round ? 1 : 0 };
    }

    // 14. SELECT match_round_players by match_id and round_number
    if (trimmed.includes('FROM match_round_players') && trimmed.includes('round_number = $2')) {
      const [matchId, roundNum] = params;
      const rows = Array.from(this.tables.match_round_players.values()).filter(
        (mrp) => mrp.match_id === matchId && mrp.round_number === roundNum
      );
      return { rows, rowCount: rows.length };
    }

    // 15. Migrations table
    if (trimmed.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return { rows: [], rowCount: 0 };
    }
    if (trimmed.includes('SELECT version FROM schema_migrations')) {
      const versions = Array.from(this.tables.schema_migrations.values()).map((v) => ({ version: v.version }));
      return { rows: versions, rowCount: versions.length };
    }
    if (trimmed.includes('INSERT INTO schema_migrations')) {
      const [version, name] = params;
      this.tables.schema_migrations.set(version, { version, name, applied_at: new Date() });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  public async connect(): Promise<any> {
    return {
      query: (sql: string, params?: any[]) => this.query(sql, params),
      release: () => {},
    };
  }
}

export function buildPersistenceTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'PostgreSQL Persistence Foundation';

  // 1. DATABASE_URL absent -> application starts and gameplay remains functional in RAM
  harness.register(category, '1. DATABASE_URL absent: degrades to RAM-only mode without error', () => {
    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      if (isDatabaseConfigured()) {
        throw new Error('isDatabaseConfigured should return false when DATABASE_URL is deleted');
      }
      const pool = getDbPool();
      if (pool !== null) {
        throw new Error('getDbPool should return null when DATABASE_URL is not configured');
      }
      const persistence = PersistenceService.getInstance();
      persistence.reinitialize();
      if (persistence.isAvailable()) {
        throw new Error('PersistenceService should report unavailable when DATABASE_URL is unset');
      }
    } finally {
      process.env.DATABASE_URL = savedUrl;
      PersistenceService.getInstance().reinitialize();
    }
  });

  // 2. DATABASE_URL absent: gameplay engine operates cleanly
  harness.register(category, '2. DATABASE_URL absent: RoomManager runs matches without database', () => {
    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    PersistenceService.getInstance().reinitialize();

    const mockSocket = { readyState: 1, send: () => {}, close: () => {}, on: () => {} } as any;
    const roomManager = RoomManager.getInstance();
    const testCode = 'RAMONLY1';

    try {
      const res = roomManager.createRoom('client_ram_host', 'Host RAM', mockSocket, testCode);
      if (!res.success || !res.room) {
        throw new Error('Room creation should succeed in RAM-only mode');
      }

      // Start match in RAM mode
      const startRes = res.room.startMatch('client_ram_host', true, 5);
      if (!startRes.success) {
        throw new Error('Match start should succeed without database');
      }

      if (res.room.status !== 'PLAYING') {
        throw new Error('Room should be in PLAYING state');
      }
    } finally {
      roomManager.cleanupRoom(testCode);
      process.env.DATABASE_URL = savedUrl;
      PersistenceService.getInstance().reinitialize();
    }
  });

  // 3. Player profile creation is idempotent
  harness.register(category, '3. Player profile creation is idempotent via PlayerRepository', async () => {
    const mockPool = new MockPgPool();
    const playerRepo = new PlayerRepository(mockPool as any);

    const anonId = 'anon_test_client_001';
    const profile1 = await playerRepo.findOrCreateByAnonymousId(anonId, 'Original Name');

    if (!profile1.player_id || profile1.anonymous_client_id !== anonId) {
      throw new Error('Initial profile creation failed');
    }

    const profile2 = await playerRepo.findOrCreateByAnonymousId(anonId, 'Updated Name');

    if (profile2.player_id !== profile1.player_id) {
      throw new Error('Second call must return the SAME player_id for the same anonymous_client_id');
    }
    if (profile2.display_name !== 'Updated Name') {
      throw new Error('Display name should update on second call');
    }
  });

  // 4. Same anonymous_client_id maps to one persistent profile
  harness.register(category, '4. Multiple lookups for same cb_player_id yield single profile record', async () => {
    const mockPool = new MockPgPool();
    const playerRepo = new PlayerRepository(mockPool as any);

    const anonId = 'cb_player_persistent_999';
    await playerRepo.findOrCreateByAnonymousId(anonId, 'Alice');
    await playerRepo.findOrCreateByAnonymousId(anonId, 'Alice');
    await playerRepo.findOrCreateByAnonymousId(anonId, 'Alice');

    const totalProfiles = mockPool.tables.player_profiles.size;
    if (totalProfiles !== 1) {
      throw new Error(`Expected exactly 1 profile in table, got ${totalProfiles}`);
    }
  });

  // 5. Match creation is persisted once
  harness.register(category, '5. MatchRepository persists match header once', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);

    const matchId = 'm_test_match_100';
    const match = await matchRepo.createMatch({
      matchId,
      roomCode: 'ROOM100',
      totalRounds: 5,
      players: [
        { seat: PlayerPosition.SOUTH, displayName: 'P1', isHost: true, isBot: false },
        { seat: PlayerPosition.WEST, displayName: 'P2', isHost: false, isBot: true },
        { seat: PlayerPosition.NORTH, displayName: 'P3', isHost: false, isBot: true },
        { seat: PlayerPosition.EAST, displayName: 'P4', isHost: false, isBot: true },
      ],
    });

    if (match.match_id !== matchId || match.status !== 'IN_PROGRESS') {
      throw new Error('Match header was not persisted correctly');
    }

    // Call duplicate creation with same matchId
    const dup = await matchRepo.createMatch({
      matchId,
      roomCode: 'ROOM100',
      totalRounds: 5,
      players: [],
    });

    if (dup.match_id !== matchId) {
      throw new Error('Duplicate createMatch should return existing match record');
    }
    if (mockPool.tables.matches.size !== 1) {
      throw new Error('Matches table must contain exactly 1 record');
    }
  });

  // 6. Match players are persisted correctly with seats
  harness.register(category, '6. Match players are persisted with 4 fixed seats and bot flags', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);

    const matchId = 'm_test_players_200';
    await matchRepo.createMatch({
      matchId,
      roomCode: 'ROOM200',
      totalRounds: 5,
      players: [
        { seat: PlayerPosition.SOUTH, displayName: 'Alice', isHost: true, isBot: false },
        { seat: PlayerPosition.WEST, displayName: 'Bob', isHost: false, isBot: false },
        { seat: PlayerPosition.NORTH, displayName: 'Charlie', isHost: false, isBot: false },
        { seat: PlayerPosition.EAST, displayName: 'Bot East', isHost: false, isBot: true },
      ],
    });

    const seated = await matchRepo.getMatchPlayers(matchId);
    if (seated.length !== 4) {
      throw new Error(`Expected 4 seated players, got ${seated.length}`);
    }

    const south = seated.find((s) => s.seat === PlayerPosition.SOUTH);
    const east = seated.find((s) => s.seat === PlayerPosition.EAST);

    if (!south || !south.is_host || south.is_bot) {
      throw new Error('SOUTH seat must be Host and not Bot');
    }
    if (!east || !east.is_bot || east.is_host) {
      throw new Error('EAST seat must be Bot and not Host');
    }
  });

  // 7. Round result persistence is correct
  harness.register(category, '7. RoundRepository records round header and player scores', async () => {
    const mockPool = new MockPgPool();
    const roundRepo = new RoundRepository(mockPool as any);

    const matchId = 'm_test_round_300';
    await roundRepo.recordRoundResult({
      matchId,
      roundNumber: 1,
      dealerSeat: PlayerPosition.SOUTH,
      players: [
        { seat: PlayerPosition.SOUTH, bid: 3, tricksWon: 3, roundScore: 3.0 },
        { seat: PlayerPosition.WEST, bid: 2, tricksWon: 2, roundScore: 2.0 },
        { seat: PlayerPosition.NORTH, bid: 4, tricksWon: 3, roundScore: -4.0 },
        { seat: PlayerPosition.EAST, bid: 2, tricksWon: 5, roundScore: 2.3 },
      ],
    });

    const roundHeader = await roundRepo.getRoundHeader(matchId, 1);
    if (!roundHeader || roundHeader.dealer_seat !== PlayerPosition.SOUTH) {
      throw new Error('Round header was not recorded properly');
    }

    const scorecards = await roundRepo.getRoundScorecards(matchId, 1);
    if (scorecards.length !== 4) {
      throw new Error(`Expected 4 scorecards, got ${scorecards.length}`);
    }

    const northScore = scorecards.find((s) => s.seat === PlayerPosition.NORTH);
    if (!northScore || northScore.round_score !== -4.0) {
      throw new Error('North failed bid score (-4.0) not recorded accurately');
    }
  });

  // 8. Match completion is idempotent
  harness.register(category, '8. Match completion updates status and final ranks idempotently', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);

    const matchId = 'm_test_complete_400';
    await matchRepo.createMatch({
      matchId,
      roomCode: 'ROOM400',
      totalRounds: 5,
      players: [
        { seat: PlayerPosition.SOUTH, displayName: 'P1', isHost: true, isBot: false },
        { seat: PlayerPosition.WEST, displayName: 'P2', isHost: false, isBot: true },
        { seat: PlayerPosition.NORTH, displayName: 'P3', isHost: false, isBot: true },
        { seat: PlayerPosition.EAST, displayName: 'P4', isHost: false, isBot: true },
      ],
    });

    const finishDate = new Date();
    await matchRepo.completeMatch({
      matchId,
      finishedAt: finishDate,
      playerResults: [
        { seat: PlayerPosition.SOUTH, finalScore: 12.5, tricksWon: 15, finalRank: 1 },
        { seat: PlayerPosition.WEST, finalScore: 8.2, tricksWon: 11, finalRank: 2 },
        { seat: PlayerPosition.NORTH, finalScore: 5.0, tricksWon: 9, finalRank: 3 },
        { seat: PlayerPosition.EAST, finalScore: -2.0, tricksWon: 7, finalRank: 4 },
      ],
    });

    const match = await matchRepo.getMatchById(matchId);
    if (!match || match.status !== 'FINISHED' || !match.finished_at) {
      throw new Error('Match status should be FINISHED with finished_at populated');
    }

    const players = await matchRepo.getMatchPlayers(matchId);
    const winner = players.find((p) => p.seat === PlayerPosition.SOUTH);
    if (!winner || winner.final_score !== 12.5 || winner.final_rank !== 1) {
      throw new Error('Winner score and rank 1 not persisted');
    }

    // Call duplicate completeMatch with same data
    await matchRepo.completeMatch({
      matchId,
      playerResults: [
        { seat: PlayerPosition.SOUTH, finalScore: 12.5, tricksWon: 15, finalRank: 1 },
      ],
    });

    const matchAfter = await matchRepo.getMatchById(matchId);
    if (matchAfter?.status !== 'FINISHED') {
      throw new Error('Duplicate completeMatch should preserve FINISHED status');
    }
  });

  // 9. Duplicate completion does not duplicate records
  harness.register(category, '9. Duplicate completion calls do not create duplicate match rows', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);

    const matchId = 'm_test_dup_500';
    await matchRepo.createMatch({
      matchId,
      roomCode: 'ROOM500',
      totalRounds: 5,
      players: [
        { seat: PlayerPosition.SOUTH, displayName: 'P1', isHost: true, isBot: false },
      ],
    });

    await matchRepo.completeMatch({
      matchId,
      playerResults: [{ seat: PlayerPosition.SOUTH, finalScore: 10, tricksWon: 10, finalRank: 1 }],
    });
    await matchRepo.completeMatch({
      matchId,
      playerResults: [{ seat: PlayerPosition.SOUTH, finalScore: 10, tricksWon: 10, finalRank: 1 }],
    });

    if (mockPool.tables.matches.size !== 1) {
      throw new Error('Matches table must contain exactly 1 record after duplicate calls');
    }
  });

  // 10. Persistence failure does not crash gameplay
  harness.register(category, '10. Persistence failure does not throw or crash gameplay loop', async () => {
    // Failing mock pool that always throws
    const failingPool = {
      query: async () => {
        throw new Error('Simulated database network timeout');
      },
      connect: async () => {
        throw new Error('Connection refused');
      },
    };

    const persistence = PersistenceService.getInstance();
    (persistence as any).pool = failingPool;
    (persistence as any).playerRepo = new PlayerRepository(failingPool as any);
    (persistence as any).matchRepo = new MatchRepository(failingPool as any);
    (persistence as any).roundRepo = new RoundRepository(failingPool as any);

    // Call match start, round complete, match complete on failing pool
    // Must NOT throw!
    await persistence.onPlayerJoin('client_fail_test', 'Name');
    const matchId = await persistence.onMatchStart('ROOMFAIL', 5, []);
    await persistence.onRoundComplete(
      matchId || 'm_fake',
      1,
      PlayerPosition.SOUTH,
      { roundNumber: 1, scores: {} as any },
      { [PlayerPosition.SOUTH]: 3, [PlayerPosition.WEST]: 2, [PlayerPosition.NORTH]: 2, [PlayerPosition.EAST]: 2 },
      { [PlayerPosition.SOUTH]: 3, [PlayerPosition.WEST]: 2, [PlayerPosition.NORTH]: 2, [PlayerPosition.EAST]: 2 },
      []
    );
    await persistence.onMatchComplete(matchId || 'm_fake', {} as any, []);

    // Clean up
    persistence.reinitialize();
  });

  // 11. Foreign keys and uniqueness behave correctly
  harness.register(category, '11. Schema constraints: match_players enforces composite PK (match_id, seat)', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);

    const matchId = 'm_constraint_test_600';
    await matchRepo.createMatch({
      matchId,
      roomCode: 'ROOM600',
      totalRounds: 5,
      players: [
        { seat: PlayerPosition.SOUTH, displayName: 'P1', isHost: true, isBot: false },
        { seat: PlayerPosition.SOUTH, displayName: 'P1 Duplicate', isHost: false, isBot: true },
      ],
    });

    const players = await matchRepo.getMatchPlayers(matchId);
    if (players.length !== 1) {
      throw new Error(`Expected exactly 1 player for SOUTH seat, got ${players.length}`);
    }
  });

  // 12. No browser bundle contains database credentials or server DB modules
  harness.register(category, '12. Browser bundle safety: no database credentials or server DB in src/', () => {
    const clientFiles = fs.readdirSync(path.join(process.cwd(), 'src'), { recursive: true }) as string[];

    for (const file of clientFiles) {
      if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
        if (file.includes('tests') || file.includes('test')) continue;
        const fullPath = path.join(process.cwd(), 'src', file);
        const content = fs.readFileSync(fullPath, 'utf8');

        if (content.includes("from 'pg'") || content.includes('from "pg"')) {
          throw new Error(`SECURITY VIOLATION: Client file ${file} imports 'pg'!`);
        }
        if (content.includes('DATABASE_URL')) {
          throw new Error(`SECURITY VIOLATION: Client file ${file} references DATABASE_URL!`);
        }
      }
    }
  });

  return harness;
}
