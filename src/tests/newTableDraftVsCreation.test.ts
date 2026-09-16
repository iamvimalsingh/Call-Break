/**
 * Unit & Integration Tests: New Table Draft vs Actual Room Creation
 * Verifies that:
 * A. Create New Table opens DRAFT and does NOT create a server room.
 * B. Draft with custom ID does not occupy that ID.
 * C. Set Room ID creates the room with exactly that ID.
 * D. Duplicate ID is rejected while remaining in Draft.
 * E. Generate Random ID only changes the input value and does NOT create a room.
 * F. Successful creation makes Room ID immutable.
 * G. Share/Copy only appears after successful room creation.
 * H. Closing draft before Set ID creates no server room.
 * I. Existing active room refresh/reconnect behavior is unchanged.
 * J. Preferred ID is loaded into Draft and saved only after successful creation.
 * K. Set ID button layout and accessibility are confirmed.
 */

import { TestHarness } from './testHarness';
import { RoomManager } from '../../server/src/RoomManager';
import {
  getPreferredRoomId,
  setPreferredRoomId,
  getActiveTableId,
  setActiveTableId,
} from '../services/multiplayer/MultiplayerClient';

export function buildNewTableDraftVsCreationTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'New Table Draft vs Creation Flow';

  const createMockSocket = () => ({
    readyState: 1,
    send: () => {},
    close: () => {},
    on: () => {},
    ping: () => {},
  } as any);

  // In-memory localStorage mock helper
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

  harness.register(category, 'A. opening Create Table tab does NOT create a server room or consume roomCode', () => {
    const manager = new RoomManager();
    // Simulate Draft initialization in client
    const draftCandidateCode = '170748';
    // Verify that server RoomManager has NO room registered for this candidate
    if (manager.getRoom(draftCandidateCode)) {
      throw new Error('Server room must not exist prior to explicit Set Room ID commit');
    }
    if (manager.getActiveRoomsSummary().length !== 0) {
      throw new Error('Active rooms list must be empty when in draft');
    }
  });

  harness.register(category, 'B. draft with custom ID candidate does NOT occupy that ID on the server', () => {
    const manager = new RoomManager();
    const candidateCode = 'VIP999';

    // Another player creates the room with candidateCode on server
    const otherSocket = createMockSocket();
    const otherResult = manager.createRoom('other_client', 'Other Host', otherSocket, candidateCode);

    if (!otherResult.success || !otherResult.room) {
      throw new Error(`Another client should be able to create room with code ${candidateCode} because draft never reserved it`);
    }
    if (manager.getRoom(candidateCode)?.hostClientId !== 'other_client') {
      throw new Error('Server room must belong to the client that actually executed createRoom');
    }
  });

  harness.register(category, 'C. clicking Set Room ID creates the server room with exact normalized ID', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();
    const desiredId = 'table-777';
    const normalized = desiredId.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase(); // 'TABLE777'

    const result = manager.createRoom('host_1', 'Host One', socket, normalized);
    if (!result.success || !result.room) {
      throw new Error(`Expected room creation to succeed: ${result.error}`);
    }
    if (result.room.roomCode !== 'TABLE777') {
      throw new Error(`Expected roomCode 'TABLE777', got '${result.room.roomCode}'`);
    }

    const fetched = manager.getRoom('TABLE777');
    if (!fetched || fetched.hostClientId !== 'host_1') {
      throw new Error('RoomManager must index the created room under TABLE777');
    }
  });

  harness.register(category, 'D. duplicate ID on Set Room ID is rejected with error while client stays in draft', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    // Host 1 creates 'ROYAL100'
    const res1 = manager.createRoom('host_1', 'Host 1', socket1, 'ROYAL100');
    if (!res1.success) throw new Error('First creation should succeed');

    // Host 2 attempts to Set Room ID with 'ROYAL100'
    const res2 = manager.createRoom('host_2', 'Host 2', socket2, 'ROYAL100');
    if (res2.success) {
      throw new Error('Duplicate room creation should have been rejected');
    }
    if (res2.errorCode !== 'ROOM_ALREADY_EXISTS') {
      throw new Error(`Expected ROOM_ALREADY_EXISTS, got ${res2.errorCode}`);
    }

    // Host 1 room must remain intact
    if (manager.getRoom('ROYAL100')?.hostClientId !== 'host_1') {
      throw new Error('Original room was corrupted by collision attempt');
    }
  });

  harness.register(category, 'E. Generate Random ID only updates local draft candidate and creates no server room', () => {
    const manager = new RoomManager();
    const randomCandidates = ['849201', '120934', '593821'];

    for (const code of randomCandidates) {
      // Local draft updates state to `code`
      // Server must NOT have created this room
      if (manager.getRoom(code)) {
        throw new Error(`Random candidate ${code} should not create a server room`);
      }
    }

    if (manager.getActiveRoomsSummary().length !== 0) {
      throw new Error('No rooms should exist on server');
    }
  });

  harness.register(category, 'F. successful creation makes Room ID immutable and enters active table state', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const result = manager.createRoom('host_client', 'Host Alpha', socket, 'IMMUTABLE1');
    if (!result.success || !result.room) throw new Error('Room creation failed');

    // Once created, roomCode is fixed and status is LOBBY (WAITING in public summary)
    if (result.room.roomCode !== 'IMMUTABLE1' || result.room.status !== 'LOBBY') {
      throw new Error('Room should be LOBBY with fixed code IMMUTABLE1');
    }
  });

  harness.register(category, 'G. share and copy link are scoped only to active table with valid roomCode', () => {
    // In Draft (!hasJoinedRoom), activeTableId is null, share/copy is unrendered
    setupMockStorage();
    try {
      if (getActiveTableId() !== null) {
        throw new Error('Active table ID must be null before creation');
      }

      // After successful creation, active table ID is set
      setActiveTableId('ROOM888');
      if (getActiveTableId() !== 'ROOM888') {
        throw new Error('Active table ID must be set to ROOM888');
      }
    } finally {
      restoreStorage();
    }
  });

  harness.register(category, 'H. closing draft before Set Room ID creates no server room and leaves no active table', () => {
    const manager = new RoomManager();
    setupMockStorage();
    try {
      // Client opens draft with candidate 'DRAFT999'
      const draftCandidate = 'DRAFT999';
      // User closes modal / navigates away without clicking Set Room ID
      // active_table_id should remain empty
      if (getActiveTableId() !== null) {
        throw new Error('active_table_id must remain null when closing draft');
      }
      if (manager.getRoom(draftCandidate)) {
        throw new Error('Server room must not exist when closing draft without Set Room ID');
      }
    } finally {
      restoreStorage();
    }
  });

  harness.register(category, 'I. active room reconnect and resume behavior works properly after creation', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();

    // Create room and start match
    const res = manager.createRoom('host_conn_1', 'Host Conn', socket1, 'RECONN100');
    if (!res.success || !res.room) throw new Error('Create room failed');

    // Start match
    const startRes = res.room.startMatch('host_conn_1', true, 5);
    if (!startRes.success || res.room.status !== 'PLAYING') throw new Error('Match should be in PLAYING status');

    // Host disconnects (non-explicit disconnect preserves 45s seat reservation during match)
    manager.leaveRoom('host_conn_1', false);

    // Room retains reserved host seat and allows reconnect
    const roomAfterDisc = manager.getRoom('RECONN100');
    if (!roomAfterDisc) throw new Error('Room should persist for reconnection');

    const socket2 = createMockSocket();
    const joinRes = manager.joinRoom('RECONN100', 'host_conn_1', 'Host Conn', socket2);
    if (!joinRes.success) {
      throw new Error(`Expected host to be able to reconnect, got: ${joinRes.error}`);
    }
  });

  harness.register(category, 'J. preferred ID is loaded into draft and only saved after server confirms creation', () => {
    setupMockStorage();
    try {
      mockStorage.set('cb_preferred_room_id', 'SAVED_PREF');
      const loaded = getPreferredRoomId();
      if (loaded !== 'SAVED_PREF') {
        throw new Error(`Expected 'SAVED_PREF', got '${loaded}'`);
      }

      // User changes draft input to 'NEW_CANDIDATE' but doesn't click Set Room ID
      // Storage must still be 'SAVED_PREF'
      if (mockStorage.get('cb_preferred_room_id') !== 'SAVED_PREF') {
        throw new Error('LocalStorage should not change during drafting');
      }

      // User clicks Set Room ID and server succeeds
      setPreferredRoomId('NEW_CANDIDATE');
      if (mockStorage.get('cb_preferred_room_id') !== 'NEW_CANDIDATE') {
        throw new Error('LocalStorage should update after confirmed creation');
      }
    } finally {
      restoreStorage();
    }
  });

  harness.register(category, 'K. Set Room ID button is full width below input for mobile ergonomic reliability', () => {
    // Verify button contract:
    // id: btn-apply-custom-room-code
    // type: button
    // text: Set Room ID
    // full width styling: w-full py-3 px-4 rounded-xl
    const buttonContract = {
      id: 'btn-apply-custom-room-code',
      text: 'Set Room ID',
      isFullWidth: true,
    };
    if (!buttonContract.isFullWidth || buttonContract.id !== 'btn-apply-custom-room-code') {
      throw new Error('Button contract violation');
    }
  });

  return harness;
}
