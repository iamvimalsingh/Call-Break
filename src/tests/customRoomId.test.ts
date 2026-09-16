/**
 * Custom Room ID Backend Unit Tests
 * Tests custom Room ID creation, duplicate active ID collision rejection, and random generator fallback.
 */

import { TestHarness } from './testHarness';
import { RoomManager } from '../../server/src/RoomManager';

export function buildCustomRoomIdTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Custom Room ID Backend';

  const createMockSocket = () => ({
    readyState: 1,
    send: () => {},
    close: () => {},
    on: () => {},
    ping: () => {},
  } as any);

  harness.register(category, 'A. custom Room ID creates successfully with exact normalized ID', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const result = manager.createRoom('client_1', 'Host Alice', socket, 'VIP888');

    if (!result.success || !result.room) {
      throw new Error(`Expected createRoom to succeed, got error: ${result.error}`);
    }

    if (result.room.roomCode !== 'VIP888') {
      throw new Error(`Expected roomCode 'VIP888', got '${result.room.roomCode}'`);
    }

    const fetched = manager.getRoom('VIP888');
    if (!fetched || fetched.roomCode !== 'VIP888') {
      throw new Error('RoomManager registry should contain the created custom room');
    }
  });

  harness.register(category, 'B. duplicate active Room ID is rejected with ROOM_ALREADY_EXISTS and no overwrite', () => {
    const manager = new RoomManager();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    // Create initial room
    const firstResult = manager.createRoom('client_1', 'Host 1', socket1, 'DUPLICATE_TEST');
    if (!firstResult.success || !firstResult.room) {
      throw new Error('Initial room creation should succeed');
    }

    // Attempt to create second room with same ID
    const duplicateResult = manager.createRoom('client_2', 'Host 2', socket2, 'DUPLICATE_TEST');

    if (duplicateResult.success) {
      throw new Error('Expected duplicate active Room ID creation to fail, but it succeeded');
    }

    if (duplicateResult.errorCode !== 'ROOM_ALREADY_EXISTS') {
      throw new Error(`Expected errorCode 'ROOM_ALREADY_EXISTS', got '${duplicateResult.errorCode}'`);
    }

    // Ensure the original room was NOT overwritten or replaced
    const currentRoom = manager.getRoom('DUPLICATE_TEST');
    if (!currentRoom || currentRoom.hostClientId !== 'client_1') {
      throw new Error('Original room was modified or replaced after collision attempt');
    }
  });

  harness.register(category, 'C. no custom ID preserves existing random 6-digit room code generation', () => {
    const manager = new RoomManager();
    const socket = createMockSocket();

    const result = manager.createRoom('client_3', 'Host 3', socket);

    if (!result.success || !result.room) {
      throw new Error(`Expected createRoom to succeed without custom code, got: ${result.error}`);
    }

    if (!/^\d{6}$/.test(result.room.roomCode)) {
      throw new Error(`Expected 6-digit random numeric roomCode, got '${result.room.roomCode}'`);
    }

    const fetched = manager.getRoom(result.room.roomCode);
    if (!fetched) {
      throw new Error('RoomManager registry should contain the randomly generated room');
    }
  });

  return harness;
}
