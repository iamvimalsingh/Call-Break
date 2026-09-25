/**
 * Match Repository
 * Handles persistent lifecycle of Call Break matches and seated participants.
 * Fully transactional and idempotent.
 */

import { Pool } from 'pg';
import {
  CreateMatchDTO,
  CompleteMatchDTO,
  MatchRecord,
  MatchPlayerRecord,
  LeaderboardCategory,
  LeaderboardTimeframe,
  LeaderboardItemDTO,
  LeaderboardResponseDTO,
  TopWinItemDTO,
  AchievementDTO,
} from '../types';

export class MatchRepository {
  constructor(private pool: Pool) {}

  /**
   * Persists a newly started match and its seated players.
   * Idempotent: if match_id already exists, ignores duplicate creation.
   */
  public async createMatch(dto: CreateMatchDTO): Promise<MatchRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert Match Header
      const matchQuery = `
        INSERT INTO matches (match_id, game_type, room_code, total_rounds, status, started_at, created_at)
        VALUES ($1, 'CALL_BREAK', $2, $3, 'IN_PROGRESS', NOW(), NOW())
        ON CONFLICT (match_id) DO NOTHING
        RETURNING match_id, game_type, room_code, total_rounds, status, started_at, finished_at, created_at;
      `;
      const matchResult = await client.query(matchQuery, [
        dto.matchId,
        dto.roomCode,
        dto.totalRounds,
      ]);

      // 2. Insert Seated Participants
      for (const p of dto.players) {
        const playerQuery = `
          INSERT INTO match_players (match_id, player_id, seat, is_host, is_bot, tricks_won)
          VALUES ($1, $2, $3, $4, $5, 0)
          ON CONFLICT (match_id, seat) DO NOTHING;
        `;
        await client.query(playerQuery, [
          dto.matchId,
          p.playerId || null,
          p.seat,
          p.isHost,
          p.isBot,
        ]);
      }

      await client.query('COMMIT');

      if (matchResult.rows.length > 0) {
        return matchResult.rows[0];
      }

      // If already existed, return current state
      const existing = await this.getMatchById(dto.matchId);
      return existing!;
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to create persistent match record: ${err.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Completes a match by recording final scores, tricks, and ranking.
   * Idempotent: multiple calls update final records safely without duplicating rows.
   */
  public async completeMatch(dto: CompleteMatchDTO): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Mark Match as FINISHED
      const updateMatchQuery = `
        UPDATE matches
        SET status = 'FINISHED',
            finished_at = COALESCE($2, NOW())
        WHERE match_id = $1 AND status <> 'FINISHED';
      `;
      await client.query(updateMatchQuery, [dto.matchId, dto.finishedAt || null]);

      // 2. Update Final Player Scores, Tricks, and Rank
      for (const res of dto.playerResults) {
        const updatePlayerQuery = `
          UPDATE match_players
          SET final_score = $3,
              tricks_won = $4,
              final_rank = $5
          WHERE match_id = $1 AND seat = $2;
        `;
        await client.query(updatePlayerQuery, [
          dto.matchId,
          res.seat,
          res.finalScore,
          res.tricksWon,
          res.finalRank,
        ]);
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to complete persistent match record: ${err.message}`);
    } finally {
      client.release();
    }
  }

  public async getMatchById(matchId: string): Promise<MatchRecord | null> {
    const query = `
      SELECT match_id, game_type, room_code, total_rounds, status, started_at, finished_at, created_at
      FROM matches
      WHERE match_id = $1;
    `;
    const result = await this.pool.query(query, [matchId]);
    return result.rows[0] || null;
  }

  public async getMatchPlayers(matchId: string): Promise<MatchPlayerRecord[]> {
    const query = `
      SELECT match_id, player_id, seat, is_host, is_bot, final_score, tricks_won, final_rank
      FROM match_players
      WHERE match_id = $1
      ORDER BY seat ASC;
    `;
    const result = await this.pool.query(query, [matchId]);
    return result.rows;
  }

  public async getPlayerStatistics(playerId: string): Promise<{
    totalMatches: number;
    wins: number;
    totalScore: number;
    avgScore: number;
    bestScore: number;
    totalTricks: number;
    avgTricks: number;
  }> {
    const query = `
      SELECT
        COUNT(m.match_id) AS total_matches,
        SUM(CASE WHEN mp.final_rank = 1 THEN 1 ELSE 0 END) AS wins,
        SUM(mp.final_score) AS total_score,
        AVG(mp.final_score) AS avg_score,
        MAX(mp.final_score) AS best_score,
        SUM(mp.tricks_won) AS total_tricks,
        AVG(mp.tricks_won) AS avg_tricks
      FROM match_players mp
      JOIN matches m ON mp.match_id = m.match_id
      WHERE mp.player_id = $1 AND m.status = 'FINISHED';
    `;
    const result = await this.pool.query(query, [playerId]);
    const row = result.rows[0] || {};
    return {
      totalMatches: Number(row.total_matches || 0),
      wins: Number(row.wins || 0),
      totalScore: Number(row.total_score || 0),
      avgScore: Number(row.avg_score || 0),
      bestScore: Number(row.best_score || 0),
      totalTricks: Number(row.total_tricks || 0),
      avgTricks: Number(row.avg_tricks || 0),
    };
  }

  public async getPlayerMatches(playerId: string, limit: number = 20, offset: number = 0): Promise<Array<{
    match: MatchRecord;
    playerRecord: MatchPlayerRecord;
    participants: MatchPlayerRecord[];
  }>> {
    const matchQuery = `
      SELECT m.match_id, m.game_type, m.room_code, m.total_rounds, m.status, m.started_at, m.finished_at, m.created_at
      FROM matches m
      JOIN match_players mp ON m.match_id = mp.match_id
      WHERE mp.player_id = $1 AND m.status = 'FINISHED'
      ORDER BY m.finished_at DESC NULLS LAST, m.started_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const matchResult = await this.pool.query(matchQuery, [playerId, limit, offset]);
    const matchesList = matchResult.rows;

    const detailedMatches = [];
    for (const m of matchesList) {
      const players = await this.getMatchPlayers(m.match_id);
      const playerRecord = players.find(p => p.player_id === playerId) || players[0];
      detailedMatches.push({
        match: m,
        playerRecord,
        participants: players,
      });
    }
    return detailedMatches;
  }

  public async getGlobalLeaderboard(
    category: LeaderboardCategory = 'overall',
    timeframe: LeaderboardTimeframe = 'all',
    limit: number = 20,
    offset: number = 0,
    callerPlayerId?: string | null
  ): Promise<LeaderboardResponseDTO> {
    const validLimit = Math.max(1, Math.min(limit, 100));
    const validOffset = Math.max(0, offset);

    let timeFilterSql = '1=1';
    if (timeframe === 'monthly') {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '30 days')";
    } else if (timeframe === 'weekly') {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '7 days')";
    }

    let havingClause = '';
    if (category === 'win_rate') {
      const minGames = timeframe === 'all' ? 2 : 1;
      havingClause = `HAVING COUNT(m.match_id) >= ${minGames}`;
    }

    let orderBySql = 'overall_score DESC, wins DESC, avg_score DESC, p.player_id ASC';
    if (category === 'wins') {
      orderBySql = 'wins DESC, avg_score DESC, total_matches ASC, p.player_id ASC';
    } else if (category === 'win_rate') {
      orderBySql = 'win_rate DESC, wins DESC, avg_score DESC, p.player_id ASC';
    } else if (category === 'score') {
      orderBySql = 'best_score DESC, avg_score DESC, wins DESC, p.player_id ASC';
    } else if (category === 'tricks') {
      orderBySql = 'total_tricks DESC, avg_tricks DESC, wins DESC, p.player_id ASC';
    }

    const query = `
      WITH aggregated AS (
        SELECT
          p.player_id,
          p.display_name,
          COUNT(m.match_id)::int AS total_matches,
          SUM(CASE WHEN mp.final_rank = 1 THEN 1 ELSE 0 END)::int AS wins,
          SUM(CASE WHEN mp.final_rank > 1 THEN 1 ELSE 0 END)::int AS losses,
          ROUND(COALESCE(SUM(mp.final_score), 0), 1)::float AS total_score,
          ROUND(COALESCE(AVG(mp.final_score), 0), 1)::float AS avg_score,
          ROUND(COALESCE(MAX(mp.final_score), 0), 1)::float AS best_score,
          SUM(mp.tricks_won)::int AS total_tricks,
          ROUND(COALESCE(AVG(mp.tricks_won), 0), 1)::float AS avg_tricks,
          ROUND((SUM(CASE WHEN mp.final_rank = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(m.match_id), 0)) * 100.0, 1)::float AS win_rate,
          ROUND(((SUM(CASE WHEN mp.final_rank = 1 THEN 1 ELSE 0 END) * 10) + COALESCE(SUM(mp.final_score), 0) + (SUM(mp.tricks_won) * 0.5)), 1)::float AS overall_score
        FROM player_profiles p
        JOIN match_players mp ON p.player_id = mp.player_id
        JOIN matches m ON mp.match_id = m.match_id
        WHERE m.status = 'FINISHED' AND ${timeFilterSql}
        GROUP BY p.player_id, p.display_name
        ${havingClause}
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY ${orderBySql})::int AS rank
        FROM aggregated
      )
      SELECT * FROM ranked
      ORDER BY rank ASC;
    `;

    const result = await this.pool.query(query);
    const allRows = result.rows || [];
    const totalCount = allRows.length;

    const pageRows = allRows.slice(validOffset, validOffset + validLimit);

    const items: LeaderboardItemDTO[] = pageRows.map((r: any) => ({
      rank: Number(r.rank),
      displayName: String(r.display_name || 'Player'),
      totalMatches: Number(r.total_matches || 0),
      wins: Number(r.wins || 0),
      losses: Number(r.losses || 0),
      winRate: Number(r.win_rate || 0),
      totalScore: Number(r.total_score || 0),
      avgScore: Number(r.avg_score || 0),
      bestScore: Number(r.best_score || 0),
      totalTricks: Number(r.total_tricks || 0),
      avgTricks: Number(r.avg_tricks || 0),
      overallScore: Number(r.overall_score || 0),
      isCurrentPlayer: callerPlayerId ? r.player_id === callerPlayerId : false,
    }));

    let selfData: { rank: number | null; entry: LeaderboardItemDTO | null } | null = null;
    if (callerPlayerId) {
      const selfRow = allRows.find((r: any) => r.player_id === callerPlayerId);
      if (selfRow) {
        selfData = {
          rank: Number(selfRow.rank),
          entry: {
            rank: Number(selfRow.rank),
            displayName: String(selfRow.display_name || 'Player'),
            totalMatches: Number(selfRow.total_matches || 0),
            wins: Number(selfRow.wins || 0),
            losses: Number(selfRow.losses || 0),
            winRate: Number(selfRow.win_rate || 0),
            totalScore: Number(selfRow.total_score || 0),
            avgScore: Number(selfRow.avg_score || 0),
            bestScore: Number(selfRow.best_score || 0),
            totalTricks: Number(selfRow.total_tricks || 0),
            avgTricks: Number(selfRow.avg_tricks || 0),
            overallScore: Number(selfRow.overall_score || 0),
            isCurrentPlayer: true,
          },
        };
      }
    }

    return {
      category,
      timeframe,
      items,
      totalCount,
      limit: validLimit,
      offset: validOffset,
      self: selfData,
    };
  }

  public async getTopWins(
    timeframe: LeaderboardTimeframe = 'all',
    limit: number = 20,
    offset: number = 0
  ): Promise<TopWinItemDTO[]> {
    const validLimit = Math.max(1, Math.min(limit, 50));
    const validOffset = Math.max(0, offset);

    let timeFilterSql = '1=1';
    if (timeframe === 'monthly') {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '30 days')";
    } else if (timeframe === 'weekly') {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '7 days')";
    }

    const query = `
      SELECT
        m.match_id,
        m.room_code,
        m.game_type,
        m.total_rounds,
        m.finished_at,
        mp.seat AS winner_seat,
        p.display_name AS winner_name,
        mp.final_score::float AS final_score,
        mp.tricks_won::int AS tricks_won,
        ROUND((mp.final_score - COALESCE((
          SELECT MAX(mp2.final_score)
          FROM match_players mp2
          WHERE mp2.match_id = m.match_id AND mp2.seat != mp.seat
        ), 0)), 1)::float AS winning_margin
      FROM matches m
      JOIN match_players mp ON m.match_id = mp.match_id
      JOIN player_profiles p ON mp.player_id = p.player_id
      WHERE m.status = 'FINISHED'
        AND mp.final_rank = 1
        AND ${timeFilterSql}
      ORDER BY mp.final_score DESC, winning_margin DESC, m.finished_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await this.pool.query(query, [validLimit, validOffset]);
    const topWinsList = result.rows || [];

    const detailedWins: TopWinItemDTO[] = [];
    for (const row of topWinsList) {
      const players = await this.getMatchPlayers(row.match_id);
      const participants = players.map((p) => ({
        seat: p.seat,
        displayName: p.is_bot ? `Bot ${p.seat}` : (p.seat === row.winner_seat ? row.winner_name : `Player ${p.seat}`),
        isBot: p.is_bot,
        finalScore: Number(p.final_score || 0),
        finalRank: Number(p.final_rank || 0),
      }));

      detailedWins.push({
        matchId: row.match_id,
        roomCode: row.room_code,
        gameType: row.game_type,
        totalRounds: Number(row.total_rounds || 5),
        finishedAt: row.finished_at,
        winnerSeat: row.winner_seat,
        winnerName: row.winner_name || 'Champion',
        finalScore: Number(row.final_score || 0),
        winningMargin: Number(row.winning_margin || 0),
        tricksWon: Number(row.tricks_won || 0),
        participants,
      });
    }

    return detailedWins;
  }

  public async getPlayerAchievements(playerId: string): Promise<AchievementDTO[]> {
    const stats = await this.getPlayerStatistics(playerId);
    const matches = await this.getPlayerMatches(playerId, 100, 0);

    const winRate = stats.totalMatches > 0 ? (stats.wins / stats.totalMatches) * 100 : 0;
    const maxSingleMatchTricks = matches.reduce((max, m) => Math.max(max, m.playerRecord?.tricks_won || 0), 0);
    const flawlessMatch = matches.some((m) => m.playerRecord?.final_rank === 1 && (m.playerRecord?.final_score || 0) >= 20);

    const achievements: AchievementDTO[] = [
      {
        id: 'FIRST_VICTORY',
        title: 'First Victory',
        description: 'Win your first Call Break match',
        category: 'wins',
        unlocked: stats.wins >= 1,
        progress: Math.min(stats.wins, 1),
        maxProgress: 1,
      },
      {
        id: 'BRONZE_CHAMPION',
        title: 'Bronze Champion',
        description: 'Win 5 completed matches',
        category: 'wins',
        unlocked: stats.wins >= 5,
        progress: Math.min(stats.wins, 5),
        maxProgress: 5,
      },
      {
        id: 'SILVER_CHAMPION',
        title: 'Silver Champion',
        description: 'Win 10 completed matches',
        category: 'wins',
        unlocked: stats.wins >= 10,
        progress: Math.min(stats.wins, 10),
        maxProgress: 10,
      },
      {
        id: 'GOLD_CHAMPION',
        title: 'Gold Champion',
        description: 'Win 25 completed matches',
        category: 'wins',
        unlocked: stats.wins >= 25,
        progress: Math.min(stats.wins, 25),
        maxProgress: 25,
      },
      {
        id: 'HIGH_ROLLER',
        title: 'High Roller',
        description: 'Score 25+ points in a single match',
        category: 'score',
        unlocked: stats.bestScore >= 25,
        progress: Math.min(stats.bestScore, 25),
        maxProgress: 25,
      },
      {
        id: 'CENTURION',
        title: 'Centurion',
        description: 'Score 30+ points in a single match',
        category: 'score',
        unlocked: stats.bestScore >= 30,
        progress: Math.min(stats.bestScore, 30),
        maxProgress: 30,
      },
      {
        id: 'TRICK_TACTICIAN',
        title: 'Trick Tactician',
        description: 'Win 10+ tricks in a single match',
        category: 'mastery',
        unlocked: maxSingleMatchTricks >= 10,
        progress: Math.min(maxSingleMatchTricks, 10),
        maxProgress: 10,
      },
      {
        id: 'MATCH_VETERAN',
        title: 'Match Veteran',
        description: 'Complete 10 total matches',
        category: 'experience',
        unlocked: stats.totalMatches >= 10,
        progress: Math.min(stats.totalMatches, 10),
        maxProgress: 10,
      },
      {
        id: 'CALLBREAK_LEGEND',
        title: 'Call Break Legend',
        description: 'Win 5+ matches with a 50%+ win rate',
        category: 'mastery',
        unlocked: stats.wins >= 5 && winRate >= 50,
        progress: Math.min(stats.wins, 5),
        maxProgress: 5,
      },
      {
        id: 'SHARPSHOOTER',
        title: 'Sharpshooter',
        description: 'Win a match with 20+ final points',
        category: 'mastery',
        unlocked: flawlessMatch,
        progress: flawlessMatch ? 1 : 0,
        maxProgress: 1,
      },
    ];

    return achievements;
  }
}
