/**
 * QA Failure Diagnostic Reporter
 * Formats rich debugging forensics for any invariant violation or test failure.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { GameState } from '../../models/gameState';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { QAFailureDiagnostics, InvariantViolation } from './QATypes';

export class QAFailureReporter {
  public static captureDiagnostics(
    seed: number,
    state: GameState,
    lastValidAction: string,
    failingAction: string,
    error: Error | string,
    violations: InvariantViolation[] = []
  ): QAFailureDiagnostics {
    const errorMsg = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const bids: Record<PlayerPosition, number | null> = {
      SOUTH: state.players.SOUTH?.currentBid ?? null,
      WEST: state.players.WEST?.currentBid ?? null,
      NORTH: state.players.NORTH?.currentBid ?? null,
      EAST: state.players.EAST?.currentBid ?? null,
    };

    const cumulativeScores: Record<PlayerPosition, number> = {
      SOUTH: state.cumulativeScores?.SOUTH ?? 0,
      WEST: state.cumulativeScores?.WEST ?? 0,
      NORTH: state.cumulativeScores?.NORTH ?? 0,
      EAST: state.cumulativeScores?.EAST ?? 0,
    };

    const playerHandLengths: Record<PlayerPosition, number> = {
      SOUTH: state.players.SOUTH?.hand?.length ?? 0,
      WEST: state.players.WEST?.hand?.length ?? 0,
      NORTH: state.players.NORTH?.hand?.length ?? 0,
      EAST: state.players.EAST?.hand?.length ?? 0,
    };

    const playerHandsSnapshot: Record<PlayerPosition, readonly any[]> = {
      SOUTH: state.players.SOUTH?.hand ?? [],
      WEST: state.players.WEST?.hand ?? [],
      NORTH: state.players.NORTH?.hand ?? [],
      EAST: state.players.EAST?.hand ?? [],
    };

    return {
      seed,
      matchId: state.matchId,
      round: state.currentRound,
      trick: state.currentTrick?.trickNumber ?? 0,
      phase: state.status,
      currentPlayer: state.currentPlayer,
      bids,
      cumulativeScores,
      currentTrickCards: state.currentTrick?.cards ?? [],
      playerHandLengths,
      playerHandsSnapshot,
      lastValidAction,
      failingAction,
      error: errorMsg,
      stack,
      serializedState: JSON.stringify(state),
    };
  }

  public static formatReport(diag: QAFailureDiagnostics, violations: InvariantViolation[]): string {
    const lines = [
      '=============================================================',
      '                  QA FAILURE REPRODUCTION REPORT            ',
      '=============================================================',
      `Seed:               ${diag.seed}`,
      `Match ID:           ${diag.matchId}`,
      `Round:              ${diag.round} / 5`,
      `Trick:              ${diag.trick} / 13`,
      `Game Phase:         ${diag.phase}`,
      `Current Player:     ${diag.currentPlayer}`,
      `Last Valid Action:  ${diag.lastValidAction}`,
      `Failing Action:     ${diag.failingAction}`,
      `Error:              ${diag.error}`,
      '-------------------------------------------------------------',
      'Bids:               ' + JSON.stringify(diag.bids),
      'Cumulative Scores:  ' + JSON.stringify(diag.cumulativeScores),
      'Hand Lengths:       ' + JSON.stringify(diag.playerHandLengths),
      'Current Trick:      ' +
        diag.currentTrickCards.map((c) => `${c.playerPosition}:${c.card.id}`).join(', '),
      '-------------------------------------------------------------',
      'Violations Detected:',
      ...violations.map((v, i) => `  [${i + 1}] [${v.category}] ${v.message}`),
      '=============================================================',
    ];
    return lines.join('\n');
  }
}
