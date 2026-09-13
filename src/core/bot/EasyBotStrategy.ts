/**
 * Easy Call Break Bot Strategy Implementation
 * Naive rule-respecting baseline bot strategy.
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
import { evaluateHandStrength } from './botBidding';

export class EasyBotStrategy implements IBotStrategy {
  public readonly difficulty = BotDifficulty.EASY;

  public decideBid(hand: readonly Card[], context: BiddingContext): number {
    const evalResult = evaluateHandStrength(hand, context);
    // Easy bot bids more conservatively or naively
    return Math.max(1, Math.min(13, Math.floor(evalResult.recommendedBid)));
  }

  public decideCardPlay(context: PlayCardContext): Card {
    const decision = this.decideCardPlayWithDetails(context);
    return decision.card;
  }

  public evaluateHand(hand: readonly Card[], context: BiddingContext): HandEvaluation {
    return evaluateHandStrength(hand, context);
  }

  public decideCardPlayWithDetails(context: PlayCardContext): CardPlayDecision {
    const legal = context.legalMoves;
    if (!legal || legal.length === 0) {
      return { card: context.hand[0], reasoning: 'Fallback: no legal moves' };
    }

    // Easy strategy: plays lowest legal card
    const sorted = [...legal].sort((a, b) => a.value - b.value);
    const chosen = sorted[0];
    return {
      card: chosen,
      reasoning: `Easy bot: playing lowest legal card (${chosen.rank} of ${chosen.suit})`,
    };
  }
}
