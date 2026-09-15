/**
 * Round Lifecycle and Authoritative Multi-Round Transition Tests
 * Tests complete 5-round match transitions (R1 -> R2 -> R3 -> R4 -> R5 -> Match Finished)
 */

import { TestHarness } from './testHarness';
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
        [PlayerPosition.WEST]: { id: 'p2_west', name: 'West Bot', isBot: true, position: PlayerPosition.WEST },
        [PlayerPosition.NORTH]: { id: 'p3_north', name: 'North Bot', isBot: true, position: PlayerPosition.NORTH },
        [PlayerPosition.EAST]: { id: 'p4_east', name: 'East Bot', isBot: true, position: PlayerPosition.EAST },
      }, 5);

      authController.clearTurnTimer();
      authController.clearRoundTransitionTimer();
      if ((authController as any).botTimer) {
        clearTimeout((authController as any).botTimer);
        (authController as any).botTimer = null;
      }

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

        // Play the bidding phase in authoritative turn order
        while (state.status === GameStatus.BIDDING) {
          const bidder = state.currentPlayer;
          const bidOk = authController.submitBid(bidder, 2);
          authController.clearTurnTimer();
          if ((authController as any).botTimer) {
            clearTimeout((authController as any).botTimer);
            (authController as any).botTimer = null;
          }
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
            if ((authController as any).botTimer) {
              clearTimeout((authController as any).botTimer);
              (authController as any).botTimer = null;
            }
            if (!played) {
              throw new Error(`Round ${round} Trick ${trick}: Play card failed for ${curPlayer}`);
            }
          }

          // Clear any pending trick resolution timer scheduled by playCard
          authController.clearTurnTimer();
          authController.clearRoundTransitionTimer();
          if ((authController as any).botTimer) {
            clearTimeout((authController as any).botTimer);
            (authController as any).botTimer = null;
          }

          // Resolve trick synchronously
          (authController as any).controller.resolveTrick();
        }

        state = authController.getState();
        if (state.status === GameStatus.ROUND_ENDED) {
          (authController as any).controller.completeRound();
          state = authController.getState();
        }

        // Verify round score record is appended
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
          if ((authController as any).botTimer) {
            clearTimeout((authController as any).botTimer);
            (authController as any).botTimer = null;
          }
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

  return harness;
}
