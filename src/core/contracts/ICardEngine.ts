/**
 * Card & Deck Engine Contract (Phase 2 Target)
 * Phase 1 Architecture Foundation
 */

import { Card, PlayerPosition } from '../../models';

export interface ICardEngine {
  /**
   * Generates a standard 52-card deck (4 suits x 13 ranks).
   */
  createDeck(): readonly Card[];

  /**
   * Shuffles a given deck using internal secure pseudo-randomness (Fisher-Yates).
   * Accepts an optional seed for deterministic testing.
   */
  shuffle(deck: readonly Card[], seed?: number): readonly Card[];

  /**
   * Deals 13 cards to each of the 4 players (South, West, North, East).
   */
  deal(
    shuffledDeck: readonly Card[],
    playerPositions: readonly PlayerPosition[]
  ): Readonly<Record<PlayerPosition, readonly Card[]>>;

  /**
   * Deals cards with a 10%-12% point boost for a target position in Solo Offline mode.
   */
  dealWeighted?(
    shuffledDeck: readonly Card[],
    targetPosition?: PlayerPosition
  ): Readonly<Record<PlayerPosition, readonly Card[]>>;

  /**
   * Sorts player hand by suit (Spades, Hearts, Clubs, Diamonds) then rank descending.
   */
  sortHand(hand: readonly Card[]): readonly Card[];

  /**
   * Verifies deck integrity (exactly 52 unique valid cards).
   */
  validateDeckIntegrity(deck: readonly Card[]): boolean;
}
