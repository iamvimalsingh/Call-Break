/**
 * Low-level Card Domain Utilities & Serialization
 * Conforms to existing Card, Suit, Rank models.
 * Phase 2 Card & Deck Engine
 */

import { Card, Rank, RANK_VALUES, Suit } from '../../models/card';

export class CardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardValidationError';
  }
}

/**
 * Deterministically generates a canonical card identity string.
 * Two cards with the same suit and rank have the exact same ID.
 * Example: "SPADES_A", "HEARTS_10", "CLUBS_2"
 */
export function getCardId(suit: Suit, rank: Rank): string {
  return `${suit}_${rank}`;
}

/**
 * Creates an immutable, valid Card object.
 */
export function createCard(suit: Suit, rank: Rank): Card {
  if (!isValidSuit(suit)) {
    throw new CardValidationError(`Invalid card suit: "${String(suit)}"`);
  }
  if (!isValidRank(rank)) {
    throw new CardValidationError(`Invalid card rank: "${String(rank)}"`);
  }

  const value = RANK_VALUES[rank];
  return Object.freeze({
    id: getCardId(suit, rank),
    suit,
    rank,
    value,
  });
}

/**
 * Validates whether a given string corresponds to a valid Suit enum value.
 */
export function isValidSuit(suit: unknown): suit is Suit {
  return (
    typeof suit === 'string' &&
    Object.values(Suit).includes(suit as Suit)
  );
}

/**
 * Validates whether a given string corresponds to a valid Rank enum value.
 */
export function isValidRank(rank: unknown): rank is Rank {
  return (
    typeof rank === 'string' &&
    Object.values(Rank).includes(rank as Rank)
  );
}

/**
 * Validates if an object conforms to a valid Card structure.
 */
export function isValidCard(candidate: unknown): candidate is Card {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const c = candidate as Partial<Card>;
  return (
    typeof c.id === 'string' &&
    isValidSuit(c.suit) &&
    isValidRank(c.rank) &&
    typeof c.value === 'number' &&
    c.id === getCardId(c.suit, c.rank) &&
    c.value === RANK_VALUES[c.rank]
  );
}

/**
 * Tests logical equality of two cards based on canonical identity.
 * Two cards with the same suit and rank are considered identical.
 */
export function areCardsEqual(
  a: Card | null | undefined,
  b: Card | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.suit === b.suit && a.rank === b.rank;
}

/**
 * Serializes a Card into a compact, plain-text representation.
 * Format: "SUIT_RANK" (e.g., "SPADES_A", "HEARTS_10")
 */
export function serializeCard(card: Card): string {
  if (!isValidCard(card)) {
    throw new CardValidationError(`Cannot serialize invalid card object: ${JSON.stringify(card)}`);
  }
  return card.id;
}

/**
 * Deserializes a string representation back into an immutable Card instance.
 * Rejects invalid, malformed, or tampered serialized inputs.
 */
export function deserializeCard(serialized: unknown): Card {
  if (typeof serialized !== 'string' || !serialized.trim()) {
    throw new CardValidationError(
      `Invalid card serialization: expected non-empty string, received ${typeof serialized}`
    );
  }

  const parts = serialized.trim().split('_');
  if (parts.length !== 2) {
    throw new CardValidationError(
      `Malformed serialized card "${serialized}": expected format "SUIT_RANK"`
    );
  }

  const [suitCandidate, rankCandidate] = parts;

  if (!isValidSuit(suitCandidate)) {
    throw new CardValidationError(
      `Unknown suit "${suitCandidate}" in serialized card "${serialized}"`
    );
  }

  if (!isValidRank(rankCandidate)) {
    throw new CardValidationError(
      `Unknown rank "${rankCandidate}" in serialized card "${serialized}"`
    );
  }

  return createCard(suitCandidate, rankCandidate);
}

/**
 * Serializes a hand or collection of cards.
 */
export function serializeHand(hand: readonly Card[]): readonly string[] {
  if (!Array.isArray(hand)) {
    throw new CardValidationError(`Expected array for hand serialization, received ${typeof hand}`);
  }
  return Object.freeze(hand.map(serializeCard));
}

/**
 * Deserializes a list of serialized card strings into Card instances.
 */
export function deserializeHand(serializedHand: unknown): readonly Card[] {
  if (!Array.isArray(serializedHand)) {
    throw new CardValidationError(
      `Expected array for hand deserialization, received ${typeof serializedHand}`
    );
  }
  return Object.freeze(serializedHand.map(deserializeCard));
}
