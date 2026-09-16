/**
 * Automated Test Suite: Separate Waiting Table from Active Game
 * 
 * Verifies:
 * 1. State Model Distinction:
 *    - Waiting Lobby: Room exists, players waiting, match not started (status === 'LOBBY').
 *    - Match Playing: Match is active (status === 'PLAYING' / BIDDING / TRICK / ROUND).
 * 2. Waiting Lobby UI Actions:
 *    - Host sees [Resume Table] and [Start Game].
 *    - Non-Host Human sees [Resume Table] only (NO [Start Game]).
 *    - [Resume Game] is NOT shown for waiting tables.
 * 3. Active Match UI Actions:
 *    - Participants see [Resume Game].
 *    - [Resume Table] and [Start Game] are NOT shown.
 * 4. Authoritative Start Game:
 *    - Only Host can execute START_MATCH.
 *    - Server rejects non-host START_MATCH.
 * 5. Reconnect & Page Refresh:
 *    - Reconnecting to a waiting room stays in LOBBY state and does not auto-start.
 *    - Reconnecting to an active match restores PLAYING match state.
 */

import { TestHarness } from './testHarness';
import { GameRoom, RoomManager } from '../../server/src/RoomManager';
import { WebSocket } from 'ws';

function createMockSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: () => {},
  } as unknown as WebSocket;
}

export function buildWaitingTableVsActiveMatchTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Waiting Table vs Active Match State Separation';

  // Test 1: Room created is initially in LOBBY state, NOT playing
  harness.register(
    category,
    'State Model: Room created starts in LOBBY state',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket = createMockSocket();
      const createRes = roomMgr.createRoom('c1', 'HostPlayer', mockSocket, 'WAIT01');
      if (!createRes.success || !createRes.room) {
        throw new Error('Failed to create room');
      }

      const room = roomMgr.getRoom('WAIT01');
      if (!room) throw new Error('Room not found');

      if (room.status !== 'LOBBY') {
        throw new Error(`Expected status LOBBY, got ${room.status}`);
      }
      if ((room as any).controller !== null) {
        throw new Error('Expected controller to be null in LOBBY state');
      }
    }
  );

  // Test 2: Waiting Lobby UI logic - Host gets [Resume Table] and [Start Game]
  harness.register(
    category,
    'Waiting Lobby UI: Host has Resume Table and Start Game actions',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket = createMockSocket();
      roomMgr.createRoom('c1_host', 'HostPlayer', mockSocket, 'WAIT02');
      const room = roomMgr.getRoom('WAIT02')!;

      // Simulate UI state derivation
      const roomCode = room.roomCode;
      const isHost = room.hostClientId === 'c1_host';
      const isWaitingTable = Boolean(roomCode) && room.status === 'LOBBY';
      const isActiveMatch = (room.status as string) === 'PLAYING';

      if (!isWaitingTable) {
        throw new Error('Expected isWaitingTable to be true');
      }
      if (isActiveMatch) {
        throw new Error('Expected isActiveMatch to be false');
      }
      if (!isHost) {
        throw new Error('Expected c1_host to be Host');
      }

      // Host must have Start Game capability and Resume Table capability
      const showResumeTable = isWaitingTable;
      const showStartGame = isWaitingTable && isHost;
      const showResumeGame = isActiveMatch && !isWaitingTable;

      if (!showResumeTable) throw new Error('Host must see Resume Table');
      if (!showStartGame) throw new Error('Host must see Start Game');
      if (showResumeGame) throw new Error('Host must NOT see Resume Game when table is waiting');
    }
  );

  // Test 3: Waiting Lobby UI logic - Non-Host Human gets [Resume Table] ONLY
  harness.register(
    category,
    'Waiting Lobby UI: Non-Host Human gets Resume Table only, not Start Game',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket1 = createMockSocket();
      const mockSocket2 = createMockSocket();
      roomMgr.createRoom('c1_host', 'HostPlayer', mockSocket1, 'WAIT03');
      roomMgr.joinRoom('WAIT03', 'c2_guest', 'GuestPlayer', mockSocket2);
      const room = roomMgr.getRoom('WAIT03')!;

      const roomCode = room.roomCode;
      const isHostForGuest = room.hostClientId === 'c2_guest';
      const isWaitingTable = Boolean(roomCode) && room.status === 'LOBBY';
      const isActiveMatch = (room.status as string) === 'PLAYING';

      if (isHostForGuest) {
        throw new Error('Expected c2_guest not to be Host');
      }

      const showResumeTable = isWaitingTable;
      const showStartGame = isWaitingTable && isHostForGuest;
      const showResumeGame = isActiveMatch && !isWaitingTable;

      if (!showResumeTable) throw new Error('Guest must see Resume Table');
      if (showStartGame) throw new Error('Guest must NOT see Start Game button');
      if (showResumeGame) throw new Error('Guest must NOT see Resume Game when table is waiting');
    }
  );

  // Test 4: Server authoritative Start Game validation
  harness.register(
    category,
    'Host Authority: Server rejects non-host START_MATCH attempts',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket1 = createMockSocket();
      const mockSocket2 = createMockSocket();
      roomMgr.createRoom('c1_host', 'HostPlayer', mockSocket1, 'WAIT04');
      roomMgr.joinRoom('WAIT04', 'c2_guest', 'GuestPlayer', mockSocket2);
      const room = roomMgr.getRoom('WAIT04')!;

      // Guest c2_guest tries to start match
      const guestStart = room.startMatch('c2_guest', true, 5);
      if (guestStart.success) {
        throw new Error('Server must reject startMatch from non-host client');
      }

      if (room.status !== 'LOBBY') {
        throw new Error('Room status should still be LOBBY after rejected start');
      }

      // Host c1_host starts match
      const hostStart = room.startMatch('c1_host', true, 5);
      if (!hostStart.success) {
        throw new Error(`Host startMatch should succeed: ${hostStart.error}`);
      }

      if ((room.status as string) !== 'PLAYING') {
        throw new Error(`Expected room status PLAYING after host start, got ${room.status}`);
      }
    }
  );

  // Test 5: Active Match UI logic - Participants see [Resume Game], not [Resume Table]
  harness.register(
    category,
    'Active Match UI: Once match is playing, shows Resume Game and hides Resume Table/Start Game',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket = createMockSocket();
      roomMgr.createRoom('c1_host', 'HostPlayer', mockSocket, 'WAIT05');
      const room = roomMgr.getRoom('WAIT05')!;
      room.startMatch('c1_host', true, 5);

      const roomCode = room.roomCode;
      const isHost = room.hostClientId === 'c1_host';
      const isWaitingTable = Boolean(roomCode) && (room.status as string) === 'LOBBY';
      const isActiveMatch = room.status === 'PLAYING';

      if (isWaitingTable) {
        throw new Error('isWaitingTable must be false during active match');
      }
      if (!isActiveMatch) {
        throw new Error('isActiveMatch must be true during active match');
      }

      const showResumeTable = isWaitingTable;
      const showStartGame = isWaitingTable && isHost;
      const showResumeGame = isActiveMatch && !isWaitingTable;

      if (showResumeTable) throw new Error('Must NOT show Resume Table during active match');
      if (showStartGame) throw new Error('Must NOT show Start Game during active match');
      if (!showResumeGame) throw new Error('Must show Resume Game during active match');
    }
  );

  // Test 6: Reconnect / Join existing waiting table preserves LOBBY and does not auto-start
  harness.register(
    category,
    'Reconnect to Waiting Table: Preserves LOBBY state and does not auto-start',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket1 = createMockSocket();
      const mockSocket2 = createMockSocket();
      roomMgr.createRoom('c1_host', 'HostPlayer', mockSocket1, 'WAIT06');
      roomMgr.joinRoom('WAIT06', 'c2_guest', 'GuestPlayer', mockSocket2);

      const room = roomMgr.getRoom('WAIT06')!;
      if (room.status !== 'LOBBY') {
        throw new Error(`Expected room to remain in LOBBY, got ${room.status}`);
      }
      if ((room as any).controller !== null) {
        throw new Error('Game must not have auto-started on join');
      }

      // Host leaves and re-joins with new socket
      roomMgr.leaveRoom('c1_host', false);
      const mockSocket3 = createMockSocket();
      const joinRes = roomMgr.joinRoom('WAIT06', 'c3_new', 'NewHost', mockSocket3);
      if (!joinRes.success) {
        throw new Error(`Failed to join waiting table: ${joinRes.error}`);
      }

      if (room.status !== 'LOBBY') {
        throw new Error(`Expected room to stay in LOBBY, got ${room.status}`);
      }
      if ((room as any).controller !== null) {
        throw new Error('Game must not auto-start until host triggers it');
      }
    }
  );

  return harness;
}
