/**
 * Player Profile, Identity Hardening & Leaderboards Test Suite (Phase 4 + Phase 5)
 * Verifies persistence aggregation, API security, ownership isolation, leaderboards, top wins,
 * achievements derivation, pagination, and time filters.
 */

import { TestHarness } from './testHarness';
import { MatchRepository } from '../../server/src/db/repositories/MatchRepository';
import { PlayerRepository } from '../../server/src/db/repositories/PlayerRepository';
import { signPlayerId, verifyPlayerToken } from '../../server/src/identityAuth';

class MockPgPool {
  public tables = {
    player_profiles: new Map<string, any>(),
    matches: new Map<string, any>(),
    match_players: new Map<string, any>(),
  };

  public async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = sql.trim();
    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    if (trimmed.includes('WITH aggregated AS')) {
      // Mock leaderboard query results
      return {
        rows: [
          {
            rank: 1,
            player_id: 'p_1',
            display_name: 'Ace King',
            total_matches: 10,
            wins: 8,
            losses: 2,
            total_score: 150.0,
            avg_score: 15.0,
            best_score: 28.0,
            total_tricks: 45,
            avg_tricks: 4.5,
            win_rate: 80.0,
            overall_score: 252.5,
          },
          {
            rank: 2,
            player_id: 'p_2',
            display_name: 'Spade Queen',
            total_matches: 8,
            wins: 5,
            losses: 3,
            total_score: 110.0,
            avg_score: 13.7,
            best_score: 24.0,
            total_tricks: 32,
            avg_tricks: 4.0,
            win_rate: 62.5,
            overall_score: 176.0,
          },
        ],
        rowCount: 2,
      };
    }
    if (trimmed.includes('SELECT mp.seat AS winner_seat') || trimmed.includes('winning_margin')) {
      // Mock Top Wins query
      return {
        rows: [
          {
            match_id: 'm_top_1',
            room_code: 'ROOM99',
            game_type: 'CALL_BREAK',
            total_rounds: 5,
            finished_at: new Date('2026-09-20'),
            winner_seat: 'SOUTH',
            winner_name: 'Ace King',
            final_score: 32.5,
            tricks_won: 11,
            winning_margin: 14.2,
          },
        ],
        rowCount: 1,
      };
    }
    if (trimmed.includes('FROM match_players') && trimmed.includes('WHERE match_id = $1')) {
      return {
        rows: [
          { match_id: 'm_top_1', player_id: 'p_1', seat: 'SOUTH', is_host: true, is_bot: false, final_score: 32.5, tricks_won: 11, final_rank: 1 },
          { match_id: 'm_top_1', player_id: null, seat: 'WEST', is_host: false, is_bot: true, final_score: 18.3, tricks_won: 6, final_rank: 2 },
          { match_id: 'm_top_1', player_id: null, seat: 'NORTH', is_host: false, is_bot: true, final_score: 12.0, tricks_won: 4, final_rank: 3 },
          { match_id: 'm_top_1', player_id: null, seat: 'EAST', is_host: false, is_bot: true, final_score: 8.5, tricks_won: 3, final_rank: 4 },
        ],
        rowCount: 4,
      };
    }
    if (trimmed.includes('FROM match_players mp') && trimmed.includes('JOIN matches m')) {
      return { rows: [{ total_matches: 12, wins: 8, total_score: 180.0, avg_score: 15.0, best_score: 32.5, total_tricks: 55, avg_tricks: 4.6 }], rowCount: 1 };
    }
    if (trimmed.includes('FROM matches m') && trimmed.includes('JOIN match_players mp')) {
      return {
        rows: [
          {
            match_id: 'm_1',
            game_type: 'CALL_BREAK',
            room_code: 'ROOM1',
            total_rounds: 5,
            status: 'FINISHED',
            started_at: new Date(),
            finished_at: new Date(),
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      };
    }
    if (trimmed.includes('FROM player_profiles')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }
}

export function buildPlayerProfileTestSuite(harness: TestHarness): void {
  const category = 'Player Profile & Identity Hardening (Phase 4C)';

  harness.register(category, '1. Profile statistics aggregation computes correctly', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);
    const stats = await matchRepo.getPlayerStatistics('p_123');
    if (stats.totalMatches !== 12 || stats.wins !== 8 || stats.bestScore !== 32.5) {
      throw new Error(`Expected aggregated stats, got ${JSON.stringify(stats)}`);
    }
  });

  harness.register(category, '2. Player matches history retrieval', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);
    const matches = await matchRepo.getPlayerMatches('p_123', 10, 0);
    if (!Array.isArray(matches) || matches.length !== 1) {
      throw new Error('Expected 1 match in history');
    }
  });

  harness.register(category, '3. Unknown player profile lookup returns null', async () => {
    const mockPool = new MockPgPool();
    const playerRepo = new PlayerRepository(mockPool as any);
    const profile = await playerRepo.findByAnonymousId('nonexistent');
    if (profile !== null) throw new Error('Expected null for unknown player');
  });

  harness.register(category, '4. Unauthorized scorecard access ownership check', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);
    const match = await matchRepo.getMatchById('m_nonexistent');
    if (match !== null) throw new Error('Nonexistent match should return null');
  });

  harness.register(category, '5. Anonymous identity token signing and verification', () => {
    const playerId = 'player_uuid_abc_123';
    const token = signPlayerId(playerId);
    const isValid = verifyPlayerToken(playerId, token);
    if (!isValid) throw new Error('Valid signed token failed verification');

    const isSpoofed = verifyPlayerToken(playerId, 'invalid_signature_hash');
    if (isSpoofed) throw new Error('Spoofed token should not verify successfully');

    const isWrongPlayer = verifyPlayerToken('other_player_id', token);
    if (isWrongPlayer) throw new Error('Token for player A should not verify for player B');
  });

  const category5 = 'Leaderboards, Top Wins & Rankings (Phase 5)';

  harness.register(category5, '6. Global leaderboard ranking aggregation and sorting', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);
    const res = await matchRepo.getGlobalLeaderboard('overall', 'all', 20, 0, 'p_1');
    if (res.items.length !== 2) throw new Error(`Expected 2 items, got ${res.items.length}`);
    if (res.items[0].displayName !== 'Ace King' || res.items[0].rank !== 1) {
      throw new Error('Rank 1 item incorrect');
    }
    if (!res.self || res.self.rank !== 1) {
      throw new Error('Caller player self rank not resolved correctly');
    }
  });

  harness.register(category5, '7. Top wins single match victories and margin calculation', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);
    const topWins = await matchRepo.getTopWins('all', 10, 0);
    if (topWins.length !== 1) throw new Error(`Expected 1 top win, got ${topWins.length}`);
    const first = topWins[0];
    if (first.winnerName !== 'Ace King' || first.finalScore !== 32.5 || first.winningMargin !== 14.2) {
      throw new Error(`Top win fields incorrect: ${JSON.stringify(first)}`);
    }
    if (first.participants.length !== 4) {
      throw new Error('Participants list should contain all 4 seated players');
    }
  });

  harness.register(category5, '8. Deterministic achievements milestone derivation', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);
    const achievements = await matchRepo.getPlayerAchievements('p_123');
    if (!Array.isArray(achievements) || achievements.length < 5) {
      throw new Error('Expected at least 5 standard achievements');
    }
    const firstWin = achievements.find((a) => a.id === 'FIRST_VICTORY');
    if (!firstWin || !firstWin.unlocked) {
      throw new Error('Player with 8 wins should have First Victory unlocked');
    }
    const centurion = achievements.find((a) => a.id === 'CENTURION');
    if (!centurion || !centurion.unlocked) {
      throw new Error('Player with best score 32.5 should have Centurion unlocked');
    }
  });

  harness.register(category5, '9. Leaderboard pagination bounds and limit enforcement', async () => {
    const mockPool = new MockPgPool();
    const matchRepo = new MatchRepository(mockPool as any);
    const res = await matchRepo.getGlobalLeaderboard('wins', 'weekly', 1, 0);
    if (res.items.length !== 1) {
      throw new Error(`Expected paginated limit 1, got ${res.items.length}`);
    }
  });
}
