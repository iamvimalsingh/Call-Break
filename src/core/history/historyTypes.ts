/**
 * Match History Data Models & Snapshot Types
 * Schema Version: 1
 * Captures completed match results as immutable snapshots without storing hidden cards or bot state.
 * Phase 9 Home, Match History & Player Statistics
 */

import { GameState, GameStatus } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';

export const HISTORY_SCHEMA_VERSION = 1;
export const MAX_HISTORY_RECORDS = 100;

export interface PlayerRoundHistory {
  readonly bid: number;
  readonly tricksWon: number;
  readonly roundScore: number;
  readonly cumulativeScore: number;
}

export interface RoundHistoryRecord {
  readonly roundNumber: number;
  readonly dealer: PlayerPosition;
  readonly scores: Readonly<Record<PlayerPosition, PlayerRoundHistory>>;
}

export interface PlayerStanding {
  readonly position: PlayerPosition;
  readonly name: string;
  readonly isHuman: boolean;
  readonly score: number;
  readonly rank: number;
}

export interface MatchHistoryRecord {
  readonly version: number;
  readonly matchId: string;
  readonly completedAt: number; // UTC timestamp
  readonly totalRounds: number;
  readonly winnerPosition: PlayerPosition;
  readonly winnerPositions: readonly PlayerPosition[];
  readonly isTie: boolean;
  readonly finalScores: Readonly<Record<PlayerPosition, number>>;
  readonly rankings: readonly PlayerStanding[];
  readonly rounds: readonly RoundHistoryRecord[];
  readonly userPosition: PlayerPosition;
  readonly playerNames: Readonly<Record<PlayerPosition, string>>;
}

/**
 * Creates an immutable, deeply cloned snapshot of a completed match.
 * Guarantees no references to live GameState or hidden game variables.
 */
export function createMatchHistoryRecord(
  state: GameState,
  userPosition: PlayerPosition = PlayerPosition.SOUTH
): MatchHistoryRecord {
  if (state.status !== GameStatus.MATCH_FINISHED || !state.matchResult) {
    throw new Error('Cannot create history record from an incomplete match');
  }

  const result = state.matchResult;
  const playerNames: Record<PlayerPosition, string> = {
    [PlayerPosition.SOUTH]: state.players[PlayerPosition.SOUTH]?.name ?? 'You',
    [PlayerPosition.WEST]: state.players[PlayerPosition.WEST]?.name ?? 'West (Bot)',
    [PlayerPosition.NORTH]: state.players[PlayerPosition.NORTH]?.name ?? 'North (Bot)',
    [PlayerPosition.EAST]: state.players[PlayerPosition.EAST]?.name ?? 'East (Bot)',
  };

  const rankings: PlayerStanding[] = result.rankings.map((r) => ({
    position: r.position,
    name: playerNames[r.position] ?? r.position,
    isHuman: r.position === userPosition,
    score: Number(r.score.toFixed(1)),
    rank: r.rank,
  }));

  const rounds: RoundHistoryRecord[] = state.roundScores.map((roundRecord) => {
    const scores: Record<PlayerPosition, PlayerRoundHistory> = {} as any;
    for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
      const pScore = roundRecord.scores[pos];
      scores[pos] = {
        bid: pScore ? pScore.bid : 0,
        tricksWon: pScore ? pScore.tricksWon : 0,
        roundScore: pScore ? Number(pScore.roundScore.toFixed(1)) : 0,
        cumulativeScore: pScore ? Number(pScore.cumulativeScore.toFixed(1)) : 0,
      };
    }
    return {
      roundNumber: roundRecord.roundNumber,
      // Default dealer rotation: Round 1=South, 2=West, 3=North, 4=East, 5=South
      dealer: getDealerForRound(roundRecord.roundNumber),
      scores: Object.freeze(scores),
    };
  });

  const finalScores: Record<PlayerPosition, number> = {
    [PlayerPosition.SOUTH]: Number((result.finalScores[PlayerPosition.SOUTH] ?? 0).toFixed(1)),
    [PlayerPosition.WEST]: Number((result.finalScores[PlayerPosition.WEST] ?? 0).toFixed(1)),
    [PlayerPosition.NORTH]: Number((result.finalScores[PlayerPosition.NORTH] ?? 0).toFixed(1)),
    [PlayerPosition.EAST]: Number((result.finalScores[PlayerPosition.EAST] ?? 0).toFixed(1)),
  };

  const record: MatchHistoryRecord = {
    version: HISTORY_SCHEMA_VERSION,
    matchId: state.matchId,
    completedAt: result.completedAt || Date.now(),
    totalRounds: state.roundScores.length,
    winnerPosition: result.winnerPosition,
    winnerPositions: Object.freeze([...result.winnerPositions]),
    isTie: result.isTie,
    finalScores: Object.freeze(finalScores),
    rankings: Object.freeze(rankings),
    rounds: Object.freeze(rounds),
    userPosition,
    playerNames: Object.freeze(playerNames),
  };

  return deepFreeze(record);
}

function getDealerForRound(roundNumber: number): PlayerPosition {
  const rotation = [
    PlayerPosition.SOUTH,
    PlayerPosition.WEST,
    PlayerPosition.NORTH,
    PlayerPosition.EAST,
  ];
  return rotation[(roundNumber - 1) % 4];
}

/**
 * Deep freezes an object recursively to guarantee immutability.
 */
function deepFreeze<T extends object>(obj: T): T {
  Object.keys(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}
