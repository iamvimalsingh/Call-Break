/**
 * Call Break Scoring Policies
 * Pure domain abstractions defining scoring calculations.
 * Allows future clients/products to configure overtrick values or penalty modes
 * without modifying rules or controllers.
 * Phase 4 Call Break Scoring Engine
 */

import { IScoringPolicy } from '../contracts/IScoringEngine';

/**
 * Rounds a floating-point number to a specified decimal precision.
 * Avoids IEEE-754 binary floating point accumulation issues (e.g. 5.1 + 0.1 = 5.200000000000001).
 */
export function roundToPrecision(value: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Standard Call Break Scoring Policy:
 * - If tricksWon >= bid: roundScore = bid + (tricksWon - bid) * 0.1
 * - If tricksWon < bid:  roundScore = -bid
 */
export class StandardCallBreakScoringPolicy implements IScoringPolicy {
  public readonly name: string = 'Standard Call Break Policy';
  public readonly minBid: number = 1;
  public readonly maxBid: number = 13;
  public readonly overtrickValue: number = 0.1;
  public readonly failedBidPenaltyMode: 'NEGATIVE_BID' = 'NEGATIVE_BID';

  public calculatePlayerRoundScore(bid: number, tricksWon: number): number {
    if (tricksWon >= bid) {
      const overtricks = tricksWon - bid;
      const score = bid + overtricks * this.overtrickValue;
      return roundToPrecision(score, 1);
    } else {
      return roundToPrecision(-bid, 1);
    }
  }
}

/**
 * Configurable Scoring Policy Factory
 * Facilitates custom rulesets (e.g. 0.2 overtrick bonus, zero penalty mode)
 * for future game modes or test variations.
 */
export class ConfigurableScoringPolicy implements IScoringPolicy {
  public readonly name: string;
  public readonly minBid: number;
  public readonly maxBid: number;
  public readonly overtrickValue: number;
  public readonly failedBidPenaltyMode: 'NEGATIVE_BID' | 'FIXED_PENALTY' | 'ZERO';
  private readonly customCalculator?: (bid: number, tricksWon: number) => number;

  constructor(options: {
    name?: string;
    minBid?: number;
    maxBid?: number;
    overtrickValue?: number;
    failedBidPenaltyMode?: 'NEGATIVE_BID' | 'FIXED_PENALTY' | 'ZERO';
    customCalculator?: (bid: number, tricksWon: number) => number;
  } = {}) {
    this.name = options.name ?? 'Custom Configurable Policy';
    this.minBid = options.minBid ?? 1;
    this.maxBid = options.maxBid ?? 13;
    this.overtrickValue = options.overtrickValue ?? 0.1;
    this.failedBidPenaltyMode = options.failedBidPenaltyMode ?? 'NEGATIVE_BID';
    this.customCalculator = options.customCalculator;
  }

  public calculatePlayerRoundScore(bid: number, tricksWon: number): number {
    if (this.customCalculator) {
      return roundToPrecision(this.customCalculator(bid, tricksWon), 1);
    }

    if (tricksWon >= bid) {
      const overtricks = tricksWon - bid;
      return roundToPrecision(bid + overtricks * this.overtrickValue, 1);
    } else {
      switch (this.failedBidPenaltyMode) {
        case 'ZERO':
          return 0;
        case 'FIXED_PENALTY':
          return -10;
        case 'NEGATIVE_BID':
        default:
          return roundToPrecision(-bid, 1);
      }
    }
  }
}
