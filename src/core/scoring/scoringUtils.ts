/**
 * Call Break Scoring Pure Utility Functions
 * Stateless, deterministic functions for score calculation, validation,
 * ranking, and tie detection.
 * Phase 4 Call Break Scoring Engine
 */

import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { GameState, GameStatus, RoundScoreRecord, PlayerRoundScore, MatchResult } from '../../models/gameState';
import {
  IScoringPolicy,
  RoundScoringInput,
  PlayerRoundResult,
  ScoringValidationResult,
} from '../contracts/IScoringEngine';
import { roundToPrecision } from './scoringPolicies';

/**
 * Validates a single player's bid and tricks won.
 */
export function validatePlayerRoundInput(
  bid: number,
  tricksWon: number,
  policy: IScoringPolicy
): ScoringValidationResult {
  const errors: string[] = [];

  if (typeof bid !== 'number' || !Number.isInteger(bid)) {
    errors.push(`Bid must be an integer, received: ${bid}`);
  } else if (bid < policy.minBid || bid > policy.maxBid) {
    errors.push(`Bid ${bid} is out of allowable range [${policy.minBid}, ${policy.maxBid}]`);
  }

  if (typeof tricksWon !== 'number' || !Number.isInteger(tricksWon)) {
    errors.push(`Tricks won must be an integer, received: ${tricksWon}`);
  } else if (tricksWon < 0 || tricksWon > 13) {
    errors.push(`Tricks won ${tricksWon} is out of allowable range [0, 13]`);
  }

  return {
    isValid: errors.length === 0,
    reason: errors.length > 0 ? errors.join('; ') : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validates a complete 4-player round scoring input.
 */
export function validateRoundScoringInput(
  input: RoundScoringInput,
  policy: IScoringPolicy
): ScoringValidationResult {
  const errors: string[] = [];

  // 1. Round number validation
  if (
    typeof input.roundNumber !== 'number' ||
    !Number.isInteger(input.roundNumber) ||
    input.roundNumber < 1 ||
    input.roundNumber > 5
  ) {
    errors.push(`Invalid round number: ${input.roundNumber}. Expected integer between 1 and 5.`);
  }

  // 2. Exactly 4 player results
  if (!input.playerResults || input.playerResults.length !== 4) {
    errors.push(
      `Round scoring requires exactly 4 player results, received: ${input.playerResults?.length ?? 0}`
    );
    return { isValid: false, reason: errors.join('; '), errors };
  }

  // 3. Player positions: exactly one of each SOUTH, WEST, NORTH, EAST
  const seenPositions = new Set<PlayerPosition>();
  let totalTricks = 0;

  for (const pr of input.playerResults) {
    if (!CLOCKWISE_PLAYER_ORDER.includes(pr.position)) {
      errors.push(`Unrecognized player position: ${pr.position}`);
      continue;
    }
    if (seenPositions.has(pr.position)) {
      errors.push(`Duplicate player result detected for position: ${pr.position}`);
    }
    seenPositions.add(pr.position);

    // Validate individual player result
    const individualCheck = validatePlayerRoundInput(pr.bid, pr.tricksWon, policy);
    if (!individualCheck.isValid && individualCheck.errors) {
      errors.push(`Player ${pr.position}: ${individualCheck.errors.join(', ')}`);
    }

    if (typeof pr.tricksWon === 'number' && Number.isInteger(pr.tricksWon)) {
      totalTricks += pr.tricksWon;
    }
  }

  // Missing players check
  for (const pos of CLOCKWISE_PLAYER_ORDER) {
    if (!seenPositions.has(pos)) {
      errors.push(`Missing player result for position: ${pos}`);
    }
  }

  // 4. Four-player consistency: total tricks won MUST equal 13
  if (totalTricks !== 13) {
    errors.push(`Sum of tricks won across all 4 players must equal 13, received: ${totalTricks}`);
  }

  return {
    isValid: errors.length === 0,
    reason: errors.length > 0 ? errors.join('; ') : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validates whether GameState is in a complete state ready for round scoring.
 */
export function validateGameStateForScoring(
  state: GameState,
  policy: IScoringPolicy
): ScoringValidationResult {
  const errors: string[] = [];

  // Round completion check
  if (state.status !== GameStatus.ROUND_ENDED && state.completedTricks.length < 13) {
    errors.push(
      `Cannot score round in status ${state.status} with ${state.completedTricks.length} completed tricks (13 required)`
    );
  }

  // Already scored check
  const alreadyScored = state.roundScores.some((r) => r.roundNumber === state.currentRound);
  if (alreadyScored) {
    errors.push(`Round ${state.currentRound} has already been scored`);
  }

  // Extract player results from state
  const playerResults: PlayerRoundResult[] = CLOCKWISE_PLAYER_ORDER.map((pos) => {
    const p = state.players[pos];
    return {
      position: pos,
      bid: p.currentBid ?? 0,
      tricksWon: p.tricksWon,
    };
  });

  const inputCheck = validateRoundScoringInput(
    {
      roundNumber: state.currentRound,
      playerResults,
    },
    policy
  );

  if (!inputCheck.isValid && inputCheck.errors) {
    errors.push(...inputCheck.errors);
  }

  return {
    isValid: errors.length === 0,
    reason: errors.length > 0 ? errors.join('; ') : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Calculates scores for all 4 players for a round.
 * Produces an immutable RoundScoreRecord.
 */
export function calculateRoundScores(
  input: RoundScoringInput,
  policy: IScoringPolicy
): RoundScoreRecord {
  const validation = validateRoundScoringInput(input, policy);
  if (!validation.isValid) {
    throw new Error(`Scoring validation failed: ${validation.reason}`);
  }

  const scoresMap = {} as Record<PlayerPosition, PlayerRoundScore>;

  for (const pr of input.playerResults) {
    const roundScore = policy.calculatePlayerRoundScore(pr.bid, pr.tricksWon);
    const prevCumulative = input.previousCumulativeScores?.[pr.position] ?? 0;
    const cumulativeScore = roundToPrecision(prevCumulative + roundScore, 1);

    scoresMap[pr.position] = {
      playerPosition: pr.position,
      bid: pr.bid,
      tricksWon: pr.tricksWon,
      roundScore,
      cumulativeScore,
    };
  }

  return {
    roundNumber: input.roundNumber,
    scores: scoresMap,
  };
}

/**
 * Calculates match result, rankings, and winner(s) with clean tie support.
 */
export function calculateMatchResult(
  cumulativeScores: Readonly<Record<PlayerPosition, number>>,
  roundScores: readonly RoundScoreRecord[] = []
): MatchResult {
  // Sort positions descending by cumulative score
  const sorted = CLOCKWISE_PLAYER_ORDER.map((pos) => ({
    position: pos,
    score: cumulativeScores[pos] ?? 0,
  })).sort((a, b) => b.score - a.score);

  // Determine ranks with standard competition ranking (e.g. 1, 1, 3, 4)
  const rankings: { position: PlayerPosition; score: number; rank: number }[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) {
      currentRank = i + 1;
    }
    rankings.push({
      position: sorted[i].position,
      score: sorted[i].score,
      rank: currentRank,
    });
  }

  const highestScore = sorted[0].score;
  const winnerPositions = rankings
    .filter((r) => r.score === highestScore)
    .map((r) => r.position);

  const isTie = winnerPositions.length > 1;

  return {
    winnerPosition: winnerPositions[0],
    winnerPositions,
    isTie,
    finalScores: { ...cumulativeScores },
    rankings,
    completedAt: Date.now(),
  };
}
