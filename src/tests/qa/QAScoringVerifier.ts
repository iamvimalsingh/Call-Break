/**
 * QA Independent Scoring Verifier
 * Calculates and validates round and match scores independently from the production ScoringEngine.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { GameState, RoundScoreRecord, MatchResult } from '../../models/gameState';
import { InvariantViolation } from './QATypes';

export class QAScoringVerifier {
  /**
   * Independently computes expected player score for a round.
   * Call Break rule:
   * - If tricksWon >= bid: score = bid + (tricksWon - bid) * 0.1
   * - If tricksWon < bid: score = -bid
   */
  public static calculateExpectedPlayerScore(bid: number, tricksWon: number): number {
    if (tricksWon >= bid) {
      const overtricks = tricksWon - bid;
      return Math.round((bid + overtricks * 0.1) * 10) / 10;
    } else {
      return -bid;
    }
  }

  /**
   * Validates a RoundScoreRecord and cumulative score progression against expected math.
   */
  public static verifyRoundScoring(
    stateBeforeScoring: GameState,
    record: RoundScoreRecord,
    updatedCumulativeScores: Record<PlayerPosition, number>,
    previousCumulativeScores: Record<PlayerPosition, number>
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const pState = stateBeforeScoring.players[pos];
      const bid = pState.currentBid ?? 1;
      const tricksWon = pState.tricksWon;

      const expectedScore = this.calculateExpectedPlayerScore(bid, tricksWon);
      const actualScore = record.scores[pos].roundScore;

      if (Math.abs(actualScore - expectedScore) > 0.001) {
        violations.push({
          category: 'SCORING_CONSISTENCY',
          message: `Player ${pos} round score mismatch: expected ${expectedScore} (bid=${bid}, tricks=${tricksWon}), got ${actualScore}`,
          playerPosition: pos,
          round: record.roundNumber,
        });
      }

      // Check cumulative score
      const expectedCumulative =
        Math.round(((previousCumulativeScores[pos] ?? 0) + expectedScore) * 10) / 10;
      const actualCumulative = updatedCumulativeScores[pos];

      if (Math.abs(actualCumulative - expectedCumulative) > 0.001) {
        violations.push({
          category: 'SCORING_CONSISTENCY',
          message: `Player ${pos} cumulative score mismatch: expected ${expectedCumulative}, got ${actualCumulative}`,
          playerPosition: pos,
          round: record.roundNumber,
        });
      }
    }

    return violations;
  }

  /**
   * Validates final MatchResult rankings, tie handling, and winner declaration.
   */
  public static verifyMatchResult(
    finalCumulativeScores: Record<PlayerPosition, number>,
    matchResult: MatchResult
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    // Find highest score
    let highestScore = -Infinity;
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const score = finalCumulativeScores[pos];
      if (score > highestScore) highestScore = score;
    }

    const expectedWinners = CLOCKWISE_PLAYER_ORDER.filter(
      (pos) => Math.abs(finalCumulativeScores[pos] - highestScore) < 0.001
    );

    if (expectedWinners.length === 1) {
      if (matchResult.isTie) {
        violations.push({
          category: 'SCORING_CONSISTENCY',
          message: `Match marked as tie but unique winner exists: ${expectedWinners[0]} with score ${highestScore}`,
        });
      }
      if (matchResult.winnerPosition !== expectedWinners[0]) {
        violations.push({
          category: 'SCORING_CONSISTENCY',
          message: `Match winner mismatch: expected ${expectedWinners[0]}, got ${matchResult.winnerPosition}`,
        });
      }
    } else {
      if (!matchResult.isTie) {
        violations.push({
          category: 'SCORING_CONSISTENCY',
          message: `Match should be a tie between ${expectedWinners.join(', ')} with score ${highestScore}`,
        });
      }
      if (!expectedWinners.includes(matchResult.winnerPosition)) {
        violations.push({
          category: 'SCORING_CONSISTENCY',
          message: `Declared winner ${matchResult.winnerPosition} is not among tied winners: ${expectedWinners.join(', ')}`,
        });
      }
    }

    // Verify rankings order
    const sortedExpected = [...CLOCKWISE_PLAYER_ORDER].sort((a, b) => {
      const diff = finalCumulativeScores[b] - finalCumulativeScores[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    for (let i = 0; i < matchResult.rankings.length - 1; i++) {
      const r1 = matchResult.rankings[i];
      const r2 = matchResult.rankings[i + 1];
      if (r1.score < r2.score) {
        violations.push({
          category: 'SCORING_CONSISTENCY',
          message: `Rankings not sorted in descending score order: rank ${r1.rank} (${r1.score}) < rank ${r2.rank} (${r2.score})`,
        });
      }
    }

    return violations;
  }
}
