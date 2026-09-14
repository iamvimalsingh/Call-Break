/**
 * Mid-Game Join and Seat Takeover Tests
 * Tests state preservation on bot replacement and host approval
 */

import { TestHarness } from './testHarness';
import { AuthoritativeGameController } from '../../server/src/AuthoritativeGameController';
import { PlayerPosition, PlayerType } from '../models/player';
import { GameStatus } from '../models/gameState';

export function buildMidGameJoinTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Mid-Game Join & Bot Replacement';

  harness.register(category, 'takeoverBotSeat should preserve complete game state, hand, bid, and tricks', () => {
    const authController = new AuthoritativeGameController();
    authController.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Host Player', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_bot', name: 'Bot West', isBot: true, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    const initialState = authController.getPerspectiveState(PlayerPosition.SOUTH);
    if (initialState.status !== GameStatus.BIDDING) {
      throw new Error('Initial game status should be BIDDING');
    }

    const roundNumberBefore = initialState.currentRound;
    const dealerBefore = initialState.dealer;

    // A human joins and replaces Bot on West (P2)
    const takeoverSuccess = authController.takeoverBotSeat(PlayerPosition.WEST, 'p2_new_human', 'New Player 2');
    if (!takeoverSuccess) {
      throw new Error('Takeover of bot seat failed');
    }

    const stateAfter = authController.getPerspectiveState(PlayerPosition.SOUTH);
    const westPlayer = stateAfter.players[PlayerPosition.WEST];

    if (westPlayer.id !== 'p2_new_human') {
      throw new Error(`Expected id p2_new_human, got ${westPlayer.id}`);
    }
    if (westPlayer.name !== 'New Player 2') {
      throw new Error(`Expected name 'New Player 2', got ${westPlayer.name}`);
    }
    if (westPlayer.type !== PlayerType.HUMAN) {
      throw new Error('Player type should be HUMAN');
    }
    if (stateAfter.currentRound !== roundNumberBefore) {
      throw new Error('Round number was changed unexpectedly');
    }
    if (stateAfter.dealer !== dealerBefore) {
      throw new Error('Dealer was changed unexpectedly');
    }

    // Check perspective state for new player
    const perspectiveForWest = authController.getPerspectiveState(PlayerPosition.WEST);
    if (perspectiveForWest.players[PlayerPosition.SOUTH].id !== 'p2_new_human') {
      throw new Error('Incoming human not mapped to SOUTH in their own perspective');
    }
    if (perspectiveForWest.players[PlayerPosition.SOUTH].hand.length !== 13) {
      throw new Error(`Expected 13 cards, got ${perspectiveForWest.players[PlayerPosition.SOUTH].hand.length}`);
    }

    authController.destroy();
  });

  harness.register(category, 'replacePlayerWithBot dynamically converts departing player to Bot without resetting game', () => {
    const authController = new AuthoritativeGameController();
    authController.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Host', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_human', name: 'Alice', isBot: false, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_human', name: 'Bob', isBot: false, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_human', name: 'Charlie', isBot: false, position: PlayerPosition.EAST },
    }, 5);

    // Replace Alice on West with Bot
    const success = authController.replacePlayerWithBot(PlayerPosition.WEST, 'Bot (Alice Auto-Play)');
    if (!success) {
      throw new Error('replacePlayerWithBot returned false');
    }

    const state = authController.getPerspectiveState(PlayerPosition.SOUTH);
    const westPlayer = state.players[PlayerPosition.WEST];
    if (westPlayer.type !== PlayerType.BOT) {
      throw new Error('Seat should be converted to PlayerType.BOT');
    }
    if (!westPlayer.name.includes('Alice Auto-Play')) {
      throw new Error(`Expected name to contain 'Alice Auto-Play', got ${westPlayer.name}`);
    }

    authController.destroy();
  });

  return harness;
}
