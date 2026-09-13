/**
 * Deterministic Call Break Hand Evaluation & Bidding Strategy
 * Estimates realistic tricks based on high cards, Spades trump length, and ruffing potential.
 * Avoids reckless over-bidding while guaranteeing bids are within [1, 13].
 * Phase 5 Bot Intelligence & Strategy Engine
 */

import { Card, Rank, Suit } from '../../models/card';
import { BiddingContext, HandEvaluation } from '../contracts/IBotStrategy';

export const MIN_BOT_BID = 1;
export const MAX_BOT_BID = 13;

/**
 * Groups cards by their suit.
 */
export function groupHandBySuit(hand: readonly Card[]): Record<Suit, Card[]> {
  const groups: Record<Suit, Card[]> = {
    [Suit.SPADES]: [],
    [Suit.HEARTS]: [],
    [Suit.DIAMONDS]: [],
    [Suit.CLUBS]: [],
  };

  for (const card of hand) {
    groups[card.suit].push(card);
  }

  // Sort each suit descending by rank value for easy honor checks
  for (const s of Object.values(Suit)) {
    groups[s].sort((a, b) => b.value - a.value);
  }

  return groups;
}

/**
 * Evaluates hand strength and computes estimated tricks broken down by strategic components.
 */
export function evaluateHandStrength(
  hand: readonly Card[],
  context: BiddingContext
): HandEvaluation {
  const trumpSuit = context.trumpSuit ?? Suit.SPADES;
  const suits = groupHandBySuit(hand);

  let spadeStrength = 0;
  let highCardStrength = 0;
  let lengthBonus = 0;
  let voidBonus = 0;

  // 1. Evaluate Trump Suit (Spades)
  const trumpCards = suits[trumpSuit] || [];
  const trumpCount = trumpCards.length;
  const hasTrumpRank = (r: Rank) => trumpCards.some((c) => c.rank === r);

  if (hasTrumpRank(Rank.ACE)) {
    spadeStrength += 1.0;
  }
  if (hasTrumpRank(Rank.KING)) {
    // If has Ace too, King is guaranteed. If 2+ trumps, very likely.
    if (hasTrumpRank(Rank.ACE)) {
      spadeStrength += 0.95;
    } else if (trumpCount >= 2) {
      spadeStrength += 0.8;
    } else {
      spadeStrength += 0.55; // singleton King can fall to Ace
    }
  }
  if (hasTrumpRank(Rank.QUEEN)) {
    if (hasTrumpRank(Rank.ACE) && hasTrumpRank(Rank.KING)) {
      spadeStrength += 0.9;
    } else if (hasTrumpRank(Rank.ACE) || hasTrumpRank(Rank.KING)) {
      spadeStrength += 0.65;
    } else if (trumpCount >= 3) {
      spadeStrength += 0.45;
    } else {
      spadeStrength += 0.2;
    }
  }
  if (hasTrumpRank(Rank.JACK)) {
    if ((hasTrumpRank(Rank.ACE) || hasTrumpRank(Rank.KING)) && trumpCount >= 3) {
      spadeStrength += 0.35;
    } else if (trumpCount >= 4) {
      spadeStrength += 0.25;
    }
  }
  if (hasTrumpRank(Rank.TEN) && trumpCount >= 4) {
    spadeStrength += 0.15;
  }

  // Trump length bonus (trumps beyond 3 allow ruffing and control)
  if (trumpCount >= 4) {
    lengthBonus += 0.45;
  }
  if (trumpCount >= 5) {
    lengthBonus += 0.55; // total +1.0 for 5 trumps
  }
  if (trumpCount >= 6) {
    lengthBonus += 0.6; // total +1.6 for 6 trumps
  }
  if (trumpCount >= 7) {
    lengthBonus += 0.7; // total +2.3 for 7 trumps
  }

  // 2. Evaluate Non-Trump Suits (Side Suits)
  for (const suit of Object.values(Suit)) {
    if (suit === trumpSuit) continue;

    const cards = suits[suit] || [];
    const count = cards.length;
    const hasRank = (r: Rank) => cards.some((c) => c.rank === r);

    // Aces in side suits
    if (hasRank(Rank.ACE)) {
      if (count <= 3) {
        highCardStrength += 0.9; // Solid trick on trick 1 of this suit
      } else {
        highCardStrength += 0.75; // In longer suit, slightly higher risk of early ruff
      }
    }

    // Kings in side suits
    if (hasRank(Rank.KING)) {
      if (hasRank(Rank.ACE)) {
        if (count >= 2) highCardStrength += 0.8;
      } else if (count >= 2 && count <= 4) {
        highCardStrength += 0.45;
      } else if (count === 1) {
        highCardStrength += 0.2; // Singleton King might fall to Ace
      } else {
        highCardStrength += 0.3; // 5+ cards
      }
    }

    // Queens in side suits
    if (hasRank(Rank.QUEEN)) {
      if (hasRank(Rank.ACE) && hasRank(Rank.KING)) {
        highCardStrength += 0.65;
      } else if (hasRank(Rank.ACE) || hasRank(Rank.KING)) {
        highCardStrength += 0.35;
      } else if (count >= 3) {
        highCardStrength += 0.15;
      }
    }

    // Jacks in side suits
    if (hasRank(Rank.JACK)) {
      if (hasRank(Rank.ACE) && hasRank(Rank.KING)) {
        highCardStrength += 0.25;
      }
    }

    // 3. Side suit voids and singletons (Ruffing potential when backed by trumps)
    if (trumpCount >= 3) {
      if (count === 0) {
        // Void: can immediately trump if this suit is led
        voidBonus += trumpCount >= 4 ? 0.65 : 0.35;
      } else if (count === 1) {
        // Singleton: can trump on round 2 of this suit
        voidBonus += trumpCount >= 4 ? 0.35 : 0.15;
      }
    }
  }

  const rawEstimatedTricks = spadeStrength + highCardStrength + lengthBonus + voidBonus;
  // Cap precision to 2 decimal places
  const estimatedTricks = Math.round(rawEstimatedTricks * 100) / 100;

  // Conservative rounding:
  // In Call Break, overtricks give +0.1 while missed bids give -bid.
  // Therefore, conservative rounding is essential.
  // We use floor with a slight 0.2 threshold to round up only when strongly warranted.
  let calculatedBid = Math.floor(estimatedTricks + 0.15);

  // Guarantee strict bounds [1, 13]
  const recommendedBid = Math.max(MIN_BOT_BID, Math.min(MAX_BOT_BID, calculatedBid));

  return {
    estimatedTricks,
    recommendedBid,
    spadeStrength: Math.round(spadeStrength * 100) / 100,
    highCardStrength: Math.round(highCardStrength * 100) / 100,
    lengthBonus: Math.round(lengthBonus * 100) / 100,
    voidBonus: Math.round(voidBonus * 100) / 100,
  };
}
