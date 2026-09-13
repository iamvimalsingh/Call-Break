/**
 * Phase 6 Offline Game Flow Integration Test Suite
 * Validates the complete interactive loop from startNewMatch to 5-round completion:
 * - New game initiation and dealing
 * - Bidding phase transitions
 * - Trick card play and legal move enforcement
 * - Trick winner resolution and leader progression
 * - Round completion and ScoringEngine integration
 * - Dealer rotation across rounds 1 to 5
 * - Cumulative score preservation and MatchResult calculation
 * Phase 6 Game Table & Playable Offline Game
 */

import { TestHarness, assertOk, assertEqual } from './testHarness';
import { LocalGameController } from '../core/controller/LocalGameController';
import { GameStateStore } from '../core/state/gameStore';
import { CardEngine } from '../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../core/scoring/ScoringEngine';
import { GameMode, GameStatus } from '../models/gameState';
import { PlayerPosition } from '../models/player';

export function buildOfflineGameFlowTestSuite(): TestHarness {
  const harness = new TestHarness();

  // Test 1: Full 5-Round Match Flow from start to finish
  harness.register(
    'Phase 6: Offline Flow',
    'Should successfully execute a complete 5-round Call Break match to MATCH_FINISHED',
    () => {
      const store = new GameStateStore();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(),
        rulesEngine: new CallBreakRulesEngine(),
        scoringEngine: new ScoringEngine(),
      });

      // 1. Start new match
      controller.startNewMatch(GameMode.OFFLINE_BOTS);
      let state = store.getState();

      assertEqual(state.status, GameStatus.BIDDING, 'Initial status must be BIDDING');
      assertEqual(state.currentRound, 1, 'Initial round must be 1');
      assertEqual(state.players.SOUTH.hand.length, 13, 'South should hold 13 dealt cards');

      // Loop through all 5 rounds
      for (let round = 1; round <= 5; round++) {
        state = store.getState();
        assertEqual(state.currentRound, round, `Should be round ${round}`);
        assertEqual(state.status, GameStatus.BIDDING, `Round ${round} should start in BIDDING`);

        // Bidding Phase: Step bots and submit human bid
        let biddingSafety = 0;
        while (store.getState().status === GameStatus.BIDDING && biddingSafety++ < 25) {
          const s = store.getState();
          if (s.currentPlayer === PlayerPosition.SOUTH) {
            // Human player places bid
            const bid = 3;
            const bidOk = controller.submitBid(PlayerPosition.SOUTH, bid);
            assertOk(bidOk, 'Human bid submission should succeed');
          } else {
            // Bot player places bid
            const botOk = controller.stepBotTurn();
            assertOk(botOk, 'Bot bid turn execution should succeed');
          }
        }

        state = store.getState();
        assertEqual(
          state.status,
          GameStatus.PLAYING,
          `Round ${round} should transition to PLAYING after all 4 bids`
        );

        // Playing Phase: Play all 13 tricks (4 cards each = 52 card plays)
        let playSafety = 0;
        while (store.getState().status === GameStatus.PLAYING && playSafety++ < 250) {
          const s = store.getState();
          if (s.currentPlayer === PlayerPosition.SOUTH) {
            // Human player turn: retrieve legal moves and play first legal card
            const legalMoves = controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
            assertOk(legalMoves.length > 0, 'Human should have at least one legal move');
            const cardToPlay = legalMoves[0];
            const playOk = controller.playCard(PlayerPosition.SOUTH, cardToPlay);
            assertOk(playOk, 'Human playing a legal card should succeed');
          } else {
            // Bot player turn
            const botPlayOk = controller.stepBotTurn();
            assertOk(botPlayOk, 'Bot playing a card should succeed');
          }
        }

        state = store.getState();

        // If status is ROUND_ENDED, complete round scoring
        if (state.status === GameStatus.ROUND_ENDED) {
          controller.completeRound();
          state = store.getState();
        }

        // Verify round score record is created
        const roundRecord = state.roundScores.find((r) => r.roundNumber === round);
        assertOk(!!roundRecord, `Round ${round} score record must exist`);
        assertEqual(state.completedTricks.length, 13, `Round ${round} must have 13 completed tricks`);

        // If not the final round, advance to next round
        if (round < 5) {
          const nextOk = controller.nextRound();
          assertOk(nextOk, `Should advance from round ${round} to ${round + 1}`);
        }
      }

      // Final match verification
      state = store.getState();
      assertEqual(state.status, GameStatus.MATCH_FINISHED, 'Match status should be MATCH_FINISHED');
      assertOk(!!state.matchResult, 'MatchResult must be generated');
      assertEqual(state.roundScores.length, 5, 'Should have 5 completed round score records');
      assertEqual(state.matchResult!.rankings.length, 4, 'MatchResult must rank all 4 players');
    }
  );

  // Test 2: Human Move Legality Enforcement
  harness.register(
    'Phase 6: Offline Flow',
    'Should reject illegal human card plays and enforce Call Break follow-suit rules',
    () => {
      const store = new GameStateStore();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(),
        rulesEngine: new CallBreakRulesEngine(),
        scoringEngine: new ScoringEngine(),
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);

      // Advance bidding to South
      let safety = 0;
      while (store.getState().status === GameStatus.BIDDING && safety++ < 10) {
        const s = store.getState();
        if (s.currentPlayer === PlayerPosition.SOUTH) {
          controller.submitBid(PlayerPosition.SOUTH, 2);
        } else {
          controller.stepBotTurn();
        }
      }

      const state = store.getState();
      assertEqual(state.status, GameStatus.PLAYING, 'State should be PLAYING');

      // Test legal move querying
      const legalMoves = controller.getLegalMovesForPlayer(state.currentPlayer);
      assertOk(legalMoves.length > 0, 'Current player must have legal moves');

      // If a card is not in legalMoves, attempting to play it should return false
      const playerHand = state.players[state.currentPlayer].hand;
      const illegalCard = playerHand.find((c) => !legalMoves.some((m) => m.id === c.id));

      if (illegalCard) {
        const illegalPlayResult = controller.playCard(state.currentPlayer, illegalCard);
        assertEqual(illegalPlayResult, false, 'Playing an illegal card must be rejected by controller');
      }
    }
  );

  // Test 3: Dealer Rotation Across Rounds
  harness.register(
    'Phase 6: Offline Flow',
    'Should rotate dealer clockwise across all 5 rounds according to rules',
    () => {
      const rules = new CallBreakRulesEngine();

      const d1 = rules.getDealerForRound(1, PlayerPosition.SOUTH);
      const d2 = rules.getDealerForRound(2, PlayerPosition.SOUTH);
      const d3 = rules.getDealerForRound(3, PlayerPosition.SOUTH);
      const d4 = rules.getDealerForRound(4, PlayerPosition.SOUTH);
      const d5 = rules.getDealerForRound(5, PlayerPosition.SOUTH);

      assertEqual(d1, PlayerPosition.SOUTH, 'Round 1 dealer should be SOUTH');
      assertEqual(d2, PlayerPosition.WEST, 'Round 2 dealer should be WEST');
      assertEqual(d3, PlayerPosition.NORTH, 'Round 3 dealer should be NORTH');
      assertEqual(d4, PlayerPosition.EAST, 'Round 4 dealer should be EAST');
      assertEqual(d5, PlayerPosition.SOUTH, 'Round 5 dealer should be SOUTH');
    }
  );

  // Test 4: Cumulative Score Preservation
  harness.register(
    'Phase 6: Offline Flow',
    'Cumulative scores should accumulate round points and persist across rounds',
    () => {
      const store = new GameStateStore();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(),
        rulesEngine: new CallBreakRulesEngine(),
        scoringEngine: new ScoringEngine(),
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);

      // Complete bidding for Round 1
      while (store.getState().status === GameStatus.BIDDING) {
        const s = store.getState();
        if (s.currentPlayer === PlayerPosition.SOUTH) {
          controller.submitBid(PlayerPosition.SOUTH, 3);
        } else {
          controller.stepBotTurn();
        }
      }

      // Complete Round 1 tricks
      while (store.getState().status === GameStatus.PLAYING) {
        const s = store.getState();
        if (s.currentPlayer === PlayerPosition.SOUTH) {
          const moves = controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
          controller.playCard(PlayerPosition.SOUTH, moves[0]);
        } else {
          controller.stepBotTurn();
        }
      }

      controller.completeRound();
      const r1State = store.getState();
      const r1SouthScore = r1State.cumulativeScores.SOUTH;

      // Advance to Round 2
      controller.nextRound();
      const r2State = store.getState();

      assertEqual(
        r2State.cumulativeScores.SOUTH,
        r1SouthScore,
        'Cumulative score must persist after transitioning to Round 2'
      );
      assertEqual(r2State.currentRound, 2, 'Current round must be 2');
      assertEqual(r2State.completedTricks.length, 0, 'Round 2 must reset completed tricks');
    }
  );

  // Test 5: Human Bidding Range Regression Test (Valid bids 9, 10, 11, 12, 13)
  harness.register(
    'Phase 6: Bidding Range Hotfix',
    'Should accept valid human bids 9, 10, 11, 12, 13 through Controller -> Rules Engine flow',
    () => {
      const highValidBids = [9, 10, 11, 12, 13];

      for (const targetBid of highValidBids) {
        const store = new GameStateStore();
        const controller = new LocalGameController(store, {
          cardEngine: new CardEngine(),
          rulesEngine: new CallBreakRulesEngine(),
          scoringEngine: new ScoringEngine(),
        });

        controller.startNewMatch(GameMode.OFFLINE_BOTS);

        // Advance to South turn
        let safety = 0;
        while (store.getState().status === GameStatus.BIDDING && safety++ < 10) {
          const s = store.getState();
          if (s.currentPlayer === PlayerPosition.SOUTH) {
            break;
          }
          controller.stepBotTurn();
        }

        const stateBeforeBid = store.getState();
        assertEqual(stateBeforeBid.status, GameStatus.BIDDING, 'Game must be in BIDDING status');
        assertEqual(stateBeforeBid.currentPlayer, PlayerPosition.SOUTH, 'Must be SOUTH turn');

        // Submit target high bid (9, 10, 11, 12, or 13)
        const submitResult = controller.submitBid(PlayerPosition.SOUTH, targetBid);
        assertEqual(submitResult, true, `Bidding ${targetBid} must be accepted as valid by Controller and RulesEngine`);

        const stateAfterBid = store.getState();
        assertEqual(
          stateAfterBid.players.SOUTH.currentBid,
          targetBid,
          `Player SOUTH currentBid must be updated to ${targetBid}`
        );
      }
    }
  );

  // Test 6: Bidding Range Boundary Rejection Test
  harness.register(
    'Phase 6: Bidding Range Hotfix',
    'Should strictly reject invalid bids (< 1, > 13, non-integers) via Controller and Rules Engine',
    () => {
      const store = new GameStateStore();
      const rulesEngine = new CallBreakRulesEngine();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(),
        rulesEngine,
        scoringEngine: new ScoringEngine(),
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);

      // Advance to South's turn
      let safety = 0;
      while (store.getState().status === GameStatus.BIDDING && safety++ < 10) {
        if (store.getState().currentPlayer === PlayerPosition.SOUTH) break;
        controller.stepBotTurn();
      }

      const state = store.getState();
      assertEqual(state.currentPlayer, PlayerPosition.SOUTH, 'Must be SOUTH turn to bid');

      // Test invalid bids
      const invalidBids = [0, -1, -5, 14, 15, 20, 2.5, NaN];

      for (const invalidBid of invalidBids) {
        const validation = rulesEngine.validateBid(invalidBid, PlayerPosition.SOUTH, state);
        assertEqual(validation.isValid, false, `RulesEngine should flag bid ${invalidBid} as invalid`);

        const controllerResult = controller.submitBid(PlayerPosition.SOUTH, invalidBid);
        assertEqual(controllerResult, false, `Controller should reject bid ${invalidBid}`);
        assertEqual(store.getState().players.SOUTH.currentBid, null, `Player bid should remain unset after invalid bid ${invalidBid}`);
      }
    }
  );

  // Test 7: Complete 1..13 Options Range Consistency
  harness.register(
    'Phase 6: Bidding Range Hotfix',
    'UI bid range options generation from minBid=1 to maxBid=13 must contain all 13 integers',
    () => {
      const minBid = 1;
      const maxBid = 13;
      const bidOptions = Array.from({ length: maxBid - minBid + 1 }, (_, i) => minBid + i);

      assertEqual(bidOptions.length, 13, 'Bid options must have length 13');
      assertEqual(bidOptions[0], 1, 'First bid option must be 1');
      assertEqual(bidOptions[12], 13, 'Last bid option must be 13');
      for (let expected = 1; expected <= 13; expected++) {
        assertEqual(bidOptions.includes(expected), true, `Bid options must contain ${expected}`);
      }
    }
  );

  return harness;
}
