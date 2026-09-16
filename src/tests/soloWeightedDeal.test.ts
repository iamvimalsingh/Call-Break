/**
 * Test Suite for Solo Human Deal Assist & Strict Multiplayer Fairness Guard
 * Verifies:
 * A. 1H + 3B, Human=SOUTH -> weighted deal targets SOUTH
 * B. 1H + 3B, Human=WEST  -> weighted deal targets WEST
 * C. 1H + 3B, Human=NORTH -> weighted deal targets NORTH
 * D. 1H + 3B, Human=EAST  -> weighted deal targets EAST
 * E. 2H + 2B              -> standard unbiased deal
 * F. 3H + 1B              -> standard unbiased deal
 * G. 4H                   -> standard unbiased deal
 * H. 0H + 4B              -> standard unbiased deal
 * I. Re-bid with 1H + 3B  -> weighted redeal
 * J. Re-bid with 2+ Humans-> standard redeal
 * K. All deals preserve 52-card/13-card invariants
 * L. Existing OFFLINE_BOTS weighted behavior remains intact
 */

import { TestHarness } from './testHarness';
import { CardEngine } from '../core/deck/CardEngine';
import { calculateHCP } from '../core/deck/Deck';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { createInitialGameState, createInitialPlayers } from '../core/state/initialState';
import { GameMode, GameState, PlayerPosition, PlayerType } from '../models';

function createCustomMatchState(
  humanPositions: PlayerPosition[],
  mode: GameMode = GameMode.ONLINE_MULTIPLAYER
): GameState {
  const base = createInitialGameState(mode);
  const players = createInitialPlayers();

  for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
    const isHuman = humanPositions.includes(pos);
    players[pos] = {
      ...players[pos],
      type: isHuman ? PlayerType.HUMAN : PlayerType.BOT,
      name: isHuman ? `Human ${pos}` : `Bot ${pos}`,
    };
  }

  return {
    ...base,
    players,
  };
}

export function buildSoloWeightedDealTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Solo Human Deal Assist & Fairness';

  harness.register(
    category,
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

  // A. 1H + 3B, Human=SOUTH -> weighted deal targets SOUTH
  harness.register(
    category,
    'A. 1H + 3B, Human=SOUTH -> weighted deal targets SOUTH',
    () => {
      let targetedPosition: PlayerPosition | null = null;
      const cardEngine = new CardEngine();
      const originalDealWeighted = cardEngine.dealWeighted!.bind(cardEngine);
      cardEngine.dealWeighted = (deck, target = PlayerPosition.SOUTH) => {
        targetedPosition = target;
        return originalDealWeighted(deck, target);
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.SOUTH]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (targetedPosition !== PlayerPosition.SOUTH) {
        throw new Error(`Expected dealWeighted to target SOUTH, got ${targetedPosition}`);
      }
      if (roundState.players[PlayerPosition.SOUTH].hand.length !== 13) {
        throw new Error('SOUTH hand must have 13 cards');
      }
    }
  );

  // B. 1H + 3B, Human=WEST -> weighted deal targets WEST
  harness.register(
    category,
    'B. 1H + 3B, Human=WEST -> weighted deal targets WEST',
    () => {
      let targetedPosition: PlayerPosition | null = null;
      const cardEngine = new CardEngine();
      const originalDealWeighted = cardEngine.dealWeighted!.bind(cardEngine);
      cardEngine.dealWeighted = (deck, target = PlayerPosition.SOUTH) => {
        targetedPosition = target;
        return originalDealWeighted(deck, target);
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.WEST]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (targetedPosition !== PlayerPosition.WEST) {
        throw new Error(`Expected dealWeighted to target WEST, got ${targetedPosition}`);
      }
      if (roundState.players[PlayerPosition.WEST].hand.length !== 13) {
        throw new Error('WEST hand must have 13 cards');
      }
    }
  );

  // C. 1H + 3B, Human=NORTH -> weighted deal targets NORTH
  harness.register(
    category,
    'C. 1H + 3B, Human=NORTH -> weighted deal targets NORTH',
    () => {
      let targetedPosition: PlayerPosition | null = null;
      const cardEngine = new CardEngine();
      const originalDealWeighted = cardEngine.dealWeighted!.bind(cardEngine);
      cardEngine.dealWeighted = (deck, target = PlayerPosition.SOUTH) => {
        targetedPosition = target;
        return originalDealWeighted(deck, target);
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.NORTH]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (targetedPosition !== PlayerPosition.NORTH) {
        throw new Error(`Expected dealWeighted to target NORTH, got ${targetedPosition}`);
      }
      if (roundState.players[PlayerPosition.NORTH].hand.length !== 13) {
        throw new Error('NORTH hand must have 13 cards');
      }
    }
  );

  // D. 1H + 3B, Human=EAST -> weighted deal targets EAST
  harness.register(
    category,
    'D. 1H + 3B, Human=EAST -> weighted deal targets EAST',
    () => {
      let targetedPosition: PlayerPosition | null = null;
      const cardEngine = new CardEngine();
      const originalDealWeighted = cardEngine.dealWeighted!.bind(cardEngine);
      cardEngine.dealWeighted = (deck, target = PlayerPosition.SOUTH) => {
        targetedPosition = target;
        return originalDealWeighted(deck, target);
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.EAST]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (targetedPosition !== PlayerPosition.EAST) {
        throw new Error(`Expected dealWeighted to target EAST, got ${targetedPosition}`);
      }
      if (roundState.players[PlayerPosition.EAST].hand.length !== 13) {
        throw new Error('EAST hand must have 13 cards');
      }
    }
  );

  // E. 2H + 2B -> standard unbiased deal
  harness.register(
    category,
    'E. 2H + 2B -> standard unbiased deal (dealWeighted NOT called)',
    () => {
      let weightedCalled = false;
      const cardEngine = new CardEngine();
      cardEngine.dealWeighted = () => {
        weightedCalled = true;
        throw new Error('dealWeighted should NOT be called for 2 Humans');
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.SOUTH, PlayerPosition.NORTH]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (weightedCalled) {
        throw new Error('dealWeighted was invoked for 2 Humans');
      }
      if (roundState.players[PlayerPosition.SOUTH].hand.length !== 13) {
        throw new Error('Expected 13 cards in hand');
      }
    }
  );

  // F. 3H + 1B -> standard unbiased deal
  harness.register(
    category,
    'F. 3H + 1B -> standard unbiased deal (dealWeighted NOT called)',
    () => {
      let weightedCalled = false;
      const cardEngine = new CardEngine();
      cardEngine.dealWeighted = () => {
        weightedCalled = true;
        throw new Error('dealWeighted should NOT be called for 3 Humans');
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (weightedCalled) {
        throw new Error('dealWeighted was invoked for 3 Humans');
      }
      if (roundState.players[PlayerPosition.WEST].hand.length !== 13) {
        throw new Error('Expected 13 cards in hand');
      }
    }
  );

  // G. 4H -> standard unbiased deal
  harness.register(
    category,
    'G. 4H -> standard unbiased deal (dealWeighted NOT called)',
    () => {
      let weightedCalled = false;
      const cardEngine = new CardEngine();
      cardEngine.dealWeighted = () => {
        weightedCalled = true;
        throw new Error('dealWeighted should NOT be called for 4 Humans');
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([
        PlayerPosition.SOUTH,
        PlayerPosition.WEST,
        PlayerPosition.NORTH,
        PlayerPosition.EAST,
      ]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (weightedCalled) {
        throw new Error('dealWeighted was invoked for 4 Humans');
      }
      if (roundState.players[PlayerPosition.EAST].hand.length !== 13) {
        throw new Error('Expected 13 cards in hand');
      }
    }
  );

  // H. 0H + 4B -> standard unbiased deal
  harness.register(
    category,
    'H. 0H + 4B -> standard unbiased deal (dealWeighted NOT called)',
    () => {
      let weightedCalled = false;
      const cardEngine = new CardEngine();
      cardEngine.dealWeighted = () => {
        weightedCalled = true;
        throw new Error('dealWeighted should NOT be called for 0 Humans');
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      if (weightedCalled) {
        throw new Error('dealWeighted was invoked for 0 Humans');
      }
      if (roundState.players[PlayerPosition.SOUTH].hand.length !== 13) {
        throw new Error('Expected 13 cards in hand');
      }
    }
  );

  // I. Re-bid with 1H + 3B -> weighted redeal
  harness.register(
    category,
    'I. Re-bid with 1H + 3B -> weighted redeal targeting the Human seat',
    () => {
      let redealTarget: PlayerPosition | null = null;
      const cardEngine = new CardEngine();
      const originalDealWeighted = cardEngine.dealWeighted!.bind(cardEngine);
      cardEngine.dealWeighted = (deck, target = PlayerPosition.SOUTH) => {
        redealTarget = target;
        return originalDealWeighted(deck, target);
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.WEST]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      // Trigger redealRound
      redealTarget = null;
      const redealtState = rulesEngine.redealRound(roundState, cardEngine);

      if (redealTarget !== PlayerPosition.WEST) {
        throw new Error(`Expected redealRound to target WEST, got ${redealTarget}`);
      }
      if (redealtState.players[PlayerPosition.WEST].hand.length !== 13) {
        throw new Error('WEST hand must have 13 cards after redeal');
      }
    }
  );

  // J. Re-bid with 2+ Humans -> standard redeal
  harness.register(
    category,
    'J. Re-bid with 2+ Humans -> standard redeal (dealWeighted NOT called)',
    () => {
      let weightedCalled = false;
      const cardEngine = new CardEngine();
      cardEngine.dealWeighted = () => {
        weightedCalled = true;
        throw new Error('dealWeighted should NOT be called on redeal for 2+ Humans');
      };

      const rulesEngine = new CallBreakRulesEngine();
      const state = createCustomMatchState([PlayerPosition.SOUTH, PlayerPosition.EAST]);
      const roundState = rulesEngine.initializeRound(state, cardEngine);

      weightedCalled = false;
      const redealtState = rulesEngine.redealRound(roundState, cardEngine);

      if (weightedCalled) {
        throw new Error('dealWeighted was invoked on redeal for 2+ Humans');
      }
      if (redealtState.players[PlayerPosition.EAST].hand.length !== 13) {
        throw new Error('Expected 13 cards in hand after redeal');
      }
    }
  );

  // K. All deals preserve 52-card/13-card invariants
  harness.register(
    category,
    'K. All deals preserve 52-card / 13-card invariants with zero duplicates',
    () => {
      const cardEngine = new CardEngine();
      const rulesEngine = new CallBreakRulesEngine();

      for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
        const state = createCustomMatchState([pos]);
        const roundState = rulesEngine.initializeRound(state, cardEngine);

        const allCardIds = new Set<string>();
        for (const p of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
          const hand = roundState.players[p].hand;
          if (hand.length !== 13) {
            throw new Error(`Player ${p} does not have 13 cards`);
          }
          for (const card of hand) {
            if (allCardIds.has(card.id)) {
              throw new Error(`Duplicate card detected: ${card.id}`);
            }
            allCardIds.add(card.id);
          }
        }
        if (allCardIds.size !== 52) {
          throw new Error(`Expected exactly 52 unique card IDs, got ${allCardIds.size}`);
        }
      }
    }
  );

  // L. Existing OFFLINE_BOTS weighted behavior remains intact
  harness.register(
    category,
    'L. Existing OFFLINE_BOTS weighted behavior remains intact (South boost)',
    () => {
      const cardEngine = new CardEngine();
      const rulesEngine = new CallBreakRulesEngine();
      const initialState = createInitialGameState(GameMode.OFFLINE_BOTS);

      let totalSouthHCP = 0;
      const rounds = 10;

      for (let r = 0; r < rounds; r++) {
        const roundState = rulesEngine.initializeRound(initialState, cardEngine);
        const southHand = roundState.players[PlayerPosition.SOUTH].hand;

        if (southHand.length !== 13) {
          throw new Error(`Expected 13 cards in South hand, got ${southHand.length}`);
        }

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
      if (avgSouthHCP < 14.5) {
        throw new Error(`Expected South HCP average to be boosted above 14.5, got ${avgSouthHCP.toFixed(2)}`);
      }
    }
  );

  return harness;
}

