/**
 * Deck Integrity Validation
 * Verifies standard 52-card deck constraints.
 * Conforms to ICardEngine.validateDeckIntegrity contract.
 * Phase 2 Card & Deck Engine
 */

import { Card, Rank, Suit } from '../../models/card';
import { isValidCard } from './cardUtils';

export interface DeckValidationReport {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly totalCards: number;
  readonly suitCounts: Readonly<Record<Suit, number>>;
  readonly uniqueCardCount: number;
}

const REQUIRED_DECK_SIZE = 52;
const REQUIRED_CARDS_PER_SUIT = 13;

const ALL_SUITS: readonly Suit[] = Object.freeze([
  Suit.SPADES,
  Suit.HEARTS,
  Suit.DIAMONDS,
  Suit.CLUBS,
]);

const ALL_RANKS: readonly Rank[] = Object.freeze([
  Rank.TWO,
  Rank.THREE,
  Rank.FOUR,
  Rank.FIVE,
  Rank.SIX,
  Rank.SEVEN,
  Rank.EIGHT,
  Rank.NINE,
  Rank.TEN,
  Rank.JACK,
  Rank.QUEEN,
  Rank.KING,
  Rank.ACE,
]);

/**
 * Performs comprehensive analysis of a deck's integrity.
 * Returns detailed diagnostic report.
 */
export function checkDeckIntegrityDetailed(deck: readonly Card[]): DeckValidationReport {
  const errors: string[] = [];

  if (!Array.isArray(deck)) {
    return {
      isValid: false,
      errors: ['Deck candidate is not an array.'],
      totalCards: 0,
      suitCounts: {
        [Suit.SPADES]: 0,
        [Suit.HEARTS]: 0,
        [Suit.DIAMONDS]: 0,
        [Suit.CLUBS]: 0,
      },
      uniqueCardCount: 0,
    };
  }

  const totalCards = deck.length;
  if (totalCards !== REQUIRED_DECK_SIZE) {
    errors.push(`Deck contains ${totalCards} cards; expected exactly ${REQUIRED_DECK_SIZE}.`);
  }

  const seenIds = new Set<string>();
  const suitCounts: Record<Suit, number> = {
    [Suit.SPADES]: 0,
    [Suit.HEARTS]: 0,
    [Suit.DIAMONDS]: 0,
    [Suit.CLUBS]: 0,
  };
  const suitRankGrid: Record<Suit, Set<Rank>> = {
    [Suit.SPADES]: new Set<Rank>(),
    [Suit.HEARTS]: new Set<Rank>(),
    [Suit.DIAMONDS]: new Set<Rank>(),
    [Suit.CLUBS]: new Set<Rank>(),
  };

  deck.forEach((card, index) => {
    if (!isValidCard(card)) {
      errors.push(`Card at index ${index} is invalid or corrupted.`);
      return;
    }

    if (seenIds.has(card.id)) {
      errors.push(`Duplicate card detected: ${card.id} at index ${index}.`);
    } else {
      seenIds.add(card.id);
    }

    if (suitCounts[card.suit] !== undefined) {
      suitCounts[card.suit]++;
      suitRankGrid[card.suit].add(card.rank);
    }
  });

  // Verify all 4 suits have exactly 13 cards and all 13 ranks
  for (const suit of ALL_SUITS) {
    const count = suitCounts[suit];
    if (count !== REQUIRED_CARDS_PER_SUIT) {
      errors.push(
        `Suit ${suit} has ${count} cards; expected exactly ${REQUIRED_CARDS_PER_SUIT}.`
      );
    }

    for (const rank of ALL_RANKS) {
      if (!suitRankGrid[suit].has(rank)) {
        errors.push(`Suit ${suit} is missing rank ${rank}.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
    totalCards,
    suitCounts: Object.freeze(suitCounts),
    uniqueCardCount: seenIds.size,
  };
}

/**
 * Boolean validator matching ICardEngine contract.
 */
export function validateDeckIntegrity(deck: readonly Card[]): boolean {
  return checkDeckIntegrityDetailed(deck).isValid;
}
