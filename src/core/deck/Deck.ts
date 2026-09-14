/**
 * Card Deck Engine & Weighted Dealing Utilities
 * Phase 2 Card & Deck Engine with Solo Offline Weighted Dealing
 */

import { Card, Rank, Suit } from '../../models/card';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { CardEngine } from './CardEngine';
import { ICardEngine } from '../contracts/ICardEngine';

/**
 * Calculates High Card Points (HCP) for a hand according to Call Break rules:
 * - Ace = 4 pts
 * - King = 3 pts
 * - Queen = 2 pts
 * - Jack = 1 pt
 * - Spades (Trump Suit) = +1 pt bonus per Spade card
 */
export function calculateHCP(hand: readonly Card[]): number {
  if (!hand || !Array.isArray(hand)) return 0;
  let points = 0;
  for (const card of hand) {
    if (card.rank === Rank.ACE) points += 4;
    else if (card.rank === Rank.KING) points += 3;
    else if (card.rank === Rank.QUEEN) points += 2;
    else if (card.rank === Rank.JACK) points += 1;

    if (card.suit === Suit.SPADES) points += 1;
  }
  return points;
}

/**
 * Solo Offline Weighted Dealing Algorithm:
 * Gives the human player (South) a ~10%-12% HCP point boost in dealt cards
 * (ensuring 1-2 solid honors and healthy Spades length).
 * 
 * Strict Invariant: Exactly 13 cards per hand dealt from the 52-card deck
 * with ZERO duplicate cards across all 4 hands.
 */
export function dealWeighted(
  shuffledDeck: readonly Card[],
  targetPosition: PlayerPosition = PlayerPosition.SOUTH,
  cardEngine?: ICardEngine
): Readonly<Record<PlayerPosition, readonly Card[]>> {
  const engine = cardEngine ?? new CardEngine();

  // If the deck provided is invalid or wrong size, fallback to default deal
  if (!shuffledDeck || shuffledDeck.length !== 52) {
    return engine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
  }

  let currentDeck = [...shuffledDeck];
  let bestDeal: Readonly<Record<PlayerPosition, readonly Card[]>> | null = null;
  let bestScoreDiff = Infinity;

  // Candidate generation loop (up to 150 attempts)
  for (let attempt = 0; attempt < 150; attempt++) {
    const candidateDeal = engine.deal(currentDeck, CLOCKWISE_PLAYER_ORDER);
    const targetHand = candidateDeal[targetPosition];

    if (targetHand && targetHand.length === 13) {
      const hcp = calculateHCP(targetHand);
      const honorsCount = targetHand.filter(
        (c) => c.rank === Rank.ACE || c.rank === Rank.KING
      ).length;
      const spadesCount = targetHand.filter((c) => c.suit === Suit.SPADES).length;

      // Target HCP range for 10%-12% boost: 15 to 19 HCP (average is 13.25)
      // Solid honors: at least 1-2 (honorsCount >= 1)
      // Healthy Spades length: at least 3 Spades (spadesCount >= 3)
      if (hcp >= 15 && hcp <= 19 && honorsCount >= 1 && spadesCount >= 3) {
        return candidateDeal;
      }

      // Track closest valid deal
      const scoreDiff = Math.abs(hcp - 16) + (spadesCount < 3 ? 5 : 0) + (honorsCount < 1 ? 5 : 0);
      if (scoreDiff < bestScoreDiff) {
        bestScoreDiff = scoreDiff;
        bestDeal = candidateDeal;
      }
    }

    // Reshuffle deck for next iteration
    currentDeck = [...engine.shuffle(currentDeck)];
  }

  return bestDeal ?? engine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
}

export * from './CardEngine';
export * from './cardUtils';
export * from './validation';
