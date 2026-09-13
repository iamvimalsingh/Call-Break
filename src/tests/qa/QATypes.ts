/**
 * QA Simulator & Reliability Stress Test Types
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { Card } from '../../models/card';
import { PlayerPosition } from '../../models/player';
import { GameState, GameStatus } from '../../models/gameState';

export interface InvariantViolation {
  category:
    | 'CARD_CONSERVATION'
    | 'DUPLICATE_CARD'
    | 'INVALID_CARD'
    | 'TURN_PROGRESSION'
    | 'BID_VALIDITY'
    | 'CARD_PLAY_LEGALITY'
    | 'TRICK_INTEGRITY'
    | 'ROUND_INTEGRITY'
    | 'SCORING_CONSISTENCY'
    | 'BOT_INFORMATION_BARRIER'
    | 'PERSISTENCE_PARITY'
    | 'HISTORY_INTEGRITY';
  message: string;
  round?: number;
  trick?: number;
  playerPosition?: PlayerPosition;
  details?: Record<string, unknown>;
}

export interface QAFailureDiagnostics {
  seed: number;
  matchId: string;
  round: number;
  trick: number;
  phase: GameStatus;
  currentPlayer: PlayerPosition;
  bids: Record<PlayerPosition, number | null>;
  cumulativeScores: Record<PlayerPosition, number>;
  currentTrickCards: readonly { playerPosition: PlayerPosition; card: Card }[];
  playerHandLengths: Record<PlayerPosition, number>;
  playerHandsSnapshot?: Record<PlayerPosition, readonly Card[]>;
  lastValidAction: string;
  failingAction: string;
  error: string;
  stack?: string;
  serializedState?: string;
}

export interface GameRunOptions {
  seed: number;
  customBids?: Record<PlayerPosition, number>;
  customBidStrategy?: 'STANDARD' | 'ALL_ONES' | 'ALL_THIRTEENS' | 'MIXED_EXTREMES' | 'RANDOM_LEGAL';
  persistenceCheckPoints?: ('DEAL' | 'AFTER_BIDS' | 'MID_TRICK' | 'AFTER_TRICK' | 'ROUND_END')[];
  validateEveryAction?: boolean;
}

export interface GameRunResult {
  seed: number;
  matchId: string;
  success: boolean;
  roundsCompleted: number;
  tricksCompleted: number;
  violations: InvariantViolation[];
  failureDiagnostics?: QAFailureDiagnostics;
  finalScores: Record<PlayerPosition, number>;
  winnerPosition: PlayerPosition | null;
  durationMs: number;
}

export interface QASimulatorOptions {
  gameCount?: number;
  startSeed?: number;
  seeds?: number[];
  validateInvariants?: boolean;
  testPersistence?: boolean;
  testHistory?: boolean;
  bidStrategy?: 'STANDARD' | 'ALL_ONES' | 'ALL_THIRTEENS' | 'MIXED_EXTREMES' | 'RANDOM_LEGAL';
}

export interface QASimulatorMetrics {
  gamesStarted: number;
  gamesCompleted: number;
  gamesFailed: number;
  roundsCompleted: number;
  tricksCompleted: number;
  illegalMoves: number;
  duplicateCards: number;
  cardConservationViolations: number;
  stateTransitionViolations: number;
  deadlocksTimeouts: number;
  doubleScoringEvents: number;
  exceptions: number;
  totalDurationMs: number;
  averageGameDurationMs: number;
}

export interface ReplayVerificationResult {
  seed: number;
  matchId1: string;
  matchId2: string;
  isExactMatch: boolean;
  mismatches: string[];
}
