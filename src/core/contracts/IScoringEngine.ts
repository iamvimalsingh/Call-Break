/**
 * Call Break Scoring Engine Contract
 * Defines pure game point calculation abstractions, configurable scoring policies,
 * and match score accumulation.
 * Strictly decoupled from financial systems, wallets, cards, rules, bots, and UI.
 * Phase 4 Call Break Scoring Engine
 */

import { PlayerPosition } from '../../models/player';
import { GameState, RoundScoreRecord, MatchResult } from '../../models/gameState';

export interface ScoringValidationResult {
  readonly isValid: boolean;
  readonly reason?: string;
  readonly errors?: readonly string[];
}

export interface PlayerRoundResult {
  readonly position: PlayerPosition;
  readonly bid: number;
  readonly tricksWon: number;
}

export interface RoundScoringInput {
  readonly roundNumber: number;
  readonly playerResults: readonly PlayerRoundResult[];
  readonly previousCumulativeScores?: Readonly<Record<PlayerPosition, number>>;
}

/**
 * Configurable scoring policy abstraction.
 * Allows future clients or alternative rule sets to modify overtrick values,
 * penalty modes, or scoring formulas without touching the controller or rules engine.
 */
export interface IScoringPolicy {
  readonly name: string;
  readonly minBid: number;
  readonly maxBid: number;
  readonly overtrickValue: number;
  readonly failedBidPenaltyMode: 'NEGATIVE_BID' | 'FIXED_PENALTY' | 'ZERO';
  calculatePlayerRoundScore(bid: number, tricksWon: number): number;
}

export interface IScoringEngine {
  readonly policy: IScoringPolicy;

  /**
   * Validates raw round scoring inputs before score calculation.
   */
  validateRoundScoringInput(input: RoundScoringInput): ScoringValidationResult;

  /**
   * Validates if a GameState is in a legal completed state ready for round scoring.
   */
  validateStateForScoring(state: GameState): ScoringValidationResult;

  /**
   * Calculates a single player's game points for a round based on bid and tricks won.
   * Does NOT produce currency or monetary amounts.
   */
  calculatePlayerScore(
    bid: number,
    tricksWon: number,
    policy?: IScoringPolicy
  ): number;

  /**
   * Calculates round scores for all 4 players and returns an immutable RoundScoreRecord.
   */
  calculateRoundScores(
    input: RoundScoringInput,
    policy?: IScoringPolicy
  ): RoundScoreRecord;

  /**
   * Applies round scores to an immutable GameState, updating roundScores,
   * cumulativeScores, and matchResult if the match has reached its final round.
   */
  applyRoundScoresToState(
    state: GameState,
    policy?: IScoringPolicy
  ): GameState;

  /**
   * Calculates the final match result, rankings, and winner(s) supporting ties cleanly.
   */
  calculateMatchResult(
    cumulativeScores: Readonly<Record<PlayerPosition, number>>,
    roundScores?: readonly RoundScoreRecord[]
  ): MatchResult;

  /**
   * Checks whether match scoring is complete (e.g. 5 rounds completed).
   */
  isMatchComplete(roundNumber: number, totalRounds?: number): boolean;
}
