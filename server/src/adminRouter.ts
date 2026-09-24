/**
 * Admin Router
 * Authenticated REST endpoints for inspecting server statistics and active game rooms.
 * Mounted at /api/admin
 */

import { Router, Request, Response } from 'express';
import { adminAuthGuard } from './adminAuth';
import {
  serializeAdminStats,
  serializeAdminRoomSummary,
  serializeAdminRoomDebug,
} from './adminSerializers';
import { RoomManager } from './RoomManager';

export interface AdminRouterOptions {
  roomManager?: RoomManager;
  getActiveConnectionsCount?: () => number;
}

export function createAdminRouter(options: AdminRouterOptions = {}): Router {
  const router = Router();
  const roomManager = options.roomManager || RoomManager.getInstance();
  const getActiveConnectionsCount = options.getActiveConnectionsCount || (() => 0);

  // Apply authentication guard to ALL admin routes
  router.use(adminAuthGuard);

  /**
   * GET /api/admin/stats
   * Server-level runtime metrics.
   */
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const stats = serializeAdminStats(roomManager, getActiveConnectionsCount);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to retrieve server statistics',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  /**
   * GET /api/admin/rooms
   * Summaries of all active in-memory rooms (NO private cards exposed).
   */
  router.get('/rooms', (_req: Request, res: Response) => {
    try {
      const rooms = roomManager.getAllRooms();
      const summaries = rooms.map((r) => serializeAdminRoomSummary(r));
      res.json(summaries);
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to retrieve room summaries',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  /**
   * GET /api/admin/rooms/:roomCode
   * Detailed authoritative debug snapshot for one room (includes server-side private cards).
   */
  router.get('/rooms/:roomCode', (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const room = roomManager.getRoom(roomCode);

      if (!room) {
        res.status(404).json({
          error: 'Room not found',
          code: 'ROOM_NOT_FOUND',
        });
        return;
      }

      const debugSnapshot = serializeAdminRoomDebug(room);
      res.json(debugSnapshot);
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to retrieve room debug snapshot',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  return router;
}
