/**
 * Deterministic Card Selection Strategy for Call Break Bots
 * Enforces legal moves from Rules Engine, trick awareness, trump conservation,
 * and smart ruffing/discarding without cheating or hidden information.
 * Phase 5 Bot Intelligence & Strategy Engine
 */

import { Card, Suit } from '../../models/card';
import { CardPlayDecision, PlayCardContext } from '../contracts/IBotStrategy';
import {
  extractPlayedCardIds,
  getHighestTrumpInTrick,
  hasTrumpBeenPlayedInTrick,
  isBossCardInSuit,
} from './botMemory';

/**
 * Deterministic tie-breaker for cards: sort primarily by value, then by suit.
 */
function compareCardsAscending(a: Card, b: Card): number {
  if (a.value !== b.value) {
    return a.value - b.value;
  }
  return a.suit.localeCompare(b.suit);
}

function compareCardsDescending(a: Card, b: Card): number {
  return compareCardsAscending(b, a);
}

/**
 * Finds the lowest, least valuable discard card among available options.
 * Strongly prefers non-trump cards with lowest rank to preserve trumps and honors.
 */
export function selectLowestDiscard(
  legalMoves: readonly Card[],
  trumpSuit: Suit
): Card {
  const nonTrumps = legalMoves.filter((c) => c.suit !== trumpSuit);
  if (nonTrumps.length > 0) {
    const sorted = [...nonTrumps].sort(compareCardsAscending);
    return sorted[0];
  }

  // If only trumps are available, pick the lowest trump
  const sortedTrumps = [...legalMoves].sort(compareCardsAscending);
  return sortedTrumps[0];
}

/**
 * Evaluates and selects the optimal card to play using Medium Call Break strategy.
 */
export function selectMediumCardPlay(context: PlayCardContext): CardPlayDecision {
  const {
    hand,
    legalMoves,
    currentTrick,
    trumpSuit,
    playerBid,
    playerTricksWon,
    completedTricks,
  } = context;

  if (!legalMoves || legalMoves.length === 0) {
    // Failsafe fallback
    const fallback = hand[0];
    return {
      card: fallback,
      reasoning: 'Failsafe fallback: no legal moves provided',
    };
  }

  // Forced move
  if (legalMoves.length === 1) {
    const only = legalMoves[0];
    const isTrump = only.suit === trumpSuit;
    return {
      card: only,
      reasoning: isTrump
        ? `Forced move: trump with only legal ${only.rank} of ${only.suit}`
        : `Forced move: only ${only.rank} of ${only.suit} is legal`,
    };
  }

  const playedCardIds = extractPlayedCardIds(completedTricks, currentTrick);
  const needsTricks = playerTricksWon < playerBid;
  const isLeading = currentTrick.cards.length === 0 || currentTrick.leadSuit === null;

  // =========================================================================
  // CASE 1: BOT IS LEADING THE TRICK
  // =========================================================================
  if (isLeading) {
    const nonTrumps = legalMoves.filter((c) => c.suit !== trumpSuit);
    const trumps = legalMoves.filter((c) => c.suit === trumpSuit);

    // 1A. If bot needs tricks, lead a boss/master non-trump card if held (e.g. Ace)
    if (needsTricks && nonTrumps.length > 0) {
      const bossNonTrumps = nonTrumps.filter((c) =>
        isBossCardInSuit(c, hand, playedCardIds)
      );

      if (bossNonTrumps.length > 0) {
        // Pick the highest boss card
        const sortedBoss = [...bossNonTrumps].sort(compareCardsDescending);
        const chosen = sortedBoss[0];
        return {
          card: chosen,
          reasoning: `Leading boss ${chosen.rank} of ${chosen.suit} to secure trick`,
        };
      }
    }

    // 1B. If holding top Ace of Spades and 4+ trumps, lead it to draw out trumps ("pull trumps")
    if (trumps.length >= 4) {
      const bossTrump = trumps.find((c) => isBossCardInSuit(c, hand, playedCardIds));
      if (bossTrump && bossTrump.rank === 'A') {
        return {
          card: bossTrump,
          reasoning: `Leading Ace of Spades to draw out opponents' trumps`,
        };
      }
    }

    // 1C. Safe lead: lead a low card in longest non-trump suit to develop/exit safely
    if (nonTrumps.length > 0) {
      // Group non-trumps by suit to find longest
      const suitCounts: Record<string, Card[]> = {};
      for (const card of nonTrumps) {
        if (!suitCounts[card.suit]) suitCounts[card.suit] = [];
        suitCounts[card.suit].push(card);
      }

      const longestSuitCards = Object.values(suitCounts).sort(
        (a, b) => b.length - a.length
      )[0];

      const sortedInSuit = [...longestSuitCards].sort(compareCardsAscending);
      const chosen = sortedInSuit[0];
      return {
        card: chosen,
        reasoning: `Leading low card (${chosen.rank} of ${chosen.suit}) in safe suit`,
      };
    }

    // 1D. Only trumps left in hand
    const sortedTrumps = [...trumps].sort(
      needsTricks ? compareCardsDescending : compareCardsAscending
    );
    const chosen = sortedTrumps[0];
    return {
      card: chosen,
      reasoning: needsTricks
        ? `Leading highest trump (${chosen.rank} of ${chosen.suit}) to win trick`
        : `Leading lowest trump (${chosen.rank} of ${chosen.suit}) to conserve honors`,
    };
  }

  // =========================================================================
  // CASE 2 & 3: BOT IS FOLLOWING A TRICK IN PROGRESS
  // =========================================================================
  const leadSuit = currentTrick.leadSuit!;
  const hasLeadSuit = legalMoves.some((c) => c.suit === leadSuit);

  // =========================================================================
  // SUB-CASE 2: BOT HAS THE LEAD SUIT (MUST FOLLOW SUIT)
  // =========================================================================
  if (hasLeadSuit) {
    const leadSuitCards = legalMoves.filter((c) => c.suit === leadSuit);
    const trumpAlreadyPlayed =
      leadSuit !== trumpSuit && hasTrumpBeenPlayedInTrick(currentTrick, trumpSuit);

    // If an opponent already trumped this non-trump trick, no lead suit card can win!
    if (trumpAlreadyPlayed) {
      const sortedLead = [...leadSuitCards].sort(compareCardsAscending);
      const lowestCard = sortedLead[0];
      return {
        card: lowestCard,
        reasoning: `Trick already trumped by opponent; ducking with lowest ${lowestCard.rank} of ${leadSuit}`,
      };
    }

    // Find highest lead-suit card currently on the table
    const playedLeadCards = currentTrick.cards.filter((pc) => pc.card.suit === leadSuit);
    const highestPlayedLeadCard = playedLeadCards.reduce(
      (prev, curr) => (curr.card.value > prev.card.value ? curr : prev),
      playedLeadCards[0]
    );

    // Cards in hand that can beat the table's highest lead-suit card
    const winningCards = leadSuitCards.filter(
      (c) => c.value > highestPlayedLeadCard.card.value
    );

    if (winningCards.length > 0) {
      // Pick the LOWEST winning card (e.g. King over Jack, saving Ace)
      const sortedWinning = [...winningCards].sort(compareCardsAscending);
      const chosen = sortedWinning[0];
      return {
        card: chosen,
        reasoning: `Playing lowest winning card (${chosen.rank} of ${leadSuit}) over table's ${highestPlayedLeadCard.card.rank}`,
      };
    }

    // Cannot beat highest lead card: play lowest card in lead suit to conserve higher honors
    const sortedLead = [...leadSuitCards].sort(compareCardsAscending);
    const lowestCard = sortedLead[0];
    return {
      card: lowestCard,
      reasoning: `Cannot beat table's ${highestPlayedLeadCard.card.rank} of ${leadSuit}; ducking with ${lowestCard.rank}`,
    };
  }

  // =========================================================================
  // SUB-CASE 3: BOT IS VOID IN LEAD SUIT (CAN TRUMP OR DISCARD)
  // =========================================================================
  const trumpsInHand = legalMoves.filter((c) => c.suit === trumpSuit);
  const highestTrumpPlayed = getHighestTrumpInTrick(currentTrick, trumpSuit);

  // 3A. Someone has already played a trump card
  if (highestTrumpPlayed) {
    const higherTrumps = trumpsInHand.filter(
      (c) => c.value > highestTrumpPlayed.card.value
    );

    // If bot has higher trumps, over-trumping is required by rules; pick lowest winning trump
    if (higherTrumps.length > 0) {
      const sortedHigher = [...higherTrumps].sort(compareCardsAscending);
      const chosen = sortedHigher[0];
      return {
        card: chosen,
        reasoning: `Over-trumping with lowest winning Spade (${chosen.rank}) over table's ${highestTrumpPlayed.card.rank}`,
      };
    }

    // Bot cannot beat table's highest trump: discard lowest non-trump or lowest card from legal moves
    const discardCard = selectLowestDiscard(legalMoves, trumpSuit);
    return {
      card: discardCard,
      reasoning: `Cannot beat table's trump (${highestTrumpPlayed.card.rank} of ${trumpSuit}); discarding ${discardCard.rank} of ${discardCard.suit}`,
    };
  }

  // 3B. No trumps have been played yet: ruffing is mandatory if holding trumps
  if (trumpsInHand.length > 0) {
    // Ruff with the lowest Spade in legal moves
    const sortedTrumps = [...trumpsInHand].sort(compareCardsAscending);
    const lowestTrump = sortedTrumps[0];
    return {
      card: lowestTrump,
      reasoning: `Ruffing with lowest trump (${lowestTrump.rank} of ${trumpSuit}) to win trick`,
    };
  }

  // 3C. No trumps available: discard lowest off-suit card
  const discardCard = selectLowestDiscard(legalMoves, trumpSuit);
  return {
    card: discardCard,
    reasoning: `Void in ${leadSuit}; discarding lowest off-suit card (${discardCard.rank} of ${discardCard.suit})`,
  };
}
