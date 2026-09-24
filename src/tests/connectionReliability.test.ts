/**
 * Connection Reliability & Mobile Recovery Tests
 * 
 * Verifies:
 * 1. WebSocket OPEN alone does not automatically mean GREEN when synchronization is not confirmed.
 * 2. Healthy connection becomes GREEN after successful authoritative sync.
 * 3. visibilitychange to foreground triggers health/recovery evaluation.
 * 4. pageshow triggers health/recovery evaluation.
 * 5. online event triggers health/recovery evaluation.
 * 6. stale heartbeat causes YELLOW and reconnect.
 * 7. successful reconnect causes authoritative resync.
 * 8. resync completion changes visible state to GREEN.
 * 9. failed bounded recovery reaches RED.
 * 10. controlled reload is triggered only after recovery failure.
 * 11. reload recovery does not clear cb_player_id.
 * 12. reload recovery does not clear a still-valid cb_active_table_id.
 * 13. duplicate lifecycle events do not start multiple reconnect sequences.
 * 14. cleanup removes watchdog/listeners.
 */

import { TestHarness } from './testHarness';
import {
  MultiplayerClient,
  getActiveTableId,
  setActiveTableId,
} from '../services/multiplayer/MultiplayerClient';

function setupMockEnvironment() {
  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();
  const windowListeners: Record<string, Function[]> = {};
  const docListeners: Record<string, Function[]> = {};

  (globalThis as any).localStorage = {
    getItem: (k: string) => localStore.get(k) ?? null,
    setItem: (k: string, v: string) => localStore.set(k, String(v)),
    removeItem: (k: string) => localStore.delete(k),
    clear: () => localStore.clear(),
  };

  (globalThis as any).sessionStorage = {
    getItem: (k: string) => sessionStore.get(k) ?? null,
    setItem: (k: string, v: string) => sessionStore.set(k, String(v)),
    removeItem: (k: string) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
  };

  (globalThis as any).__reloaded = false;

  (globalThis as any).window = {
    location: {
      reload: () => {
        (globalThis as any).__reloaded = true;
      },
    },
    addEventListener: (event: string, fn: Function) => {
      windowListeners[event] = windowListeners[event] || [];
      windowListeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: Function) => {
      if (windowListeners[event]) {
        windowListeners[event] = windowListeners[event].filter((f) => f !== fn);
      }
    },
    dispatchEvent: (event: string) => {
      (windowListeners[event] || []).forEach((fn) => fn());
    },
  };

  (globalThis as any).document = {
    visibilityState: 'visible',
    addEventListener: (event: string, fn: Function) => {
      docListeners[event] = docListeners[event] || [];
      docListeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: Function) => {
      if (docListeners[event]) {
        docListeners[event] = docListeners[event].filter((f) => f !== fn);
      }
    },
    dispatchEvent: (event: string) => {
      (docListeners[event] || []).forEach((fn) => fn());
    },
  };

  return { localStore, sessionStore, windowListeners, docListeners };
}

export function buildConnectionReliabilityTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Connection Reliability & Recovery';

  const createMockSocket = (onClose?: () => void) =>
    ({
      readyState: 1, // WebSocket.OPEN
      send: (_data: string) => {},
      close: (_code?: number, _reason?: string) => {
        if (onClose) onClose();
      },
    } as any);

  // 1. WebSocket OPEN alone does not automatically mean GREEN when synchronization is not confirmed
  harness.register(
    category,
    'WebSocket OPEN alone does not automatically mean GREEN when synchronization is not confirmed',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_1');

      const client = new MultiplayerClient();
      (client as any).socket = createMockSocket();
      client.setLastMessageTime(Date.now());
      (client as any).hasSynchronizedState = false;

      client.evaluateOnlineState();

      if (client.getConnectionDotStatus() === 'green') {
        throw new Error('Connection must NOT be GREEN when synchronization is not confirmed');
      }
      if (client.getConnectionDotStatus() !== 'yellow') {
        throw new Error(`Expected YELLOW dot status during SYNCING, got ${client.getConnectionDotStatus()}`);
      }
      if (client.getDetailedConnectionState() !== 'SYNCING') {
        throw new Error(`Expected detailedState SYNCING, got ${client.getDetailedConnectionState()}`);
      }
      client.cleanup();
    }
  );

  // 2. Healthy connection becomes GREEN after successful authoritative sync
  harness.register(
    category,
    'Healthy connection becomes GREEN after successful authoritative sync',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_2');

      const client = new MultiplayerClient();
      (client as any).socket = createMockSocket();
      client.setLastMessageTime(Date.now());
      (client as any).hasSynchronizedState = true;

      client.evaluateOnlineState();

      if (client.getConnectionDotStatus() !== 'green') {
        throw new Error(`Expected GREEN dot status after state sync, got ${client.getConnectionDotStatus()}`);
      }
      if (client.getDetailedConnectionState() !== 'ONLINE') {
        throw new Error(`Expected detailedState ONLINE, got ${client.getDetailedConnectionState()}`);
      }
      client.cleanup();
    }
  );

  // 3. visibilitychange to foreground triggers health/recovery evaluation
  harness.register(
    category,
    'visibilitychange to foreground triggers health/recovery evaluation',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_3');

      const client = new MultiplayerClient();
      let clientReadySent = false;
      (client as any).socket = {
        readyState: 1,
        send: (data: string) => {
          if (data.includes('CLIENT_READY')) {
            clientReadySent = true;
          }
        },
        close: () => {},
      };
      client.setLastMessageTime(Date.now());
      (client as any).hasSynchronizedState = true;
      client.evaluateOnlineState();

      // Trigger visibilitychange to visible
      client.triggerLifecycleRecovery('visibilitychange');

      // Must transition to SYNCING immediately and request authoritative sync
      if (client.getConnectionDotStatus() !== 'yellow') {
        throw new Error(`Expected YELLOW dot status on foreground return, got ${client.getConnectionDotStatus()}`);
      }
      if (client.getDetailedConnectionState() !== 'SYNCING') {
        throw new Error(`Expected SYNCING detailed state, got ${client.getDetailedConnectionState()}`);
      }
      if (!clientReadySent) {
        throw new Error('Expected CLIENT_READY to be sent for authoritative synchronization');
      }
      client.cleanup();
    }
  );

  // 4. pageshow triggers health/recovery evaluation
  harness.register(
    category,
    'pageshow triggers health/recovery evaluation',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_4');

      const client = new MultiplayerClient();
      (client as any).socket = createMockSocket();
      client.setLastMessageTime(Date.now());

      client.triggerLifecycleRecovery('pageshow');

      if (client.getDetailedConnectionState() !== 'SYNCING') {
        throw new Error(`Expected SYNCING detailed state on pageshow, got ${client.getDetailedConnectionState()}`);
      }
      client.cleanup();
    }
  );

  // 5. online event triggers health/recovery evaluation
  harness.register(
    category,
    'online event triggers health/recovery evaluation',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_5');

      const client = new MultiplayerClient();
      (client as any).socket = createMockSocket();
      client.setLastMessageTime(Date.now());

      client.triggerLifecycleRecovery('online');

      if (client.getConnectionDotStatus() !== 'yellow') {
        throw new Error(`Expected YELLOW dot status on online event before resync, got ${client.getConnectionDotStatus()}`);
      }
      client.cleanup();
    }
  );

  // 6. stale heartbeat causes YELLOW and reconnect
  harness.register(
    category,
    'stale heartbeat causes YELLOW and reconnect',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_6');

      const client = new MultiplayerClient();
      let socketClosed = false;
      (client as any).socket = createMockSocket(() => {
        socketClosed = true;
      });

      // Socket has not received any message for 26 seconds (over 25s threshold)
      client.setLastMessageTime(Date.now() - 26000);

      client.checkWatchdog();

      if (!socketClosed) {
        throw new Error('Expected stale socket to be closed by watchdog');
      }
      if ((client as any).socket !== null) {
        throw new Error('Expected socket reference to be nulled after stale termination');
      }
      if (client.getConnectionDotStatus() !== 'yellow') {
        throw new Error(`Expected YELLOW dot status during reconnect, got ${client.getConnectionDotStatus()}`);
      }
      if (client.getDetailedConnectionState() !== 'RECONNECTING') {
        throw new Error(`Expected RECONNECTING state, got ${client.getDetailedConnectionState()}`);
      }
      client.cleanup();
    }
  );

  // 7. successful reconnect causes authoritative resync
  harness.register(
    category,
    'successful reconnect causes authoritative resync',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_7');

      const client = new MultiplayerClient();
      (client as any).socket = createMockSocket();
      client.setLastMessageTime(Date.now());

      // Simulate reconnect in-progress
      client.setDetailedState('SYNCING');

      if (client.getConnectionDotStatus() !== 'yellow') {
        throw new Error(`Expected YELLOW status during reconnect sync, got ${client.getConnectionDotStatus()}`);
      }
      client.cleanup();
    }
  );

  // 8. resync completion changes visible state to GREEN
  harness.register(
    category,
    'resync completion changes visible state to GREEN',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_8');

      const client = new MultiplayerClient();
      (client as any).socket = createMockSocket();
      client.setLastMessageTime(Date.now());
      client.setDetailedState('SYNCING');

      // Resync completes (e.g. MATCH_SYNC received)
      client.setHasSynchronizedState(true);

      if (client.getConnectionDotStatus() !== 'green') {
        throw new Error(`Expected GREEN dot status upon resync completion, got ${client.getConnectionDotStatus()}`);
      }
      if (client.getDetailedConnectionState() !== 'ONLINE') {
        throw new Error(`Expected ONLINE state, got ${client.getDetailedConnectionState()}`);
      }
      client.cleanup();
    }
  );

  // 9. failed bounded recovery reaches RED
  harness.register(
    category,
    'failed bounded recovery reaches RED',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_9');

      const client = new MultiplayerClient();
      (client as any).socket = null;
      client.setReconnectAttempts(MultiplayerClient.MAX_RECONNECT_ATTEMPTS);

      // Trigger recovery when max attempts already reached
      client.triggerReconnect();

      if (client.getConnectionDotStatus() !== 'red') {
        throw new Error(`Expected RED dot status when recovery fails, got ${client.getConnectionDotStatus()}`);
      }
      if (client.getDetailedConnectionState() !== 'DISCONNECTED') {
        throw new Error(`Expected DISCONNECTED state, got ${client.getDetailedConnectionState()}`);
      }
      client.cleanup();
    }
  );

  // 10. controlled reload is triggered only after recovery failure
  harness.register(
    category,
    'controlled reload is triggered only after recovery failure with infinite loop protection',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_10');

      const client = new MultiplayerClient();
      (client as any).socket = null;
      client.setReconnectAttempts(MultiplayerClient.MAX_RECONNECT_ATTEMPTS);

      // Attempt 1: Should trigger reload
      client.triggerReconnect();
      if ((globalThis as any).__reloaded !== true) {
        throw new Error('Expected controlled page reload to be triggered on first recovery failure');
      }

      // Reset reload spy, but keep recovery storage flag
      (globalThis as any).__reloaded = false;

      // Attempt 2: Should NOT reload again (loop protection)
      client.triggerReconnect();
      if ((globalThis as any).__reloaded !== false) {
        throw new Error('Controlled reload must NOT trigger in an infinite loop');
      }
      if (client.getConnectionDotStatus() !== 'red') {
        throw new Error(`Must remain RED when reload recovery already attempted, got ${client.getConnectionDotStatus()}`);
      }
      client.cleanup();
    }
  );

  // 11. reload recovery does not clear cb_player_id
  harness.register(
    category,
    'reload recovery does not clear cb_player_id',
    () => {
      setupMockEnvironment();
      localStorage.setItem('cb_player_id', 'player_persistent_123');
      setActiveTableId('ROOM_TEST_11');

      const client = new MultiplayerClient();
      client.setReconnectAttempts(MultiplayerClient.MAX_RECONNECT_ATTEMPTS);
      client.triggerReconnect();

      const storedPlayerId = localStorage.getItem('cb_player_id');
      if (storedPlayerId !== 'player_persistent_123') {
        throw new Error(`cb_player_id was mutated or deleted: ${storedPlayerId}`);
      }
      client.cleanup();
    }
  );

  // 12. reload recovery does not clear a still-valid cb_active_table_id
  harness.register(
    category,
    'reload recovery does not clear a still-valid cb_active_table_id',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_ACTIVE_PERSISTENT');

      const client = new MultiplayerClient();
      client.setReconnectAttempts(MultiplayerClient.MAX_RECONNECT_ATTEMPTS);
      client.triggerReconnect();

      const storedTableId = getActiveTableId();
      if (storedTableId !== 'ROOM_ACTIVE_PERSISTENT') {
        throw new Error(`cb_active_table_id was wiped during reload recovery: ${storedTableId}`);
      }
      client.cleanup();
    }
  );

  // 13. duplicate lifecycle events do not start multiple reconnect sequences
  harness.register(
    category,
    'duplicate lifecycle events do not start multiple reconnect sequences',
    () => {
      setupMockEnvironment();
      setActiveTableId('ROOM_TEST_13');

      const client = new MultiplayerClient();
      let readyCount = 0;
      (client as any).socket = {
        readyState: 1,
        send: (data: string) => {
          if (data.includes('CLIENT_READY')) {
            readyCount++;
          }
        },
        close: () => {},
      };
      client.setLastMessageTime(Date.now());

      // Fire multiple lifecycle events back-to-back
      client.triggerLifecycleRecovery('visibilitychange');
      client.triggerLifecycleRecovery('pageshow');
      client.triggerLifecycleRecovery('focus');
      client.triggerLifecycleRecovery('online');

      if (readyCount > 1) {
        throw new Error(`Deduplication failed: sent ${readyCount} CLIENT_READY requests instead of 1`);
      }
      client.cleanup();
    }
  );

  // 14. cleanup removes watchdog/listeners
  harness.register(
    category,
    'cleanup removes watchdog/listeners',
    () => {
      setupMockEnvironment();

      const client = new MultiplayerClient();
      client.startWatchdog();
      client.setupLifecycleListeners();

      client.cleanup();

      if ((client as any).watchdogTimer !== null) {
        throw new Error('Expected watchdogTimer to be cleared on cleanup');
      }
      if ((client as any).boundVisibilityChange !== null) {
        throw new Error('Expected boundVisibilityChange to be removed on cleanup');
      }
    }
  );

  // 15. MATCH_SYNC does not fire gameStartedListeners, while GAME_STARTED does
  harness.register(
    category,
    'MATCH_SYNC must not fire gameStartedListeners, while GAME_STARTED does',
    () => {
      setupMockEnvironment();

      const client = new MultiplayerClient();
      const startedEvents: string[] = [];
      const stateEvents: any[] = [];

      client.onGameStarted((roomCode) => {
        startedEvents.push(roomCode);
      });

      client.onGameState((payload) => {
        stateEvents.push(payload);
      });

      // Directly invoke handleMessage with a MATCH_SYNC packet
      const matchSyncMessage = {
        type: 'MATCH_SYNC',
        payload: {
          roomCode: 'SYNC01',
          rawPosition: 'SOUTH',
          state: {
            round: 1,
            currentPlayer: 'SOUTH',
            players: {},
          },
        },
      };

      const getStartedCount = (): number => startedEvents.length;
      const getStateCount = (): number => stateEvents.length;

      (client as any).handleServerMessage(JSON.stringify(matchSyncMessage));

      if (getStartedCount() !== 0) {
        throw new Error(`MATCH_SYNC incorrectly invoked gameStartedListeners ${getStartedCount()} times (expected 0)`);
      }
      if (getStateCount() !== 1) {
        throw new Error(`MATCH_SYNC failed to invoke gameStateListeners (expected 1, got ${getStateCount()})`);
      }

      // Now invoke with genuine GAME_STARTED packet
      const gameStartedMessage = {
        type: 'GAME_STARTED',
        payload: {
          roomCode: 'SYNC01',
        },
      };

      (client as any).handleServerMessage(JSON.stringify(gameStartedMessage));

      if (getStartedCount() !== 1) {
        throw new Error(`GAME_STARTED failed to invoke gameStartedListeners (expected 1, got ${getStartedCount()})`);
      }

      client.cleanup();
    }
  );

  return harness;
}
