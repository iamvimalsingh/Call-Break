/**
 * Medium Call Break Bot Strategy Implementation
 * Fully deterministic, rule-aware heuristic decision engine.
 * Decoupled from UI and external APIs.
 * Phase 5 Bot Intelligence & Strategy Engine
 */

import { Card } from '../../models/card';
import {
  BiddingContext,
  BotDifficulty,
  CardPlayDecision,
  HandEvaluation,
  IBotStrategy,
  PlayCardContext,
} from '../contracts/IBotStrategy';
import { IRandomSource } from '../random/IRandomSource';
import { evaluateHandStrength } from './botBidding';
import { selectMediumCardPlay } from './botCardPlay';

export interface BotStrategyOptions {
  readonly randomSource?: IRandomSource;
}

export class MediumBotStrategy implements IBotStrategy {
  public readonly difficulty = BotDifficulty.MEDIUM;
  private readonly randomSource?: IRandomSource;

  constructor(options?: BotStrategyOptions) {
    this.randomSource = options?.randomSource;
  }

  /**
   * Predicts/decides optimal call/bid (1 to 13) for the bot's hand.
   */
  public decideBid(hand: readonly Card[], context: BiddingContext): number {
    const evaluation = this.evaluateHand(hand, context);
    return evaluation.recommendedBid;
  }

  /**
   * Decides which legal card to play during the bot's turn.
   */
  public decideCardPlay(context: PlayCardContext): Card {
    const decision = this.decideCardPlayWithDetails(context);
    return decision.card;
  }

  /**
   * Evaluates hand strength and returns estimated tricks breakdown for testing and diagnostics.
   */
  public evaluateHand(hand: readonly Card[], context: BiddingContext): HandEvaluation {
    return evaluateHandStrength(hand, context);
  }

  /**
   * Evaluates card play and returns both the selected card and the strategy reasoning label.
   */
  public decideCardPlayWithDetails(context: PlayCardContext): CardPlayDecision {
    return selectMediumCardPlay(context);
  }
}
