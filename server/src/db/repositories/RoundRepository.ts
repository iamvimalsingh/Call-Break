/**
 * Round Repository
 * Persists authoritative round scorecards and bids.
 * Idempotent: safe against duplicate round-end notifications.
 */

import { Pool } from 'pg';
import { RecordRoundDTO, MatchRoundRecord, MatchRoundPlayerRecord } from '../types';

export class RoundRepository {
  constructor(private pool: Pool) {}

  /**
   * Persists an authoritative round outcome and individual player scorecards.
   * Idempotent: ignores duplicates if the same round result is delivered twice.
   */
  public async recordRoundResult(dto: RecordRoundDTO): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert Round Header
      const roundQuery = `
        INSERT INTO match_rounds (match_id, round_number, dealer_seat, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (match_id, round_number) DO NOTHING;
      `;
      await client.query(roundQuery, [dto.matchId, dto.roundNumber, dto.dealerSeat]);

      // 2. Insert Round Player Scorecards
      for (const p of dto.players) {
        const roundPlayerQuery = `
          INSERT INTO match_round_players (match_id, round_number, player_id, seat, bid, tricks_won, round_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (match_id, round_number, seat)
          DO UPDATE SET
            bid = EXCLUDED.bid,
            tricks_won = EXCLUDED.tricks_won,
            round_score = EXCLUDED.round_score;
        `;
        await client.query(roundPlayerQuery, [
          dto.matchId,
          dto.roundNumber,
          p.playerId || null,
          p.seat,
          p.bid,
          p.tricksWon,
          p.roundScore,
        ]);
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to record persistent round result: ${err.message}`);
    } finally {
      client.release();
    }
  }

  public async getRoundHeader(matchId: string, roundNumber: number): Promise<MatchRoundRecord | null> {
    const query = `
      SELECT match_id, round_number, dealer_seat, created_at
      FROM match_rounds
      WHERE match_id = $1 AND round_number = $2;
    `;
    const result = await this.pool.query(query, [matchId, roundNumber]);
    return result.rows[0] || null;
  }

  public async getRoundScorecards(matchId: string, roundNumber: number): Promise<MatchRoundPlayerRecord[]> {
    const query = `
      SELECT match_id, round_number, player_id, seat, bid, tricks_won, round_score
      FROM match_round_players
      WHERE match_id = $1 AND round_number = $2
      ORDER BY seat ASC;
    `;
    const result = await this.pool.query(query, [matchId, roundNumber]);
    return result.rows;
  }

  public async getMatchRoundsFull(matchId: string): Promise<Array<{
    roundNumber: number;
    dealerSeat: string;
    createdAt: Date;
    scorecards: MatchRoundPlayerRecord[];
  }>> {
    const roundsQuery = `
      SELECT match_id, round_number, dealer_seat, created_at
      FROM match_rounds
      WHERE match_id = $1
      ORDER BY round_number ASC;
    `;
    const roundsResult = await this.pool.query(roundsQuery, [matchId]);
    const rounds = roundsResult.rows;

    const result = [];
    for (const r of rounds) {
      const scorecards = await this.getRoundScorecards(matchId, r.round_number);
      result.push({
        roundNumber: r.round_number,
        dealerSeat: r.dealer_seat,
        createdAt: r.created_at,
        scorecards,
      });
    }
    return result;
  }
}
