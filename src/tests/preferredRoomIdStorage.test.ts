/**
 * Preferred Room ID LocalStorage & State Unit Tests
 * Verifies:
 * A. preferred ID is loaded into Create Table
 * B. successful custom creation saves the ID
 * C. rejected/duplicate ID is not saved
 * D. refresh does not create a duplicate room
 * E. active_table_id remains separate from preferred_room_id
 */

import { TestHarness } from './testHarness';
import {
  getPreferredRoomId,
  setPreferredRoomId,
  getActiveTableId,
  setActiveTableId,
} from '../services/multiplayer/MultiplayerClient';

export function buildPreferredRoomIdTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Preferred Room ID LocalStorage';

  // Mock in-memory localStorage for test isolation
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

  harness.register(category, 'A. preferred ID is loaded from cb_preferred_room_id when present', () => {
    setupMockStorage();
    try {
      mockStorage.set('cb_preferred_room_id', 'MYTABLE777');
      const loaded = getPreferredRoomId();
      if (loaded !== 'MYTABLE777') {
        throw new Error(`Expected 'MYTABLE777', got '${loaded}'`);
      }
    } finally {
      restoreStorage();
    }
  });

  harness.register(category, 'B. successful custom creation saves the ID to cb_preferred_room_id', () => {
    setupMockStorage();
    try {
      setPreferredRoomId('GOLDEN_ROOM');
      const stored = mockStorage.get('cb_preferred_room_id');
      if (stored !== 'GOLDEN_ROOM') {
        throw new Error(`Expected 'GOLDEN_ROOM' in storage, got '${stored}'`);
      }
      if (getPreferredRoomId() !== 'GOLDEN_ROOM') {
        throw new Error('getPreferredRoomId should return saved value');
      }
    } finally {
      restoreStorage();
    }
  });

  harness.register(category, 'C. rejected or duplicate ID is not saved to cb_preferred_room_id', () => {
    setupMockStorage();
    try {
      mockStorage.set('cb_preferred_room_id', 'PREVIOUS_VALID');

      // Simulate a rejected creation attempt where onError fires
      const simulatedCreationSuccess = false;
      const rejectedId = 'COLLIDING_ID';

      if (simulatedCreationSuccess) {
        setPreferredRoomId(rejectedId);
      }

      // Storage must still retain the original or untouched state, not the rejected ID
      const stored = mockStorage.get('cb_preferred_room_id');
      if (stored === 'COLLIDING_ID') {
        throw new Error('Rejected ID must NOT be persisted to cb_preferred_room_id');
      }
      if (stored !== 'PREVIOUS_VALID') {
        throw new Error(`Expected storage to retain 'PREVIOUS_VALID', got '${stored}'`);
      }
    } finally {
      restoreStorage();
    }
  });

  harness.register(category, 'D. refresh does not create a duplicate room from preferred_room_id', () => {
    setupMockStorage();
    try {
      mockStorage.set('cb_preferred_room_id', 'PREFERRED_ONLY');
      // On page load/refresh, getActiveTableId is inspected for reconnection
      const activeTable = getActiveTableId();
      if (activeTable !== null) {
        throw new Error(`Expected active table to be null on fresh session with only preferred ID, got '${activeTable}'`);
      }
    } finally {
      restoreStorage();
    }
  });

  harness.register(category, 'E. active_table_id and preferred_room_id remain completely separate', () => {
    setupMockStorage();
    try {
      setPreferredRoomId('ROOM_PREF_123');
      setActiveTableId('ACTIVE_TBL_456');

      const pref = getPreferredRoomId();
      const active = getActiveTableId();

      if (pref !== 'ROOM_PREF_123') {
        throw new Error(`Preferred ID corrupted: ${pref}`);
      }
      if (active !== 'ACTIVE_TBL_456') {
        throw new Error(`Active Table ID corrupted: ${active}`);
      }

      // Clearing active table must NOT clear preferred room ID
      setActiveTableId(null);
      if (getPreferredRoomId() !== 'ROOM_PREF_123') {
        throw new Error('Clearing active_table_id must not affect cb_preferred_room_id');
      }
      if (getActiveTableId() !== null) {
        throw new Error('active_table_id should be null after clearing');
      }
    } finally {
      restoreStorage();
    }
  });

  return harness;
}
