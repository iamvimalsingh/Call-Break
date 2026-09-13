/**
 * QASimulator Engine
 * Master orchestration harness for large-scale stress testing, invariant validation,
 * seed sweeps, deterministic replay auditing, and failure diagnosis.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { GameRunner } from './GameRunner';
import {
  QASimulatorOptions,
  QASimulatorMetrics,
  GameRunResult,
  ReplayVerificationResult,
} from './QATypes';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';

export class QASimulator {
  private runner: GameRunner;

  constructor() {
    this.runner = new GameRunner();
  }

  /**
   * Runs a batch of games according to the specified options and aggregates metrics.
   */
  public runBatch(options: QASimulatorOptions): {
    metrics: QASimulatorMetrics;
    failedGames: GameRunResult[];
  } {
    const gameCount = options.gameCount ?? 1;
    const startSeed = options.startSeed ?? 10001;
    const seeds: number[] = options.seeds ?? Array.from({ length: gameCount }, (_, i) => startSeed + i * 17);

    const metrics: QASimulatorMetrics = {
      gamesStarted: seeds.length,
      gamesCompleted: 0,
      gamesFailed: 0,
      roundsCompleted: 0,
      tricksCompleted: 0,
      illegalMoves: 0,
      duplicateCards: 0,
      cardConservationViolations: 0,
      stateTransitionViolations: 0,
      deadlocksTimeouts: 0,
      doubleScoringEvents: 0,
      exceptions: 0,
      totalDurationMs: 0,
      averageGameDurationMs: 0,
    };

    const failedGames: GameRunResult[] = [];
    const batchStart = Date.now();

    for (const seed of seeds) {
      const result = this.runner.runGame({
        seed,
        customBidStrategy: options.bidStrategy ?? 'STANDARD',
        validateEveryAction: options.validateInvariants ?? true,
      });

      metrics.roundsCompleted += result.roundsCompleted;
      metrics.tricksCompleted += result.tricksCompleted;

      // Classify violations
      for (const v of result.violations) {
        if (v.category === 'CARD_PLAY_LEGALITY') metrics.illegalMoves++;
        if (v.category === 'DUPLICATE_CARD') metrics.duplicateCards++;
        if (v.category === 'CARD_CONSERVATION') metrics.cardConservationViolations++;
        if (v.category === 'ROUND_INTEGRITY' || v.category === 'TURN_PROGRESSION')
          metrics.stateTransitionViolations++;
        if (v.category === 'SCORING_CONSISTENCY') metrics.doubleScoringEvents++;
      }

      if (result.failureDiagnostics) {
        metrics.exceptions++;
      }

      if (result.success) {
        metrics.gamesCompleted++;
      } else {
        metrics.gamesFailed++;
        failedGames.push(result);
      }
    }

    metrics.totalDurationMs = Date.now() - batchStart;
    metrics.averageGameDurationMs =
      metrics.gamesStarted > 0 ? metrics.totalDurationMs / metrics.gamesStarted : 0;

    return { metrics, failedGames };
  }

  /**
   * Verifies deterministic replay by running the same seed twice and asserting exact state parity.
   */
  public verifyDeterministicReplay(seed: number): ReplayVerificationResult {
    const run1 = this.runner.runGame({ seed, validateEveryAction: true });
    const run2 = this.runner.runGame({ seed, validateEveryAction: true });

    const mismatches: string[] = [];

    if (run1.roundsCompleted !== run2.roundsCompleted) {
      mismatches.push(`Rounds completed mismatch: Run1=${run1.roundsCompleted}, Run2=${run2.roundsCompleted}`);
    }

    if (run1.tricksCompleted !== run2.tricksCompleted) {
      mismatches.push(`Tricks completed mismatch: Run1=${run1.tricksCompleted}, Run2=${run2.tricksCompleted}`);
    }

    if (run1.winnerPosition !== run2.winnerPosition) {
      mismatches.push(`Winner position mismatch: Run1=${run1.winnerPosition}, Run2=${run2.winnerPosition}`);
    }

    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const s1 = run1.finalScores[pos];
      const s2 = run2.finalScores[pos];
      if (Math.abs(s1 - s2) > 0.001) {
        mismatches.push(`Player ${pos} final score mismatch: Run1=${s1}, Run2=${s2}`);
      }
    }

    return {
      seed,
      matchId1: run1.matchId,
      matchId2: run2.matchId,
      isExactMatch: mismatches.length === 0,
      mismatches,
    };
  }

  /**
   * Formats a standard machine-readable text summary of a simulation run.
   */
  public formatSummaryText(title: string, metrics: QASimulatorMetrics): string {
    return [
      `=== ${title} ===`,
      `Games Started:             ${metrics.gamesStarted}`,
      `Games Completed:           ${metrics.gamesCompleted}`,
      `Games Failed:              ${metrics.gamesFailed}`,
      `Rounds Completed:          ${metrics.roundsCompleted}`,
      `Tricks Completed:          ${metrics.tricksCompleted}`,
      `Illegal Moves:             ${metrics.illegalMoves}`,
      `Duplicate Cards:           ${metrics.duplicateCards}`,
      `Conservation Violations:   ${metrics.cardConservationViolations}`,
      `State Violations:          ${metrics.stateTransitionViolations}`,
      `Deadlocks / Timeouts:      ${metrics.deadlocksTimeouts}`,
      `Double Scoring Events:     ${metrics.doubleScoringEvents}`,
      `Exceptions:                ${metrics.exceptions}`,
      `Total Duration:            ${metrics.totalDurationMs} ms`,
      `Average Game Duration:     ${metrics.averageGameDurationMs.toFixed(2)} ms`,
    ].join('\n');
  }
}
