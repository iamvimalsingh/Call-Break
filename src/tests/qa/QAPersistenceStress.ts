/**
 * QA Persistence Stress Suite
 * Stress tests the Phase 11 Save/Resume mechanics across varied match phases and trick depths.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { GameStateStore } from '../../core/state/gameStore';
import { LocalGameController } from '../../core/controller/LocalGameController';
import { CardEngine } from '../../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../../core/scoring/ScoringEngine';
import { MemoryStorageAdapter } from '../../services/storage/MemoryStorageAdapter';
import { DeterministicRandomSource } from '../../core/random/IRandomSource';
import { GameStatus } from '../../models/gameState';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { validateResumableGameState } from '../../core/persistence/gameStateValidation';
import { InvariantViolation } from './QATypes';

export interface PersistenceTestPointResult {
  checkpoint: string;
  success: boolean;
  violations: InvariantViolation[];
}

export class QAPersistenceStress {
  /**
   * Executes a multi-checkpoint save/restore cycle through a complete game.
   */
  public static async runMultiCheckpointStress(seed: number = 4242): Promise<PersistenceTestPointResult[]> {
    const results: PersistenceTestPointResult[] = [];
    const memoryAdapter = new MemoryStorageAdapter();
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const rng = new DeterministicRandomSource(seed);
    const cardEngine = new CardEngine(rng);

    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      persistenceAdapter: memoryAdapter,
    });

    controller.startNewMatch();

    // Checkpoint 1: Immediately after deal (BIDDING phase)
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'DEAL_BIDDING'));

    // Submit 2 bids
    const b1 = rulesEngine.getExpectedBiddingPlayer(store.getState())!;
    controller.submitBid(b1, 3);
    const b2 = rulesEngine.getExpectedBiddingPlayer(store.getState())!;
    controller.submitBid(b2, 2);

    // Checkpoint 2: Mid-bidding (2 bids submitted)
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'MID_BIDDING'));

    // Complete remaining bids
    while (store.getState().status === GameStatus.BIDDING) {
      const b = rulesEngine.getExpectedBiddingPlayer(store.getState());
      if (!b) break;
      controller.submitBid(b, 3);
    }

    // Checkpoint 3: Start of Trick 1 (PLAYING phase, 0 cards played)
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'START_TRICK_1'));

    // Play 2 cards into Trick 1
    const p1 = store.getState().currentPlayer;
    const c1 = store.getState().players[p1].hand[0];
    controller.playCard(p1, c1);

    const p2 = store.getState().currentPlayer;
    const legal2 = controller.getLegalMovesForPlayer(p2);
    controller.playCard(p2, legal2[0]);

    // Checkpoint 4: Mid-trick (2 cards in trick)
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'MID_TRICK_2_CARDS'));

    // Complete Trick 1 (play cards 3 and 4)
    const p3 = store.getState().currentPlayer;
    const legal3 = controller.getLegalMovesForPlayer(p3);
    controller.playCard(p3, legal3[0]);

    const p4 = store.getState().currentPlayer;
    const legal4 = controller.getLegalMovesForPlayer(p4);
    controller.playCard(p4, legal4[0]);

    // Checkpoint 5: After 1 completed trick
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'AFTER_TRICK_1'));

    // Play through trick 7 (6 more tricks = 24 cards)
    for (let c = 0; c < 24; c++) {
      const cur = store.getState();
      const legal = controller.getLegalMovesForPlayer(cur.currentPlayer);
      controller.playCard(cur.currentPlayer, legal[0]);
    }

    // Checkpoint 6: Mid-round (after 7 tricks completed)
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'MID_ROUND_7_TRICKS'));

    // Finish round 1 (play until ROUND_ENDED)
    while (store.getState().status === GameStatus.PLAYING) {
      const cur = store.getState();
      const legal = controller.getLegalMovesForPlayer(cur.currentPlayer);
      controller.playCard(cur.currentPlayer, legal[0]);
    }

    // Checkpoint 7: Round ended (ROUND_ENDED phase, before scoring)
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'ROUND_1_ENDED'));

    controller.completeRound();
    controller.nextRound();

    // Checkpoint 8: Round 2 Deal
    results.push(await this.verifySaveAndResume(store, controller, memoryAdapter, 'ROUND_2_DEAL'));

    return results;
  }

  private static async verifySaveAndResume(
    liveStore: GameStateStore,
    liveController: LocalGameController,
    adapter: MemoryStorageAdapter,
    checkpointName: string
  ): Promise<PersistenceTestPointResult> {
    const violations: InvariantViolation[] = [];
    const snapshot = liveStore.getState();

    // Ensure snapshot is persisted
    await adapter.saveGame(snapshot);

    // Validate schema
    const validation = validateResumableGameState(snapshot);
    if (!validation.isValid) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `Snapshot at ${checkpointName} failed validation: ${validation.error}`,
      });
    }

    // Create fresh test store & controller to simulate page refresh / restart
    const freshStore = new GameStateStore();
    const freshController = new LocalGameController(freshStore, {
      cardEngine: new CardEngine(),
      rulesEngine: new CallBreakRulesEngine(),
      scoringEngine: new ScoringEngine(),
      persistenceAdapter: adapter,
    });

    const hasSaved = await freshController.hasSavedGame();
    if (!hasSaved) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `Fresh controller reported no saved game at checkpoint ${checkpointName}`,
      });
    }

    const restored = await freshController.restoreSavedGame();
    if (!restored) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `Fresh controller failed to restore saved game at checkpoint ${checkpointName}`,
      });
    }

    const restoredState = freshStore.getState();

    // Verify exact parity
    if (restoredState.matchId !== snapshot.matchId) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `MatchId mismatch: expected ${snapshot.matchId}, got ${restoredState.matchId}`,
      });
    }

    if (restoredState.currentRound !== snapshot.currentRound) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `CurrentRound mismatch: expected ${snapshot.currentRound}, got ${restoredState.currentRound}`,
      });
    }

    if (restoredState.status !== snapshot.status) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `Status mismatch: expected ${snapshot.status}, got ${restoredState.status}`,
      });
    }

    if (restoredState.currentPlayer !== snapshot.currentPlayer) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `CurrentPlayer mismatch: expected ${snapshot.currentPlayer}, got ${restoredState.currentPlayer}`,
      });
    }

    if (restoredState.currentTrick.cards.length !== snapshot.currentTrick.cards.length) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `CurrentTrick length mismatch: expected ${snapshot.currentTrick.cards.length}, got ${restoredState.currentTrick.cards.length}`,
      });
    }

    if (restoredState.completedTricks.length !== snapshot.completedTricks.length) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: `CompletedTricks count mismatch: expected ${snapshot.completedTricks.length}, got ${restoredState.completedTricks.length}`,
      });
    }

    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const snapHand = snapshot.players[pos]?.hand ?? [];
      const restHand = restoredState.players[pos]?.hand ?? [];
      if (snapHand.length !== restHand.length) {
        violations.push({
          category: 'PERSISTENCE_PARITY',
          message: `Player ${pos} hand length mismatch: expected ${snapHand.length}, got ${restHand.length}`,
          playerPosition: pos,
        });
      }

      // Exact card IDs preservation check (no redeal)
      const snapCardIds = snapHand.map((c) => c.id).sort().join(',');
      const restCardIds = restHand.map((c) => c.id).sort().join(',');
      if (snapCardIds !== restCardIds) {
        violations.push({
          category: 'PERSISTENCE_PARITY',
          message: `Player ${pos} hand cards changed upon restoration! Redeal detected at ${checkpointName}`,
          playerPosition: pos,
        });
      }

      if (restoredState.players[pos]?.currentBid !== snapshot.players[pos]?.currentBid) {
        violations.push({
          category: 'PERSISTENCE_PARITY',
          message: `Player ${pos} bid mismatch: expected ${snapshot.players[pos]?.currentBid}, got ${restoredState.players[pos]?.currentBid}`,
          playerPosition: pos,
        });
      }

      if (restoredState.players[pos]?.tricksWon !== snapshot.players[pos]?.tricksWon) {
        violations.push({
          category: 'PERSISTENCE_PARITY',
          message: `Player ${pos} tricksWon mismatch: expected ${snapshot.players[pos]?.tricksWon}, got ${restoredState.players[pos]?.tricksWon}`,
          playerPosition: pos,
        });
      }
    }

    return {
      checkpoint: checkpointName,
      success: violations.length === 0,
      violations,
    };
  }
}
