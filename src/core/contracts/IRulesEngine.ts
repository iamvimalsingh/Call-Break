/**
 * Rules Engine Contract (Phase 4 Target)
 * Defines legal moves, trick winner resolution, and scoring rules for Call Break
 * Phase 1 Architecture Foundation
 */

import { Card, Suit } from '../../models/card';
import { PlayerPosition } from '../../models/player';
import { GameState, PlayedCard, TrickState } from '../../models/gameState';
import { ICardEngine } from './ICardEngine';

export interface ValidationResult {
  readonly isValid: boolean;
  readonly reason?: string;
}

export interface IRulesEngine {
  /**
   * Evaluates legal moves for the active player according to Call Break rules:
   * 1. If leading the trick, any card from hand may be played.
   * 2. If following suit, must play lead suit if player has at least one card of that suit.
   * 3. If void in lead suit, may play any card (including trump Spade).
   */
  getLegalMoves(
    playerHand: readonly Card[],
    currentTrick: TrickState,
    trumpSuit: Suit
  ): readonly Card[];

  /**
   * Validates if a proposed card play is strictly legal.
   */
  validateCardPlay(
    cardToPlay: Card,
    playerHand: readonly Card[],
    currentTrick: TrickState,
    trumpSuit: Suit
  ): ValidationResult;

  /**
   * Validates if a proposed card play is legal given the entire game state.
   */
  isLegalPlay(
    state: GameState,
    playerPosition: PlayerPosition,
    card: Card
  ): ValidationResult;

  /**
   * Validates a bid value (1 to 13) for the expected player in the bidding phase.
   */
  validateBid(
    bid: number,
    playerPosition: PlayerPosition,
    state: GameState
  ): ValidationResult;

  /**
   * Determines whose bid is currently expected in turn order.
   * Returns null if bidding phase is complete or not in bidding status.
   */
  getExpectedBiddingPlayer(state: GameState): PlayerPosition | null;

  /**
   * Returns the next player position in standard clockwise rotation.
   */
  getNextPlayer(current: PlayerPosition): PlayerPosition;

  /**
   * Returns the dealer for the specified round number (1 to 5).
   * Standard dealer rotation clockwise (Round 1: SOUTH -> Round 2: WEST -> NORTH -> EAST -> SOUTH).
   */
  getDealerForRound(roundNumber: number, initialDealer?: PlayerPosition): PlayerPosition;

  /**
   * Returns the starting player for a round (immediately clockwise from the dealer).
   */
  getStartingPlayer(dealer: PlayerPosition): PlayerPosition;

  /**
   * Determines the winner of a completed 4-card trick.
   * Trump cards beat non-trump cards; higher trump wins; if no trumps, highest of lead suit wins.
   */
  determineTrickWinner(
    playedCards: readonly PlayedCard[],
    leadSuit: Suit,
    trumpSuit: Suit
  ): PlayerPosition;

  /**
   * Initializes a deterministic round flow: dealer, starting player, deck generation,
   * shuffle, deal 13 cards each, clear trick and bid states, set status to BIDDING.
   */
  initializeRound(
    state: GameState,
    cardEngine: ICardEngine,
    seed?: number
  ): GameState;

  /**
   * Applies a validated bid to the state and advances bidding turn or transitions to PLAYING.
   */
  applyBid(
    state: GameState,
    playerPosition: PlayerPosition,
    bid: number
  ): GameState;

  /**
   * Applies a legal card play: removes card from hand, adds to trick, advances turn,
   * and auto-resolves trick if 4th card is played.
   */
  applyCardPlay(
    state: GameState,
    playerPosition: PlayerPosition,
    card: Card
  ): GameState;

  /**
   * Resolves the current completed trick, updates tricksWon, completedTricks,
   * and sets next leader/currentPlayer or marks ROUND_ENDED if 13 tricks are done.
   */
  resolveCurrentTrick(state: GameState): GameState;

  /**
   * Calculates a player's round score:
   * - If tricksWon >= bid: score = bid + (tricksWon - bid) * 0.1
   * - If tricksWon < bid: score = -bid
   */
  calculateRoundScore(bid: number, tricksWon: number): number;

  /**
   * Verifies if round is complete (13 completed tricks).
   */
  isRoundComplete(completedTricksCount: number): boolean;

  /**
   * Verifies if match is complete (all rounds completed, typically 5 rounds).
   */
  isMatchComplete(currentRound: number, totalRounds: number): boolean;

  /**
   * Determines overall match winner and ranked standings.
   */
  rankPlayersByScore(
    cumulativeScores: Readonly<Record<PlayerPosition, number>>
  ): readonly { position: PlayerPosition; score: number; rank: number }[];
}
