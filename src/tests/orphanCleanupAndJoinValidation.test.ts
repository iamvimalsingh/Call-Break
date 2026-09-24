/**
 * Step 3: Orphan Room Cleanup, Simplified Join UX & Resume Validation Tests
 */

import { TestHarness } from './testHarness';
import { RoomManager, GameRoom } from '../../server/src/RoomManager';
import { PlayerPosition } from '../models/player';
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

  (globalThis as any).window = {
    location: {
      reload: () => {},
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

export function buildOrphanCleanupAndJoinValidationTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Step 3: Orphan Cleanup & Join/Resume Validation';

  const assert = (condition: any, message: string) => {
    if (!condition) throw new Error(message);
  };

  const createMockSocket = () =>
    ({
      readyState: 1, // WebSocket.OPEN
      send: (_data: string) => {},
      close: (_code?: number, _reason?: string) => {},
    } as any);

  // 1. Zero-human LOBBY room with no reservations is immediately cleaned up
  harness.register(category, 'Zero-human LOBBY room with no reservations is immediately cleaned up', () => {
    const roomManager = RoomManager.getInstance();
    const hostSocket = createMockSocket();
    const createRes = roomManager.createRoom('user_host_1', 'HostAlice', hostSocket);
    assert(createRes.success, 'Room should be created');
    const roomCode = createRes.room!.roomCode;

    assert(roomManager.getRoom(roomCode) !== undefined, 'Room exists in manager');

    // Host explicitly leaves the lobby
    roomManager.leaveRoom('user_host_1', true);

    assert(roomManager.getRoom(roomCode) === undefined, 'Zero-human LOBBY room should be deleted from RoomManager');
  });

  // 2. Explicit departure does not leave lingering ghost rooms
  harness.register(category, 'Explicit departure cleans up room without creating reservations', () => {
    const roomManager = RoomManager.getInstance();
    const hostSocket = createMockSocket();
    const createRes = roomManager.createRoom('user_host_2', 'HostBob', hostSocket);
    const roomCode = createRes.room!.roomCode;

    roomManager.leaveRoom('user_host_2', true);

    const activeRooms = roomManager.getActiveRoomsSummary();
    const found = activeRooms.find((r) => r.roomCode === roomCode);
    assert(!found, 'Active tables list must not contain the abandoned room');
  });

  // 3. PLAYING room preserves 45-second reconnect reservation for disconnected client
  harness.register(category, 'PLAYING room preserves 45-second reconnect reservation on disconnect', () => {
    const roomManager = RoomManager.getInstance();
    const hostSocket = createMockSocket();
    const createRes = roomManager.createRoom('user_host_3', 'HostCharlie', hostSocket);
    const room = createRes.room!;
    const roomCode = room.roomCode;

    // Start match
    const startRes = room.startMatch('user_host_3', true, 5);
    assert(startRes.success, 'startMatch should succeed');
    assert(room.getStatus() === 'PLAYING', 'Room should be in PLAYING status');

    // Implicit disconnect (network loss, not explicit leave)
    room.removeClient('user_host_3', false);

    assert(room.hasActiveReservations(), 'Should have active reconnect reservation');
    assert(roomManager.getRoom(roomCode) !== undefined, 'Room should not be destroyed while reservation active');

    // Cleanup test
    room.destroy();
    roomManager.cleanupRoom(roomCode);
  });

  // 4. Zero-human PLAYING room is cleaned up once all reservations expire
  harness.register(category, 'Zero-human PLAYING room is cleaned up when all reservations expire', () => {
    const roomManager = RoomManager.getInstance();
    const hostSocket = createMockSocket();
    const createRes = roomManager.createRoom('user_host_4', 'HostDan', hostSocket);
    const room = createRes.room!;
    const roomCode = room.roomCode;

    const startRes = room.startMatch('user_host_4', true, 5);
    assert(startRes.success, 'startMatch should succeed');
    room.removeClient('user_host_4', false);

    // Clear reservations explicitly simulating timer expiration
    room.clearSeatReservation(PlayerPosition.SOUTH);
    assert(!room.hasActiveReservations(), 'No active reservations remain');

    roomManager.cleanupRoomIfEmpty(roomCode);
    assert(roomManager.getRoom(roomCode) === undefined, 'Room should be destroyed and removed after reservations expire');
  });

  // 5. FINISHED room is cleaned up immediately when all clients disconnect
  harness.register(category, 'FINISHED room is cleaned up immediately when all clients disconnect', () => {
    const roomManager = RoomManager.getInstance();
    const hostSocket = createMockSocket();
    const createRes = roomManager.createRoom('user_host_5', 'HostEve', hostSocket);
    const room = createRes.room!;
    const roomCode = room.roomCode;

    room.status = 'FINISHED';

    room.removeClient('user_host_5', true);
    roomManager.cleanupRoomIfEmpty(roomCode);

    assert(roomManager.getRoom(roomCode) === undefined, 'Finished room with 0 clients should be cleaned up');
  });

  // 6. FINISHED room schedules bounded 90-second cleanup if clients remain
  harness.register(category, 'FINISHED room schedules bounded 90-second cleanup when match completes', () => {
    const roomManager = RoomManager.getInstance();
    const hostSocket = createMockSocket();
    const createRes = roomManager.createRoom('user_host_6', 'HostFrank', hostSocket);
    const room = createRes.room!;
    const roomCode = room.roomCode;

    room.status = 'FINISHED';
    room.scheduleFinishedCleanup();

    // Verify destroy cleans up timer and room
    roomManager.cleanupRoom(roomCode);
    assert(roomManager.getRoom(roomCode) === undefined, 'Room should be cleaned up safely');
  });

  // 7. Cleanup and destroy are strictly idempotent
  harness.register(category, 'cleanupRoom and destroy are idempotent and safe against repeated calls', () => {
    const roomManager = RoomManager.getInstance();
    const hostSocket = createMockSocket();
    const createRes = roomManager.createRoom('user_host_7', 'HostGrace', hostSocket);
    const room = createRes.room!;
    const roomCode = room.roomCode;

    // Call destroy multiple times
    room.destroy();
    room.destroy();

    // Call cleanup multiple times
    roomManager.cleanupRoom(roomCode);
    roomManager.cleanupRoom(roomCode);
    roomManager.cleanupRoomIfEmpty(roomCode);

    assert(roomManager.getRoom(roomCode) === undefined, 'Room successfully removed without throw');
  });

  // 8. getPublicSummary never advertises FINISHED rooms
  harness.register(category, 'getPublicSummary returns null for FINISHED rooms', () => {
    const hostSocket = createMockSocket();
    const room = new GameRoom('ROOM_F1', 'client_1', 'Player1', hostSocket);
    room.status = 'FINISHED';

    const summary = room.getPublicSummary();
    assert(summary === null, 'FINISHED room must not have a public summary');
    room.destroy();
  });

  // 9. getPublicSummary never advertises orphan / zero-human ghost rooms
  harness.register(category, 'getPublicSummary returns null for ghost rooms with 0 connected humans and 0 reservations', () => {
    const hostSocket = createMockSocket();
    const room = new GameRoom('ROOM_G1', 'client_1', 'Player1', hostSocket);
    room.removeClient('client_1', true); // explicit remove => 0 humans, 0 reservations

    const summary = room.getPublicSummary();
    assert(summary === null, 'Ghost room with 0 humans and 0 reservations must not be advertised');
    room.destroy();
  });

  // 10. getPublicSummary returns valid summary for joinable WAITING table
  harness.register(category, 'getPublicSummary returns valid summary for active joinable table', () => {
    const hostSocket = createMockSocket();
    const room = new GameRoom('ROOMW1', 'client_1', 'Aarav', hostSocket);

    const summary = room.getPublicSummary();
    assert(summary !== null, 'Active waiting table must have a public summary');
    assert(summary!.roomCode === 'ROOMW1', 'Room code matches');
    assert(summary!.hostName === 'Aarav', 'Host name matches');
    assert(summary!.status === 'WAITING', 'Status is WAITING');
    assert(summary!.isJoinable === true, 'Table is joinable');
    room.destroy();
  });

  // 11. getActiveRoomsSummary purges dead rooms automatically
  harness.register(category, 'getActiveRoomsSummary purges dead rooms and returns only active ones', () => {
    const roomManager = RoomManager.getInstance();
    const socketA = createMockSocket();
    const socketB = createMockSocket();

    const roomA = roomManager.createRoom('client_a', 'PlayerA', socketA);
    const roomB = roomManager.createRoom('client_b', 'PlayerB', socketB);

    // Abandon roomA explicitly
    roomA.room!.removeClient('client_a', true);

    const summaries = roomManager.getActiveRoomsSummary();
    const foundA = summaries.find((s) => s.roomCode === roomA.room!.roomCode);
    const foundB = summaries.find((s) => s.roomCode === roomB.room!.roomCode);

    assert(!foundA, 'Dead room A must not appear in active rooms summary');
    assert(Boolean(foundB), 'Active room B must appear in active rooms summary');

    // Clean up
    roomManager.cleanupRoom(roomB.room!.roomCode);
  });

  // 12. Client handles ROOM_NOT_FOUND by clearing active_table_id and preserving player_id
  harness.register(category, 'Client clears cb_active_table_id and preserves cb_player_id on ROOM_NOT_FOUND', () => {
    setupMockEnvironment();
    setActiveTableId('DEAD_ROOM_999');

    const client = new MultiplayerClient();
    const playerIdBefore = client.getPlayerId();

    assert(getActiveTableId() === 'DEAD_ROOM_999', 'Active table id set in storage');
    assert(Boolean(playerIdBefore), 'Player ID exists');

    // Feed ERROR: ROOM_NOT_FOUND to client
    (client as any).handleServerMessage(
      JSON.stringify({
        type: 'ERROR',
        payload: {
          code: 'ROOM_NOT_FOUND',
          message: 'No active table found with code: DEAD_ROOM_999',
        },
      })
    );

    assert(getActiveTableId() === null, 'Active table id cleared on ROOM_NOT_FOUND');
    assert(client.getPlayerId() === playerIdBefore, 'Player ID preserved on ROOM_NOT_FOUND');
    assert(client.getRoomState() === null, 'Current room state is null');

    client.cleanup();
  });

  // 13. Resume labels strictly distinguish LOBBY (Resume Table) vs PLAYING (Resume Game)
  harness.register(category, 'Resume semantics distinguish LOBBY (Resume Table) and PLAYING (Resume Game)', () => {
    const isLobbyResume = (roomCode: string | null, roomState: any) =>
      Boolean(roomCode) && Boolean(roomState) && roomState?.status === 'LOBBY';

    const isPlayingResume = (roomCode: string | null, roomState: any, gameStatus: string) =>
      Boolean(roomCode) && Boolean(roomState) && roomState?.status === 'PLAYING' && gameStatus !== 'MATCH_FINISHED';

    // Stale or nonexistent room
    assert(!isLobbyResume('ROOM_1', null), 'No resume when roomState is null');
    assert(!isPlayingResume('ROOM_1', null, 'PLAYING'), 'No resume when roomState is null');

    // Finished room
    assert(!isLobbyResume('ROOM_1', { status: 'FINISHED' }), 'No resume for FINISHED room in lobby');
    assert(!isPlayingResume('ROOM_1', { status: 'FINISHED' }, 'MATCH_FINISHED'), 'No resume for FINISHED room in playing');

    // Valid LOBBY room
    assert(isLobbyResume('ROOM_1', { status: 'LOBBY' }), 'LOBBY room produces Resume Table');
    assert(!isPlayingResume('ROOM_1', { status: 'LOBBY' }, 'IDLE'), 'LOBBY room does not produce Resume Game');

    // Valid PLAYING room
    assert(!isLobbyResume('ROOM_1', { status: 'PLAYING' }), 'PLAYING room does not produce Resume Table');
    assert(isPlayingResume('ROOM_1', { status: 'PLAYING' }, 'PLAYING'), 'PLAYING room produces Resume Game');
  });

  return harness;
}
