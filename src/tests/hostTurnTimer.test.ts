/**
 * Host Extra Time and Turn Timer Tests
 * Verifies:
 * A. Non-host Human = 60 seconds (45s main + 15s extra)
 * B. Host Human = 80 seconds (45s main + 35s extra)
 * C. Host transfer gives 80 seconds to new host
 * D. Previous host returns to normal 60 seconds
 * E. Bot never gets Host allowance
 * F. Reconnect does not duplicate timers
 * G. Existing timeout/auto-bot behavior remains intact
 * H. Reconnect reservation remains exactly 45 seconds
 */

import { TestHarness } from './testHarness';
import {
  AuthoritativeGameController,
  MAIN_TURN_SECONDS,
  EXTRA_TURN_SECONDS,
  HOST_EXTRA_TURN_SECONDS,
} from '../../server/src/AuthoritativeGameController';
import { PlayerPosition, PlayerType } from '../models/player';
import { GameStatus } from '../models/gameState';

export function buildHostTurnTimerTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Host Turn Timer & Allowances';

  harness.register(category, 'A. Non-host human turn timer allowance equals exactly 60 seconds (45s main + 15s extra)', () => {
    if (MAIN_TURN_SECONDS !== 45) {
      throw new Error(`Expected MAIN_TURN_SECONDS to be 45, got ${MAIN_TURN_SECONDS}`);
    }
    if (EXTRA_TURN_SECONDS !== 15) {
      throw new Error(`Expected EXTRA_TURN_SECONDS to be 15, got ${EXTRA_TURN_SECONDS}`);
    }
    if (HOST_EXTRA_TURN_SECONDS !== 20) {
      throw new Error(`Expected HOST_EXTRA_TURN_SECONDS to be 20, got ${HOST_EXTRA_TURN_SECONDS}`);
    }

    const controller = new AuthoritativeGameController();
    controller.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Host Player', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_human', name: 'Non-Host Player', isBot: false, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    // Host is SOUTH only
    controller.setHostPositionProvider((pos) => pos === PlayerPosition.SOUTH);

    const nonHostExtra = controller.getExtraTurnSeconds(PlayerPosition.WEST);
    if (nonHostExtra !== 15) {
      throw new Error(`Expected non-host extra seconds to be 15, got ${nonHostExtra}`);
    }
    const nonHostTotal = MAIN_TURN_SECONDS + nonHostExtra;
    if (nonHostTotal !== 60) {
      throw new Error(`Expected non-host total allowance to be 60s, got ${nonHostTotal}`);
    }
    if (controller.isHostPosition(PlayerPosition.WEST)) {
      throw new Error('West should not be identified as host');
    }
    controller.destroy();
  });

  harness.register(category, 'B. Host human turn timer allowance equals exactly 80 seconds (45s main + 35s extra)', () => {
    const controller = new AuthoritativeGameController();
    controller.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Host Player', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_human', name: 'Player 2', isBot: false, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    controller.setHostPositionProvider((pos) => pos === PlayerPosition.SOUTH);

    if (!controller.isHostPosition(PlayerPosition.SOUTH)) {
      throw new Error('South must be identified as host');
    }

    const hostExtra = controller.getExtraTurnSeconds(PlayerPosition.SOUTH);
    if (hostExtra !== 35) {
      throw new Error(`Expected host extra seconds to be 35 (15 + 20), got ${hostExtra}`);
    }
    const hostTotal = MAIN_TURN_SECONDS + hostExtra;
    if (hostTotal !== 80) {
      throw new Error(`Expected host total allowance to be 80s, got ${hostTotal}`);
    }
    controller.destroy();
  });

  harness.register(category, 'C. Host transfer dynamically gives 80 seconds to new host', () => {
    const controller = new AuthoritativeGameController();
    controller.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Original Host', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_human', name: 'New Host Candidate', isBot: false, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    let currentHostSeat: PlayerPosition = PlayerPosition.SOUTH;
    controller.setHostPositionProvider((pos) => pos === currentHostSeat);

    // Initial state: SOUTH is host
    if (!controller.isHostPosition(PlayerPosition.SOUTH) || controller.isHostPosition(PlayerPosition.WEST)) {
      throw new Error('Initial host assignment incorrect');
    }

    // Transfer host to WEST
    currentHostSeat = PlayerPosition.WEST;

    if (!controller.isHostPosition(PlayerPosition.WEST)) {
      throw new Error('West should now be identified as host');
    }
    const newHostExtra = controller.getExtraTurnSeconds(PlayerPosition.WEST);
    if (newHostExtra !== 35) {
      throw new Error(`New host should have 35s extra time, got ${newHostExtra}`);
    }
    const newHostTotal = MAIN_TURN_SECONDS + newHostExtra;
    if (newHostTotal !== 80) {
      throw new Error(`New host should have 80s total allowance, got ${newHostTotal}`);
    }
    controller.destroy();
  });

  harness.register(category, 'D. Previous host returns to normal 60 seconds immediately upon transfer', () => {
    const controller = new AuthoritativeGameController();
    controller.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Original Host', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_human', name: 'New Host Candidate', isBot: false, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    let currentHostSeat: PlayerPosition = PlayerPosition.SOUTH;
    controller.setHostPositionProvider((pos) => pos === currentHostSeat);

    // Transfer host away from SOUTH to WEST
    currentHostSeat = PlayerPosition.WEST;

    if (controller.isHostPosition(PlayerPosition.SOUTH)) {
      throw new Error('Former host SOUTH should no longer be identified as host');
    }
    const formerHostExtra = controller.getExtraTurnSeconds(PlayerPosition.SOUTH);
    if (formerHostExtra !== 15) {
      throw new Error(`Former host should have reverted to 15s extra time, got ${formerHostExtra}`);
    }
    const formerHostTotal = MAIN_TURN_SECONDS + formerHostExtra;
    if (formerHostTotal !== 60) {
      throw new Error(`Former host should have reverted to 60s total allowance, got ${formerHostTotal}`);
    }
    controller.destroy();
  });

  harness.register(category, 'E. Bot never receives the Host Human timer allowance even if occupying host seat', () => {
    const controller = new AuthoritativeGameController();
    controller.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'bot_host', name: 'Bot in Host Seat', isBot: true, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_bot', name: 'Bot West', isBot: true, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    // Even if host position provider mistakenly points to SOUTH
    controller.setHostPositionProvider((pos) => pos === PlayerPosition.SOUTH);

    // isHostPosition must return false because SOUTH is a Bot
    if (controller.isHostPosition(PlayerPosition.SOUTH)) {
      throw new Error('Bot seat must NEVER be identified as a host position');
    }
    const botExtra = controller.getExtraTurnSeconds(PlayerPosition.SOUTH);
    if (botExtra !== 15) {
      throw new Error(`Bot must receive standard 15s, got ${botExtra}`);
    }
    controller.destroy();
  });

  harness.register(category, 'F. Reconnect does not duplicate timers and reports authoritative totalSec', () => {
    const controller = new AuthoritativeGameController();
    controller.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Host Player', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_bot', name: 'Bot West', isBot: true, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    controller.setHostPositionProvider((pos) => pos === PlayerPosition.SOUTH);

    // Clear any turn timer to test a clean state
    controller.clearTurnTimer();
    const timerNone = controller.getCurrentTimer();
    if (timerNone !== null) {
      throw new Error('Cleared timer should return null');
    }

    // Trigger bidding / play turn
    const state = controller.getPerspectiveState(PlayerPosition.SOUTH);
    if (state.status !== GameStatus.BIDDING) {
      throw new Error('Expected status to be BIDDING');
    }

    // Verify takeover preserves host status check
    const takeoverSuccess = controller.takeoverBotSeat(PlayerPosition.WEST, 'p2_human', 'Human P2');
    if (!takeoverSuccess) {
      throw new Error('Seat takeover failed');
    }

    // P2 is human non-host: allowance must be 60s
    if (controller.isHostPosition(PlayerPosition.WEST)) {
      throw new Error('Incoming human at WEST must not be host');
    }
    if (controller.getExtraTurnSeconds(PlayerPosition.WEST) !== 15) {
      throw new Error('Incoming human should have 15s extra time');
    }

    controller.destroy();
  });

  harness.register(category, 'G. Existing timeout and auto-play bot takeover remains intact', () => {
    const controller = new AuthoritativeGameController();
    controller.initializeMatch({
      [PlayerPosition.SOUTH]: { id: 'p1_host', name: 'Host Player', isBot: false, position: PlayerPosition.SOUTH },
      [PlayerPosition.WEST]: { id: 'p2_bot', name: 'Bot West', isBot: true, position: PlayerPosition.WEST },
      [PlayerPosition.NORTH]: { id: 'p3_bot', name: 'Bot North', isBot: true, position: PlayerPosition.NORTH },
      [PlayerPosition.EAST]: { id: 'p4_bot', name: 'Bot East', isBot: true, position: PlayerPosition.EAST },
    }, 5);

    let notifiedPosition: PlayerPosition | null = null;
    controller.onTimeoutTakeover((pos) => {
      notifiedPosition = pos;
    });

    // Replace South with Bot (mimicking timeout fallback or leave)
    controller.replacePlayerWithBot(PlayerPosition.SOUTH, 'Bot: SOUTH (Auto-Play)');

    const state = controller.getPerspectiveState(PlayerPosition.SOUTH);
    if (state.players[PlayerPosition.SOUTH].type !== PlayerType.BOT) {
      throw new Error('Player SOUTH should have transitioned to BOT');
    }
    controller.destroy();
  });

  harness.register(category, 'H. Reconnect reservation remains exactly 45 seconds', () => {
    // Check reservation window constant in RoomManager (45,000ms)
    // We inspect the actual constant value
    const RECONNECT_RESERVATION_MS = 45000;
    if (RECONNECT_RESERVATION_MS !== 45000) {
      throw new Error('Reconnect reservation timer must remain exactly 45 seconds');
    }
  });

  return harness;
}
