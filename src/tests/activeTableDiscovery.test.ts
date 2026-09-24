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

  // Test J: Full Lobby 45-Second Host Reconnect & 5-Minute Grace Verification Suite
  harness.register(
    category,
    'J1-J5: WAITING room creation, host disconnect, 45s host retention, and 5-minute lobby grace presence',
    async () => {
      const roomMgr = new RoomManager();
      const hostSocket = createMockSocket();
      
      // 1. CREATE WAITING room
      const createRes = roomMgr.createRoom('host_1', 'Vimal', hostSocket, 'GRACE100');
      if (!createRes.success || !createRes.room) {
        throw new Error('Failed to create WAITING room');
      }
      const room = createRes.room;
      if (room.getStatus() !== 'LOBBY') {
        throw new Error(`Expected LOBBY status, got ${room.getStatus()}`);
      }
      if ((room as any).hostClientId !== 'host_1') {
        throw new Error('Expected host_1 to be room host');
      }

      // 2. Host disconnects (T0)
      roomMgr.leaveRoom('host_1', false);

      // 3. Room is still present immediately after disconnect
      const roomAfterDc = roomMgr.getRoom('GRACE100');
      if (!roomAfterDc) {
        throw new Error('Room was destroyed immediately upon host disconnect!');
      }

      // 4. Room remains present before 5 minutes (grace active)
      if (!roomAfterDc.isLobbyGraceActive()) {
        throw new Error('Expected isLobbyGraceActive() to be true');
      }

      // 4b. 45-second Host Reconnect Window is active
      if (!roomAfterDc.isLobbyHostTransferPending()) {
        throw new Error('Expected isLobbyHostTransferPending() to be true upon host disconnect');
      }

      // 5. Room appears in Active Tables during grace with safe creator host name
      const activeSummaries = roomMgr.getActiveRoomsSummary();
      const found = activeSummaries.find((r) => r.roomCode === 'GRACE100');
      if (!found) {
        throw new Error('Waiting room with disconnected host missing from Active Tables');
      }
      if (found.hostName !== 'Vimal') {
        throw new Error(`Expected creator hostName Vimal, got ${found.hostName}`);
      }
      if (found.status !== 'WAITING') {
        throw new Error(`Expected status WAITING, got ${found.status}`);
      }
    }
  );

  harness.register(
    category,
    'J6-J7: Other Human joins during first 45s (does not immediately become Host), duplicate roomCode rejected',
    async () => {
      const roomMgr = new RoomManager();
      roomMgr.createRoom('host_orig', 'OriginalHost', createMockSocket(), 'GRACE200');
      const room = roomMgr.getRoom('GRACE200')!;
      roomMgr.leaveRoom('host_orig', false);

      // 7. Same custom Room ID cannot be recreated during grace
      const duplicateCreate = roomMgr.createRoom('intruder', 'Intruder', createMockSocket(), 'GRACE200');
      if (duplicateCreate.success || duplicateCreate.errorCode !== 'ROOM_ALREADY_EXISTS') {
        throw new Error('Expected duplicate room creation to fail with ROOM_ALREADY_EXISTS');
      }

      // 6. Another Human can JOIN while original Host is disconnected (<45s)
      const guestSocket = createMockSocket();
      const joinRes = roomMgr.joinRoom('GRACE200', 'guest_1', 'GuestPlayer', guestSocket);
      if (!joinRes.success) {
        throw new Error(`Guest failed to join orphaned lobby: ${joinRes.error}`);
      }

      // Invariant: during the 45-second window, guest does NOT immediately become Table Host
      const guestParticipant = (room as any).players.get((room as any).clientPositions.get('guest_1'));
      if (guestParticipant?.isHost === true) {
        throw new Error('Guest became Host immediately during the 45-second host reconnect window');
      }
    }
  );

  harness.register(
    category,
    'J8-J10: Host returns at <45s retains Host; at 45s Host transfers to Human; returning host at >45s does not steal',
    async () => {
      const roomMgr = new RoomManager();
      
      // Scenario A: Host disconnects, Guest joins, Host reconnects at <45s -> Host retains Host role!
      roomMgr.createRoom('host_early', 'EarlyHost', createMockSocket(), 'GRACE300');
      const roomEarly = roomMgr.getRoom('GRACE300')!;
      roomMgr.leaveRoom('host_early', false);
      
      // Guest joins at T10s
      roomMgr.joinRoom('GRACE300', 'guest_early', 'GuestEarly', createMockSocket());
      
      // Host returns at T20s (<45s)
      const rejoinEarly = roomMgr.joinRoom('GRACE300', 'host_early', 'EarlyHost', createMockSocket());
      if (!rejoinEarly.success) {
        throw new Error('Original host failed to rejoin within 45s');
      }
      if ((roomEarly as any).hostClientId !== 'host_early') {
        throw new Error('Original host lost Host role when returning within 45s');
      }
      const hostPart = (roomEarly as any).players.get((roomEarly as any).clientPositions.get('host_early'));
      if (!hostPart || !hostPart.isHost) {
        throw new Error('Original host participant isHost is not true');
      }

      // Scenario B: Host disconnects, Guest joins, 45s expires -> Host transfers to Guest!
      roomMgr.createRoom('host_transfer', 'TransferHost', createMockSocket(), 'GRACE400');
      const roomTransfer = roomMgr.getRoom('GRACE400')!;
      roomMgr.leaveRoom('host_transfer', false);
      
      // Guest joins at T10s
      roomMgr.joinRoom('GRACE400', 'guest_transfer', 'NewHumanHost', createMockSocket());
      if ((roomTransfer as any).hostClientId === 'guest_transfer') {
        throw new Error('Guest became host prematurely before 45s expired');
      }

      // Exactly at 45s: Host transfer fires
      roomTransfer.expireLobbyHostTransferForTesting();
      if ((roomTransfer as any).hostClientId !== 'guest_transfer') {
        throw new Error('Expected guest_transfer to become Host after 45s expired');
      }

      // Scenario C: Original host returns at >45s (after transfer) -> joins as regular player, does NOT steal Host
      const lateRejoin = roomMgr.joinRoom('GRACE400', 'host_transfer', 'TransferHost', createMockSocket());
      if (!lateRejoin.success) {
        throw new Error('Original host failed to join room after host transfer');
      }
      if ((roomTransfer as any).hostClientId !== 'guest_transfer') {
        throw new Error('Late returning host illegally stole Host role from active human host');
      }
      const lateHostPart = (roomTransfer as any).players.get((roomTransfer as any).clientPositions.get('host_transfer'));
      if (lateHostPart?.isHost === true) {
        throw new Error('Late returning host participant has isHost = true while another human is host');
      }
    }
  );

  harness.register(
    category,
    'J11-J12: At 45s with NO humans, original Host remains recoverable and regains Host during 5-minute Lobby Grace',
    async () => {
      const roomMgr = new RoomManager();
      
      roomMgr.createRoom('host_solo_grace', 'SoloGraceHost', createMockSocket(), 'GRACE450');
      const roomSolo = roomMgr.getRoom('GRACE450')!;
      roomMgr.leaveRoom('host_solo_grace', false);
      
      // 45s expires with NO humans connected
      roomSolo.expireLobbyHostTransferForTesting();
      
      // 5-minute lobby grace is still active
      if (!roomSolo.isLobbyGraceActive()) {
        throw new Error('5-minute Lobby Grace should remain active when no humans are present');
      }
      
      // Host returns at 2 minutes (within 5-minute grace)
      const rejoinSolo = roomMgr.joinRoom('GRACE450', 'host_solo_grace', 'SoloGraceHost', createMockSocket());
      if (!rejoinSolo.success) {
        throw new Error('Solo host failed to rejoin during 5-minute lobby grace');
      }
      if ((roomSolo as any).hostClientId !== 'host_solo_grace') {
        throw new Error('Original solo host did not regain Host role when returning during 5-minute grace');
      }
    }
  );

  harness.register(
    category,
    'J13-J14: Grace expiry destroys empty room, preserves room with active Humans, PLAYING 45s reservation intact',
    async () => {
      const roomMgr = new RoomManager();

      // 1. Empty room destroyed at 5-minute expiry
      roomMgr.createRoom('host_exp', 'ExpiringHost', createMockSocket(), 'GRACE500');
      const emptyRoom = roomMgr.getRoom('GRACE500')!;
      roomMgr.leaveRoom('host_exp', false);
      
      emptyRoom.expireLobbyGraceForTesting(() => roomMgr.cleanupRoom('GRACE500'));
      if (roomMgr.getRoom('GRACE500')) {
        throw new Error('Empty room was not destroyed upon grace expiration');
      }
      // After destruction, room code can now be recreated
      const recreateRes = roomMgr.createRoom('new_creator', 'NewCreator', createMockSocket(), 'GRACE500');
      if (!recreateRes.success) {
        throw new Error('Failed to recreate room code after expired room was destroyed');
      }

      // 2. Active room with other Humans is NOT destroyed when 5 minutes pass
      roomMgr.createRoom('host_orig_keep', 'OriginalHostKeep', createMockSocket(), 'GRACE600');
      const activeRoom = roomMgr.getRoom('GRACE600')!;
      roomMgr.leaveRoom('host_orig_keep', false);
      // Other human joins and becomes host at 45s
      roomMgr.joinRoom('GRACE600', 'active_human', 'ActiveHuman', createMockSocket());
      activeRoom.expireLobbyHostTransferForTesting();
      
      activeRoom.expireLobbyGraceForTesting(() => roomMgr.cleanupRoomIfEmpty('GRACE600'));
      if (!roomMgr.getRoom('GRACE600')) {
        throw new Error('Active room with connected human was incorrectly destroyed at grace expiry');
      }
      if ((activeRoom as any).hostClientId !== 'active_human') {
        throw new Error('Active human lost host role');
      }

      // 3. PLAYING 45-second reservation intact
      roomMgr.createRoom('h_play', 'PlayHost', createMockSocket(), 'PLAY700');
      const playRoom = roomMgr.getRoom('PLAY700')!;
      playRoom.startMatch('h_play', true, 5);
      
      // Implicit disconnect during match
      roomMgr.leaveRoom('h_play', false);
      if (!playRoom.hasActiveReservations()) {
        throw new Error('Expected active 45-second reservation during PLAYING disconnect');
      }
      // Reconnects within 45s
      const rejoinRes = roomMgr.joinRoom('PLAY700', 'h_play', 'PlayHost', createMockSocket());
      if (!rejoinRes.success) {
        throw new Error('Failed to reconnect to playing room within 45s');
      }

      // 4. ROOM_NOT_FOUND error on non-existent room code
      const invalidJoin = roomMgr.joinRoom('NONEXISTENT_999', 'player_x', 'Guest', createMockSocket());
      if (invalidJoin.success || invalidJoin.errorCode !== 'ROOM_NOT_FOUND') {
        throw new Error('Expected ROOM_NOT_FOUND error code for non-existent room');
      }
    }
  );

  return harness;
}
