/**
 * WebSocket Server Entry Point
 * Attaches real-time WebSocket listeners to Node HTTP Server and connects to RoomManager.
 * Fully configured for cloud hosting on Render.com with health check routes and 0.0.0.0 host binding.
 */

import http, { Server as HttpServer } from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from '../../src/models/multiplayer';
import { RoomManager } from './RoomManager';
import { createAdminRouter } from './adminRouter';
import { createPlayerRouter } from './playerRouter';
import { parseAndValidateWsMessage, WsRateLimiter } from './wsGuard';
import { PersistenceService } from './db/PersistenceService';

export const PORT = Number(process.env.PORT) || 3001;

export function setupWebSocketServer(server: HttpServer, customRateLimiter?: WsRateLimiter): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const roomManager = RoomManager.getInstance();
  const rateLimiter = customRateLimiter || new WsRateLimiter();

  console.log('[WebSocket] CallBreak Multiplayer WebSocket server initialized');

  // Handle upgrade to support /ws or standalone / without interfering with Vite HMR
  server.on('upgrade', (request, socket, head) => {
    // Never intercept Vite HMR upgrades or Vite dev server internals
    const protocol = request.headers['sec-websocket-protocol'];
    if (protocol && protocol.includes('vite')) {
      return;
    }

    const pathname = request.url ? new URL(request.url, 'http://localhost').pathname : '/';
    if (pathname.startsWith('/@vite') || pathname.startsWith('/__vite')) {
      return;
    }

    // Never intercept Vite HMR token requests
    if (request.url && request.url.includes('token=')) {
      return;
    }

    // Only handle CallBreak WebSocket endpoints (/ws or /ws/)
    if (pathname === '/ws' || pathname === '/ws/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (socket: WebSocket, req) => {
    let clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[WebSocket] Client connected: ${clientId} from ${req.socket.remoteAddress}`);

    // Heartbeat setup
    let isAlive = true;
    socket.on('pong', () => {
      isAlive = true;
    });

    socket.on('message', (rawData: string | Buffer) => {
      try {
        const guardResult = parseAndValidateWsMessage(rawData, socket, rateLimiter);
        if (!guardResult.ok) {
          if (socket.readyState === WebSocket.OPEN) {
            const errMsg: ServerMessage = {
              type: 'ERROR',
              payload: {
                code: guardResult.errorCode || 'INVALID_PAYLOAD',
                message: guardResult.errorMessage || 'Invalid message format',
              },
            };
            socket.send(JSON.stringify(errMsg));
          }
          return;
        }

        const msg = guardResult.message!;

        switch (msg.type) {
          case 'GET_ACTIVE_ROOMS': {
            const summaries = roomManager.getActiveRoomsSummary();
            const activeRoomsMsg: ServerMessage = {
              type: 'ACTIVE_ROOMS_LIST',
              payload: summaries,
            };
            socket.send(JSON.stringify(activeRoomsMsg));
            break;
          }

          case 'CREATE_ROOM': {
            const { roomCode, playerName, totalRounds, playerId } = (msg.payload as any) || {};
            const trimmedName = typeof playerName === 'string' ? playerName.trim() : '';
            if (!trimmedName) {
              const errMsg: ServerMessage = {
                type: 'ERROR',
                payload: {
                  code: 'INVALID_NAME',
                  message: 'Please enter your name.',
                },
              };
              socket.send(JSON.stringify(errMsg));
              break;
            }
            if (playerId && typeof playerId === 'string' && playerId.trim().length > 0) {
              clientId = playerId.trim();
            }
            const result = roomManager.createRoom(
              clientId,
              trimmedName,
              socket,
              roomCode
            );
            if (!result.success || !result.room) {
              const errMsg: ServerMessage = {
                type: 'ERROR',
                payload: {
                  code: result.errorCode || 'CREATE_FAILED',
                  message: result.error || 'Room ID already active',
                },
              };
              socket.send(JSON.stringify(errMsg));
              break;
            }
            const room = result.room;
            if (totalRounds && (totalRounds === 5 || totalRounds === 10)) {
              room.totalRounds = totalRounds;
            }
            if (playerId && typeof playerId === 'string' && playerId.trim().length > 0) {
              PersistenceService.getInstance().onPlayerJoin(playerId.trim(), trimmedName).catch(() => {});
            }
            console.log(`[WebSocket] Room created: ${room.roomCode} by ${clientId}`);
            break;
          }

          case 'JOIN_ROOM': {
            const { roomCode, playerName, playerId } = (msg.payload as any) || {};
            const trimmedName = typeof playerName === 'string' ? playerName.trim() : '';
            if (!trimmedName) {
              const errMsg: ServerMessage = {
                type: 'ERROR',
                payload: {
                  code: 'INVALID_NAME',
                  message: 'Please enter your name.',
                },
              };
              socket.send(JSON.stringify(errMsg));
              break;
            }
            if (playerId && typeof playerId === 'string' && playerId.trim().length > 0) {
              clientId = playerId.trim();
            }
            const result = roomManager.joinRoom(
              roomCode,
              clientId,
              trimmedName,
              socket
            );

            if (!result.success) {
              const errMsg: ServerMessage = {
                type: 'ERROR',
                payload: {
                  code: result.errorCode || 'JOIN_FAILED',
                  message: result.error || 'Failed to join room.',
                },
              };
              socket.send(JSON.stringify(errMsg));
            } else {
              if (playerId && typeof playerId === 'string' && playerId.trim().length > 0) {
                PersistenceService.getInstance().onPlayerJoin(playerId.trim(), trimmedName).catch(() => {});
              }
              console.log(`[WebSocket] Client ${clientId} joined room: ${roomCode}`);
            }
            break;
          }

          case 'START_MATCH':
          case 'START_GAME': {
            const room = roomManager.getRoomByClientId(clientId);
            if (!room) {
              const errMsg: ServerMessage = {
                type: 'ERROR',
                payload: { message: 'You are not in any active room.' },
              };
              socket.send(JSON.stringify(errMsg));
              return;
            }

            const autoFill = msg.payload?.autoFillBots ?? true;
            const totalRounds = msg.payload?.totalRounds ?? 5;
            const result = room.startMatch(clientId, autoFill, totalRounds);

            if (!result.success) {
              const errMsg: ServerMessage = {
                type: 'ERROR',
                payload: { message: result.error || 'Cannot start table.' },
              };
              socket.send(JSON.stringify(errMsg));
            } else {
              console.log(`[WebSocket] Match started in room ${room.roomCode}`);
            }
            break;
          }

          case 'CLIENT_READY': {
            const room =
              roomManager.getRoomByClientId(clientId) ||
              (msg.payload?.roomCode ? roomManager.getRoom(msg.payload.roomCode) : undefined);
            if (room) {
              room.handleClientReady(clientId);
            }
            break;
          }

          case 'RENAME_PLAYER': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const { seat, name } = msg.payload || {};
              if (seat && name) {
                room.renameSeat(clientId, seat, name);
              }
            }
            break;
          }

          case 'TRANSFER_HOST': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const { targetSeat, targetClientId } = msg.payload || {};
              room.transferHost(clientId, targetSeat || targetClientId);
            }
            break;
          }

          case 'SUBMIT_BID': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const result = room.handleBid(clientId, msg.payload.bid);
              if (!result.success && result.error) {
                socket.send(
                  JSON.stringify({
                    type: 'ERROR',
                    payload: { message: result.error },
                  })
                );
              }
            }
            break;
          }

          case 'PLAY_CARD': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const result = room.handlePlayCard(clientId, msg.payload.card);
              if (!result.success && result.error) {
                socket.send(
                  JSON.stringify({
                    type: 'ERROR',
                    payload: { message: result.error },
                  })
                );
              }
            }
            break;
          }

          case 'NEXT_ROUND': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              room.handleNextRound(clientId);
            }
            break;
          }

          case 'RESPOND_JOIN_REQUEST': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              room.handleJoinResponse(clientId, msg.payload.requestId, msg.payload.accept, msg.payload.targetSeat);
            }
            break;
          }

          case 'CONVERT_TO_BOT':
          case 'KICK_PLAYER': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room && msg.payload?.seat) {
              room.handleConvertToBot(clientId, msg.payload.seat);
            }
            break;
          }

          case 'SWAP_SEATS': {
            const room = roomManager.getRoomByClientId(clientId);
            if (room && msg.payload?.seatA && msg.payload?.seatB) {
              room.handleSwapSeats(clientId, msg.payload.seatA, msg.payload.seatB);
            }
            break;
          }

          case 'LEAVE_ROOM': {
            roomManager.leaveRoom(clientId, true);
            break;
          }

          case 'PING': {
            const pong: ServerMessage = { type: 'PONG' };
            socket.send(JSON.stringify(pong));
            break;
          }

          default:
            console.warn('[WebSocket] Unknown message type received:', (msg as any)?.type);
        }
      } catch (err: any) {
        console.error('[WebSocket] Failed to handle message:', err?.message);
        const errMsg: ServerMessage = {
          type: 'ERROR',
          payload: { message: 'Invalid payload format' },
        };
        socket.send(JSON.stringify(errMsg));
      }
    });

    socket.on('close', () => {
      rateLimiter.cleanup(socket);
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      roomManager.leaveRoom(clientId, false);
    });

    socket.on('error', (err) => {
      rateLimiter.cleanup(socket);
      console.error(`[WebSocket] Error for client ${clientId}:`, err.message);
      roomManager.leaveRoom(clientId, false);
    });
  });

  // Keep-alive ping interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
    rateLimiter.reset();
  });

  return wss;
}

/**
 * Creates Express application with basic HTTP health-check routes required by Render.com
 */
export function createServerApp(getActiveConnectionsCount?: () => number): express.Express {
  const app = express();
  app.use(express.json());

  // Permissive CORS for health endpoints and cross-origin WebSocket polling
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
  });

  // Basic HTTP health-check routes for Render.com & control plane
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'callbreak-server' });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'callbreak-server', timestamp: new Date().toISOString() });
  });

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'callbreak-server' });
  });

  // Authenticated Admin REST inspection endpoints
  app.use('/api/admin', createAdminRouter({ getActiveConnectionsCount }));

  // Player Profile & Scorecard REST endpoints
  app.use('/api/player', createPlayerRouter());

  return app;
}

/**
 * Starts standalone HTTP & WebSocket server bound to host '0.0.0.0' for Render.com
 */
export function startStandaloneServer(port: number = PORT): {
  app: express.Express;
  server: HttpServer;
  wss: WebSocketServer;
} {
  const server = http.createServer();
  const wss = setupWebSocketServer(server);
  const app = createServerApp(() => wss.clients.size);
  server.on('request', app);

  server.listen(port, '0.0.0.0', () => {
    console.log(`[CallBreak Server] Running on http://0.0.0.0:${port}`);
    console.log(`[CallBreak Server] Health check ready at http://0.0.0.0:${port}/health`);
  });

  return { app, server, wss };
}

// Auto-start standalone server if executed directly as entrypoint (e.g. node dist/index.js or tsx server/src/index.ts)
const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server/src/index.ts') ||
    process.argv[1].endsWith('server/src/index.js') ||
    process.argv[1].endsWith('dist/index.js') ||
    process.argv[1].endsWith('dist/index.mjs') ||
    Boolean(process.env.STANDALONE_SERVER));

if (isDirectExecution) {
  startStandaloneServer();
}

