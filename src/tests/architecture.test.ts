/**
 * Phase 1 Architecture Verification Tests
 * Validates layer separation, domain models, store contract, and headless operation.
 */

import { TestHarness, assert, assertDefined } from './testHarness';
import { Suit, Rank, RANK_VALUES, DEFAULT_TRUMP_SUIT } from '../models/card';
import { PlayerPosition, PlayerType } from '../models/player';
import { GameStatus, GameMode } from '../models/gameState';
import { GameStateStore } from '../core/state/gameStore';
import { createInitialGameState } from '../core/state/initialState';
import { LocalGameController } from '../core/controller/LocalGameController';
import { MemoryStorageAdapter } from '../services/storage/MemoryStorageAdapter';

export function buildArchitectureTestSuite(): TestHarness {
  const harness = new TestHarness();

  // Test 1: Domain Card Models & Trump Definition
  harness.register('Card Domain', 'Standard 4 Suits and 13 Ranks are defined', () => {
    const suits = Object.values(Suit);
    const ranks = Object.values(Rank);

    assert.equal(suits.length, 4, 'Must have exactly 4 suits');
    assert.equal(ranks.length, 13, 'Must have exactly 13 ranks');
    assert.equal(DEFAULT_TRUMP_SUIT, Suit.SPADES, 'Call Break default trump must be SPADES');
    assert.equal(RANK_VALUES[Rank.ACE], 14, 'Ace must have highest value (14)');
    assert.equal(RANK_VALUES[Rank.TWO], 2, 'Two must have lowest value (2)');
  });

  // Test 2: Centralized State Structure & 4-Player Layout
  harness.register('Game State', 'Initial state contains 4 player positions with pristine values', () => {
    const state = createInitialGameState();

    assert.ok(state.matchId, 'Match ID must be generated');
    assert.equal(state.status, GameStatus.IDLE, 'Initial game status must be IDLE');
    assert.equal(state.config.totalRounds, 5, 'Call Break standard must be 5 rounds');
    assert.equal(state.config.cardsPerPlayer, 13, 'Must be 13 cards per player');

    const positions = [
      PlayerPosition.SOUTH,
      PlayerPosition.WEST,
      PlayerPosition.NORTH,
      PlayerPosition.EAST,
    ];

    for (const pos of positions) {
      assertDefined(state.players[pos], `Player position ${pos} must exist in state`);
      assert.equal(state.players[pos].hand.length, 0, 'Initial hand must be empty before deal');
      assert.equal(state.players[pos].currentBid, null, 'Initial bid must be null before bidding');
      assert.equal(state.players[pos].tricksWon, 0, 'Initial tricks won must be 0');
    }

    assert.equal(state.players[PlayerPosition.SOUTH].type, PlayerType.HUMAN, 'South player must be HUMAN');
    assert.equal(state.players[PlayerPosition.WEST].type, PlayerType.BOT, 'West player must be BOT');
    assert.equal(state.players[PlayerPosition.NORTH].type, PlayerType.BOT, 'North player must be BOT');
    assert.equal(state.players[PlayerPosition.EAST].type, PlayerType.BOT, 'East player must be BOT');
  });

  // Test 3: Centralized Game State Store Contract
  harness.register('State Layer', 'GameStateStore manages state transitions and subscription notifications', () => {
    const store = new GameStateStore();
    let notificationCount = 0;
    let latestStatus = store.getState().status;

    const unsubscribe = store.subscribe((st) => {
      notificationCount++;
      latestStatus = st.status;
    });

    // Initial subscription emits once immediately
    assert.equal(notificationCount, 1, 'Subscriber must receive initial state on registration');

    store.setState((prev) => ({
      ...prev,
      status: GameStatus.DEALING,
    }));

    assert.equal(notificationCount, 2, 'Subscriber must be notified on state update');
    assert.equal(latestStatus, GameStatus.DEALING, 'State update must be reflected in subscriber');

    unsubscribe();
    store.setState((prev) => ({
      ...prev,
      status: GameStatus.BIDDING,
    }));

    assert.equal(notificationCount, 2, 'Unsubscribed listener must not receive further notifications');
  });

  // Test 4: Game Controller Layer Decoupling
  harness.register('Controller Layer', 'LocalGameController coordinates state without UI coupling', () => {
    const store = new GameStateStore();
    const controller = new LocalGameController(store);

    controller.initMatch(GameMode.OFFLINE_BOTS);
    assert.equal(store.getState().status, GameStatus.IDLE);

    controller.startRound();
    assert.equal(store.getState().status, GameStatus.DEALING);

    const bidSuccess = controller.submitBid(PlayerPosition.SOUTH, 3);
    assert.ok(bidSuccess, 'Valid bid (3) must be accepted');
    assert.equal(store.getState().players[PlayerPosition.SOUTH].currentBid, 3);

    const invalidBid = controller.submitBid(PlayerPosition.SOUTH, 15);
    assert.equal(invalidBid, false, 'Invalid bid (> 13) must be rejected');
  });

  // Test 5: Persistence Layer Abstraction
  harness.register('Persistence Layer', 'MemoryStorageAdapter saves, loads, and clears game state headlessly', async () => {
    const adapter = new MemoryStorageAdapter();
    const state = createInitialGameState();

    const saved = await adapter.saveGame(state);
    assert.ok(saved, 'Save game should return true');

    const loaded = await adapter.loadSavedGame();
    assertDefined(loaded, 'Loaded state must exist');
    assert.equal(loaded.matchId, state.matchId, 'Loaded state must match saved matchId');

    const cleared = await adapter.clearSavedGame();
    assert.ok(cleared, 'Clear game should return true');

    const afterClear = await adapter.loadSavedGame();
    assert.equal(afterClear, null, 'Loaded state after clear must be null');
  });

  return harness;
}
