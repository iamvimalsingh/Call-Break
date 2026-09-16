/**
 * Automated Test Suite: Joiner Waiting Room Flow
 * 
 * Verifies:
 * 1. A player joining an existing LOBBY room immediately receives ROOM_STATE and enters the waiting room.
 * 2. Joiner client state derives `hasJoinedRoom = true` and shows the waiting table with seated players.
 * 3. Joiner waiting table shows "Waiting for host to start the game" and does NOT render the Start Game button.
 * 4. Host waiting table renders the "Start Game" button and match configurations.
 * 5. Host starting the game transitions the room to PLAYING and broadcasts MATCH_STARTED / GAME_STATE.
 * 6. Non-host client cannot start the match.
 * 7. Disconnecting / Reconnecting in LOBBY preserves room LOBBY status and allows immediate re-entry to the waiting room.
 */

import { TestHarness } from './testHarness';
import { RoomManager } from '../../server/src/RoomManager';
import { WebSocket } from 'ws';
import { ServerMessage, RoomState } from '../models/multiplayer';
import { PlayerPosition } from '../models/player';

function createMockSocket(onMessage?: (msg: ServerMessage) => void): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: (data: string) => {
      try {
        const parsed = JSON.parse(data) as ServerMessage;
        if (onMessage) {
          onMessage(parsed);
        }
      } catch {}
    },
  } as unknown as WebSocket;
}

export function buildJoinerWaitingRoomFlowTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Joiner Waiting Room Flow';

  // Test 1: Joining a room receives ROOM_STATE with LOBBY status immediately
  harness.register(
    category,
    'Joiner receives ROOM_STATE in LOBBY status and is assigned a seat',
    async () => {
      const roomMgr = new RoomManager();
      const hostMessages: ServerMessage[] = [];
      const guestMessages: ServerMessage[] = [];

      const hostSocket = createMockSocket((msg) => hostMessages.push(msg));
      const guestSocket = createMockSocket((msg) => guestMessages.push(msg));

      roomMgr.createRoom('client_host', 'Host_P1', hostSocket, 'JOIN01');
      const joinRes = roomMgr.joinRoom('JOIN01', 'client_guest', 'Guest_P2', guestSocket);

      if (!joinRes.success) {
        throw new Error(`Join failed: ${joinRes.error}`);
      }

      // Guest must have received ROOM_STATE
      const roomStateMsg = guestMessages.find((m) => m.type === 'ROOM_STATE');
      if (!roomStateMsg) {
        throw new Error('Guest did not receive ROOM_STATE message upon joining');
      }

      const roomPayload = roomStateMsg.payload as RoomState;
      if (roomPayload.status !== 'LOBBY') {
        throw new Error(`Expected room status LOBBY, got ${roomPayload.status}`);
      }
      if (roomPayload.roomCode !== 'JOIN01') {
        throw new Error(`Expected room code JOIN01, got ${roomPayload.roomCode}`);
      }

      // Both players must be present in the roomState
      const humanCount = roomPayload.players.filter((p) => !p.isBot).length;
      if (humanCount !== 2) {
        throw new Error(`Expected 2 human players in roomState, got ${humanCount}`);
      }

      const guestPlayer = roomPayload.players.find((p) => p.id === 'client_guest');
      if (!guestPlayer) {
        throw new Error('Guest participant not found in roomState.players');
      }
      if (guestPlayer.position !== PlayerPosition.WEST) {
        throw new Error(`Expected guest to be at WEST, got ${guestPlayer.position}`);
      }
    }
  );

  // Test 2: Client UI derivation for Joiner inside Waiting Table
  harness.register(
    category,
    'UI State Derivation: Joiner has hasJoinedRoom=true, isHost=false, and shows Waiting for Host banner',
    async () => {
      const roomMgr = new RoomManager();
      let lastGuestRoomState: RoomState | null = null;

      const hostSocket = createMockSocket();
      const guestSocket = createMockSocket((msg) => {
        if (msg.type === 'ROOM_STATE') {
          lastGuestRoomState = msg.payload as RoomState;
        }
      });

      roomMgr.createRoom('client_host', 'Rahul', hostSocket, 'JOIN02');
      roomMgr.joinRoom('JOIN02', 'client_guest', 'Priya', guestSocket);

      if (!lastGuestRoomState) {
        throw new Error('Guest did not receive ROOM_STATE');
      }

      // Simulate RoomLobbyModal UI state derivation
      const roomState: RoomState = lastGuestRoomState;
      const hasJoinedRoom = Boolean(roomState && roomState.roomCode);
      const isHost =
        roomState.hostId === roomState.myClientId ||
        roomState.players.find((p) => p.id === roomState.myClientId)?.isHost === true;
      const isWaitingTable = roomState.status === 'LOBBY';

      if (!hasJoinedRoom) {
        throw new Error('Expected hasJoinedRoom to be true');
      }
      if (isHost) {
        throw new Error('Guest client must have isHost = false');
      }
      if (!isWaitingTable) {
        throw new Error('Expected isWaitingTable to be true in LOBBY status');
      }

      // Action & Banner checks
      const showStartGameButton = isHost;
      const showGuestWaitingBanner = !isHost && hasJoinedRoom;

      if (showStartGameButton) {
        throw new Error('Guest must NOT see Start Game button');
      }
      if (!showGuestWaitingBanner) {
        throw new Error('Guest MUST see Waiting for host banner');
      }
    }
  );

  // Test 3: Host UI derivation inside Waiting Table
  harness.register(
    category,
    'UI State Derivation: Host has hasJoinedRoom=true, isHost=true, and shows Start Game button',
    async () => {
      const roomMgr = new RoomManager();
      let lastHostRoomState: RoomState | null = null;

      const hostSocket = createMockSocket((msg) => {
        if (msg.type === 'ROOM_STATE') {
          lastHostRoomState = msg.payload as RoomState;
        }
      });
      const guestSocket = createMockSocket();

      roomMgr.createRoom('client_host', 'Rahul', hostSocket, 'JOIN03');
      roomMgr.joinRoom('JOIN03', 'client_guest', 'Priya', guestSocket);

      if (!lastHostRoomState) {
        throw new Error('Host did not receive ROOM_STATE');
      }

      const roomState: RoomState = lastHostRoomState;
      const hasJoinedRoom = Boolean(roomState && roomState.roomCode);
      const isHost =
        roomState.hostId === roomState.myClientId ||
        roomState.players.find((p) => p.id === roomState.myClientId)?.isHost === true;

      if (!hasJoinedRoom) {
        throw new Error('Expected hasJoinedRoom to be true for host');
      }
      if (!isHost) {
        throw new Error('Host client must have isHost = true');
      }

      const showStartGameButton = isHost;
      const showGuestWaitingBanner = !isHost && hasJoinedRoom;

      if (!showStartGameButton) {
        throw new Error('Host MUST see Start Game button');
      }
      if (showGuestWaitingBanner) {
        throw new Error('Host must NOT see Guest Waiting banner');
      }
    }
  );

  // Test 4: Starting game transitions room to PLAYING and notifies both players
  harness.register(
    category,
    'Match Start: Host triggers START_MATCH -> Room becomes PLAYING and both players receive MATCH_STARTED',
    async () => {
      const roomMgr = new RoomManager();
      const hostEvents: string[] = [];
      const guestEvents: string[] = [];

      const hostSocket = createMockSocket((msg) => hostEvents.push(msg.type));
      const guestSocket = createMockSocket((msg) => guestEvents.push(msg.type));

      roomMgr.createRoom('client_host', 'Rahul', hostSocket, 'JOIN04');
      roomMgr.joinRoom('JOIN04', 'client_guest', 'Priya', guestSocket);

      const room = roomMgr.getRoom('JOIN04')!;
      if (room.status !== 'LOBBY') {
        throw new Error('Room should be in LOBBY status before start');
      }

      // Non-host attempts to start
      const nonHostStart = room.startMatch('client_guest', true, 5);
      if (nonHostStart.success) {
        throw new Error('Server must reject startMatch from non-host client');
      }

      // Host starts match
      const hostStart = room.startMatch('client_host', true, 5);
      if (!hostStart.success) {
        throw new Error(`Host start failed: ${hostStart.error}`);
      }

      if ((room.status as string) !== 'PLAYING') {
        throw new Error(`Expected room status PLAYING, got ${room.status}`);
      }

      if (!hostEvents.includes('MATCH_STARTED') || !guestEvents.includes('MATCH_STARTED')) {
        throw new Error('Both Host and Guest must receive MATCH_STARTED message');
      }
      if (!hostEvents.includes('GAME_STATE') || !guestEvents.includes('GAME_STATE')) {
        throw new Error('Both Host and Guest must receive GAME_STATE message');
      }
    }
  );

  // Test 5: Reconnecting in LOBBY preserves waiting room status without auto-starting
  harness.register(
    category,
    'Lobby Reconnection: Preserves LOBBY status and returns updated roomState',
    async () => {
      const roomMgr = new RoomManager();
      const hostSocket = createMockSocket();
      const guestSocket1 = createMockSocket();

      roomMgr.createRoom('client_host', 'Rahul', hostSocket, 'JOIN05');
      roomMgr.joinRoom('JOIN05', 'client_guest_1', 'Priya', guestSocket1);

      const room = roomMgr.getRoom('JOIN05')!;
      if (room.status !== 'LOBBY') {
        throw new Error('Expected room status LOBBY');
      }

      // Guest disconnects
      roomMgr.leaveRoom('client_guest_1', false);

      // Guest reconnects with new socket ID
      let reconnectedRoomState: RoomState | null = null;
      const guestSocket2 = createMockSocket((msg) => {
        if (msg.type === 'ROOM_STATE') {
          reconnectedRoomState = msg.payload as RoomState;
        }
      });

      const reconnectRes = roomMgr.joinRoom('JOIN05', 'client_guest_2', 'Priya', guestSocket2);
      if (!reconnectRes.success) {
        throw new Error(`Reconnect failed: ${reconnectRes.error}`);
      }

      if (room.status !== 'LOBBY') {
        throw new Error('Room must remain in LOBBY on reconnect');
      }

      if (!reconnectedRoomState) {
        throw new Error('Reconnected guest did not receive ROOM_STATE');
      }

      const reconnectedRoom: RoomState = reconnectedRoomState;
      if (reconnectedRoom.status !== 'LOBBY') {
        throw new Error(`Reconnected room state has invalid status: ${reconnectedRoom.status}`);
      }
    }
  );

  return harness;
}
