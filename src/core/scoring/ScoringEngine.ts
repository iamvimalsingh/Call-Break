/**
 * Call Break Scoring Engine Implementation
 * Pure game point calculation engine conforming to IScoringEngine contract.
 * Strictly decoupled from financial systems, wallets, cards, rules, bots, and UI.
 * Phase 4 Call Break Scoring Engine
 */

import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { GameState, GameStatus, RoundScoreRecord, MatchResult } from '../../models/gameState';
import {
  IScoringEngine,
  IScoringPolicy,
  RoundScoringInput,
  PlayerRoundResult,
  ScoringValidationResult,
} from '../contracts/IScoringEngine';
import { StandardCallBreakScoringPolicy, roundToPrecision } from './scoringPolicies';
import {
  validatePlayerRoundInput,
  validateRoundScoringInput,
  validateGameStateForScoring,
  calculateRoundScores,
  calculateMatchResult,
} from './scoringUtils';

export class ScoringEngine implements IScoringEngine {
  public readonly policy: IScoringPolicy;

  constructor(policy?: IScoringPolicy) {
    this.policy = policy ?? new StandardCallBreakScoringPolicy();
  }

  public validateRoundScoringInput(input: RoundScoringInput): ScoringValidationResult {
    return validateRoundScoringInput(input, this.policy);
  }

  public validateStateForScoring(state: GameState): ScoringValidationResult {
    return validateGameStateForScoring(state, this.policy);
  }

  public calculatePlayerScore(
    bid: number,
    tricksWon: number,
    policy?: IScoringPolicy
  ): number {
    const activePolicy = policy ?? this.policy;
    const validation = validatePlayerRoundInput(bid, tricksWon, activePolicy);
    if (!validation.isValid) {
      throw new Error(`Invalid score calculation inputs: ${validation.reason}`);
    }
    return activePolicy.calculatePlayerRoundScore(bid, tricksWon);
  }

  public calculateRoundScores(
    input: RoundScoringInput,
    policy?: IScoringPolicy
  ): RoundScoreRecord {
    const activePolicy = policy ?? this.policy;
    return calculateRoundScores(input, activePolicy);
  }

  public applyRoundScoresToState(
    state: GameState,
    policy?: IScoringPolicy
  ): GameState {
    const activePolicy = policy ?? this.policy;
    const validation = validateGameStateForScoring(state, activePolicy);
    if (!validation.isValid) {
      throw new Error(`State validation failed for round scoring: ${validation.reason}`);
    }

    const playerResults: PlayerRoundResult[] = CLOCKWISE_PLAYER_ORDER.map((pos) => {
      const p = state.players[pos];
      return {
        position: pos,
        bid: p.currentBid ?? 0,
        tricksWon: p.tricksWon,
      };
    });

    const roundRecord = calculateRoundScores(
      {
        roundNumber: state.currentRound,
        playerResults,
        previousCumulativeScores: state.cumulativeScores,
      },
      activePolicy
    );

    const newCumulativeScores = {} as Record<PlayerPosition, number>;
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const prev = state.cumulativeScores[pos] ?? 0;
      const roundScore = roundRecord.scores[pos].roundScore;
      newCumulativeScores[pos] = roundToPrecision(prev + roundScore, 1);
    }

    const updatedRoundScores = [...state.roundScores, roundRecord];
    const matchFinished = this.isMatchComplete(
      state.currentRound,
      state.config.totalRounds
    );

    let matchResult: MatchResult | null = null;
    let nextStatus = GameStatus.ROUND_ENDED;
    let actionMsg = `Round ${state.currentRound} scored successfully.`;

    if (matchFinished) {
      matchResult = calculateMatchResult(newCumulativeScores, updatedRoundScores);
      nextStatus = GameStatus.MATCH_FINISHED;
      const winnerName = matchResult.isTie
        ? `Tied: ${matchResult.winnerPositions.join(', ')}`
        : `Winner: ${matchResult.winnerPosition}`;
      actionMsg = `Match complete! ${winnerName} with ${matchResult.rankings[0].score} points.`;
    }

    return {
      ...state,
      status: nextStatus,
      roundScores: updatedRoundScores,
      cumulativeScores: newCumulativeScores,
      matchResult,
      lastActionMessage: actionMsg,
    };
  }

  public calculateMatchResult(
    cumulativeScores: Readonly<Record<PlayerPosition, number>>,
    roundScores: readonly RoundScoreRecord[] = []
  ): MatchResult {
    return calculateMatchResult(cumulativeScores, roundScores);
  }

  public isMatchComplete(roundNumber: number, totalRounds: number = 5): boolean {
    return roundNumber >= totalRounds;
  }
}
