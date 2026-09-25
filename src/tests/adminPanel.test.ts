/**
 * Admin Panel & Client Unit Tests
 * Verifies key storage, API client request construction, error classifications,
 * formatting helpers, and end-to-end admin inspection against test server.
 */

import http from 'http';
import { TestHarness } from './testHarness';
import { createServerApp } from '../../server/src/index';
import { RoomManager } from '../../server/src/RoomManager';
import {
  ADMIN_KEY_STORAGE,
  AdminApiError,
  formatUptime,
  formatBytes,
  getSuitDisplay,
  fetchAdminStats,
  fetchAdminRooms,
  fetchAdminRoomDebug,
  verifyAdminApiKey,
  getStoredAdminApiKey,
  setStoredAdminApiKey,
  clearStoredAdminApiKey,
} from '../services/admin/adminApiClient';

export function buildAdminPanelTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Admin Panel Client & Formatters';

  // 1. Formatting helpers: formatUptime
  harness.register(category, '1. formatUptime handles zero, seconds, minutes, hours, days', () => {
    if (formatUptime(0) !== '0s') {
      throw new Error(`Expected '0s', got '${formatUptime(0)}'`);
    }
    if (formatUptime(45) !== '45s') {
      throw new Error(`Expected '45s', got '${formatUptime(45)}'`);
    }
    if (formatUptime(125) !== '2m 5s') {
      throw new Error(`Expected '2m 5s', got '${formatUptime(125)}'`);
    }
    if (formatUptime(3665) !== '1h 1m 5s') {
      throw new Error(`Expected '1h 1m 5s', got '${formatUptime(3665)}'`);
    }
    if (formatUptime(90061) !== '1d 1h 1m 1s') {
      throw new Error(`Expected '1d 1h 1m 1s', got '${formatUptime(90061)}'`);
    }
  });

  // 2. Formatting helpers: formatBytes
  harness.register(category, '2. formatBytes formats memory values in MB and GB', () => {
    if (formatBytes(0) !== '0 MB') {
      throw new Error(`Expected '0 MB', got '${formatBytes(0)}'`);
    }
    const tenMB = 10 * 1024 * 1024;
    if (formatBytes(tenMB) !== '10.00 MB') {
      throw new Error(`Expected '10.00 MB', got '${formatBytes(tenMB)}'`);
    }
    const twoGB = 2 * 1024 * 1024 * 1024;
    if (formatBytes(twoGB) !== '2.00 GB') {
      throw new Error(`Expected '2.00 GB', got '${formatBytes(twoGB)}'`);
    }
  });

  // 3. getSuitDisplay helper
  harness.register(category, '3. getSuitDisplay returns proper symbols and colors for all 4 suits', () => {
    const spade = getSuitDisplay('SPADES');
    if (spade.symbol !== '♠' || !spade.color) {
      throw new Error('SPADES must have ♠ symbol');
    }
    const heart = getSuitDisplay('HEARTS');
    if (heart.symbol !== '♥' || !heart.color.includes('rose')) {
      throw new Error('HEARTS must have ♥ symbol and red color');
    }
    const diamond = getSuitDisplay('DIAMONDS');
    if (diamond.symbol !== '♦' || !diamond.color.includes('rose')) {
      throw new Error('DIAMONDS must have ♦ symbol and red color');
    }
    const club = getSuitDisplay('CLUBS');
    if (club.symbol !== '♣' || !club.color.includes('emerald')) {
      throw new Error('CLUBS must have ♣ symbol and emerald color');
    }
  });

  // 4. AdminApiError properties
  harness.register(category, '4. AdminApiError captures status code and server error code', () => {
    const err = new AdminApiError('Forbidden', 403, 'FORBIDDEN');
    if (err.status !== 403 || err.code !== 'FORBIDDEN' || err.message !== 'Forbidden') {
      throw new Error('AdminApiError did not capture fields accurately');
    }
    if (err.name !== 'AdminApiError') {
      throw new Error(`Expected name 'AdminApiError', got '${err.name}'`);
    }
  });

  // 5. Token storage helpers
  harness.register(category, '5. setStoredAdminApiKey and clearStoredAdminApiKey work safely in Node/Browser', () => {
    // In Node test environment, window may be undefined or mockable
    // Function must not crash
    setStoredAdminApiKey('test_key_sample');
    clearStoredAdminApiKey();
  });

  // 6. End-to-end client integration with test server
  harness.register(category, '6. fetchAdminStats and verifyAdminApiKey against test server', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    const testKey = 'test_integration_admin_key_777';
    process.env.ADMIN_API_KEY = testKey;

    const roomManager = RoomManager.getInstance();
    const app = createServerApp(() => 1);
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    const originalFetch = globalThis.fetch;

    try {
      // Mock fetch to route relative /api/admin/* to local test server
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = typeof input === 'string' ? input : input.toString();
        if (urlStr.startsWith('/api/admin/')) {
          return originalFetch(`http://127.0.0.1:${port}${urlStr}`, init);
        }
        return originalFetch(input, init);
      };

      // Successful verification
      const isValid = await verifyAdminApiKey(testKey);
      if (!isValid) {
        throw new Error('verifyAdminApiKey should return true for valid key');
      }

      // Invalid key check
      const isInvalid = await verifyAdminApiKey('wrong_key_999');
      if (isInvalid) {
        throw new Error('verifyAdminApiKey should return false for invalid key');
      }

      // Successful fetchAdminStats
      const stats = await fetchAdminStats(testKey);
      if (typeof stats.activeRoomsCount !== 'number' || typeof stats.serverUptimeSeconds !== 'number') {
        throw new Error('fetchAdminStats returned invalid DTO structure');
      }

      // Successful fetchAdminRooms
      const rooms = await fetchAdminRooms(testKey);
      if (!Array.isArray(rooms)) {
        throw new Error('fetchAdminRooms should return array of room summaries');
      }
    } finally {
      globalThis.fetch = originalFetch;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  return harness;
}
