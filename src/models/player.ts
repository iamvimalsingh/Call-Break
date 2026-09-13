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
 * Standard Call Break counter-clockwise rotation (traditional South Asian play).
 * SOUTH -> EAST -> NORTH -> WEST -> SOUTH
 */
export const COUNTER_CLOCKWISE_PLAYER_ORDER: readonly PlayerPosition[] = Object.freeze([
  PlayerPosition.SOUTH,
  PlayerPosition.EAST,
  PlayerPosition.NORTH,
  PlayerPosition.WEST,
]);

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
