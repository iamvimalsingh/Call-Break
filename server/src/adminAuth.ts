/**
 * Admin Authentication Guard
 * Lightweight, timing-safe Bearer token guard for /api/admin/* inspection routes.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Timing-safe string comparison to protect against side-channel timing attacks.
 * Hashing both values with SHA-256 guarantees equal-length 32-byte buffers.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Express middleware for authenticating admin requests.
 * Requires: Authorization: Bearer <ADMIN_API_KEY>
 *
 * Status Codes:
 * - 503 Service Unavailable: ADMIN_API_KEY not configured on server
 * - 401 Unauthorized: Missing or malformed Authorization header
 * - 403 Forbidden: Invalid admin key
 */
export function adminAuthGuard(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || expectedKey.trim().length === 0) {
    res.status(503).json({
      error: 'Admin API is not configured on this server',
      code: 'ADMIN_NOT_CONFIGURED',
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      error: 'Authorization header with Bearer token is required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    res.status(401).json({
      error: 'Authorization header must follow Bearer <token> format',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = parts[1];
  if (!timingSafeEqualStr(token, expectedKey)) {
    res.status(403).json({
      error: 'Invalid admin API key',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
}
