/**
 * QA Bot Safety & Information Boundary Verifier
 * Audits bot contexts to ensure no forbidden information (hidden cards, RNG seed, future cards)
 * leaks to AI bots during decision-making.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { PlayCardContext, BiddingContext } from '../../core/contracts/IBotStrategy';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { InvariantViolation } from './QATypes';

export class QABotSafetyVerifier {
  /**
   * Verifies that the BiddingContext provided to a bot contains strictly legal public information.
   */
  public static verifyBiddingContext(context: BiddingContext): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (!context || typeof context !== 'object') {
      violations.push({
        category: 'BOT_INFORMATION_BARRIER',
        message: 'BiddingContext is null or malformed',
      });
      return violations;
    }

    // Check that context does NOT contain any private player hand properties
    const keys = Object.keys(context);
    const forbiddenKeys = ['hiddenHands', 'deck', 'unplayedCards', 'rngSeed', 'futureCards', 'allHands'];
    for (const forbidden of forbiddenKeys) {
      if (keys.includes(forbidden)) {
        violations.push({
          category: 'BOT_INFORMATION_BARRIER',
          message: `BiddingContext leaked forbidden property: ${forbidden}`,
        });
      }
    }

    return violations;
  }

  /**
   * Verifies that PlayCardContext provided to a bot does not expose opponent hidden hands.
   */
  public static verifyPlayCardContext(context: PlayCardContext): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (!context || typeof context !== 'object') {
      violations.push({
        category: 'BOT_INFORMATION_BARRIER',
        message: 'PlayCardContext is null or malformed',
      });
      return violations;
    }

    const keys = Object.keys(context);
    const forbiddenKeys = ['hiddenHands', 'deck', 'unplayedCards', 'rngSeed', 'futureCards', 'allHands'];
    for (const forbidden of forbiddenKeys) {
      if (keys.includes(forbidden)) {
        violations.push({
          category: 'BOT_INFORMATION_BARRIER',
          message: `PlayCardContext leaked forbidden property: ${forbidden}`,
        });
      }
    }

    // Ensure remainingCardsCount provides ONLY integer counts, not actual cards
    if (context.remainingCardsCount) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        const val = context.remainingCardsCount[pos];
        if (typeof val !== 'number' || val < 0 || val > 13) {
          violations.push({
            category: 'BOT_INFORMATION_BARRIER',
            message: `Invalid remainingCardsCount for ${pos}: ${String(val)}`,
          });
        }
      }
    }

    return violations;
  }
}
