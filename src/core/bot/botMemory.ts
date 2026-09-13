/**
 * Bot Card Memory & Public Trick Tracking Utility
 * Provides lightweight tracking of publicly visible played cards, boss card evaluation,
 * and current trick analysis.
 * STRICTLY uses only public/known game state — ZERO hidden information/cheating.
 * Phase 5 Bot Intelligence & Strategy Engine
 */

import { Card, Rank, RANK_VALUES, Suit } from '../../models/card';
import { CompletedTrick, PlayedCard, TrickState } from '../../models/gameState';
import { getCardId } from '../deck/cardUtils';
import { determineTrickWinner } from '../rules/rulesUtils';

/**
 * Aggregates all publicly revealed cards from completed tricks and the current active trick.
 */
export function extractPlayedCardIds(
  completedTricks?: readonly CompletedTrick[],
  currentTrick?: TrickState
): Set<string> {
  const played = new Set<string>();

  if (completedTricks) {
    for (const trick of completedTricks) {
      for (const pc of trick.cards) {
        played.add(pc.card.id);
      }
    }
  }

  if (currentTrick) {
    for (const pc of currentTrick.cards) {
      played.add(pc.card.id);
    }
  }

  return played;
}

/**
 * Determines whether a card is currently the highest remaining unplayed card in its suit (a "boss" or "master" card).
 * A card is considered boss if every card in the same suit with a higher rank
 * has ALREADY been played publicly, or is held in the player's own hand.
 */
export function isBossCardInSuit(
  candidateCard: Card,
  playerHand: readonly Card[],
  playedCardIds: Set<string>
): boolean {
  const suit = candidateCard.suit;
  const candidateValue = candidateCard.value;

  const handCardIds = new Set(playerHand.map((c) => c.id));

  // Check all ranks in the game
  for (const rankStr of Object.values(Rank)) {
    const rankValue = RANK_VALUES[rankStr];
    if (rankValue > candidateValue) {
      const cardId = getCardId(suit, rankStr);
      // If a higher card exists that has NOT been played AND is NOT in player's hand, candidate is not boss
      if (!playedCardIds.has(cardId) && !handCardIds.has(cardId)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Returns the card that is currently winning the active trick according to Call Break rules,
 * or null if no cards have been played yet.
 */
export function getCurrentlyWinningPlay(
  currentTrick: TrickState,
  trumpSuit: Suit
): PlayedCard | null {
  if (!currentTrick.cards || currentTrick.cards.length === 0 || !currentTrick.leadSuit) {
    return null;
  }

  try {
    const winnerPos = determineTrickWinner(
      currentTrick.cards,
      currentTrick.leadSuit,
      trumpSuit
    );
    const winningPlay = currentTrick.cards.find((pc) => pc.playerPosition === winnerPos);
    return winningPlay ?? currentTrick.cards[0];
  } catch {
    return currentTrick.cards[0] ?? null;
  }
}

/**
 * Checks if any trump card has been played in the current trick.
 */
export function hasTrumpBeenPlayedInTrick(
  currentTrick: TrickState,
  trumpSuit: Suit
): boolean {
  if (!currentTrick.cards) return false;
  return currentTrick.cards.some((pc) => pc.card.suit === trumpSuit);
}

/**
 * Returns the highest trump card played so far in the current trick, or null if no trumps played.
 */
export function getHighestTrumpInTrick(
  currentTrick: TrickState,
  trumpSuit: Suit
): PlayedCard | null {
  if (!currentTrick.cards) return null;
  const trumps = currentTrick.cards.filter((pc) => pc.card.suit === trumpSuit);
  if (trumps.length === 0) return null;

  let highest = trumps[0];
  for (let i = 1; i < trumps.length; i++) {
    if (trumps[i].card.value > highest.card.value) {
      highest = trumps[i];
    }
  }
  return highest;
}
