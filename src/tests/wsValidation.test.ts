/**
 * WebSocket Input Validation & Rate Limiting Tests (P0)
 * 
 * Verifies:
 * 1. Safe rejection of malformed JSON, non-object payloads, missing type, unknown types
 * 2. Strict rejection of oversized WebSocket messages (> 16 KB)
 * 3. Strict payload structure and range validation across client messages
 * 4. In-memory per-connection rate limiting for global bursts and setup abuse
 * 5. Rate limit window recovery and socket cleanup to prevent memory leaks
 * 6. Legitimate messages pass cleanly without degrading normal gameplay
 */

import { TestHarness } from './testHarness';
import {
  WsRateLimiter,
  parseAndValidateWsMessage,
  validateClientPayload,
  MAX_WS_MESSAGE_SIZE_BYTES,
  RATE_LIMIT_CONFIG,
} from '../../server/src/wsGuard';
import { RoomManager } from '../../server/src/RoomManager';
import { PlayerPosition } from '../models/player';
import { Suit, Rank } from '../models/card';

export function buildWsValidationTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'WebSocket Validation & Rate Limiting';

  const createMockSocket = () =>
    ({
      readyState: 1,
      send: () => {},
      close: () => {},
      on: () => {},
      ping: () => {},
    } as any);

  // 1. Safe rejection of invalid JSON
  harness.register(category, 'Rejects invalid JSON safely with INVALID_JSON code', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();

    const result = parseAndValidateWsMessage('{ "type": "CREATE_ROOM", invalid_json', socket, limiter);
    if (result.ok) {
      throw new Error('Expected invalid JSON to be rejected');
    }
    if (result.errorCode !== 'INVALID_JSON') {
      throw new Error(`Expected errorCode INVALID_JSON, got ${result.errorCode}`);
    }
  });

  // 2. Safe rejection of non-object payloads (arrays, primitives, null)
  harness.register(category, 'Rejects non-object payloads with INVALID_MESSAGE_SHAPE', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();

    const testCases = [
      '[1, 2, 3]',
      '"just a string"',
      '12345',
      'true',
      'null',
    ];

    for (const raw of testCases) {
      const result = parseAndValidateWsMessage(raw, socket, limiter);
      if (result.ok) {
        throw new Error(`Expected non-object payload '${raw}' to be rejected`);
      }
      if (result.errorCode !== 'INVALID_MESSAGE_SHAPE') {
        throw new Error(`Expected INVALID_MESSAGE_SHAPE for '${raw}', got ${result.errorCode}`);
      }
    }
  });

  // 3. Rejection of missing or empty type field
  harness.register(category, 'Rejects payloads missing type field with MISSING_MESSAGE_TYPE', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();

    const testCases = [
      '{}',
      '{"payload": {}}',
      '{"type": ""}',
      '{"type": "   "}',
      '{"type": 123}',
      '{"type": null}',
    ];

    for (const raw of testCases) {
      const result = parseAndValidateWsMessage(raw, socket, limiter);
      if (result.ok) {
        throw new Error(`Expected missing type for '${raw}' to be rejected`);
      }
      if (result.errorCode !== 'MISSING_MESSAGE_TYPE') {
        throw new Error(`Expected MISSING_MESSAGE_TYPE, got ${result.errorCode}`);
      }
    }
  });

  // 4. Rejection of unknown client message types
  harness.register(category, 'Rejects unknown message types with UNKNOWN_MESSAGE_TYPE', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();

    const testCases = [
      '{"type": "UNKNOWN_ACTION"}',
      '{"type": "ADMIN_OVERRIDE"}',
      '{"type": "EXECUTE_COMMAND"}',
      '{"type": "inject_sql"}',
    ];

    for (const raw of testCases) {
      const result = parseAndValidateWsMessage(raw, socket, limiter);
      if (result.ok) {
        throw new Error(`Expected unknown type for '${raw}' to be rejected`);
      }
      if (result.errorCode !== 'UNKNOWN_MESSAGE_TYPE') {
        throw new Error(`Expected UNKNOWN_MESSAGE_TYPE, got ${result.errorCode}`);
      }
    }
  });

  // 5. Oversized message protection (> 16 KB)
  harness.register(category, 'Rejects oversized WebSocket messages with MESSAGE_TOO_LARGE', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();

    // 17 KB payload (exceeds 16 KB limit)
    const largePadding = 'A'.repeat(17 * 1024);
    const oversized = JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { playerName: 'Alice', padding: largePadding },
    });

    const result = parseAndValidateWsMessage(oversized, socket, limiter);
    if (result.ok) {
      throw new Error('Expected oversized message to be rejected');
    }
    if (result.errorCode !== 'MESSAGE_TOO_LARGE') {
      throw new Error(`Expected MESSAGE_TOO_LARGE, got ${result.errorCode}`);
    }

    // Normal message size is accepted
    const normal = JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { playerName: 'Alice' },
    });
    const normalResult = parseAndValidateWsMessage(normal, socket, limiter);
    if (!normalResult.ok) {
      throw new Error(`Expected normal size message to pass, got ${normalResult.errorMessage}`);
    }
  });

  // 6. CREATE_ROOM payload validation
  harness.register(category, 'Validates CREATE_ROOM payload parameters strictly', () => {
    // Missing payload
    let res = validateClientPayload('CREATE_ROOM', null);
    if (res.valid) throw new Error('Expected null payload to fail');

    // Missing player name
    res = validateClientPayload('CREATE_ROOM', {});
    if (res.valid) throw new Error('Expected missing playerName to fail');

    // Empty whitespace player name
    res = validateClientPayload('CREATE_ROOM', { playerName: '   ' });
    if (res.valid) throw new Error('Expected whitespace playerName to fail');

    // Overlong player name (>30 chars)
    res = validateClientPayload('CREATE_ROOM', { playerName: 'A'.repeat(31) });
    if (res.valid) throw new Error('Expected overlong playerName to fail');

    // Invalid totalRounds
    res = validateClientPayload('CREATE_ROOM', { playerName: 'Alice', totalRounds: 7 });
    if (res.valid) throw new Error('Expected totalRounds=7 to fail');

    // Invalid roomCode formatting
    res = validateClientPayload('CREATE_ROOM', { playerName: 'Alice', roomCode: 'bad!@#' });
    if (res.valid) throw new Error('Expected invalid roomCode to fail');

    // Valid CREATE_ROOM
    res = validateClientPayload('CREATE_ROOM', { playerName: 'Alice', totalRounds: 5, roomCode: 'ROOM1' });
    if (!res.valid) throw new Error(`Expected valid CREATE_ROOM to pass: ${res.error}`);
  });

  // 7. JOIN_ROOM payload validation
  harness.register(category, 'Validates JOIN_ROOM payload parameters strictly', () => {
    // Missing roomCode
    let res = validateClientPayload('JOIN_ROOM', { playerName: 'Bob' });
    if (res.valid) throw new Error('Expected missing roomCode to fail');

    // Missing playerName
    res = validateClientPayload('JOIN_ROOM', { roomCode: 'ROOM1' });
    if (res.valid) throw new Error('Expected missing playerName to fail');

    // Overlong playerName
    res = validateClientPayload('JOIN_ROOM', { roomCode: 'ROOM1', playerName: 'B'.repeat(35) });
    if (res.valid) throw new Error('Expected overlong playerName to fail');

    // Valid JOIN_ROOM
    res = validateClientPayload('JOIN_ROOM', { roomCode: 'ROOM1', playerName: 'Bob', playerId: 'bob_123' });
    if (!res.valid) throw new Error(`Expected valid JOIN_ROOM to pass: ${res.error}`);
  });

  // 8. SUBMIT_BID payload validation
  harness.register(category, 'Validates SUBMIT_BID integer boundaries (1 to 13)', () => {
    // Missing bid
    let res = validateClientPayload('SUBMIT_BID', {});
    if (res.valid) throw new Error('Expected missing bid to fail');

    // Non-number
    res = validateClientPayload('SUBMIT_BID', { bid: '5' });
    if (res.valid) throw new Error('Expected string bid to fail');

    // Float number
    res = validateClientPayload('SUBMIT_BID', { bid: 3.5 });
    if (res.valid) throw new Error('Expected float bid to fail');

    // Out of range (< 1)
    res = validateClientPayload('SUBMIT_BID', { bid: 0 });
    if (res.valid) throw new Error('Expected bid=0 to fail');

    // Out of range (> 13)
    res = validateClientPayload('SUBMIT_BID', { bid: 14 });
    if (res.valid) throw new Error('Expected bid=14 to fail');

    // Valid bids 1 through 13
    for (let b = 1; b <= 13; b++) {
      res = validateClientPayload('SUBMIT_BID', { bid: b });
      if (!res.valid) throw new Error(`Expected bid=${b} to pass: ${res.error}`);
    }
  });

  // 9. PLAY_CARD payload validation
  harness.register(category, 'Validates PLAY_CARD card object, suits, ranks, and values', () => {
    // Missing card
    let res = validateClientPayload('PLAY_CARD', {});
    if (res.valid) throw new Error('Expected missing card to fail');

    // Invalid suit
    res = validateClientPayload('PLAY_CARD', {
      card: { id: 'c1', suit: 'CIRCLES', rank: 'A', value: 14 },
    });
    if (res.valid) throw new Error('Expected invalid suit to fail');

    // Invalid rank
    res = validateClientPayload('PLAY_CARD', {
      card: { id: 'c1', suit: Suit.SPADES, rank: '1', value: 1 },
    });
    if (res.valid) throw new Error('Expected invalid rank to fail');

    // Value out of bounds
    res = validateClientPayload('PLAY_CARD', {
      card: { id: 'c1', suit: Suit.SPADES, rank: Rank.ACE, value: 20 },
    });
    if (res.valid) throw new Error('Expected value 20 to fail');

    // Valid card
    res = validateClientPayload('PLAY_CARD', {
      card: { id: 'spades_ace', suit: Suit.SPADES, rank: Rank.ACE, value: 14 },
    });
    if (!res.valid) throw new Error(`Expected valid card to pass: ${res.error}`);
  });

  // 10. Other action payloads (SWAP_SEATS, CONVERT_TO_BOT, RESPOND_JOIN_REQUEST, etc.)
  harness.register(category, 'Validates room actions (SWAP_SEATS, BOT, JOIN_REQUEST)', () => {
    // SWAP_SEATS with identical seat
    let res = validateClientPayload('SWAP_SEATS', {
      seatA: PlayerPosition.SOUTH,
      seatB: PlayerPosition.SOUTH,
    });
    if (res.valid) throw new Error('Expected swapping same seat to fail');

    // SWAP_SEATS valid
    res = validateClientPayload('SWAP_SEATS', {
      seatA: PlayerPosition.SOUTH,
      seatB: PlayerPosition.NORTH,
    });
    if (!res.valid) throw new Error(`Expected valid SWAP_SEATS to pass: ${res.error}`);

    // CONVERT_TO_BOT invalid seat
    res = validateClientPayload('CONVERT_TO_BOT', { seat: 'INVALID_SEAT' });
    if (res.valid) throw new Error('Expected invalid seat to fail');

    // RESPOND_JOIN_REQUEST missing boolean accept
    res = validateClientPayload('RESPOND_JOIN_REQUEST', { requestId: 'req_1' });
    if (res.valid) throw new Error('Expected missing accept to fail');

    // RESPOND_JOIN_REQUEST valid
    res = validateClientPayload('RESPOND_JOIN_REQUEST', { requestId: 'req_1', accept: true });
    if (!res.valid) throw new Error(`Expected valid RESPOND_JOIN_REQUEST to pass: ${res.error}`);
  });

  // 11. Rate limiter: Global flood rejection (30 msgs per 1s window)
  harness.register(category, 'Enforces global rate limit (blocks > 30 msgs per 1s window)', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();
    const t0 = 100000;

    // Send 30 valid messages within same window
    for (let i = 0; i < 30; i++) {
      const check = limiter.checkRateLimit(socket, false, t0 + i * 10);
      if (!check.allowed) {
        throw new Error(`Expected message ${i + 1} to be allowed within rate limit`);
      }
    }

    // 31st message must be rejected
    const blockedCheck = limiter.checkRateLimit(socket, false, t0 + 500);
    if (blockedCheck.allowed) {
      throw new Error('Expected 31st rapid message to be rate-limited');
    }
  });

  // 12. Rate limiter: Setup flood rejection (5 setup ops per 2s window)
  harness.register(category, 'Enforces setup rate limit (blocks > 5 room ops per 2s window)', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();
    const t0 = 200000;

    // 5 room operations (e.g. CREATE_ROOM)
    for (let i = 0; i < 5; i++) {
      const check = limiter.checkRateLimit(socket, true, t0 + i * 100);
      if (!check.allowed) {
        throw new Error(`Expected setup op ${i + 1} to be allowed`);
      }
    }

    // 6th room operation must be rejected
    const blocked = limiter.checkRateLimit(socket, true, t0 + 600);
    if (blocked.allowed) {
      throw new Error('Expected 6th setup operation to be rate-limited');
    }
  });

  // 13. Rate limit sliding window recovery
  harness.register(category, 'Allows new messages after sliding window elapses', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();
    const t0 = 300000;

    // Fill the 30 quota
    for (let i = 0; i < 30; i++) {
      limiter.checkRateLimit(socket, false, t0);
    }
    const blocked = limiter.checkRateLimit(socket, false, t0 + 200);
    if (blocked.allowed) {
      throw new Error('Expected to be blocked at t0 + 200ms');
    }

    // Advance time past GLOBAL_WINDOW_MS (1000ms)
    const recovered = limiter.checkRateLimit(socket, false, t0 + RATE_LIMIT_CONFIG.GLOBAL_WINDOW_MS + 100);
    if (!recovered.allowed) {
      throw new Error('Expected message to be allowed after rate limit window passed');
    }
  });

  // 14. Socket cleanup prevents memory leak
  harness.register(category, 'Cleans up rate limit state on socket disconnection', () => {
    const limiter = new WsRateLimiter();
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    limiter.checkRateLimit(socket1, false);
    limiter.checkRateLimit(socket2, false);

    if (limiter.getActiveTrackedCount() !== 2) {
      throw new Error(`Expected 2 tracked sockets, got ${limiter.getActiveTrackedCount()}`);
    }

    limiter.cleanup(socket1);
    if (limiter.getActiveTrackedCount() !== 1) {
      throw new Error(`Expected 1 tracked socket after cleanup, got ${limiter.getActiveTrackedCount()}`);
    }

    limiter.cleanup(socket2);
    if (limiter.getActiveTrackedCount() !== 0) {
      throw new Error(`Expected 0 tracked sockets after cleanup, got ${limiter.getActiveTrackedCount()}`);
    }
  });

  // 15. Normal legitimate messages pass validation cleanly
  harness.register(category, 'Passes all standard gameplay messages through guard cleanly', () => {
    const limiter = new WsRateLimiter();
    const socket = createMockSocket();

    const messages = [
      { type: 'GET_ACTIVE_ROOMS' },
      { type: 'CREATE_ROOM', payload: { playerName: 'HostPlayer', totalRounds: 5 } },
      { type: 'JOIN_ROOM', payload: { roomCode: 'ROOM1', playerName: 'GuestPlayer' } },
      { type: 'START_MATCH', payload: { autoFillBots: true } },
      { type: 'CLIENT_READY', payload: { roomCode: 'ROOM1' } },
      { type: 'SUBMIT_BID', payload: { bid: 4 } },
      {
        type: 'PLAY_CARD',
        payload: {
          card: { id: 'spades_king', suit: Suit.SPADES, rank: Rank.KING, value: 13 },
        },
      },
      { type: 'NEXT_ROUND' },
      { type: 'PING' },
      { type: 'LEAVE_ROOM' },
    ];

    for (const msg of messages) {
      const raw = JSON.stringify(msg);
      const res = parseAndValidateWsMessage(raw, socket, limiter);
      if (!res.ok) {
        throw new Error(`Expected message type ${msg.type} to pass cleanly, got error: ${res.errorMessage}`);
      }
      if (res.message?.type !== msg.type) {
        throw new Error(`Expected parsed type ${msg.type}, got ${res.message?.type}`);
      }
    }
  });

  // 16. Authoritative game controller still enforces gameplay legality (out-of-turn / illegal moves)
  harness.register(category, 'Preserves server authority rejecting illegal or out-of-turn actions', () => {
    const roomManager = RoomManager.getInstance();
    const socket = createMockSocket();

    const createRes = roomManager.createRoom('p_host', 'HostPlayer', socket, 'CB-VAL1');
    if (!createRes.success || !createRes.room) {
      throw new Error(`Failed to create room: ${createRes.error}`);
    }
    const room = createRes.room;

    // Attempting a bid or play before match is started returns server error
    const bidRes = room.handleBid('p_host', 3);
    if (bidRes.success) {
      throw new Error('Expected bid to fail when match is not in bidding state');
    }

    const cardRes = room.handlePlayCard('p_host', {
      id: 'spades_ace',
      suit: Suit.SPADES,
      rank: Rank.ACE,
      value: 14,
    });
    if (cardRes.success) {
      throw new Error('Expected play card to fail when match is not in playing state');
    }

    // Cleanup room
    roomManager.leaveRoom('p_host', true);
  });

  return harness;
}
