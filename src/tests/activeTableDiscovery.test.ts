/**
 * Automated Test Suite: Active Table Discovery Feature
 * 
 * Verifies:
 * A. Active waiting room appears in summary.
 * B. Active playing room with eligible Bot seat appears in summary.
 * C. Full 4-human room does NOT appear in summary.
 * D. Finished room does NOT appear in summary.
 * E. Room summary contains only public fields (no private secrets or state).
 * F. Clicking a listed room uses the existing JOIN_ROOM flow.
 * G. Empty list is handled correctly.
 * H. Existing Join-by-ID behavior remains unchanged.
 * I. Existing custom Room ID behavior remains unchanged.
 */

import { TestHarness } from './testHarness';
import { RoomManager } from '../../server/src/RoomManager';
import { WebSocket } from 'ws';
import { ActiveTableSummary } from '../models/multiplayer';

function createMockSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: () => {},
  } as unknown as WebSocket;
}

export function buildActiveTableDiscoveryTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Active Table Discovery';

  // Test A: Active waiting room appears
  harness.register(
    category,
    'A: Active waiting room in LOBBY appears in discovery list',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket = createMockSocket();
      roomMgr.createRoom('client_host_1', 'Vimal', mockSocket, '1000');

      const activeRooms = roomMgr.getActiveRoomsSummary();
      if (activeRooms.length !== 1) {
        throw new Error(`Expected 1 active room, found ${activeRooms.length}`);
      }

      const summary = activeRooms[0];
      if (summary.roomCode !== '1000') {
        throw new Error(`Expected roomCode '1000', got ${summary.roomCode}`);
      }
      if (summary.hostName !== 'Vimal') {
        throw new Error(`Expected hostName 'Vimal', got ${summary.hostName}`);
      }
      if (summary.humanCount !== 1) {
        throw new Error(`Expected humanCount 1, got ${summary.humanCount}`);
      }
      if (summary.totalSeats !== 4) {
        throw new Error(`Expected totalSeats 4, got ${summary.totalSeats}`);
      }
      if (summary.status !== 'WAITING') {
        throw new Error(`Expected status 'WAITING', got ${summary.status}`);
      }
      if (summary.isJoinable !== true) {
        throw new Error('Expected isJoinable to be true');
      }
    }
  );

  // Test B: Active playing room with eligible Bot seat appears
  harness.register(
    category,
    'B: Active playing room with bot seats appears in discovery list',
    async () => {
      const roomMgr = new RoomManager();
      const mockSocket1 = createMockSocket();
      const mockSocket2 = createMockSocket();

      roomMgr.createRoom('client_host_2', 'Rahul', mockSocket1, '1007');
      roomMgr.joinRoom('1007', 'client_p2', 'Aman', mockSocket2);

      const room = roomMgr.getRoom('1007')!;
      // Start match with autoFillBots so remaining seats are bots
      room.startMatch('client_host_2', true, 5);

      if (room.status !== 'PLAYING') {
        throw new Error('Expected room status to be PLAYING');
      }

      const activeRooms = roomMgr.getActiveRoomsSummary();
      if (activeRooms.length !== 1) {
        throw new Error(`Expected 1 active room, found ${activeRooms.length}`);
      }

      const summary = activeRooms[0];
      if (summary.roomCode !== '1007') {
        throw new Error(`Expected roomCode '1007', got ${summary.roomCode}`);
      }
      if (summary.hostName !== 'Rahul') {
        throw new Error(`Expected hostName 'Rahul', got ${summary.hostName}`);
      }
      if (summary.humanCount !== 2) {
        throw new Error(`Expected humanCount 2, got ${summary.humanCount}`);
      }
      if (summary.status !== 'PLAYING') {
        throw new Error(`Expected status 'PLAYING', got ${summary.status}`);
      }
      if (summary.isJoinable !== true) {
        throw new Error('Expected isJoinable to be true');
      }
    }
  );

  // Test C: Full 4-human room does NOT appear
  harness.register(
    category,
    'C: Full 4-human room does NOT appear in discovery list',
    async () => {
      const roomMgr = new RoomManager();
      roomMgr.createRoom('c1', 'Player1', createMockSocket(), 'FULL01');
      roomMgr.joinRoom('FULL01', 'c2', 'Player2', createMockSocket());
      roomMgr.joinRoom('FULL01', 'c3', 'Player3', createMockSocket());
      roomMgr.joinRoom('FULL01', 'c4', 'Player4', createMockSocket());

      const activeRooms = roomMgr.getActiveRoomsSummary();
      if (activeRooms.length !== 0) {
        throw new Error(`Expected 0 joinable rooms for full room, found ${activeRooms.length}`);
      }

      const room = roomMgr.getRoom('FULL01')!;
      room.startMatch('c1', false, 5);
      const activeRoomsPlaying = roomMgr.getActiveRoomsSummary();
      if (activeRoomsPlaying.length !== 0) {
        throw new Error(`Expected 0 joinable rooms for playing full room, found ${activeRoomsPlaying.length}`);
      }
    }
  );

  // Test D: Finished room does NOT appear
  harness.register(
    category,
    'D: Finished room does NOT appear in discovery list',
    async () => {
      const roomMgr = new RoomManager();
      roomMgr.createRoom('c1', 'Host', createMockSocket(), 'FIN01');
      const room = roomMgr.getRoom('FIN01')!;
      room.status = 'FINISHED';

      const activeRooms = roomMgr.getActiveRoomsSummary();
      if (activeRooms.length !== 0) {
        throw new Error(`Expected 0 active rooms for FINISHED room, found ${activeRooms.length}`);
      }
    }
  );

  // Test E: Room summary contains only public fields
  harness.register(
    category,
    'E: Room summary contains only public fields and no private secrets/state',
    async () => {
      const roomMgr = new RoomManager();
      roomMgr.createRoom('secret_client_id_123', 'PublicHost', createMockSocket(), 'PUB01');

      const activeRooms = roomMgr.getActiveRoomsSummary();
      if (activeRooms.length !== 1) {
        throw new Error('Expected 1 active room');
      }

      const summary = activeRooms[0] as any;
      const allowedKeys = new Set([
        'roomCode',
        'hostName',
        'humanCount',
        'totalSeats',
        'status',
        'currentRound',
        'totalRounds',
        'isJoinable',
      ]);

      for (const key of Object.keys(summary)) {
        if (!allowedKeys.has(key)) {
          throw new Error(`Unauthorized private field leaked in ActiveTableSummary: ${key}`);
        }
      }

      // Explicitly check that private client IDs, sockets, controllers, or cards are not present
      if (summary.clientId !== undefined) throw new Error('clientId leaked');
      if (summary.socket !== undefined) throw new Error('socket leaked');
      if (summary.cards !== undefined) throw new Error('cards leaked');
      if (summary.deck !== undefined) throw new Error('deck leaked');
      if (summary.bids !== undefined) throw new Error('bids leaked');
      if (summary.tricks !== undefined) throw new Error('tricks leaked');
      if (summary.scores !== undefined) throw new Error('scores leaked');
    }
  );

  // Test F: Clicking a listed room uses the existing JOIN_ROOM flow
  harness.register(
    category,
    'F: Joining via discovered room code uses standard joinRoom flow',
    async () => {
      const roomMgr = new RoomManager();
      roomMgr.createRoom('host_c', 'HostPlayer', createMockSocket(), 'JOIN77');

      const activeRooms = roomMgr.getActiveRoomsSummary();
      if (activeRooms.length !== 1) throw new Error('Expected 1 active room');

      const chosenCode = activeRooms[0].roomCode;
      const joinRes = roomMgr.joinRoom(chosenCode, 'joiner_c', 'NewGuest', createMockSocket());

      if (!joinRes.success || !joinRes.room) {
        throw new Error(`Expected join to succeed: ${joinRes.error}`);
      }

      const updatedRoom = roomMgr.getRoom(chosenCode)!;
      const participants = Array.from((updatedRoom as any).players.values());
      const guest = participants.find((p: any) => p.id === 'joiner_c');
      if (!guest || (guest as any).name !== 'NewGuest') {
        throw new Error('Expected NewGuest to be in room after standard join');
      }
    }
  );

  // Test G: Empty list is handled correctly
  harness.register(
    category,
    'G: Empty list returns empty array [] when no rooms exist',
    async () => {
      const roomMgr = new RoomManager();
      const activeRooms = roomMgr.getActiveRoomsSummary();
      if (!Array.isArray(activeRooms) || activeRooms.length !== 0) {
        throw new Error('Expected empty array when no rooms exist');
      }
    }
  );

  // Test H: Existing Join-by-ID behavior remains unchanged
  harness.register(
    category,
    'H: Direct Join-by-ID works identically without using discovery',
    async () => {
      const roomMgr = new RoomManager();
      roomMgr.createRoom('h1', 'Host1', createMockSocket(), 'DIRECT9');

      const joinRes = roomMgr.joinRoom('DIRECT9', 'j1', 'DirectJoiner', createMockSocket());
      if (!joinRes.success) {
        throw new Error('Expected direct join by ID to succeed');
      }
    }
  );

  // Test I: Existing custom Room ID behavior remains unchanged
  harness.register(
    category,
    'I: Custom Room ID creation and discovery works seamlessly',
    async () => {
      const roomMgr = new RoomManager();
      const createRes = roomMgr.createRoom('h_custom', 'CustomHost', createMockSocket(), 'VIP888');
      if (!createRes.success) {
        throw new Error('Custom room ID creation failed');
      }

      const activeRooms = roomMgr.getActiveRoomsSummary();
      const vipRoom = activeRooms.find((r) => r.roomCode === 'VIP888');
      if (!vipRoom) {
        throw new Error('Custom VIP888 room not found in active rooms summary');
      }
      if (vipRoom.hostName !== 'CustomHost') {
        throw new Error(`Expected hostName CustomHost, got ${vipRoom.hostName}`);
      }
    }
  );

  return harness;
}
