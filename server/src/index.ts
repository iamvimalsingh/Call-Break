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

export const PORT = Number(process.env.PORT) || 3001;

export function setupWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const roomManager = RoomManager.getInstance();

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

    // Only handle CallBreak WebSocket endpoints (/ws or standalone root)
    if (pathname === '/ws' || pathname === '/ws/' || pathname === '/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (socket: WebSocket, req) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[WebSocket] Client connected: ${clientId} from ${req.socket.remoteAddress}`);

    // Heartbeat setup
    let isAlive = true;
    socket.on('pong', () => {
      isAlive = true;
    });

    socket.on('message', (rawData: string | Buffer) => {
      try {
        const text = rawData.toString('utf8');
        const msg = JSON.parse(text) as ClientMessage;

        switch (msg.type) {
          case 'CREATE_ROOM': {
            const { roomCode, playerName } = msg.payload || {};
            const room = roomManager.createRoom(
              clientId,
              playerName || 'Host Player',
              socket,
              roomCode
            );
            console.log(`[WebSocket] Room created: ${room.roomCode} by ${clientId}`);
            break;
          }

          case 'JOIN_ROOM': {
            const { roomCode, playerName } = msg.payload;
            const result = roomManager.joinRoom(
              roomCode,
              clientId,
              playerName || 'Guest Player',
              socket
            );

            if (!result.success) {
              const errMsg: ServerMessage = {
                type: 'ERROR',
                payload: {
                  code: 'JOIN_FAILED',
                  message: result.error || 'Failed to join room.',
                },
              };
              socket.send(JSON.stringify(errMsg));
            } else {
              console.log(`[WebSocket] Client ${clientId} joined room: ${roomCode}`);
            }
            break;
          }

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
            const result = room.startMatch(clientId, autoFill);

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

          case 'LEAVE_ROOM': {
            roomManager.leaveRoom(clientId);
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
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      roomManager.leaveRoom(clientId);
    });

    socket.on('error', (err) => {
      console.error(`[WebSocket] Error for client ${clientId}:`, err.message);
      roomManager.leaveRoom(clientId);
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
  });

  return wss;
}

/**
 * Creates Express application with basic HTTP health-check routes required by Render.com
 */
export function createServerApp(): express.Express {
  const app = express();
  app.use(express.json());

  // Permissive CORS for health endpoints and cross-origin WebSocket polling
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Basic HTTP health-check routes for Render.com
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'callbreak-server' });
  });

  app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'callbreak-server' });
  });

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
  const app = createServerApp();
  const server = http.createServer(app);
  const wss = setupWebSocketServer(server);

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

