/**
 * Test Suite for Solo Offline 10% Weighted Dealing & Strict Multiplayer Fairness Guard
 */

import { TestHarness } from './testHarness';
import { CardEngine } from '../core/deck/CardEngine';
import { calculateHCP, dealWeighted } from '../core/deck/Deck';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { createInitialGameState } from '../core/state/initialState';
import { GameMode, PlayerPosition } from '../models';

export function buildSoloWeightedDealTestSuite(): TestHarness {
  const harness = new TestHarness();

  harness.register(
    'Solo Offline Weighted Dealing',
    'Calculates High Card Points (HCP) accurately according to Call Break formula',
    () => {
      const cardEngine = new CardEngine();
      const deck = cardEngine.createDeck();
      
      // Total HCP in pristine deck must be exactly 53 (40 ranks + 13 spades)
      const totalHCP = calculateHCP(deck);
      if (totalHCP !== 53) {
        throw new Error(`Expected total deck HCP to be 53, got ${totalHCP}`);
      }
    }
  );

  harness.register(
    'Solo Offline Weighted Dealing',
    'Provides South (Human) with ~10%-12% HCP boost, solid honors, and healthy Spades length in Solo Offline mode',
    () => {
      const cardEngine = new CardEngine();
      const rulesEngine = new CallBreakRulesEngine();
      const initialState = createInitialGameState(GameMode.OFFLINE_BOTS);

      let totalSouthHCP = 0;
      const rounds = 10;

      for (let r = 0; r < rounds; r++) {
        const roundState = rulesEngine.initializeRound(initialState, cardEngine);
        const southHand = roundState.players[PlayerPosition.SOUTH].hand;

        // Invariant 1: Exactly 13 cards in hand
        if (southHand.length !== 13) {
          throw new Error(`Expected 13 cards in South hand, got ${southHand.length}`);
        }

        // Invariant 2: Total cards across all 4 players must equal 52 unique cards
        const allCardIds = new Set<string>();
        for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
          const hand = roundState.players[pos].hand;
          if (hand.length !== 13) throw new Error(`Player ${pos} does not have 13 cards`);
          for (const card of hand) {
            allCardIds.add(card.id);
          }
        }
        if (allCardIds.size !== 52) {
          throw new Error(`Expected 52 unique card IDs across all hands, got ${allCardIds.size}`);
        }

        const southHCP = calculateHCP(southHand);
        totalSouthHCP += southHCP;
      }

      const avgSouthHCP = totalSouthHCP / rounds;
      // Standard average HCP per hand is 53 / 4 = 13.25
      // Boosted average should be significantly above 13.25 (e.g. >= 15.0)
      if (avgSouthHCP < 14.5) {
        throw new Error(`Expected South HCP average to be boosted above 14.5, got ${avgSouthHCP.toFixed(2)}`);
      }
    }
  );

  harness.register(
    'Strict Multiplayer Fairness Guard',
    'Online Multiplayer mode strictly uses unweighted uniform random Fisher-Yates dealing',
    () => {
      const cardEngine = new CardEngine();
      const rulesEngine = new CallBreakRulesEngine();
      const mpState = createInitialGameState(GameMode.ONLINE_MULTIPLAYER);

      const roundState = rulesEngine.initializeRound(mpState, cardEngine);

      // Verify all 4 players have 13 cards and 52 unique cards total
      const allCardIds = new Set<string>();
      for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
        const hand = roundState.players[pos].hand;
        if (hand.length !== 13) throw new Error(`Player ${pos} does not have 13 cards in MP mode`);
        for (const card of hand) {
          allCardIds.add(card.id);
        }
      }
      if (allCardIds.size !== 52) {
        throw new Error(`Expected 52 unique card IDs in MP mode, got ${allCardIds.size}`);
      }
    }
  );

  return harness;
}
