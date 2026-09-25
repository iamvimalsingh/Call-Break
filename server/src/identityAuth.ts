/**
 * Anonymous Identity Proof & Signing Utilities
 * Implements server-side HMAC-SHA256 signing of anonymous player IDs
 * to prevent client-side player ID spoofing without requiring logins or passwords.
 */

import crypto from 'crypto';

// Server-side secret key for HMAC token signing (ephemeral per server process or persistent)
const IDENTITY_SECRET = process.env.IDENTITY_SECRET || crypto.randomBytes(32).toString('hex');

export function signPlayerId(playerId: string): string {
  if (!playerId) return '';
  return crypto.createHmac('sha256', IDENTITY_SECRET).update(playerId.trim()).digest('hex');
}

export function verifyPlayerToken(playerId: string, token: string): boolean {
  if (!playerId || !token) return false;
  try {
    const expected = signPlayerId(playerId);
    if (expected.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}
