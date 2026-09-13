/**
 * Bot Strategy Factory
 * Instantiates deterministic bot strategies based on difficulty level.
 * Phase 5 Bot Intelligence & Strategy Engine
 */

import { BotDifficulty, IBotStrategy } from '../contracts/IBotStrategy';
import { IRandomSource } from '../random/IRandomSource';
import { EasyBotStrategy } from './EasyBotStrategy';
import { MediumBotStrategy } from './MediumBotStrategy';

export interface CreateBotStrategyOptions {
  readonly randomSource?: IRandomSource;
}

export class BotStrategyFactory {
  /**
   * Creates an IBotStrategy corresponding to the requested BotDifficulty.
   */
  public static create(
    difficulty: BotDifficulty = BotDifficulty.MEDIUM,
    options?: CreateBotStrategyOptions
  ): IBotStrategy {
    switch (difficulty) {
      case BotDifficulty.EASY:
        return new EasyBotStrategy();

      case BotDifficulty.MEDIUM:
        return new MediumBotStrategy(options);

      case BotDifficulty.HARD:
      case BotDifficulty.EXPERT:
        // Hard/Expert foundations use Medium as baseline in Phase 5
        return new MediumBotStrategy(options);

      default:
        return new MediumBotStrategy(options);
    }
  }
}
