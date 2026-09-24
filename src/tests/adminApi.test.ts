/**
 * Authenticated Admin / Debug REST Inspection API Tests
 * Tests authorization guards, timing-safe checks, stats DTOs, room summaries,
 * private card debug views, 404 responses, and serialization safety.
 */

import http from 'http';
import { TestHarness } from './testHarness';
import { createServerApp } from '../../server/src/index';
import { RoomManager } from '../../server/src/RoomManager';
import { timingSafeEqualStr } from '../../server/src/adminAuth';
import { PlayerPosition } from '../models/player';

export function buildAdminApiTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Admin REST Inspection API';

  const createMockSocket = () =>
    ({
      readyState: 1,
      send: () => {},
      close: () => {},
      on: () => {},
      ping: () => {},
    } as any);

  // Helper to run ephemeral server and execute test callback
  async function withTestServer(
    fn: (baseUrl: string, roomManager: RoomManager) => Promise<void>
  ): Promise<void> {
    const roomManager = RoomManager.getInstance();
    const app = createServerApp(() => 2); // mock 2 active ws connections
    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      await fn(baseUrl, roomManager);
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  }

  // 1. Timing-safe comparison unit test
  harness.register(category, '1. timingSafeEqualStr performs timing-safe constant-time string comparison', () => {
    if (!timingSafeEqualStr('secret_key_123', 'secret_key_123')) {
      throw new Error('Identical keys should return true');
    }
    if (timingSafeEqualStr('secret_key_123', 'secret_key_999')) {
      throw new Error('Different keys of same length should return false');
    }
    if (timingSafeEqualStr('short', 'much_longer_string')) {
      throw new Error('Different keys of different length should return false');
    }
    if (timingSafeEqualStr('', 'secret')) {
      throw new Error('Empty string should return false');
    }
  });

  // 2. HTTP 503 when ADMIN_API_KEY is not configured
  harness.register(category, '2. rejects with HTTP 503 when ADMIN_API_KEY is not configured', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    delete process.env.ADMIN_API_KEY;

    try {
      await withTestServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/admin/stats`, {
          headers: { Authorization: 'Bearer some_token' },
        });

        if (res.status !== 503) {
          throw new Error(`Expected HTTP 503 when key unconfigured, got ${res.status}`);
        }

        const data = await res.json();
        if (data.code !== 'ADMIN_NOT_CONFIGURED') {
          throw new Error(`Expected code 'ADMIN_NOT_CONFIGURED', got '${data.code}'`);
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  // 3. HTTP 401 when Authorization header is missing or malformed
  harness.register(category, '3. rejects with HTTP 401 when Authorization header is missing or malformed', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    process.env.ADMIN_API_KEY = 'test_secret_admin_key_999';

    try {
      await withTestServer(async (baseUrl) => {
        // Missing Authorization header
        const resMissing = await fetch(`${baseUrl}/api/admin/stats`);
        if (resMissing.status !== 401) {
          throw new Error(`Expected HTTP 401 for missing header, got ${resMissing.status}`);
        }
        const dataMissing = await resMissing.json();
        if (dataMissing.code !== 'UNAUTHORIZED') {
          throw new Error(`Expected code 'UNAUTHORIZED', got '${dataMissing.code}'`);
        }

        // Malformed header (not Bearer)
        const resMalformed = await fetch(`${baseUrl}/api/admin/stats`, {
          headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        });
        if (resMalformed.status !== 401) {
          throw new Error(`Expected HTTP 401 for non-Bearer header, got ${resMalformed.status}`);
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  // 4. HTTP 403 when token is invalid
  harness.register(category, '4. rejects with HTTP 403 when token is incorrect', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    process.env.ADMIN_API_KEY = 'test_secret_admin_key_999';

    try {
      await withTestServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/admin/stats`, {
          headers: { Authorization: 'Bearer wrong_token_attempt' },
        });

        if (res.status !== 403) {
          throw new Error(`Expected HTTP 403 for wrong token, got ${res.status}`);
        }

        const data = await res.json();
        if (data.code !== 'FORBIDDEN') {
          throw new Error(`Expected code 'FORBIDDEN', got '${data.code}'`);
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  // 5. GET /api/admin/stats with valid token
  harness.register(category, '5. GET /api/admin/stats returns valid server runtime metrics', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    const testAdminKey = 'valid_admin_secret_key_123';
    process.env.ADMIN_API_KEY = testAdminKey;

    try {
      await withTestServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${testAdminKey}` },
        });

        if (res.status !== 200) {
          throw new Error(`Expected HTTP 200, got ${res.status}`);
        }

        const data = await res.json();

        if (typeof data.serverUptimeSeconds !== 'number') {
          throw new Error('serverUptimeSeconds must be a number');
        }
        if (typeof data.activeWebSocketConnections !== 'number') {
          throw new Error('activeWebSocketConnections must be a number');
        }
        if (typeof data.activeRoomsCount !== 'number') {
          throw new Error('activeRoomsCount must be a number');
        }
        if (typeof data.humanPlayerCount !== 'number') {
          throw new Error('humanPlayerCount must be a number');
        }
        if (typeof data.botSeatCount !== 'number') {
          throw new Error('botSeatCount must be a number');
        }
        if (!data.roomsByStatus || typeof data.roomsByStatus.LOBBY !== 'number') {
          throw new Error('roomsByStatus must have numeric LOBBY count');
        }
        if (!data.processMemory || typeof data.processMemory.heapUsedBytes !== 'number') {
          throw new Error('processMemory must contain heapUsedBytes');
        }
        if (!data.serverVersion) {
          throw new Error('serverVersion must be present');
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  // 6. GET /api/admin/rooms returns room summaries and DOES NOT expose private cards
  harness.register(category, '6. GET /api/admin/rooms returns summaries without private cards', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    const testAdminKey = 'valid_admin_secret_key_123';
    process.env.ADMIN_API_KEY = testAdminKey;

    try {
      await withTestServer(async (baseUrl, roomManager) => {
        const testCode = 'ADMR1';
        const socket = createMockSocket();
        roomManager.createRoom('client_adm_host', 'Host Admin', socket, testCode);

        const res = await fetch(`${baseUrl}/api/admin/rooms`, {
          headers: { Authorization: `Bearer ${testAdminKey}` },
        });

        if (res.status !== 200) {
          throw new Error(`Expected HTTP 200, got ${res.status}`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error('Expected array of room summaries');
        }

        const roomSummary = data.find((r: any) => r.roomCode === testCode);
        if (!roomSummary) {
          throw new Error(`Room '${testCode}' not found in /api/admin/rooms response`);
        }

        if (roomSummary.hostSeat !== 'P1') {
          throw new Error(`Expected hostSeat 'P1', got '${roomSummary.hostSeat}'`);
        }
        if (!roomSummary.seats || roomSummary.seats.length !== 4) {
          throw new Error('Room summary must have 4 seats');
        }

        // STRICT SECURITY INVARIANT: Summary must NEVER contain hand or privateCards
        const rawString = JSON.stringify(roomSummary);
        if (rawString.includes('"hand"') || rawString.includes('"privateCards"')) {
          throw new Error('SECURITY VIOLATION: Room summary exposed private hand cards!');
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  // 7. GET /api/admin/rooms/:roomCode returns 404 for unknown room
  harness.register(category, '7. GET /api/admin/rooms/:roomCode returns 404 for unknown room', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    const testAdminKey = 'valid_admin_secret_key_123';
    process.env.ADMIN_API_KEY = testAdminKey;

    try {
      await withTestServer(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/admin/rooms/NONEXISTENT999`, {
          headers: { Authorization: `Bearer ${testAdminKey}` },
        });

        if (res.status !== 404) {
          throw new Error(`Expected HTTP 404, got ${res.status}`);
        }

        const data = await res.json();
        if (data.code !== 'ROOM_NOT_FOUND') {
          throw new Error(`Expected code 'ROOM_NOT_FOUND', got '${data.code}'`);
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  // 8. GET /api/admin/rooms/:roomCode returns authoritative debug snapshot with private cards
  harness.register(category, '8. GET /api/admin/rooms/:roomCode returns debug state with private cards', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    const testAdminKey = 'valid_admin_secret_key_123';
    process.env.ADMIN_API_KEY = testAdminKey;

    try {
      await withTestServer(async (baseUrl, roomManager) => {
        const testCode = 'ADMPLAY';
        const socket = createMockSocket();
        const createRes = roomManager.createRoom('client_adm_play', 'Play Host', socket, testCode);
        const room = createRes.room!;

        // Start game so controller and card distribution exist
        room.startMatch('client_adm_play', true, 5);

        const res = await fetch(`${baseUrl}/api/admin/rooms/${testCode}`, {
          headers: { Authorization: `Bearer ${testAdminKey}` },
        });

        if (res.status !== 200) {
          throw new Error(`Expected HTTP 200, got ${res.status}`);
        }

        const data = await res.json();

        // Check room section
        if (data.room.roomCode !== testCode) {
          throw new Error(`Expected roomCode '${testCode}', got '${data.room.roomCode}'`);
        }
        if (data.room.status !== 'PLAYING') {
          throw new Error(`Expected status 'PLAYING', got '${data.room.status}'`);
        }

        // Check seats and private card state
        if (!Array.isArray(data.seats) || data.seats.length !== 4) {
          throw new Error('Expected 4 seats in debug response');
        }

        const southSeat = data.seats.find((s: any) => s.position === PlayerPosition.SOUTH);
        if (!southSeat) {
          throw new Error('SOUTH seat must exist');
        }
        if (!southSeat.privateCards || !Array.isArray(southSeat.privateCards.hand)) {
          throw new Error('Private cards hand must be an array for authenticated admin');
        }
        // At start of round 1, cardsRemaining should be 13
        if (southSeat.privateCards.cardsRemaining !== 13) {
          throw new Error(`Expected 13 cards remaining in dealt hand, got ${southSeat.privateCards.cardsRemaining}`);
        }

        // Check game state section
        if (!data.gameState) {
          throw new Error('gameState should be populated when game is PLAYING');
        }
        if (typeof data.gameState.biddingComplete !== 'boolean') {
          throw new Error('biddingComplete should be a boolean');
        }
        if (!data.gameState.currentTrick) {
          throw new Error('currentTrick should be present');
        }
        if (!data.gameState.scores) {
          throw new Error('scores should be present');
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  // 9. Data safety & serialization sanitization test
  harness.register(category, '9. Serialization safety: no circular refs, no raw sockets, no secrets', async () => {
    const savedKey = process.env.ADMIN_API_KEY;
    const testAdminKey = 'super_secret_key_should_never_leak';
    process.env.ADMIN_API_KEY = testAdminKey;

    try {
      await withTestServer(async (baseUrl, roomManager) => {
        const testCode = 'ADMSAFE';
        const socket = createMockSocket();
        const createRes = roomManager.createRoom('client_adm_safe', 'Safe Host', socket, testCode);
        createRes.room!.startMatch('client_adm_safe', true, 5);

        const [statsRes, roomsRes, roomDebugRes] = await Promise.all([
          fetch(`${baseUrl}/api/admin/stats`, { headers: { Authorization: `Bearer ${testAdminKey}` } }),
          fetch(`${baseUrl}/api/admin/rooms`, { headers: { Authorization: `Bearer ${testAdminKey}` } }),
          fetch(`${baseUrl}/api/admin/rooms/${testCode}`, { headers: { Authorization: `Bearer ${testAdminKey}` } }),
        ]);

        const statsText = await statsRes.text();
        const roomsText = await roomsRes.text();
        const roomDebugText = await roomDebugRes.text();

        for (const [name, text] of [
          ['stats', statsText],
          ['rooms', roomsText],
          ['roomDebug', roomDebugText],
        ]) {
          // Never leak the configured admin key in responses
          if (text.includes(testAdminKey)) {
            throw new Error(`SECURITY LEAK: Response ${name} contains the configured ADMIN_API_KEY`);
          }

          // No raw WebSocket internal properties
          if (text.includes('_receiver') || text.includes('_sender') || text.includes('_socket')) {
            throw new Error(`DATA LEAK: Response ${name} contains raw WebSocket internals`);
          }

          // Must parse cleanly as JSON
          try {
            JSON.parse(text);
          } catch (e) {
            throw new Error(`Response ${name} is not valid JSON`);
          }
        }
      });
    } finally {
      process.env.ADMIN_API_KEY = savedKey;
    }
  });

  return harness;
}
