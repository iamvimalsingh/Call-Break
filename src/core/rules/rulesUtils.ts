/**
 * Pure Rule Evaluation Functions for Call Break (Lakdi)
 * Zero external dependencies. Zero UI or DOM coupling.
 * Phase 3 Call Break Rules Engine
 */

import { Card, Suit } from '../../models/card';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { GameState, GameStatus, PlayedCard, TrickState } from '../../models/gameState';
import { ValidationResult } from '../contracts/IRulesEngine';
import { areCardsEqual } from '../deck/cardUtils';
import { defaultDealerDirectionPolicy, IDealerDirectionPolicy } from './dealerDirectionPolicy';

export const DEFAULT_TRUMP_SUIT = Suit.SPADES;
export const STANDARD_MIN_BID = 1;
export const STANDARD_MAX_BID = 13;
export const TRICKS_PER_ROUND = 13;
export const TOTAL_ROUNDS = 5;

/**
 * Returns the next player position in clockwise order.
 * Delegated to isolated dealer/direction policy.
 */
export function getNextPlayerClockwise(
  current: PlayerPosition,
  policy: IDealerDirectionPolicy = defaultDealerDirectionPolicy
): PlayerPosition {
  return policy.getNextPlayer(current);
}

/**
 * Returns the dealer for the given round number (1 to 5).
 * Defaults to SOUTH for Round 1:
 * Round 1: SOUTH -> Round 2: WEST -> Round 3: NORTH -> Round 4: EAST -> Round 5: SOUTH
 * Delegated to isolated dealer/direction policy.
 */
export function getDealerForRound(
  roundNumber: number,
  initialDealer: PlayerPosition = PlayerPosition.SOUTH,
  policy: IDealerDirectionPolicy = defaultDealerDirectionPolicy
): PlayerPosition {
  return policy.getDealerForRound(roundNumber, initialDealer);
}

/**
 * In Call Break, the player immediately clockwise from the dealer starts the round/calling sequence.
 * Delegated to isolated dealer/direction policy.
 */
export function getStartingPlayerForRound(
  dealer: PlayerPosition,
  policy: IDealerDirectionPolicy = defaultDealerDirectionPolicy
): PlayerPosition {
  return policy.getStartingPlayer(dealer);
}

/**
 * Determines which player is currently expected to place a bid.
 * Bidding starts at starting player (clockwise from dealer) and proceeds clockwise.
 * Returns null if the game is not in BIDDING status or all 4 players have placed their bids.
 */
export function getExpectedBiddingPlayer(state: GameState): PlayerPosition | null {
  if (state.status !== GameStatus.BIDDING) {
    return null;
  }

  const startingPlayer = getStartingPlayerForRound(state.dealer);
  let candidate = startingPlayer;

  for (let i = 0; i < CLOCKWISE_PLAYER_ORDER.length; i++) {
    const playerState = state.players[candidate];
    if (playerState && playerState.currentBid === null) {
      return candidate;
    }
    candidate = getNextPlayerClockwise(candidate);
  }

  // All 4 players have bid
  return null;
}

/**
 * Validates a call/bid according to Call Break rules:
 * - Status must be BIDDING
 * - Bid must be an integer between 1 and 13 inclusive
 * - Player must be the expected current bidder
 * - Player cannot have already bid in this round
 */
export function validateBid(
  bid: number,
  playerPosition: PlayerPosition,
  state: GameState
): ValidationResult {
  if (state.status !== GameStatus.BIDDING) {
    return {
      isValid: false,
      reason: `Cannot place bid in game status "${state.status}". Bidding is only allowed in BIDDING status.`,
    };
  }

  if (!Number.isInteger(bid) || bid < STANDARD_MIN_BID || bid > STANDARD_MAX_BID) {
    return {
      isValid: false,
      reason: `Invalid bid value "${bid}". Bid must be an integer between ${STANDARD_MIN_BID} and ${STANDARD_MAX_BID}.`,
    };
  }

  const playerState = state.players[playerPosition];
  if (!playerState) {
    return {
      isValid: false,
      reason: `Player "${playerPosition}" does not exist in game state.`,
    };
  }

  if (playerState.currentBid !== null) {
    return {
      isValid: false,
      reason: `Player "${playerPosition}" has already placed a bid (${playerState.currentBid}) for this round.`,
    };
  }

  const expectedPlayer = getExpectedBiddingPlayer(state);
  if (expectedPlayer !== playerPosition) {
    return {
      isValid: false,
      reason: `It is not ${playerPosition}'s turn to bid. Expected bidder is ${expectedPlayer ?? 'none'}.`,
    };
  }

  return { isValid: true };
}

/**
 * Determines the card currently winning the in-progress trick across all played cards.
 * 1. If any trump card (Spade) has been played, the highest-ranked Spade is currently winning.
 * 2. Otherwise, the highest-ranked card of the led suit is currently winning.
 * 3. Returns null if the trick has no cards played yet.
 */
export function getCurrentWinningCard(
  currentTrick: TrickState,
  trumpSuit: Suit = DEFAULT_TRUMP_SUIT
): PlayedCard | null {
  if (!currentTrick || !currentTrick.cards || currentTrick.cards.length === 0) {
    return null;
  }

  // 1. Check for trump cards (Spades)
  const playedTrumps = currentTrick.cards.filter((pc) => pc.card.suit === trumpSuit);
  if (playedTrumps.length > 0) {
    let winningTrump = playedTrumps[0];
    for (let i = 1; i < playedTrumps.length; i++) {
      if (playedTrumps[i].card.value > winningTrump.card.value) {
        winningTrump = playedTrumps[i];
      }
    }
    return winningTrump;
  }

  // 2. No trumps played: highest card of the led suit controls the trick
  const leadSuit = currentTrick.leadSuit ?? currentTrick.cards[0].card.suit;
  const playedLeadCards = currentTrick.cards.filter((pc) => pc.card.suit === leadSuit);
  if (playedLeadCards.length === 0) {
    return currentTrick.cards[0];
  }

  let winningLead = playedLeadCards[0];
  for (let i = 1; i < playedLeadCards.length; i++) {
    if (playedLeadCards[i].card.value > winningLead.card.value) {
      winningLead = playedLeadCards[i];
    }
  }
  return winningLead;
}

/**
 * Evaluates legal moves for a player's hand given the current trick according to
 * authentic Call Break (Lakdi) "must-beat" rules:
 * 1. If leading the trick (no cards played yet): any card in hand is legal.
 * 2. If holding cards of the lead suit: player MUST follow suit.
 *    - Evaluates the CURRENT trick winner across all played cards in the trick.
 *    - If no trump has been played (or if the lead suit is trump), player MUST play a card
 *      of the lead suit higher than the current winning card of the trick if held.
 *    - If player cannot beat the current winning card (or if a non-trump trick was already trumped),
 *      any card of the lead suit in hand is legal.
 * 3. If void in lead suit:
 *    - If no trumps have been played yet: player MUST play a trump (Spade) if they hold any.
 *    - If one or more trumps have been played:
 *      - If player holds a trump higher than the current winning highest trump, player MUST over-trump!
 *      - If player holds NO higher trump (cannot beat the table's winning trump), player has no viable trump:
 *        any card in hand is legal (including lower trumps and off-suit discards).
 * 4. If void in lead suit AND void in trumps (no Spades):
 *    - Any card in hand is legal (discard).
 */
export function getLegalMoves(
  playerHand: readonly Card[],
  currentTrick: TrickState,
  trumpSuit: Suit = DEFAULT_TRUMP_SUIT
): readonly Card[] {
  if (!playerHand || playerHand.length === 0) {
    return Object.freeze([]);
  }

  // Trick is not yet led: player may lead any card
  if (currentTrick.cards.length === 0 || currentTrick.leadSuit === null) {
    return Object.freeze([...playerHand]);
  }

  const leadSuit = currentTrick.leadSuit;
  const leadSuitCards = playerHand.filter((c) => c.suit === leadSuit);
  const currentWinner = getCurrentWinningCard(currentTrick, trumpSuit);

  // Case 1: Player has cards of the led suit -> MUST follow suit
  if (leadSuitCards.length > 0) {
    // If an opponent already trumped this trick and the led suit is not trump:
    // No led suit card can beat a trump card on the table, so all led suit cards are legal.
    if (currentWinner && currentWinner.card.suit === trumpSuit && leadSuit !== trumpSuit) {
      return Object.freeze(leadSuitCards);
    }

    // Otherwise, compare against the CURRENT winning card of the trick:
    const currentWinningValue = currentWinner ? currentWinner.card.value : 0;

    // Player must beat the CURRENT trick winner if they hold a higher card in the led suit
    const higherLeadCards = leadSuitCards.filter((c) => c.value > currentWinningValue);
    if (higherLeadCards.length > 0) {
      return Object.freeze(higherLeadCards);
    }

    // Cannot beat the current winning card: all cards of the led suit are legal
    return Object.freeze(leadSuitCards);
  }

  // Case 2: Player is void in the led suit
  const trumpsInHand = playerHand.filter((c) => c.suit === trumpSuit);

  // If player has no trumps (void in led suit AND void in trumps): any card is legal (discard)
  if (trumpsInHand.length === 0) {
    return Object.freeze([...playerHand]);
  }

  // Player has trumps in hand:
  if (!currentWinner || currentWinner.card.suit !== trumpSuit) {
    // No trumps played yet on table: Spade is REQUIRED to trump
    return Object.freeze(trumpsInHand);
  }

  // One or more trumps already played on table:
  const higherTrumps = trumpsInHand.filter((c) => c.value > currentWinner.card.value);
  if (higherTrumps.length > 0) {
    // Player has a higher trump: MUST over-trump the highest winning Spade
    return Object.freeze(higherTrumps);
  }

  // Player cannot beat the table's highest trump (no viable trump):
  // Under Call Break rules ("Only if you have no cards of the lead suit and no viable trump can you play any other card"),
  // any remaining card in hand is legal (including lower trumps and off-suit discards).
  return Object.freeze([...playerHand]);
}

/**
 * Validates whether a specific card is legal to play given the player's hand and current trick.
 */
export function validateCardPlay(
  cardToPlay: Card,
  playerHand: readonly Card[],
  currentTrick: TrickState,
  trumpSuit: Suit = DEFAULT_TRUMP_SUIT
): ValidationResult {
  if (!cardToPlay) {
    return { isValid: false, reason: 'Card to play cannot be null or undefined.' };
  }

  const hasCard = playerHand.some((c) => areCardsEqual(c, cardToPlay));
  if (!hasCard) {
    return {
      isValid: false,
      reason: `Player does not hold ${cardToPlay.rank} of ${cardToPlay.suit} in hand.`,
    };
  }

  const legalMoves = getLegalMoves(playerHand, currentTrick, trumpSuit);
  const isLegal = legalMoves.some((c) => areCardsEqual(c, cardToPlay));

  if (!isLegal) {
    const leadSuit = currentTrick.leadSuit;
    const hasLeadSuit = playerHand.some((c) => c.suit === leadSuit);
    const currentWinner = getCurrentWinningCard(currentTrick, trumpSuit);

    if (hasLeadSuit) {
      if (cardToPlay.suit === leadSuit) {
        return {
          isValid: false,
          reason: `Illegal move: Must play a higher card of lead suit (${leadSuit}) to beat current winning card (${currentWinner?.card.rank} of ${currentWinner?.card.suit}) when possible.`,
        };
      }
      return {
        isValid: false,
        reason: `Illegal move: Must follow lead suit (${leadSuit}). You hold ${playerHand.filter((c) => c.suit === leadSuit).length} card(s) of ${leadSuit}.`,
      };
    }

    if (currentWinner && currentWinner.card.suit === trumpSuit) {
      return {
        isValid: false,
        reason: `Illegal move: Must over-trump with a higher ${trumpSuit} than current winner ${currentWinner.card.rank} of ${trumpSuit} when possible.`,
      };
    }

    return {
      isValid: false,
      reason: `Illegal move: Must trump with a ${trumpSuit} when void in lead suit (${leadSuit}).`,
    };
  }

  return { isValid: true };
}

/**
 * Validates whether a card play is legal within the full game state context.
 */
export function isLegalPlay(
  state: GameState,
  playerPosition: PlayerPosition,
  card: Card
): ValidationResult {
  if (state.status !== GameStatus.PLAYING) {
    return {
      isValid: false,
      reason: `Cannot play cards in game status "${state.status}". Game must be in PLAYING status.`,
    };
  }

  if (state.currentPlayer !== playerPosition) {
    return {
      isValid: false,
      reason: `It is not ${playerPosition}'s turn to play. Current player is ${state.currentPlayer}.`,
    };
  }

  if (state.currentTrick.cards.length >= 4) {
    return {
      isValid: false,
      reason: 'Current trick is already complete (4 cards played). Trick must be resolved before next play.',
    };
  }

  const playerState = state.players[playerPosition];
  if (!playerState) {
    return {
      isValid: false,
      reason: `Player "${playerPosition}" not found in game state.`,
    };
  }

  return validateCardPlay(
    card,
    playerState.hand,
    state.currentTrick,
    state.config.trumpSuit
  );
}

/**
 * Determines the winner of a trick according to standard Call Break rules:
 * Case 1 — One or more trump cards (Spades) were played:
 *   Highest-ranked Spade wins.
 * Case 2 — No trump cards were played:
 *   Highest-ranked card of the led suit wins.
 */
export function determineTrickWinner(
  playedCards: readonly PlayedCard[],
  leadSuit: Suit,
  trumpSuit: Suit = DEFAULT_TRUMP_SUIT
): PlayerPosition {
  if (!playedCards || playedCards.length === 0) {
    throw new Error('Cannot determine trick winner for empty played cards.');
  }

  // Case 1: Check for trump cards (Spades)
  const trumpCards = playedCards.filter((pc) => pc.card.suit === trumpSuit);
  if (trumpCards.length > 0) {
    let winningPlay = trumpCards[0];
    for (let i = 1; i < trumpCards.length; i++) {
      if (trumpCards[i].card.value > winningPlay.card.value) {
        winningPlay = trumpCards[i];
      }
    }
    return winningPlay.playerPosition;
  }

  // Case 2: No trump cards played. Highest card of led suit wins.
  const leadSuitCards = playedCards.filter((pc) => pc.card.suit === leadSuit);
  if (leadSuitCards.length === 0) {
    // Fallback safeguard: if lead suit not present, highest card of first played card's suit
    return playedCards[0].playerPosition;
  }

  let winningPlay = leadSuitCards[0];
  for (let i = 1; i < leadSuitCards.length; i++) {
    if (leadSuitCards[i].card.value > winningPlay.card.value) {
      winningPlay = leadSuitCards[i];
    }
  }

  return winningPlay.playerPosition;
}
