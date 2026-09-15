/**
 * Round Lifecycle and Authoritative Multi-Round Transition Tests
 * Tests complete 5-round match transitions (R1 -> R2 -> R3 -> R4 -> R5 -> Match Finished)
 */

import { TestHarness, assertEqual, assertOk } from './testHarness';
import { AuthoritativeGameController } from '../../server/src/AuthoritativeGameController';
import { PlayerPosition } from '../models/player';
import { GameStatus } from '../models/gameState';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';

export function buildRoundLifecycleTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Round Lifecycle & Transitions';

  harness.register(
    category,
    'AuthoritativeGameController progresses through all 5 rounds seamlessly with accurate dealer rotation and scoring',
    () => {
      const authController = new AuthoritativeGameController();
      authController.initializeMatch({
        [PlayerPosition.SOUTH]: { id: 'p1_south', name: 'South Human', isBot: false, position: PlayerPosition.SOUTH },
        [PlayerPosition.WEST]: { id: 'p2_west', name: 'West Human', isBot: false, position: PlayerPosition.WEST },
        [PlayerPosition.NORTH]: { id: 'p3_north', name: 'North Human', isBot: false, position: PlayerPosition.NORTH },
        [PlayerPosition.EAST]: { id: 'p4_east', name: 'East Human', isBot: false, position: PlayerPosition.EAST },
      }, 5);

      authController.clearTurnTimer();
      authController.clearRoundTransitionTimer();

      const expectedDealers = [
        PlayerPosition.SOUTH, // Round 1
        PlayerPosition.WEST,  // Round 2
        PlayerPosition.NORTH, // Round 3
        PlayerPosition.EAST,  // Round 4
        PlayerPosition.SOUTH, // Round 5
      ];

      const rules = new CallBreakRulesEngine();

      for (let round = 1; round <= 5; round++) {
        let state = authController.getState();
        if (state.currentRound !== round) {
          throw new Error(`Expected round ${round}, got ${state.currentRound}`);
        }
        if (state.dealer !== expectedDealers[round - 1]) {
          throw new Error(`Expected dealer ${expectedDealers[round - 1]} for round ${round}, got ${state.dealer}`);
        }
        if (state.status !== GameStatus.BIDDING) {
          throw new Error(`Round ${round} expected status BIDDING, got ${state.status}`);
        }
        if (state.completedTricks.length !== 0) {
          throw new Error(`Round ${round} completedTricks should be 0, got ${state.completedTricks.length}`);
        }

        // Verify each player received exactly 13 cards
        for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
          if (state.players[pos].hand.length !== 13) {
            throw new Error(`Round ${round}: Player ${pos} should have 13 cards, got ${state.players[pos].hand.length}`);
          }
          if (state.players[pos].currentBid !== null) {
            throw new Error(`Round ${round}: Player ${pos} bid should be reset to null`);
          }
          if (state.players[pos].tricksWon !== 0) {
            throw new Error(`Round ${round}: Player ${pos} tricksWon should be reset to 0`);
          }
        }

        // Play the bidding phase in authoritative turn order (bid 3 each, total 12 > 8)
        while (state.status === GameStatus.BIDDING) {
          const bidder = state.currentPlayer;
          const bidOk = authController.submitBid(bidder, 3);
          authController.clearTurnTimer();
          if (!bidOk) {
            throw new Error(`Round ${round}: Failed to submit bid for ${bidder}`);
          }
          state = authController.getState();
        }

        if (state.status !== GameStatus.PLAYING) {
          throw new Error(`Round ${round} status should be PLAYING after bidding, got ${state.status}`);
        }

        // Play 13 tricks to completion
        for (let trick = 1; trick <= 13; trick++) {
          for (let step = 0; step < 4; step++) {
            state = authController.getState();
            const curPlayer = state.currentPlayer;
            const hand = state.players[curPlayer].hand;
            const legalMoves = rules.getLegalMoves(hand, state.currentTrick, state.config.trumpSuit);
            if (legalMoves.length === 0) {
              throw new Error(`Round ${round} Trick ${trick}: No legal moves for ${curPlayer}`);
            }
            const played = authController.playCard(curPlayer, legalMoves[0]);
            authController.clearTurnTimer();
            if (!played) {
              throw new Error(`Round ${round} Trick ${trick}: Play card failed for ${curPlayer}`);
            }
          }

          authController.clearTurnTimer();
          state = authController.getState();
        }

        // Verify round score record is appended automatically upon round completion
        const roundRecord = state.roundScores.find((r) => r.roundNumber === round);
        if (!roundRecord) {
          throw new Error(`Round ${round} score record must exist`);
        }
        if (state.completedTricks.length !== 13) {
          throw new Error(`Round ${round} must have 13 completed tricks, got ${state.completedTricks.length}`);
        }

        // Advance to next round if round < 5
        if (round < 5) {
          const advanced = authController.nextRound();
          authController.clearTurnTimer();
          authController.clearRoundTransitionTimer();
          if (!advanced) {
            throw new Error(`Failed to advance from round ${round} to ${round + 1}`);
          }
        }
      }

      // Final match status verification
      const finalState = authController.getState();
      if (finalState.status !== GameStatus.MATCH_FINISHED) {
        throw new Error(`Expected MATCH_FINISHED after Round 5, got ${finalState.status}`);
      }
      if (!finalState.matchResult) {
        throw new Error('MatchResult must be defined after Round 5 completion');
      }
      if (finalState.roundScores.length !== 5) {
        throw new Error(`Expected 5 round scores, got ${finalState.roundScores.length}`);
      }

      // Attempting to advance beyond Round 5 must be rejected
      const overAdvance = authController.nextRound();
      if (overAdvance) {
        throw new Error('Should NOT be able to advance past Round 5');
      }

      authController.destroy();
    }
  );

  harness.register(
    category,
    'AuthoritativeGameController perspective state properly rotates roundScores and matchResult for non-host players',
    () => {
      const authController = new AuthoritativeGameController();
      authController.initializeMatch({
        [PlayerPosition.SOUTH]: { id: 'p1_south', name: 'South Player', isBot: false, position: PlayerPosition.SOUTH },
        [PlayerPosition.WEST]: { id: 'p2_west', name: 'West Player', isBot: false, position: PlayerPosition.WEST },
        [PlayerPosition.NORTH]: { id: 'p3_north', name: 'North Player', isBot: false, position: PlayerPosition.NORTH },
        [PlayerPosition.EAST]: { id: 'p4_east', name: 'East Player', isBot: false, position: PlayerPosition.EAST },
      }, 5);

      authController.clearTurnTimer();
      authController.clearRoundTransitionTimer();

      const rules = new CallBreakRulesEngine();

      // Complete Round 1 bidding
      let state = authController.getState();
      while (state.status === GameStatus.BIDDING) {
        authController.submitBid(state.currentPlayer, 3);
        authController.clearTurnTimer();
        state = authController.getState();
      }

      // Play 13 tricks
      for (let trick = 1; trick <= 13; trick++) {
        for (let step = 0; step < 4; step++) {
          state = authController.getState();
          const curPlayer = state.currentPlayer;
          const moves = rules.getLegalMoves(state.players[curPlayer].hand, state.currentTrick, state.config.trumpSuit);
          authController.playCard(curPlayer, moves[0]);
          authController.clearTurnTimer();
        }
      }

      // Check perspective state for WEST player
      const westPerspective = authController.getPerspectiveState(PlayerPosition.WEST);
      if (westPerspective.roundScores.length !== 1) {
        throw new Error(`Expected 1 round score in perspective, got ${westPerspective.roundScores.length}`);
      }

      // WEST player should see their own score at SOUTH in perspective
      const westRecord = westPerspective.roundScores[0];
      if (!westRecord.scores[PlayerPosition.SOUTH]) {
        throw new Error('Perspective round scores must have SOUTH record');
      }

      // Raw WEST score should match perspective SOUTH score
      const rawRecord = authController.getState().roundScores[0];
      if (westRecord.scores[PlayerPosition.SOUTH].roundScore !== rawRecord.scores[PlayerPosition.WEST].roundScore) {
        throw new Error('West perspective SOUTH score must match raw WEST score');
      }

      authController.destroy();
    }
  );

  harness.register(
    category,
    'Regression: Round 1 complete -> Next Round executes -> Round 2 is fully active and deal reset',
    async () => {
      const authController = new AuthoritativeGameController();
      authController.initializeMatch({
        [PlayerPosition.SOUTH]: { id: 'p1_south', name: 'South Player', isBot: false, position: PlayerPosition.SOUTH },
        [PlayerPosition.WEST]: { id: 'p2_west', name: 'West Player', isBot: true, position: PlayerPosition.WEST },
        [PlayerPosition.NORTH]: { id: 'p3_north', name: 'North Player', isBot: true, position: PlayerPosition.NORTH },
        [PlayerPosition.EAST]: { id: 'p4_east', name: 'East Player', isBot: true, position: PlayerPosition.EAST },
      }, 5);

      authController.clearTurnTimer();
      authController.clearRoundTransitionTimer();

      const rules = new CallBreakRulesEngine();

      // Complete Round 1 bidding
      let state = authController.getState();
      assertEqual(state.currentRound, 1, 'Initial match must start at Round 1');
      assertEqual(state.status, GameStatus.BIDDING, 'Initial match must be in BIDDING phase');

      while (state.status === GameStatus.BIDDING) {
        authController.submitBid(state.currentPlayer, 3);
        authController.clearTurnTimer();
        state = authController.getState();
      }

      assertEqual(state.status, GameStatus.PLAYING, 'After bids, round 1 must be PLAYING');

      // Play all 13 tricks in Round 1
      for (let trick = 1; trick <= 13; trick++) {
        for (let step = 0; step < 4; step++) {
          state = authController.getState();
          const curPlayer = state.currentPlayer;
          const moves = rules.getLegalMoves(state.players[curPlayer].hand, state.currentTrick, state.config.trumpSuit);
          authController.playCard(curPlayer, moves[0]);
          authController.clearTurnTimer();
        }
      }

      // Authoritative round scoring
      state = authController.getState();
      assertEqual(state.status, GameStatus.ROUND_ENDED, 'After trick 13, status must be ROUND_ENDED');
      assertEqual(state.currentRound, 1, 'Must still be round 1 before nextRound transition');
      assertEqual(state.roundScores.length, 1, 'Round 1 score record must exist');

      // Execute startNextRound() / nextRound()
      const advanced = authController.startNextRound();
      assertEqual(advanced, true, 'startNextRound must return true');

      // Verify Round 2 State
      const r2State = authController.getState();
      assertEqual(r2State.currentRound, 2, 'Must increment currentRound to 2');
      assertEqual(r2State.status, GameStatus.BIDDING, 'Must transition to BIDDING for Round 2');
      assertEqual(r2State.completedTricks.length, 0, 'completedTricks must be reset to 0 in Round 2');
      assertEqual(r2State.currentTrick.cards.length, 0, 'currentTrick.cards must be empty in Round 2');
      assertEqual(r2State.currentTrick.trickNumber, 1, 'currentTrick.trickNumber must be 1 in Round 2');
      assertEqual(r2State.dealer, PlayerPosition.WEST, 'Dealer must rotate to WEST for Round 2');
      assertEqual(r2State.currentPlayer, PlayerPosition.NORTH, 'First bidder must be NORTH for Round 2');

      // Verify all 4 players have 13 fresh cards, null bids, and 0 tricks won
      for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
        const player = r2State.players[pos];
        assertEqual(player.hand.length, 13, `Player ${pos} must have 13 cards dealt`);
        assertEqual(player.currentBid, null, `Player ${pos} bid must be null`);
        assertEqual(player.tricksWon, 0, `Player ${pos} tricksWon must be 0`);
      }

      // Complete Round 2 bidding & tricks -> advance to Round 3
      while (authController.getState().status === GameStatus.BIDDING) {
        authController.submitBid(authController.getState().currentPlayer, 3);
        authController.clearTurnTimer();
      }

      for (let trick = 1; trick <= 13; trick++) {
        for (let step = 0; step < 4; step++) {
          const s = authController.getState();
          const curPlayer = s.currentPlayer;
          const moves = rules.getLegalMoves(s.players[curPlayer].hand, s.currentTrick, s.config.trumpSuit);
          authController.playCard(curPlayer, moves[0]);
          authController.clearTurnTimer();
        }
      }

      const r2EndState = authController.getState();
      assertEqual(r2EndState.status, GameStatus.ROUND_ENDED, 'After round 2 trick 13, status must be ROUND_ENDED');
      assertEqual(r2EndState.roundScores.length, 2, 'Round 2 score record must exist');

      const advancedToR3 = authController.startNextRound();
      assertEqual(advancedToR3, true, 'Must advance to Round 3');
      const r3State = authController.getState();
      assertEqual(r3State.currentRound, 3, 'Must increment currentRound to 3');
      assertEqual(r3State.status, GameStatus.BIDDING, 'Must transition to BIDDING for Round 3');
      assertEqual(r3State.dealer, PlayerPosition.NORTH, 'Dealer must rotate to NORTH for Round 3');
      assertEqual(r3State.currentPlayer, PlayerPosition.EAST, 'First bidder must be EAST for Round 3');

      authController.destroy();
    }
  );

  harness.register(
    category,
    'Regression: Real-time 4s server timer automatically fires and transitions to Round 2 without any client action',
    async () => {
      const authController = new AuthoritativeGameController();
      let stateEmissions: GameStatus[] = [];
      authController.onStateChange((s) => {
        stateEmissions.push(s.status);
      });

      authController.initializeMatch({
        [PlayerPosition.SOUTH]: { id: 'p1_south', name: 'South Player', isBot: false, position: PlayerPosition.SOUTH },
        [PlayerPosition.WEST]: { id: 'p2_west', name: 'West Player', isBot: true, position: PlayerPosition.WEST },
        [PlayerPosition.NORTH]: { id: 'p3_north', name: 'North Player', isBot: true, position: PlayerPosition.NORTH },
        [PlayerPosition.EAST]: { id: 'p4_east', name: 'East Player', isBot: true, position: PlayerPosition.EAST },
      }, 5);

      authController.clearTurnTimer();

      const rules = new CallBreakRulesEngine();

      // Submit Round 1 bids (total = 12 to avoid rebid)
      while (authController.getState().status === GameStatus.BIDDING) {
        authController.submitBid(authController.getState().currentPlayer, 3);
        authController.clearTurnTimer();
      }

      // Play 13 tricks in Round 1
      for (let trick = 1; trick <= 13; trick++) {
        for (let step = 0; step < 4; step++) {
          const s = authController.getState();
          const curPlayer = s.currentPlayer;
          const moves = rules.getLegalMoves(s.players[curPlayer].hand, s.currentTrick, s.config.trumpSuit);
          authController.playCard(curPlayer, moves[0]);
          authController.clearTurnTimer();
        }
      }

      // At this instant, Round 1 is complete and scored, and the 4s auto transition is running
      const endedState = authController.getState();
      assertEqual(endedState.status, GameStatus.ROUND_ENDED, 'Must be ROUND_ENDED after trick 13');
      assertEqual(endedState.currentRound, 1, 'Must be currentRound 1');
      assertEqual(endedState.roundScores.length, 1, 'Must have Round 1 scores');

      // Now wait 4.2 seconds WITHOUT calling any function or triggering any client action
      await new Promise((resolve) => setTimeout(resolve, 4200));

      // After 4.2s, the server timer MUST have executed startNextRound()
      const transitionedState = authController.getState();
      assertEqual(transitionedState.status, GameStatus.BIDDING, 'Automatic timer must transition status to BIDDING');
      assertEqual(transitionedState.currentRound, 2, 'Automatic timer must advance to currentRound 2');
      assertEqual(transitionedState.dealer, PlayerPosition.WEST, 'Dealer must rotate to WEST for Round 2');
      assertEqual(transitionedState.currentPlayer, PlayerPosition.NORTH, 'First bidder must be NORTH for Round 2');
      assertEqual(transitionedState.completedTricks.length, 0, 'completedTricks must be 0 for Round 2');
      assertEqual(transitionedState.players[PlayerPosition.SOUTH].hand.length, 13, 'South must have 13 new cards in Round 2');
      assertEqual(transitionedState.players[PlayerPosition.SOUTH].currentBid, null, 'South bid must be reset to null in Round 2');
      assertEqual(transitionedState.players[PlayerPosition.SOUTH].tricksWon, 0, 'South tricksWon must be reset to 0 in Round 2');

      authController.destroy();
    }
  );

  return harness;
}
