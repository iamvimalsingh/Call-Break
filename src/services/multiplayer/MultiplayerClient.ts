/**
 * Multiplayer Client Service
 * Manages WebSocket connection, message dispatching, and state synchronization with the game server.
 */

import { Card } from '../../models/card';
import { GameEvent } from '../../models/events';
import { GameState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { ClientMessage, ConnectionState, RoomState, ServerMessage } from '../../models/multiplayer';

export type RoomStateListener = (roomState: RoomState) => void;
export type GameStateListener = (data: {
  state: GameState;
  myPosition: PlayerPosition;
  rawPosition: PlayerPosition;
}) => void;
export type GameEventListener = (event: GameEvent) => void;
export type ErrorListener = (error: { message: string; code?: string }) => void;
export type GameStartedListener = (roomCode: string) => void;
export type ConnectionStateListener = (state: ConnectionState, error: string | null) => void;

/**
 * Cleans and sanitizes WebSocket URLs by stripping markdown brackets, parentheses,
 * duplicate URLs, and extracting pure domains.
 *
 * Example: "[https://call-break-778p.onrender.com](https://call-break-778p.onrender.com)"
 * resolves cleanly to "wss://call-break-778p.onrender.com/ws".
 */
export function cleanAndSanitizeWebSocketUrl(rawUrl?: string): string {
  const defaultFallback = 'wss://call-break-778p.onrender.com/ws';

  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      try {
        return window.location.origin.replace(/^http/, 'ws') + '/ws';
      } catch {
        return defaultFallback;
      }
    }
    return defaultFallback;
  }

  try {
    let input = rawUrl.trim();

    // 1. Strip markdown link syntax: [text](url) -> extract url
    const mdMatch = input.match(/\[([^\]]*)\]\(([^)]+)\)/);
    if (mdMatch) {
      input = mdMatch[2].trim() || mdMatch[1].trim();
    }

    // 2. Strip any lingering brackets, parentheses, angle brackets, quotes, backticks
    input = input.replace(/[\[\]\(\)\<\>"`']/g, '').trim();

    // 3. Extract the first valid URL token if duplicate or concatenated
    const urlMatch = input.match(/(?:https?|wss?):\/\/[^\s\/$.?#].[^\s]*/i);
    if (urlMatch) {
      input = urlMatch[0].trim();
    }

    // 4. Extract pure domain
    let cleaned = input.replace(/^(?:https?|wss?):\/\//i, '').trim();
    cleaned = cleaned.replace(/^\/+/, '');
    const pathIndex = cleaned.indexOf('/');
    const domain = (pathIndex !== -1 ? cleaned.substring(0, pathIndex) : cleaned).trim();

    if (!domain) {
      return defaultFallback;
    }

    // Special case for CallBreak Render backend host
    if (domain.includes('call-break-778p')) {
      return 'wss://call-break-778p.onrender.com/ws';
    }

    const isLocal = domain.includes('localhost') || domain.includes('127.0.0.1');
    const scheme = isLocal ? 'ws://' : 'wss://';
    return `${scheme}${domain}/ws`;
  } catch (err) {
    console.error('[WebSocket] Error sanitizing URL, falling back safely to default:', err);
    return defaultFallback;
  }
}

export class MultiplayerClient {
  private static instance: MultiplayerClient | null = null;
  private socket: WebSocket | null = null;
  private currentRoomState: RoomState | null = null;
  private isConnecting: boolean = false;
  private pendingQueue: ClientMessage[] = [];

  private connectionState: ConnectionState = 'CLOSED';
  private connectionError: string | null = null;
  private connectionStateListeners: Set<ConnectionStateListener> = new Set();

  private roomStateListeners: Set<RoomStateListener> = new Set();
  private gameStateListeners: Set<GameStateListener> = new Set();
  private gameEventListeners: Set<GameEventListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private gameStartedListeners: Set<GameStartedListener> = new Set();

  public static getInstance(): MultiplayerClient {
    if (!MultiplayerClient.instance) {
      MultiplayerClient.instance = new MultiplayerClient();
    }
    return MultiplayerClient.instance;
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): ConnectionState {
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) return 'OPEN';
      if (this.socket.readyState === WebSocket.CONNECTING) return 'CONNECTING';
      if (this.socket.readyState === WebSocket.CLOSING || this.socket.readyState === WebSocket.CLOSED) return 'CLOSED';
    }
    return this.connectionState;
  }

  public getConnectionError(): string | null {
    return this.connectionError;
  }

  public onConnectionState(listener: ConnectionStateListener): () => void {
    this.connectionStateListeners.add(listener);
    listener(this.getConnectionState(), this.connectionError);
    return () => this.connectionStateListeners.delete(listener);
  }

  private setConnectionState(state: ConnectionState, error: string | null = null): void {
    this.connectionState = state;
    this.connectionError = error;
    this.connectionStateListeners.forEach((fn) => fn(state, error));
  }

  public getRoomState(): RoomState | null {
    return this.currentRoomState;
  }

  public connect(): Promise<void> {
    if (this.isConnected()) {
      this.setConnectionState('OPEN', null);
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.isConnected()) {
            clearInterval(check);
            resolve();
          } else if (this.connectionState === 'ERROR' || this.connectionState === 'CLOSED') {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
    }

    this.isConnecting = true;
    this.setConnectionState('CONNECTING', null);

    return new Promise((resolve, reject) => {
      try {
        const rawWsUrl = import.meta.env.VITE_WS_URL;
        const wsUrl = cleanAndSanitizeWebSocketUrl(rawWsUrl);

        console.log(`[WebSocket] Connecting to CallBreak multiplayer server at: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = (event) => {
          console.log(`[WebSocket] onopen: Connected successfully to ${wsUrl}`, event);
          this.socket = ws;
          this.isConnecting = false;
          this.setConnectionState('OPEN', null);

          // Flush pending queue
          while (this.pendingQueue.length > 0) {
            const msg = this.pendingQueue.shift();
            if (msg) this.send(msg);
          }
          resolve();
        };

        ws.onmessage = (event) => {
          console.log(
            '[WebSocket] onmessage: received',
            typeof event.data === 'string' ? event.data.slice(0, 120) : event.data
          );
          this.handleServerMessage(event.data);
        };

        ws.onerror = (err) => {
          const errMsg = `WebSocket connection error on ${wsUrl}`;
          console.error('[WebSocket] onerror:', errMsg, err);
          this.socket = null;
          this.isConnecting = false;
          this.setConnectionState('ERROR', errMsg);
          reject(err);
        };

        ws.onclose = (event) => {
          const reason =
            event.reason ||
            (event.code === 1000
              ? 'Connection closed normally'
              : `Server connection closed (code: ${event.code})`);
          console.warn(`[WebSocket] onclose: code=${event.code}, reason=${event.reason || 'none'}`);
          this.socket = null;
          this.isConnecting = false;
          if (this.connectionState !== 'ERROR') {
            this.setConnectionState('CLOSED', reason);
          }
        };
      } catch (err: any) {
        this.isConnecting = false;
        const msg = err?.message || 'Failed to initialize WebSocket';
        console.error('[WebSocket] exception during connect():', err);
        this.setConnectionState('ERROR', msg);
        reject(err);
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.send({ type: 'LEAVE_ROOM' });
      this.socket.close(1000, 'User left room');
      this.socket = null;
    }
    this.currentRoomState = null;
    this.setConnectionState('CLOSED', null);
  }

  private send(message: ClientMessage): void {
    if (this.isConnected() && this.socket) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.pendingQueue.push(message);
      this.connect().catch((err) => {
        console.error('Failed to auto-connect to multiplayer server:', err);
      });
    }
  }

  private handleServerMessage(data: string | ArrayBuffer): void {
    try {
      const msg = JSON.parse(
        typeof data === 'string' ? data : new TextDecoder().decode(data)
      ) as ServerMessage;

      switch (msg.type) {
        case 'ROOM_STATE':
          this.currentRoomState = msg.payload;
          this.roomStateListeners.forEach((fn) => fn(msg.payload));
          break;

        case 'MATCH_STARTED':
        case 'GAME_STARTED':
          this.gameStartedListeners.forEach((fn) => fn(msg.payload.roomCode));
          break;

        case 'GAME_STATE':
          this.gameStateListeners.forEach((fn) => fn(msg.payload));
          break;

        case 'GAME_EVENT':
          this.gameEventListeners.forEach((fn) => fn(msg.payload));
          break;

        case 'ERROR':
          this.errorListeners.forEach((fn) => fn(msg.payload));
          break;

        case 'PONG':
          break;
      }
    } catch (err) {
      console.error('Failed to parse incoming server message:', err);
    }
  }

  // Room Actions
  public createRoom(playerName: string = 'Host Player', roomCode?: string): void {
    this.send({
      type: 'CREATE_ROOM',
      payload: { playerName, roomCode },
    });
  }

  public joinRoom(roomCode: string, playerName: string = 'Guest Player'): void {
    this.send({
      type: 'JOIN_ROOM',
      payload: { roomCode, playerName },
    });
  }

  public startMatch(autoFillBots: boolean = true): void {
    this.send({
      type: 'START_MATCH',
      payload: { autoFillBots },
    });
  }

  public startGame(autoFillBots: boolean = true): void {
    this.startMatch(autoFillBots);
  }

  public submitBid(bid: number): void {
    this.send({
      type: 'SUBMIT_BID',
      payload: { bid },
    });
  }

  public playCard(card: Card): void {
    this.send({
      type: 'PLAY_CARD',
      payload: { card },
    });
  }

  public nextRound(): void {
    this.send({
      type: 'NEXT_ROUND',
    });
  }

  public leaveRoom(): void {
    this.send({
      type: 'LEAVE_ROOM',
    });
    this.currentRoomState = null;
  }

  // Subscriptions
  public onRoomState(listener: RoomStateListener): () => void {
    this.roomStateListeners.add(listener);
    if (this.currentRoomState) {
      listener(this.currentRoomState);
    }
    return () => this.roomStateListeners.delete(listener);
  }

  public onGameState(listener: GameStateListener): () => void {
    this.gameStateListeners.add(listener);
    return () => this.gameStateListeners.delete(listener);
  }

  public onGameEvent(listener: GameEventListener): () => void {
    this.gameEventListeners.add(listener);
    return () => this.gameEventListeners.delete(listener);
  }

  public onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public onGameStarted(listener: GameStartedListener): () => void {
    this.gameStartedListeners.add(listener);
    return () => this.gameStartedListeners.delete(listener);
  }
}

export const sharedMultiplayerClient = MultiplayerClient.getInstance();
