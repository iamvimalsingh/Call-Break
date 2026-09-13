/**
 * Bot AI Strategy Layer Contract (Phase 5 Target)
 * Operates purely offline on game state without external AI/API dependencies.
 * Phase 1 Architecture Foundation
 */

import { Card, Suit } from '../../models/card';
import { PlayerPosition } from '../../models/player';
import { CompletedTrick, TrickState } from '../../models/gameState';

export enum BotDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXPERT = 'EXPERT',
}

export interface BiddingContext {
  readonly position: PlayerPosition;
  readonly dealer: PlayerPosition;
  readonly existingBids: Readonly<Record<PlayerPosition, number | null>>;
  readonly trumpSuit: Suit;
}

export interface PlayCardContext {
  readonly position: PlayerPosition;
  readonly hand: readonly Card[];
  readonly legalMoves: readonly Card[];
  readonly currentTrick: TrickState;
  readonly trumpSuit: Suit;
  readonly playerBid: number;
  readonly playerTricksWon: number;
  readonly remainingCardsCount: Readonly<Record<PlayerPosition, number>>;
  readonly completedTricks?: readonly CompletedTrick[];
}

export interface CardPlayDecision {
  readonly card: Card;
  readonly reasoning: string;
}

export interface HandEvaluation {
  readonly estimatedTricks: number;
  readonly recommendedBid: number;
  readonly spadeStrength: number;
  readonly highCardStrength: number;
  readonly lengthBonus: number;
  readonly voidBonus: number;
}

export interface IBotStrategy {
  readonly difficulty: BotDifficulty;

  /**
   * Predicts/decides optimal call/bid (1 to 13) for the bot's hand.
   */
  decideBid(hand: readonly Card[], context: BiddingContext): Promise<number> | number;

  /**
   * Decides which legal card to play during the bot's turn.
   */
  decideCardPlay(context: PlayCardContext): Promise<Card> | Card;

  /**
   * Optional evaluation method for hand diagnostics.
   */
  evaluateHand?(hand: readonly Card[], context: BiddingContext): HandEvaluation;

  /**
   * Optional detailed card play method providing diagnostic reasoning.
   */
  decideCardPlayWithDetails?(context: PlayCardContext): CardPlayDecision;
}
