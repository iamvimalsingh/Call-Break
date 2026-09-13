/**
 * Phase 11 Save/Resume & Reliability Automated Test Suite
 * Validates session persistence, state restoration, 52-card conservation integrity,
 * corruption rejection, and seamless match resumption without redealing.
 */

import { TestHarness, assert } from './testHarness';
import { GameState, GameStatus } from '../models/gameState';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../models/player';
import { CardEngine } from '../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../core/scoring/ScoringEngine';
import { LocalGameController } from '../core/controller/LocalGameController';
import { GameStateStore } from '../core/state/gameStore';
import { MemoryStorageAdapter } from '../services/storage/MemoryStorageAdapter';
import { ActiveGameService } from '../core/persistence/ActiveGameService';
import { validateResumableGameState } from '../core/persistence/gameStateValidation';
import { DeterministicRandomSource } from '../core/random/IRandomSource';

export function buildPhase11SaveResumeTestSuite(): TestHarness {
  const harness = new TestHarness();

  // Test 1: Conservation Check - Pristine State
  harness.register('Phase 11: Validation', 'Validates a pristine in-progress game state', () => {
    const cardEngine = new CardEngine(new DeterministicRandomSource(101));
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const store = new GameStateStore();
    const memoryAdapter = new MemoryStorageAdapter();

    const controller = new LocalGameController(store, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      persistenceAdapter: memoryAdapter,
    });

    controller.startNewMatch();
    const state = store.getState();

    const result = validateResumableGameState(state);
    assert.equal(result.isValid, true);
    assert.equal(result.error, undefined);
  });

  // Test 2: Conservation Check - Duplicate Card Rejection
  harness.register('Phase 11: Validation', 'Rejects state when duplicate card exists across hands', () => {
    const cardEngine = new CardEngine(new DeterministicRandomSource(102));
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const store = new GameStateStore();

    const controller = new LocalGameController(store, { cardEngine, rulesEngine, scoringEngine });
    controller.startNewMatch();
    const state = store.getState();

    // Duplicate South's card into North's hand
    const cardToDuplicate = state.players[PlayerPosition.SOUTH].hand[0];
    const corruptedState: GameState = {
      ...state,
      players: {
        ...state.players,
        [PlayerPosition.NORTH]: {
          ...state.players[PlayerPosition.NORTH],
          hand: [cardToDuplicate, ...state.players[PlayerPosition.NORTH].hand.slice(1)],
        },
      },
    };

    const result = validateResumableGameState(corruptedState);
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes('Duplicate card') ?? false);
  });

  // Test 3: Conservation Check - Missing Card Rejection
  harness.register('Phase 11: Validation', 'Rejects state when deck count is fewer than 52 cards', () => {
    const cardEngine = new CardEngine(new DeterministicRandomSource(103));
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const store = new GameStateStore();

    const controller = new LocalGameController(store, { cardEngine, rulesEngine, scoringEngine });
    controller.startNewMatch();
    const state = store.getState();

    // Remove one card from East (51 total)
    const corruptedState: GameState = {
      ...state,
      players: {
        ...state.players,
        [PlayerPosition.EAST]: {
          ...state.players[PlayerPosition.EAST],
          hand: state.players[PlayerPosition.EAST].hand.slice(1),
        },
      },
    };

    const result = validateResumableGameState(corruptedState);
    assert.equal(result.isValid, false);
    assert.ok(result.error?.includes('found 51') ?? false);
  });

  // Test 4: Status Boundary Validation
  harness.register('Phase 11: Validation', 'Rejects IDLE and MATCH_FINISHED as active games', () => {
    const store = new GameStateStore();
    const idleState = store.getState();
    assert.equal(validateResumableGameState(idleState).isValid, false);

    const finishedState: GameState = {
      ...idleState,
      status: GameStatus.MATCH_FINISHED,
    };
    assert.equal(validateResumableGameState(finishedState).isValid, false);
  });

  // Helper to complete bidding in correct clockwise order
  function completeAllBids(ctrl: LocalGameController, rEngine: CallBreakRulesEngine, str: GameStateStore): void {
    while (str.getState().status === GameStatus.BIDDING) {
      const cur = str.getState();
      const expected = rEngine.getExpectedBiddingPlayer(cur);
      if (!expected) break;
      ctrl.submitBid(expected, 3);
    }
  }

  // Test 5: Automatic Persistence on Gameplay Transitions
  harness.register('Phase 11: Persistence', 'Persists state on match start, bidding, and card plays', async () => {
    const cardEngine = new CardEngine(new DeterministicRandomSource(105));
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const memoryAdapter = new MemoryStorageAdapter();
    const store = new GameStateStore();

    const controller = new LocalGameController(store, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      persistenceAdapter: memoryAdapter,
    });

    controller.startNewMatch();
    let saved = await memoryAdapter.loadSavedGame();
    assert.ok(saved !== null);
    assert.equal(saved?.status, GameStatus.BIDDING);

    // First expected bidder submits bid
    const firstBidder = rulesEngine.getExpectedBiddingPlayer(store.getState())!;
    controller.submitBid(firstBidder, 3);
    saved = await memoryAdapter.loadSavedGame();
    assert.equal(saved?.players[firstBidder].currentBid, 3);

    // Complete remaining bids
    completeAllBids(controller, rulesEngine, store);

    saved = await memoryAdapter.loadSavedGame();
    assert.equal(saved?.status, GameStatus.PLAYING);

    const leader = store.getState().currentPlayer;
    const cardToPlay = store.getState().players[leader].hand[0];
    controller.playCard(leader, cardToPlay);

    saved = await memoryAdapter.loadSavedGame();
    assert.equal(saved?.currentTrick.cards.length, 1);
    assert.equal(saved?.currentTrick.cards[0].playerPosition, leader);
  });

  // Test 6: Exact State Parity Restoration Without Redeal
  harness.register('Phase 11: Resume', 'Restores exact in-progress trick, hands, and scores without redealing', async () => {
    const cardEngine = new CardEngine(new DeterministicRandomSource(106));
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const memoryAdapter = new MemoryStorageAdapter();
    const store1 = new GameStateStore();

    const controller1 = new LocalGameController(store1, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      persistenceAdapter: memoryAdapter,
    });

    controller1.startNewMatch();
    completeAllBids(controller1, rulesEngine, store1);

    // Play 2 cards into the first trick
    const p1 = store1.getState().currentPlayer;
    const c1 = store1.getState().players[p1].hand[0];
    controller1.playCard(p1, c1);

    const p2 = store1.getState().currentPlayer;
    const legalMovesP2 = controller1.getLegalMovesForPlayer(p2);
    controller1.playCard(p2, legalMovesP2[0]);

    const snapshot = store1.getState();
    assert.equal(snapshot.currentTrick.cards.length, 2);

    // Explicitly sync to adapter
    await memoryAdapter.saveGame(snapshot);

    // Simulate page refresh: Fresh store & controller reading from persistence
    const store2 = new GameStateStore();
    const controller2 = new LocalGameController(store2, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      persistenceAdapter: memoryAdapter,
    });

    let restoredEvent = false;
    store2.subscribeToEvents((e) => {
      if (e.type === 'MATCH_RESTORED') restoredEvent = true;
    });

    const hasActive = await controller2.hasSavedGame();
    assert.equal(hasActive, true);

    const didRestore = await controller2.restoreSavedGame();
    assert.equal(didRestore, true);
    assert.equal(restoredEvent, true);

    const restoredState = store2.getState();
    assert.equal(restoredState.matchId, snapshot.matchId);
    assert.equal(restoredState.currentRound, snapshot.currentRound);
    assert.equal(restoredState.status, snapshot.status);
    assert.equal(restoredState.currentPlayer, snapshot.currentPlayer);
    assert.equal(restoredState.currentTrick.cards.length, 2);

    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      assert.equal(restoredState.players[pos].hand.length, snapshot.players[pos].hand.length);
      assert.equal(restoredState.players[pos].currentBid, snapshot.players[pos].currentBid);
      assert.equal(restoredState.players[pos].tricksWon, snapshot.players[pos].tricksWon);
    }
  });

  // Test 7: Match Completion Clears Active Game
  harness.register('Phase 11: Cleanup', 'Clears active game when match is finished', async () => {
    const memoryAdapter = new MemoryStorageAdapter();
    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      cardEngine: new CardEngine(new DeterministicRandomSource(107)),
      rulesEngine: new CallBreakRulesEngine(),
      scoringEngine: new ScoringEngine(),
      persistenceAdapter: memoryAdapter,
    });

    controller.startNewMatch();
    assert.ok((await memoryAdapter.loadSavedGame()) !== null);

    // Mark match finished and trigger save
    store.setState((prev) => ({ ...prev, status: GameStatus.MATCH_FINISHED }));
    await memoryAdapter.saveGame(store.getState());

    assert.equal(await memoryAdapter.loadSavedGame(), null);
  });

  // Test 8: ActiveGameService Corrupted Storage Auto-Recovery
  harness.register('Phase 11: Recovery', 'Handles corrupted storage gracefully with auto-cleanup', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    };

    const service = new ActiveGameService(storage);

    // Corrupted syntax
    store.set('cb_lakdi_active_game_v1', 'corrupted-json-data');
    assert.equal(service.loadActiveGameSync(), null);
    assert.equal(store.has('cb_lakdi_active_game_v1'), false);

    // Invalid schema
    store.set('cb_lakdi_active_game_v1', JSON.stringify({ broken: true }));
    assert.equal(service.loadActiveGameSync(), null);
    assert.equal(store.has('cb_lakdi_active_game_v1'), false);
  });

  // Test 9: Mid-Match Resumed Game Completes 5 Rounds Flawlessly
  harness.register('Phase 11: Integration', 'Resumed match completes all 5 rounds without violations', async () => {
    const cardEngine = new CardEngine(new DeterministicRandomSource(999));
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const memoryAdapter = new MemoryStorageAdapter();

    // Session 1: Run through Round 1
    const store1 = new GameStateStore();
    const controller1 = new LocalGameController(store1, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      persistenceAdapter: memoryAdapter,
    });

    controller1.startNewMatch();
    completeAllBids(controller1, rulesEngine, store1);

    // Play 5 tricks (20 cards) of Round 1
    for (let c = 0; c < 20; c++) {
      const cur = store1.getState();
      const legal = controller1.getLegalMovesForPlayer(cur.currentPlayer);
      assert.ok(legal.length > 0, 'Must have legal moves');
      controller1.playCard(cur.currentPlayer, legal[0]);
    }

    assert.equal(store1.getState().completedTricks.length, 5);

    // Session 2: "Browser closed and reopened" - Restore from persistence
    const store2 = new GameStateStore();
    const controller2 = new LocalGameController(store2, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      persistenceAdapter: memoryAdapter,
    });

    const restored = await controller2.restoreSavedGame();
    assert.equal(restored, true);
    assert.equal(store2.getState().completedTricks.length, 5);

    // Complete remaining 8 tricks (32 cards) of Round 1
    for (let c = 0; c < 32; c++) {
      const cur = store2.getState();
      const legal = controller2.getLegalMovesForPlayer(cur.currentPlayer);
      assert.ok(legal.length > 0, 'Must have legal moves');
      controller2.playCard(cur.currentPlayer, legal[0]);
    }

    controller2.completeRound();
    assert.equal(store2.getState().status, GameStatus.ROUND_ENDED);
    assert.equal(store2.getState().roundScores.length, 1);

    // Play rounds 2 through 5 to verify match finishing
    for (let r = 2; r <= 5; r++) {
      controller2.nextRound();
      completeAllBids(controller2, rulesEngine, store2);
      for (let c = 0; c < 52; c++) {
        const cur = store2.getState();
        const legal = controller2.getLegalMovesForPlayer(cur.currentPlayer);
        assert.ok(legal.length > 0, 'Must have legal moves');
        controller2.playCard(cur.currentPlayer, legal[0]);
      }
      controller2.completeRound();
    }

    assert.equal(store2.getState().status, GameStatus.MATCH_FINISHED);
    assert.ok(store2.getState().matchResult !== null);
    // Active game should be cleared automatically
    assert.equal(await memoryAdapter.loadSavedGame(), null);
  });

  return harness;
}
