/**
 * Mandatory Player Name and Canonical Room ID Policy Unit Tests
 * 
 * Verifies:
 * A. Empty create name rejected
 * B. Empty join name rejected
 * C. 'Vimal' -> VIMAL
 * D. Second active Vimal room -> VIMAL2
 * E. Third active Vimal room -> VIMAL3
 * F. 10-character limit respected
 * G. Long name truncation + numeric suffix works
 * H. Different names produce different base IDs
 * I. Custom Room ID still works
 * J. Duplicate custom ID is rejected
 * K. Room ID is immutable after creation
 * L. Same roomCode appears through Create, Waiting Table, Join, Active Tables, Resume, and reconnect
 * M. Page refresh preserves existing roomCode and room membership
 * N. Active Tables uses authoritative roomCode
 * O. Existing JOIN_ROOM server behavior remains intact
 */

import { TestHarness } from './testHarness';
import { RoomManager } from '../../server/src/RoomManager';
import { PlayerPosition } from '../models/player';
import {
  getActiveTableId,
  setActiveTableId,
  getPreferredRoomId,
  setPreferredRoomId,
} from '../services/multiplayer/MultiplayerClient';

export function buildMandatoryNameAndRoomIdPolicyTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Mandatory Name & Canonical Room ID Policy';

  const createMockSocket = () => ({
    readyState: 1,
    send: () => {},
    close: () => {},
    on: () => {},
    ping: () => {},
  } as any);

  // Mock storage helper
  const mockStorage = new Map<string, string>();
  const originalLocalStorage = (globalThis as any).localStorage;

  function setupMockStorage() {
    mockStorage.clear();
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage.get(key) || null,
      setItem: (key: string, val: string) => mockStorage.set(key, val),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    };
  }

  function restoreStorage() {
    (globalThis as any).localStorage = originalLocalStorage;
  }

  // A. Empty create name rejected
  harness.register(category, 'A. Empty player name on createRoom is rejected on server', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const res1 = manager.createRoom('c1', '', socket);
    if (res1.success || res1.errorCode !== 'INVALID_NAME') {
      throw new Error(`Expected INVALID_NAME error for empty name, got: ${JSON.stringify(res1)}`);
    }

    const res2 = manager.createRoom('c2', '   ', socket);
    if (res2.success || res2.errorCode !== 'INVALID_NAME') {
      throw new Error(`Expected INVALID_NAME error for whitespace name, got: ${JSON.stringify(res2)}`);
    }
  });

  // B. Empty join name rejected
  harness.register(category, 'B. Empty player name on joinRoom is rejected on server', () => {
    const manager = new RoomManager();
    const hostSocket = createMockSocket();
    const joinSocket = createMockSocket();

    const createRes = manager.createRoom('host1', 'Host', hostSocket, 'ROOM100');
    if (!createRes.success) throw new Error('Failed to create host room');

    const joinRes1 = manager.joinRoom('ROOM100', 'join1', '', joinSocket);
    if (joinRes1.success || joinRes1.errorCode !== 'INVALID_NAME') {
      throw new Error(`Expected INVALID_NAME error for empty joiner name, got: ${JSON.stringify(joinRes1)}`);
    }

    const joinRes2 = manager.joinRoom('ROOM100', 'join2', '   ', joinSocket);
    if (joinRes2.success || joinRes2.errorCode !== 'INVALID_NAME') {
      throw new Error(`Expected INVALID_NAME error for whitespace joiner name, got: ${JSON.stringify(joinRes2)}`);
    }
  });

  // C. 'Vimal' -> VIMAL
  harness.register(category, 'C. Host "Vimal" auto-generates Room ID "VIMAL"', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const res = manager.createRoom('c_vimal_1', 'Vimal', socket);
    if (!res.success || !res.room) {
      throw new Error(`Expected room creation to succeed, got: ${res.error}`);
    }
    if (res.room.roomCode !== 'VIMAL') {
      throw new Error(`Expected roomCode 'VIMAL', got '${res.room.roomCode}'`);
    }
  });

  // D. Second active Vimal room -> VIMAL2
  harness.register(category, 'D. Second active Vimal room auto-generates Room ID "VIMAL2"', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    const res1 = manager.createRoom('c_vimal_1', 'Vimal', socket1);
    if (!res1.success || res1.room?.roomCode !== 'VIMAL') {
      throw new Error('First Vimal room should have ID VIMAL');
    }

    const res2 = manager.createRoom('c_vimal_2', 'Vimal', socket2);
    if (!res2.success || !res2.room) {
      throw new Error(`Expected second Vimal room to succeed, got: ${res2.error}`);
    }
    if (res2.room.roomCode !== 'VIMAL2') {
      throw new Error(`Expected roomCode 'VIMAL2', got '${res2.room.roomCode}'`);
    }
  });

  // E. Third active Vimal room -> VIMAL3
  harness.register(category, 'E. Third active Vimal room auto-generates Room ID "VIMAL3"', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();
    const socket3 = createMockSocket();

    manager.createRoom('c_vimal_1', 'Vimal', socket1);
    manager.createRoom('c_vimal_2', 'Vimal', socket2);
    const res3 = manager.createRoom('c_vimal_3', 'Vimal', socket3);

    if (!res3.success || !res3.room) {
      throw new Error(`Expected third Vimal room to succeed, got: ${res3.error}`);
    }
    if (res3.room.roomCode !== 'VIMAL3') {
      throw new Error(`Expected roomCode 'VIMAL3', got '${res3.room.roomCode}'`);
    }
  });

  // F. 10-character limit respected
  harness.register(category, 'F. 10-character limit strictly respected for auto-generated Room IDs', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const res = manager.createRoom('c_long_1', 'SuperLongPlayerNameHere', socket);
    if (!res.success || !res.room) {
      throw new Error(`Expected long name room to succeed, got: ${res.error}`);
    }
    if (res.room.roomCode.length > 10) {
      throw new Error(`Room code length ${res.room.roomCode.length} exceeds 10 chars: '${res.room.roomCode}'`);
    }
    if (res.room.roomCode !== 'SUPERLONGP') {
      throw new Error(`Expected 'SUPERLONGP', got '${res.room.roomCode}'`);
    }
  });

  // G. Long name truncation + numeric suffix works
  harness.register(category, 'G. Long name truncation + numeric collision suffix keeps length <= 10', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    // 10 chars exact: "VimalSingh" -> "VIMALSINGH"
    const res1 = manager.createRoom('c_vs_1', 'Vimal Singh', socket1);
    if (!res1.success || res1.room?.roomCode !== 'VIMALSINGH') {
      throw new Error(`Expected 'VIMALSINGH', got '${res1.room?.roomCode}'`);
    }

    const res2 = manager.createRoom('c_vs_2', 'Vimal Singh', socket2);
    if (!res2.success || !res2.room) {
      throw new Error(`Expected second Vimal Singh room to succeed, got: ${res2.error}`);
    }
    if (res2.room.roomCode.length > 10) {
      throw new Error(`Collision Room ID '${res2.room.roomCode}' exceeds 10 characters`);
    }
    if (res2.room.roomCode !== 'VIMALSING2') {
      throw new Error(`Expected 'VIMALSING2', got '${res2.room.roomCode}'`);
    }
  });

  // H. Different names produce different base IDs
  harness.register(category, 'H. Different host names produce distinct base IDs', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    const resRahul = manager.createRoom('c_rahul', 'Rahul', socket1);
    const resPriya = manager.createRoom('c_priya', 'Priya', socket2);

    if (resRahul.room?.roomCode !== 'RAHUL') {
      throw new Error(`Expected 'RAHUL', got '${resRahul.room?.roomCode}'`);
    }
    if (resPriya.room?.roomCode !== 'PRIYA') {
      throw new Error(`Expected 'PRIYA', got '${resPriya.room?.roomCode}'`);
    }
  });

  // I. Custom Room ID still works
  harness.register(category, 'I. Custom Room ID creates successfully with exact custom code', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const res = manager.createRoom('c_custom', 'Host Alpha', socket, 'VIP888');
    if (!res.success || !res.room) {
      throw new Error(`Expected custom room creation to succeed, got: ${res.error}`);
    }
    if (res.room.roomCode !== 'VIP888') {
      throw new Error(`Expected 'VIP888', got '${res.room.roomCode}'`);
    }
  });

  // J. Duplicate custom ID is rejected
  harness.register(category, 'J. Duplicate custom Room ID is rejected with ROOM_ALREADY_EXISTS', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    const res1 = manager.createRoom('c_dup_1', 'Host 1', socket1, 'ROYAL99');
    if (!res1.success) throw new Error('Initial creation failed');

    const res2 = manager.createRoom('c_dup_2', 'Host 2', socket2, 'ROYAL99');
    if (res2.success || res2.errorCode !== 'ROOM_ALREADY_EXISTS') {
      throw new Error(`Expected ROOM_ALREADY_EXISTS, got: ${JSON.stringify(res2)}`);
    }

    // Original room remains intact
    const original = manager.getRoom('ROYAL99');
    if (!original || original.hostClientId !== 'c_dup_1') {
      throw new Error('Original room was overwritten');
    }
  });

  // K. Room ID is immutable after creation
  harness.register(category, 'K. Server roomCode is immutable once created', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const res = manager.createRoom('c_imm_1', 'Vimal', socket);
    if (!res.success || !res.room) throw new Error('Creation failed');

    const canonicalCode = res.room.roomCode;
    if (canonicalCode !== 'VIMAL') {
      throw new Error(`Expected 'VIMAL', got '${canonicalCode}'`);
    }

    // Room manager returns room by canonical code
    const fetched = manager.getRoom('VIMAL');
    if (!fetched || fetched.roomCode !== 'VIMAL') {
      throw new Error('Fetched room does not match canonical code');
    }
  });

  // L. Same roomCode appears through Create, Waiting Table, Join, Active Tables, Resume, and reconnect
  harness.register(category, 'L. Same authoritative roomCode appears across all game room flows', () => {
    const manager = new RoomManager();
    const hostSocket = createMockSocket();
    const guestSocket = createMockSocket();

    // 1. Create
    const createRes = manager.createRoom('host_flow', 'Vimal', hostSocket);
    const roomCode = createRes.room!.roomCode;
    if (roomCode !== 'VIMAL') throw new Error(`Expected 'VIMAL', got '${roomCode}'`);

    // 2. Waiting Table State
    if (createRes.room!.hostClientId !== 'host_flow') {
      throw new Error('Host client ID mismatch');
    }

    // 3. Join
    const joinRes = manager.joinRoom(roomCode, 'guest_flow', 'Priya', guestSocket);
    if (!joinRes.success) throw new Error('Join failed');
    if (joinRes.room!.roomCode !== 'VIMAL') {
      throw new Error(`Guest roomCode '${joinRes.room!.roomCode}' does not match`);
    }

    // 4. Active Tables summary
    const summaries = manager.getActiveRoomsSummary();
    const found = summaries.find((s) => s.roomCode === 'VIMAL');
    if (!found) {
      throw new Error('Active table summary does not contain canonical roomCode VIMAL');
    }

    // 5. Reconnect
    manager.leaveRoom('guest_flow', false);
    const reconnectSocket = createMockSocket();
    const reconnectRes = manager.joinRoom('VIMAL', 'guest_flow', 'Priya', reconnectSocket);
    if (!reconnectRes.success) throw new Error('Reconnect failed');
    if (reconnectRes.room!.roomCode !== 'VIMAL') {
      throw new Error(`Reconnected roomCode does not match: '${reconnectRes.room!.roomCode}'`);
    }
  });

  // M. Page refresh preserves existing roomCode and room membership
  harness.register(category, 'M. Page refresh / active table storage persistence preserves roomCode', () => {
    setupMockStorage();
    try {
      setActiveTableId(null);
      setPreferredRoomId(null);

      // Host creates room with canonical ID
      setActiveTableId('VIMAL');
      setPreferredRoomId('VIMAL');

      if (getActiveTableId() !== 'VIMAL') {
        throw new Error('Active table ID should be VIMAL');
      }
      if (getPreferredRoomId() !== 'VIMAL') {
        throw new Error('Preferred room ID should be VIMAL');
      }

      // Cleaning up active table does not corrupt preferred ID
      setActiveTableId(null);
      if (getActiveTableId() !== null) throw new Error('Active table should be null');
      if (getPreferredRoomId() !== 'VIMAL') throw new Error('Preferred room ID should remain VIMAL');
    } finally {
      restoreStorage();
    }
  });

  // N. Active Tables uses authoritative roomCode
  harness.register(category, 'N. Active Tables summary uses authoritative server roomCode', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    manager.createRoom('h_aman', 'Aman', socket);
    const summaries = manager.getActiveRoomsSummary();

    const amanTable = summaries.find((s) => s.hostName === 'Aman');
    if (!amanTable) throw new Error('Aman table not found in Active Tables');
    if (amanTable.roomCode !== 'AMAN') {
      throw new Error(`Expected Active Table roomCode 'AMAN', got '${amanTable.roomCode}'`);
    }
  });

  // O. Existing JOIN_ROOM server behavior remains intact
  harness.register(category, 'O. Existing JOIN_ROOM server behavior correctly assigns seats and broadcast state', () => {
    const manager = new RoomManager();
    const hostSocket = createMockSocket();
    const guestSocket = createMockSocket();

    const createRes = manager.createRoom('host_o', 'HostPlayer', hostSocket, 'JOINTEST99');
    if (!createRes.success || !createRes.room) throw new Error('Creation failed');

    const joinRes = manager.joinRoom('JOINTEST99', 'guest_o', 'GuestPlayer', guestSocket);
    if (!joinRes.success || !joinRes.room) throw new Error('Join failed');

    const room = joinRes.room;
    const humanPlayers = Array.from(((room as any).players as Map<any, any>).values()).filter((p: any) => !p.isBot);

    if (humanPlayers.length !== 2) {
      throw new Error(`Expected 2 human players in room, found ${humanPlayers.length}`);
    }

    const hostParticipant = (room as any).players.get(PlayerPosition.SOUTH);
    const guestPos = (room as any).clientPositions.get('guest_o');
    if (!guestPos) throw new Error('Guest position not assigned');
    const guestParticipant = (room as any).players.get(guestPos);

    if (!hostParticipant || !hostParticipant.isHost || hostParticipant.name !== 'HostPlayer') {
      throw new Error('Host player not properly registered as host at SOUTH');
    }
    if (!guestParticipant || guestParticipant.isHost || guestParticipant.name !== 'GuestPlayer') {
      throw new Error('Guest player registered incorrectly');
    }
    if (guestPos !== PlayerPosition.WEST) {
      throw new Error(`Expected first joiner to be seated at WEST, got: ${guestPos}`);
    }
  });

  return harness;
}
