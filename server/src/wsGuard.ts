/**
 * WebSocket Input Validation & Rate Limiting Guard
 * 
 * Provides:
 * 1. Strict message envelope validation (JSON object, valid type, size bounds)
 * 2. Conservative payload structure and range validation for every client message
 * 3. In-memory per-connection token/sliding-window rate limiting with setup action protection
 * 4. Deterministic socket cleanup to prevent memory leaks
 */

import { WebSocket } from 'ws';
import { ClientMessage } from '../../src/models/multiplayer';
import { PlayerPosition } from '../../src/models/player';
import { Suit, Rank } from '../../src/models/card';

/**
 * Maximum allowed raw WebSocket message size.
 * Call Break client JSON messages are typically 50-300 bytes.
 * 16 KB is >50x larger than any legitimate message while completely preventing
 * memory exhaustion from oversized payloads.
 */
export const MAX_WS_MESSAGE_SIZE_BYTES = 16 * 1024; // 16 KB

export const RATE_LIMIT_CONFIG = {
  // Global message limit per connection: 30 messages per 1-second sliding window
  GLOBAL_MAX_PER_WINDOW: 30,
  GLOBAL_WINDOW_MS: 1000,

  // Setup / heavy room operations limit per connection (CREATE_ROOM, JOIN_ROOM, RESPOND_JOIN_REQUEST):
  // 5 requests per 2-second sliding window
  SETUP_MAX_PER_WINDOW: 5,
  SETUP_WINDOW_MS: 2000,
};

export const KNOWN_CLIENT_MESSAGE_TYPES = new Set<string>([
  'GET_ACTIVE_ROOMS',
  'CREATE_ROOM',
  'JOIN_ROOM',
  'START_MATCH',
  'START_GAME',
  'CLIENT_READY',
  'RENAME_PLAYER',
  'TRANSFER_HOST',
  'SUBMIT_BID',
  'PLAY_CARD',
  'NEXT_ROUND',
  'RESPOND_JOIN_REQUEST',
  'CONVERT_TO_BOT',
  'KICK_PLAYER',
  'SWAP_SEATS',
  'LEAVE_ROOM',
  'PING',
]);

export const SETUP_MESSAGE_TYPES = new Set<string>([
  'CREATE_ROOM',
  'JOIN_ROOM',
  'RESPOND_JOIN_REQUEST',
]);

export const VALID_POSITIONS = new Set<string>([
  PlayerPosition.SOUTH,
  PlayerPosition.WEST,
  PlayerPosition.NORTH,
  PlayerPosition.EAST,
]);

export const VALID_SUITS = new Set<string>([
  Suit.SPADES,
  Suit.HEARTS,
  Suit.DIAMONDS,
  Suit.CLUBS,
]);

export const VALID_RANKS = new Set<string>([
  Rank.TWO,
  Rank.THREE,
  Rank.FOUR,
  Rank.FIVE,
  Rank.SIX,
  Rank.SEVEN,
  Rank.EIGHT,
  Rank.NINE,
  Rank.TEN,
  Rank.JACK,
  Rank.QUEEN,
  Rank.KING,
  Rank.ACE,
]);

interface ClientRateLimitState {
  globalTimestamps: number[];
  setupTimestamps: number[];
}

/**
 * In-memory sliding window rate limiter per WebSocket connection.
 * Zero external dependencies (no Redis, no database).
 */
export class WsRateLimiter {
  private states = new Map<WebSocket, ClientRateLimitState>();

  public checkRateLimit(
    socket: WebSocket,
    isSetupAction: boolean = false,
    now: number = Date.now()
  ): { allowed: boolean; reason?: string } {
    let state = this.states.get(socket);
    if (!state) {
      state = { globalTimestamps: [], setupTimestamps: [] };
      this.states.set(socket, state);
    }

    // 1. Check global rate limit (sliding window)
    const globalWindowStart = now - RATE_LIMIT_CONFIG.GLOBAL_WINDOW_MS;
    state.globalTimestamps = state.globalTimestamps.filter((t) => t > globalWindowStart);

    if (state.globalTimestamps.length >= RATE_LIMIT_CONFIG.GLOBAL_MAX_PER_WINDOW) {
      return { allowed: false, reason: 'Message rate limit exceeded. Please slow down.' };
    }

    // 2. Check setup rate limit if applicable (sliding window)
    if (isSetupAction) {
      const setupWindowStart = now - RATE_LIMIT_CONFIG.SETUP_WINDOW_MS;
      state.setupTimestamps = state.setupTimestamps.filter((t) => t > setupWindowStart);
      if (state.setupTimestamps.length >= RATE_LIMIT_CONFIG.SETUP_MAX_PER_WINDOW) {
        return { allowed: false, reason: 'Room operation rate limit exceeded. Please slow down.' };
      }
      state.setupTimestamps.push(now);
    }

    state.globalTimestamps.push(now);
    return { allowed: true };
  }

  public cleanup(socket: WebSocket): void {
    this.states.delete(socket);
  }

  public getActiveTrackedCount(): number {
    return this.states.size;
  }

  public reset(): void {
    this.states.clear();
  }
}

/**
 * Validates payload fields, data types, and range boundaries for each message type.
 * Note: Does not perform game-state legality checks; stateful rules validation remains authoritative.
 */
export function validateClientPayload(
  type: string,
  payload: any
): { valid: boolean; error?: string } {
  switch (type) {
    case 'CREATE_ROOM': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'CREATE_ROOM payload must be an object.' };
      }
      const { playerName, roomCode, totalRounds, playerId } = payload;
      if (typeof playerName !== 'string' || playerName.trim().length === 0) {
        return { valid: false, error: 'Player name is required.' };
      }
      if (playerName.trim().length > 30) {
        return { valid: false, error: 'Player name must not exceed 30 characters.' };
      }
      if (roomCode !== undefined && roomCode !== null && roomCode !== '') {
        if (typeof roomCode !== 'string') {
          return { valid: false, error: 'Room code must be a string.' };
        }
        const trimmedCode = roomCode.trim().replace(/^CB-?/i, '');
        if (trimmedCode.length < 3 || trimmedCode.length > 10 || !/^[A-Za-z0-9]+$/.test(trimmedCode)) {
          return { valid: false, error: 'Room code must be 3 to 10 alphanumeric characters.' };
        }
      }
      if (totalRounds !== undefined && totalRounds !== null) {
        if (typeof totalRounds !== 'number' || !Number.isInteger(totalRounds) || (totalRounds !== 5 && totalRounds !== 10)) {
          return { valid: false, error: 'Total rounds must be 5 or 10.' };
        }
      }
      if (playerId !== undefined && playerId !== null) {
        if (typeof playerId !== 'string' || playerId.trim().length === 0 || playerId.length > 64) {
          return { valid: false, error: 'Player ID must be a non-empty string up to 64 characters.' };
        }
      }
      return { valid: true };
    }

    case 'JOIN_ROOM': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'JOIN_ROOM payload must be an object.' };
      }
      const { roomCode, playerName, playerId } = payload;
      if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
        return { valid: false, error: 'Room code is required.' };
      }
      if (roomCode.trim().length > 20) {
        return { valid: false, error: 'Room code must not exceed 20 characters.' };
      }
      if (typeof playerName !== 'string' || playerName.trim().length === 0) {
        return { valid: false, error: 'Player name is required.' };
      }
      if (playerName.trim().length > 30) {
        return { valid: false, error: 'Player name must not exceed 30 characters.' };
      }
      if (playerId !== undefined && playerId !== null) {
        if (typeof playerId !== 'string' || playerId.trim().length === 0 || playerId.length > 64) {
          return { valid: false, error: 'Player ID must be a non-empty string up to 64 characters.' };
        }
      }
      return { valid: true };
    }

    case 'START_MATCH':
    case 'START_GAME': {
      if (payload !== undefined && payload !== null) {
        if (typeof payload !== 'object' || Array.isArray(payload)) {
          return { valid: false, error: 'START_MATCH payload must be an object if provided.' };
        }
        const { autoFillBots, totalRounds } = payload;
        if (autoFillBots !== undefined && typeof autoFillBots !== 'boolean') {
          return { valid: false, error: 'autoFillBots must be a boolean.' };
        }
        if (totalRounds !== undefined && totalRounds !== null) {
          if (typeof totalRounds !== 'number' || !Number.isInteger(totalRounds) || (totalRounds !== 5 && totalRounds !== 10)) {
            return { valid: false, error: 'Total rounds must be 5 or 10.' };
          }
        }
      }
      return { valid: true };
    }

    case 'CLIENT_READY': {
      if (payload !== undefined && payload !== null) {
        if (typeof payload !== 'object' || Array.isArray(payload)) {
          return { valid: false, error: 'CLIENT_READY payload must be an object if provided.' };
        }
        if (payload.roomCode !== undefined && (typeof payload.roomCode !== 'string' || payload.roomCode.length > 32)) {
          return { valid: false, error: 'roomCode must be a string up to 32 characters.' };
        }
      }
      return { valid: true };
    }

    case 'SUBMIT_BID': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'SUBMIT_BID payload must be an object.' };
      }
      const { bid } = payload;
      if (typeof bid !== 'number' || !Number.isInteger(bid) || bid < 1 || bid > 13) {
        return { valid: false, error: 'Bid must be an integer between 1 and 13.' };
      }
      return { valid: true };
    }

    case 'PLAY_CARD': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'PLAY_CARD payload must be an object.' };
      }
      const { card } = payload;
      if (!card || typeof card !== 'object' || Array.isArray(card)) {
        return { valid: false, error: 'PLAY_CARD requires a card object.' };
      }
      if (!VALID_SUITS.has(card.suit)) {
        return { valid: false, error: `Invalid card suit: ${String(card.suit)}` };
      }
      if (!VALID_RANKS.has(card.rank)) {
        return { valid: false, error: `Invalid card rank: ${String(card.rank)}` };
      }
      if (typeof card.id !== 'string' || card.id.length < 1 || card.id.length > 32) {
        return { valid: false, error: 'Card id must be a string between 1 and 32 characters.' };
      }
      if (typeof card.value !== 'number' || !Number.isFinite(card.value) || card.value < 2 || card.value > 14) {
        return { valid: false, error: 'Card value must be a number between 2 and 14.' };
      }
      return { valid: true };
    }

    case 'RESPOND_JOIN_REQUEST': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'RESPOND_JOIN_REQUEST payload must be an object.' };
      }
      const { requestId, accept, targetSeat } = payload;
      if (typeof requestId !== 'string' || requestId.trim().length === 0 || requestId.length > 64) {
        return { valid: false, error: 'requestId must be a non-empty string up to 64 characters.' };
      }
      if (typeof accept !== 'boolean') {
        return { valid: false, error: 'accept must be a boolean.' };
      }
      if (targetSeat !== undefined && targetSeat !== null && !VALID_POSITIONS.has(targetSeat)) {
        return { valid: false, error: `Invalid targetSeat: ${String(targetSeat)}` };
      }
      return { valid: true };
    }

    case 'CONVERT_TO_BOT':
    case 'KICK_PLAYER': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: `${type} payload must be an object.` };
      }
      const { seat } = payload;
      if (!seat || !VALID_POSITIONS.has(seat)) {
        return { valid: false, error: `Invalid seat position: ${String(seat)}` };
      }
      return { valid: true };
    }

    case 'SWAP_SEATS': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'SWAP_SEATS payload must be an object.' };
      }
      const { seatA, seatB } = payload;
      if (!seatA || !VALID_POSITIONS.has(seatA)) {
        return { valid: false, error: `Invalid seatA: ${String(seatA)}` };
      }
      if (!seatB || !VALID_POSITIONS.has(seatB)) {
        return { valid: false, error: `Invalid seatB: ${String(seatB)}` };
      }
      if (seatA === seatB) {
        return { valid: false, error: 'seatA and seatB must be different seats.' };
      }
      return { valid: true };
    }

    case 'RENAME_PLAYER': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'RENAME_PLAYER payload must be an object.' };
      }
      const { seat, name } = payload;
      if (!seat || !VALID_POSITIONS.has(seat)) {
        return { valid: false, error: `Invalid seat: ${String(seat)}` };
      }
      if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 30) {
        return { valid: false, error: 'Player name must be 1 to 30 characters.' };
      }
      return { valid: true };
    }

    case 'TRANSFER_HOST': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'TRANSFER_HOST payload must be an object.' };
      }
      const { targetSeat, targetClientId } = payload;
      if (!targetSeat && !targetClientId) {
        return { valid: false, error: 'targetSeat or targetClientId is required.' };
      }
      if (targetSeat && !VALID_POSITIONS.has(targetSeat)) {
        return { valid: false, error: `Invalid targetSeat: ${String(targetSeat)}` };
      }
      if (targetClientId && (typeof targetClientId !== 'string' || targetClientId.trim().length === 0 || targetClientId.length > 64)) {
        return { valid: false, error: 'targetClientId must be a non-empty string up to 64 characters.' };
      }
      return { valid: true };
    }

    case 'GET_ACTIVE_ROOMS':
    case 'NEXT_ROUND':
    case 'LEAVE_ROOM':
    case 'PING': {
      if (payload !== undefined && payload !== null && typeof payload !== 'object') {
        return { valid: false, error: `${type} does not accept primitive payloads.` };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: `Unknown message type: ${type}` };
  }
}

export interface ParseAndValidateResult {
  ok: boolean;
  message?: ClientMessage;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Top-level parser and safety validator for incoming WebSocket messages.
 * Never throws an unhandled exception.
 */
export function parseAndValidateWsMessage(
  rawData: string | Buffer,
  socket: WebSocket,
  rateLimiter: WsRateLimiter,
  now: number = Date.now()
): ParseAndValidateResult {
  if (rawData == null) {
    return {
      ok: false,
      errorCode: 'INVALID_MESSAGE_SHAPE',
      errorMessage: 'Message data cannot be null or undefined.',
    };
  }

  // 1. Message size check
  const byteLength = Buffer.isBuffer(rawData)
    ? rawData.byteLength
    : Buffer.byteLength(rawData, 'utf8');

  if (byteLength > MAX_WS_MESSAGE_SIZE_BYTES) {
    return {
      ok: false,
      errorCode: 'MESSAGE_TOO_LARGE',
      errorMessage: `Message size (${byteLength} bytes) exceeds maximum allowed limit of ${MAX_WS_MESSAGE_SIZE_BYTES} bytes.`,
    };
  }

  // 2. Text decode & JSON parse
  let parsed: any;
  try {
    const text = typeof rawData === 'string' ? rawData : rawData.toString('utf8');
    parsed = JSON.parse(text);
  } catch {
    // Malformed JSON counts towards rate limit to prevent JSON-parse flood attacks
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: 'INVALID_JSON',
      errorMessage: 'Invalid JSON payload.',
    };
  }

  // 3. Envelope validation
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: 'INVALID_MESSAGE_SHAPE',
      errorMessage: 'Message must be a valid JSON object.',
    };
  }

  if (typeof parsed.type !== 'string' || !parsed.type.trim()) {
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: 'MISSING_MESSAGE_TYPE',
      errorMessage: 'Message missing required type field.',
    };
  }

  if (!KNOWN_CLIENT_MESSAGE_TYPES.has(parsed.type)) {
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: 'UNKNOWN_MESSAGE_TYPE',
      errorMessage: `Unknown message type: ${String(parsed.type).slice(0, 32)}`,
    };
  }

  // 4. Rate limiting
  const isSetup = SETUP_MESSAGE_TYPES.has(parsed.type);
  const rateCheck = rateLimiter.checkRateLimit(socket, isSetup, now);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: rateCheck.reason || 'Too many requests. Please slow down.',
    };
  }

  // 5. Payload validation
  const payloadCheck = validateClientPayload(parsed.type, parsed.payload);
  if (!payloadCheck.valid) {
    return {
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
      errorMessage: payloadCheck.error || 'Invalid payload format.',
    };
  }

  return {
    ok: true,
    message: parsed as ClientMessage,
  };
}
