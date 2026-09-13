/**
 * Standard 52-Card Deck Engine for Call Break (Lakdi)
 * Conforms to ICardEngine contract.
 * Pure TypeScript, zero external dependencies, 100% offline & multiplayer-ready.
 * Phase 2 Card & Deck Engine
 */

import { Card, Rank, Suit } from '../../models/card';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { ICardEngine } from '../contracts/ICardEngine';
import { CryptoRandomSource, DeterministicRandomSource, IRandomSource } from '../random/IRandomSource';
import { createCard } from './cardUtils';
import { validateDeckIntegrity } from './validation';

/**
 * Standard suit ordering for deck initialization & hand sorting.
 * In Call Break:
 * Spades is the permanent Trump suit (first priority),
 * followed by Hearts, Diamonds, Clubs.
 */
export const STANDARD_SUIT_ORDER: readonly Suit[] = Object.freeze([
  Suit.SPADES,
  Suit.HEARTS,
  Suit.DIAMONDS,
  Suit.CLUBS,
]);

/**
 * Standard rank ordering ascending for deck generation:
 * 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace.
 */
export const STANDARD_RANK_ORDER: readonly Rank[] = Object.freeze([
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

export class CardEngine implements ICardEngine {
  private readonly defaultRandomSource: IRandomSource;

  constructor(randomSource?: IRandomSource) {
    this.defaultRandomSource = randomSource ?? new CryptoRandomSource();
  }

  /**
   * Generates a standard 52-card deck (4 suits x 13 ranks).
   * Generates cards in a deterministic, standard order.
   * Fully immutable.
   */
  public createDeck(): readonly Card[] {
    const cards: Card[] = [];

    for (const suit of STANDARD_SUIT_ORDER) {
      for (const rank of STANDARD_RANK_ORDER) {
        cards.push(createCard(suit, rank));
      }
    }

    return Object.freeze(cards);
  }

  /**
   * Shuffles a given deck using an unbiased Fisher-Yates (Knuth) algorithm.
   * If a seed is provided, a DeterministicRandomSource is used for reproducible shuffles.
   * Does NOT mutate the input deck (returns a new array).
   */
  public shuffle(deck: readonly Card[], seed?: number): readonly Card[] {
    if (!deck || !Array.isArray(deck)) {
      throw new Error('Cannot shuffle invalid or non-array deck');
    }

    const random = seed !== undefined 
      ? new DeterministicRandomSource(seed) 
      : this.defaultRandomSource;

    // Create a shallow copy to strictly preserve input immutability
    const copy: Card[] = [...deck];

    // Fisher-Yates shuffle (from last element down to index 1)
    for (let i = copy.length - 1; i > 0; i--) {
      // Pick random index in [0, i] inclusive
      const j = random.nextInt(0, i);
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }

    return Object.freeze(copy);
  }

  /**
   * Deals 13 cards to each of the 4 players.
   * Call Break standard: 52 cards dealt equally to 4 players (13 cards each).
   * Validates deck size and integrity before distribution.
   */
  public deal(
    shuffledDeck: readonly Card[],
    playerPositions: readonly PlayerPosition[] = CLOCKWISE_PLAYER_ORDER
  ): Readonly<Record<PlayerPosition, readonly Card[]>> {
    if (!shuffledDeck || !Array.isArray(shuffledDeck)) {
      throw new Error('Cannot deal invalid or non-array deck');
    }

    const expectedTotalCards = playerPositions.length * 13;
    if (shuffledDeck.length < expectedTotalCards) {
      throw new Error(
        `Insufficient cards to deal: required at least ${expectedTotalCards} cards for ${playerPositions.length} players, got ${shuffledDeck.length}`
      );
    }

    // Initialize hand buckets for each player
    const handBuckets: Record<string, Card[]> = {};
    for (const pos of playerPositions) {
      handBuckets[pos] = [];
    }

    // Deal round-robin (1 card per player each round, 13 rounds)
    let cardIdx = 0;
    for (let round = 0; round < 13; round++) {
      for (const pos of playerPositions) {
        handBuckets[pos].push(shuffledDeck[cardIdx++]);
      }
    }

    // Build immutable result record
    const result: Partial<Record<PlayerPosition, readonly Card[]>> = {};
    for (const pos of playerPositions) {
      result[pos] = Object.freeze(handBuckets[pos]);
    }

    return Object.freeze(result as Record<PlayerPosition, readonly Card[]>);
  }

  /**
   * Sorts a player's hand deterministically:
   * 1. Grouped by suit: Spades (Trump) -> Hearts -> Diamonds -> Clubs
   * 2. Within each suit: Rank descending (Ace = 14 down to 2)
   * Returns a new frozen array, preserving input immutability.
   */
  public sortHand(hand: readonly Card[]): readonly Card[] {
    if (!hand || !Array.isArray(hand)) {
      return Object.freeze([]);
    }

    const suitPriority: Record<Suit, number> = {
      [Suit.SPADES]: 0,   // Trump always first
      [Suit.HEARTS]: 1,
      [Suit.DIAMONDS]: 2,
      [Suit.CLUBS]: 3,
    };

    const sorted = [...hand].sort((a, b) => {
      // First compare suit priority
      const suitDiff = suitPriority[a.suit] - suitPriority[b.suit];
      if (suitDiff !== 0) {
        return suitDiff;
      }
      // Same suit: compare rank value descending (high card to low card)
      return b.value - a.value;
    });

    return Object.freeze(sorted);
  }

  /**
   * Verifies standard 52-card deck integrity.
   * Conforms to ICardEngine.
   */
  public validateDeckIntegrity(deck: readonly Card[]): boolean {
    return validateDeckIntegrity(deck);
  }
}
