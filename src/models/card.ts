/**
 * Core Card Domain Models for Call Break (Lakdi)
 * Phase 1 Architecture Foundation
 */

export enum Suit {
  SPADES = 'SPADES',
  HEARTS = 'HEARTS',
  DIAMONDS = 'DIAMONDS',
  CLUBS = 'CLUBS',
}

export enum SuitColor {
  BLACK = 'BLACK',
  RED = 'RED',
}

export enum Rank {
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K',
  ACE = 'A',
}

/**
 * Standard Call Break Rank Numerical Order:
 * 2 is lowest (2), Ace is highest (14).
 */
export const RANK_VALUES: Readonly<Record<Rank, number>> = Object.freeze({
  [Rank.TWO]: 2,
  [Rank.THREE]: 3,
  [Rank.FOUR]: 4,
  [Rank.FIVE]: 5,
  [Rank.SIX]: 6,
  [Rank.SEVEN]: 7,
  [Rank.EIGHT]: 8,
  [Rank.NINE]: 9,
  [Rank.TEN]: 10,
  [Rank.JACK]: 11,
  [Rank.QUEEN]: 12,
  [Rank.KING]: 13,
  [Rank.ACE]: 14,
});

/**
 * Suit metadata and display attributes.
 * In Call Break, Spades is ALWAYS the default Trump suit.
 */
export const SUIT_CONFIG: Readonly<
  Record<
    Suit,
    {
      name: string;
      symbol: string;
      color: SuitColor;
      isDefaultTrump: boolean;
    }
  >
> = Object.freeze({
  [Suit.SPADES]: {
    name: 'Spades',
    symbol: '♠',
    color: SuitColor.BLACK,
    isDefaultTrump: true,
  },
  [Suit.HEARTS]: {
    name: 'Hearts',
    symbol: '♥',
    color: SuitColor.RED,
    isDefaultTrump: false,
  },
  [Suit.DIAMONDS]: {
    name: 'Diamonds',
    symbol: '♦',
    color: SuitColor.RED,
    isDefaultTrump: false,
  },
  [Suit.CLUBS]: {
    name: 'Clubs',
    symbol: '♣',
    color: SuitColor.BLACK,
    isDefaultTrump: false,
  },
});

/**
 * Permanent Trump Suit in Call Break rules.
 */
export const DEFAULT_TRUMP_SUIT: Suit = Suit.SPADES;

/**
 * Immutable Card representation.
 */
export interface Card {
  readonly id: string; // e.g. "SPADES_A", "HEARTS_10"
  readonly suit: Suit;
  readonly rank: Rank;
  readonly value: number; // 2..14 for quick comparison
}
