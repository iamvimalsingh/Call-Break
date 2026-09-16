/**
 * Player Domain Models for Call Break (Lakdi)
 * Phase 1 Architecture Foundation
 */

import { Card } from './card';

export enum PlayerType {
  HUMAN = 'HUMAN',
  BOT = 'BOT',
}

export enum PlayerPosition {
  SOUTH = 'SOUTH', // Primary user / Human player position
  WEST = 'WEST',   // Opponent 1 (Left bot)
  NORTH = 'NORTH', // Opponent 2 (Partner/Opposite bot)
  EAST = 'EAST',   // Opponent 3 (Right bot)
}

/**
 * Standard turn sequence in clockwise order.
 * SOUTH -> WEST -> NORTH -> EAST -> SOUTH
 */
export const CLOCKWISE_PLAYER_ORDER: readonly PlayerPosition[] = Object.freeze([
  PlayerPosition.SOUTH,
  PlayerPosition.WEST,
  PlayerPosition.NORTH,
  PlayerPosition.EAST,
]);

/**
 * Standard position order array for UI rendering and seat iterations.
 */
export const POSITION_ORDER = CLOCKWISE_PLAYER_ORDER;

/**
 * Standard Call Break counter-clockwise rotation (traditional South Asian play).
 * SOUTH -> EAST -> NORTH -> WEST -> SOUTH
 */
export const COUNTER_CLOCKWISE_PLAYER_ORDER: readonly PlayerPosition[] = Object.freeze([
  PlayerPosition.SOUTH,
  PlayerPosition.EAST,
  PlayerPosition.NORTH,
  PlayerPosition.WEST,
]);

/**
 * Maps authoritative PlayerPosition seat to its single-character seat code.
 * SOUTH = S, WEST = W, NORTH = N, EAST = E
 */
export function getSeatPrefixLetter(position: PlayerPosition): 'S' | 'W' | 'N' | 'E' {
  switch (position) {
    case PlayerPosition.SOUTH:
      return 'S';
    case PlayerPosition.WEST:
      return 'W';
    case PlayerPosition.NORTH:
      return 'N';
    case PlayerPosition.EAST:
      return 'E';
  }
}

/**
 * Formats a player display identity with a permanent authoritative seat prefix.
 * e.g. "S • You", "W • Bot: Shield", "N • Bot: Shark", "E • Rahul"
 */
export function formatPlayerSeatIdentity(position: PlayerPosition, displayName: string): string {
  const seat = getSeatPrefixLetter(position);
  // Strip any preexisting seat prefix to prevent double-prefixing
  const cleanName = (displayName || '').replace(/^[SWNE]\s*[•·-]\s*/i, '').trim();
  return `${seat} • ${cleanName || 'Player'}`;
}

export interface PlayerState {
  readonly id: string;
  readonly name: string;
  readonly type: PlayerType;
  readonly position: PlayerPosition;
  readonly hand: readonly Card[];
  readonly currentBid: number | null; // 1 to 13, null before bidding
  readonly tricksWon: number;
  readonly isTurn: boolean;
  readonly isDealer: boolean;
}
