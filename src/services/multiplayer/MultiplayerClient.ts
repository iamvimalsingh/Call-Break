/**
 * Multiplayer Client Service
 * Manages WebSocket connection, message dispatching, and state synchronization with the game server.
 */

import { Card } from '../../models/card';
import { GameEvent } from '../../models/events';
import { GameState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import {
  ClientMessage,
  ConnectionState,
  JoinRequestPayload,
  JoinRequestStatusPayload,
  RoomState,
  ServerMessage,
  ToastPayload,
  TurnTimerPayload,
} from '../../models/multiplayer';

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
export type TurnTimerListener = (payload: TurnTimerPayload) => void;
export type ToastListener = (payload: ToastPayload) => void;
export type PlayerLeftListener = (data: {
  clientId: string;
  playerName: string;
  position: PlayerPosition;
}) => void;
export type PlayerDisconnectedListener = (data: {
  seat: PlayerPosition;
  playerName: string;
}) => void;
export type JoinRequestListener = (payload: JoinRequestPayload) => void;
export type JoinRequestStatusListener = (payload: JoinRequestStatusPayload) => void;

const PLAYER_ID_STORAGE_KEY = 'cb_player_id';
const ACTIVE_TABLE_STORAGE_KEY = 'cb_active_table_id';
const CONFIRMED_SEAT_STORAGE_KEY = 'cb_confirmed_seat';

/**
 * Returns the currently active table ID persisted in localStorage, if any.
 */
export function getActiveTableId(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(ACTIVE_TABLE_STORAGE_KEY);
      return val && val.trim().length > 0 ? val.trim().toUpperCase() : null;
    }
  } catch {}
  return null;
}

/**
 * Persists or clears the active table ID in localStorage.
 */
export function setActiveTableId(tableId: string | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (tableId && tableId.trim().length > 0) {
        localStorage.setItem(ACTIVE_TABLE_STORAGE_KEY, tableId.trim().toUpperCase());
      } else {
        localStorage.removeItem(ACTIVE_TABLE_STORAGE_KEY);
      }
    }
  } catch {}
}

/**
 * Returns the confirmed player seat persisted in localStorage, if any.
 */
export function getConfirmedSeat(): PlayerPosition | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(CONFIRMED_SEAT_STORAGE_KEY);
      return (val as PlayerPosition) || null;
    }
  } catch {}
  return null;
}

/**
 * Persists or clears the confirmed player seat in localStorage.
 */
export function setConfirmedSeat(seat: PlayerPosition | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (seat) {
        localStorage.setItem(CONFIRMED_SEAT_STORAGE_KEY, seat);
      } else {
        localStorage.removeItem(CONFIRMED_SEAT_STORAGE_KEY);
      }
    }
  } catch {}
}

/**
 * Returns the stable persistent player ID from localStorage (cb_player_id),
 * generating and persisting a new UUID if one does not exist yet.
 */
export function getOrCreatePersistentPlayerId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
      if (existing && existing.trim().length > 0) {
        return existing.trim();
      }
    }
  } catch {
    // localStorage may throw in restricted sandboxed iframes
  }

  let newId: string;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    newId = crypto.randomUUID();
  } else {
    newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PLAYER_ID_STORAGE_KEY, newId);
    }
  } catch {
    // ignore
  }

  return newId;
}

/**
 * Resolves the WebSocket URL based on the active application host.
 * Converts http/https origin to ws/wss and appends /ws path.
 */
export function getActiveHostWebSocketUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const origin = window.location.origin;
      if (origin && origin.startsWith('http')) {
        return origin.replace(/^http/, 'ws') + '/ws';
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      if (host) {
        return `${protocol}//${host}/ws`;
      }
    } catch {
      // fallback
    }
  }
  return 'ws://localhost:3000/ws';
}

/**
 * Cleans and sanitizes WebSocket URLs.
 * When VITE_WS_URL is not provided: prefers active host (window.location.origin -> ws/wss + /ws).
 * Does NOT default to the old external Render URL.
 * Uses explicit VITE_WS_URL when it is provided.
 */
export function cleanAndSanitizeWebSocketUrl(rawUrl?: string): string {
  const activeHostFallback = getActiveHostWebSocketUrl();

  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return activeHostFallback;
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
      return activeHostFallback;
    }

    const isLocal = domain.includes('localhost') || domain.includes('127.0.0.1');
    const scheme = isLocal ? 'ws://' : 'wss://';
    return `${scheme}${domain}/ws`;
  } catch (err) {
    console.error('[WebSocket] Error sanitizing URL, falling back safely to active host:', err);
    return activeHostFallback;
  }
}

export class MultiplayerClient {
  private static instance: MultiplayerClient | null = null;
  private socket: WebSocket | null = null;
  private currentRoomState: RoomState | null = null;
  private isConnecting: boolean = false;
  private pendingQueue: ClientMessage[] = [];

  private playerId: string = getOrCreatePersistentPlayerId();
  private connectionState: ConnectionState = 'CLOSED';
  private connectionError: string | null = null;
  private connectionStateListeners: Set<ConnectionStateListener> = new Set();
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;
  private isManualDisconnect: boolean = false;
  private keepaliveTimer: any = null;

  private roomStateListeners: Set<RoomStateListener> = new Set();
  private gameStateListeners: Set<GameStateListener> = new Set();
  private gameEventListeners: Set<GameEventListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private gameStartedListeners: Set<GameStartedListener> = new Set();
  private turnTimerListeners: Set<TurnTimerListener> = new Set();
  private toastListeners: Set<ToastListener> = new Set();
  private playerLeftListeners: Set<PlayerLeftListener> = new Set();
  private playerDisconnectedListeners: Set<PlayerDisconnectedListener> = new Set();
  private joinRequestListeners: Set<JoinRequestListener> = new Set();
  private joinRequestStatusListeners: Set<JoinRequestStatusListener> = new Set();

  public static getInstance(): MultiplayerClient {
    if (!MultiplayerClient.instance) {
      MultiplayerClient.instance = new MultiplayerClient();
    }
    return MultiplayerClient.instance;
  }

  public getPlayerId(): string {
    return this.playerId;
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public isHost(): boolean {
    if (!this.currentRoomState) return false;
    return this.currentRoomState.players.find((p) => p.id === this.currentRoomState?.myClientId)?.isHost === true;
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
    this.isManualDisconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.isConnected()) {
      if (this.connectionState !== 'OPEN') {
        this.setConnectionState('OPEN', null);
      }
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.isConnected() || this.connectionState === 'ERROR' || this.connectionState === 'CLOSED') {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
    }

    this.isConnecting = true;
    this.setConnectionState('CONNECTING', null);

    return new Promise((resolve) => {
      let timeoutId: any = null;
      let completed = false;

      const finish = (finalState: ConnectionState, reason: string | null = null) => {
        if (completed) return;
        completed = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        this.isConnecting = false;
        if (finalState === 'OPEN') {
          this.reconnectAttempts = 0;
          this.setConnectionState('OPEN', null);
        } else {
          this.socket = null;
          this.setConnectionState(finalState, reason);
        }
        // Always resolve so callers awaiting connect() never receive unhandled rejections
        resolve();
      };

      // 10s safe connection timeout guard
      timeoutId = setTimeout(() => {
        console.warn('[WebSocket] Connection attempt timed out after 10s. Setting state to CLOSED.');
        if (this.socket) {
          try {
            this.socket.close();
          } catch {
            // ignore
          }
          this.socket = null;
        }
        finish('CLOSED', 'Connection timed out after 10s');
      }, 10000);

      try {
        const rawWsUrl = import.meta.env.VITE_WS_URL;
        const wsUrl = cleanAndSanitizeWebSocketUrl(rawWsUrl);

        console.log(`[WebSocket] Connecting to CallBreak multiplayer server at: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = (event) => {
          console.log(`[WebSocket] onopen: Connected successfully to ${wsUrl}`, event);
          this.socket = ws;
          this.reconnectAttempts = 0;
          this.startKeepalive();

          // Flush pending queue
          while (this.pendingQueue.length > 0) {
            const msg = this.pendingQueue.shift();
            if (msg) this.send(msg);
          }

          // Automatically resume active table session if persisted on browser reload
          const activeTable = getActiveTableId();
          if (activeTable) {
            console.log(`[WebSocket] Attempting to auto-resume active table session: ${activeTable}`);
            this.send({
              type: 'JOIN_ROOM',
              payload: {
                roomCode: activeTable,
                playerId: this.playerId,
                playerName: 'Player',
              },
            });
          }

          finish('OPEN');
        };

        ws.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };

        ws.onerror = (err) => {
          const errMsg = `WebSocket connection warning on ${wsUrl}`;
          console.warn('[WebSocket] onerror (handled gracefully):', errMsg, err);
          this.stopKeepalive();
          finish('CLOSED', errMsg);
        };

        ws.onclose = (event) => {
          const reason =
            event.reason ||
            (event.code === 1000
              ? 'Connection closed normally'
              : `Server connection closed (code: ${event.code})`);
          console.warn(`[WebSocket] onclose: code=${event.code}, reason=${reason}`);
          this.stopKeepalive();
          finish('CLOSED', reason);

          // Automatic reconnect with backoff when disconnected unexpectedly
          if (!this.isManualDisconnect) {
            const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
            this.reconnectAttempts++;
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(() => {});
            }, delay);
          }
        };
      } catch (err: any) {
        console.warn('[WebSocket] Exception during connect() handled safely:', err);
        finish('CLOSED', err?.message || 'Failed to initialize WebSocket');
      }
    });
  }

  public disconnect(): void {
    this.isManualDisconnect = true;
    this.reconnectAttempts = 0;
    this.stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.send({ type: 'LEAVE_ROOM' });
        this.socket.close(1000, 'User left room');
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.currentRoomState = null;
    this.setConnectionState('CLOSED', null);
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.isConnected() && this.socket) {
        try {
          this.socket.send(JSON.stringify({ type: 'PING' }));
        } catch {
          // ignore
        }
      }
    }, 20000); // 20-second application-level keepalive suitable for Render Free tier
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private send(message: ClientMessage): void {
    if (this.isConnected() && this.socket) {
      try {
        this.socket.send(JSON.stringify(message));
      } catch (err) {
        console.warn('[WebSocket] Send failed gracefully:', err);
      }
    } else {
      if (message.type !== 'CREATE_ROOM' && message.type !== 'JOIN_ROOM') {
        this.pendingQueue.push(message);
      }
      this.connect().catch((err) => {
        console.warn('[WebSocket] Auto-connect note:', err);
      });
    }
  }

  private handleServerMessage(data: string | ArrayBuffer): void {
    try {
      const msg = JSON.parse(
        typeof data === 'string' ? data : new TextDecoder().decode(data)
      ) as ServerMessage;

      const safeCall = (fn: Function, arg: any) => {
        try {
          fn(arg);
        } catch (listenerErr) {
          console.warn('[WebSocket] Trapped listener error safely:', listenerErr);
        }
      };

      switch (msg.type) {
        case 'ROOM_STATE':
          this.currentRoomState = msg.payload;
          if (msg.payload?.roomCode) {
            setActiveTableId(msg.payload.roomCode);
          }
          if (msg.payload?.assignedPosition) {
            setConfirmedSeat(msg.payload.assignedPosition);
          }
          this.roomStateListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'MATCH_STARTED':
        case 'GAME_STARTED':
          if (msg.payload?.roomCode) {
            setActiveTableId(msg.payload.roomCode);
          }
          this.gameStartedListeners.forEach((fn) => safeCall(fn, msg.payload.roomCode));
          break;

        case 'MATCH_SYNC':
          if (msg.payload?.roomCode) {
            setActiveTableId(msg.payload.roomCode);
          }
          if (msg.payload?.rawPosition) {
            setConfirmedSeat(msg.payload.rawPosition);
          }
          this.gameStartedListeners.forEach((fn) => safeCall(fn, msg.payload.roomCode));
          this.gameStateListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'GAME_STATE':
          this.gameStateListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'TURN_TIMER':
        case 'TURN_TIMER_TICK':
          this.turnTimerListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'TOAST_NOTIFICATION':
          this.toastListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'PLAYER_LEFT':
          this.playerLeftListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'PLAYER_DISCONNECTED':
          this.playerDisconnectedListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'JOIN_REQUEST':
          this.joinRequestListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'JOIN_REQUEST_STATUS':
          this.joinRequestStatusListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'GAME_EVENT':
          this.gameEventListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'ERROR':
          if (
            msg.payload?.code === 'ROOM_NOT_FOUND' ||
            msg.payload?.code === 'TABLE_NOT_ACTIVE' ||
            msg.payload?.message?.toLowerCase().includes('no active table')
          ) {
            setActiveTableId(null);
            setConfirmedSeat(null);
          }
          this.errorListeners.forEach((fn) => safeCall(fn, msg.payload));
          break;

        case 'PONG':
          break;
      }
    } catch (err) {
      console.warn('Failed to parse incoming server message safely:', err);
    }
  }

  // Room Actions
  public createRoom(playerName: string = 'Host', roomCode?: string, totalRounds: number = 5): boolean {
    if (this.getConnectionState() !== 'OPEN') {
      console.warn('[MultiplayerClient] Cannot create table: WebSocket connection is not OPEN.');
      this.errorListeners.forEach((fn) => {
        try {
          fn({ message: 'Cannot create table: Server connection is offline or reconnecting.', code: 'CONNECTION_NOT_OPEN' });
        } catch {}
      });
      return false;
    }
    this.send({
      type: 'CREATE_ROOM',
      payload: { playerName, roomCode, totalRounds, playerId: this.playerId },
    });
    return true;
  }

  public joinRoom(roomCode: string, playerName: string = 'Guest'): boolean {
    if (this.getConnectionState() !== 'OPEN') {
      console.warn('[MultiplayerClient] Cannot join table: WebSocket connection is not OPEN.');
      this.errorListeners.forEach((fn) => {
        try {
          fn({ message: 'Cannot join table: Server connection is offline or reconnecting.', code: 'CONNECTION_NOT_OPEN' });
        } catch {}
      });
      return false;
    }
    this.send({
      type: 'JOIN_ROOM',
      payload: { roomCode, playerName, playerId: this.playerId },
    });
    return true;
  }

  public respondJoinRequest(requestId: string, accept: boolean, targetSeat?: PlayerPosition): void {
    this.send({
      type: 'RESPOND_JOIN_REQUEST',
      payload: { requestId, accept, targetSeat },
    });
  }

  public convertToBot(seat: PlayerPosition): void {
    this.send({
      type: 'CONVERT_TO_BOT',
      payload: { seat },
    });
  }

  public kickPlayer(seat: PlayerPosition): void {
    this.send({
      type: 'KICK_PLAYER',
      payload: { seat },
    });
  }

  public swapSeats(seatA: PlayerPosition, seatB: PlayerPosition): void {
    this.send({
      type: 'SWAP_SEATS',
      payload: { seatA, seatB },
    });
  }

  public startMatch(autoFillBots: boolean = true, totalRounds: number = 5): void {
    this.send({
      type: 'START_MATCH',
      payload: { autoFillBots, totalRounds },
    });
  }

  public startGame(autoFillBots: boolean = true, totalRounds: number = 5): void {
    this.startMatch(autoFillBots, totalRounds);
  }

  public renameSeat(seat: PlayerPosition, name: string): void {
    this.send({
      type: 'RENAME_PLAYER',
      payload: { seat, name },
    });
  }

  public transferHost(targetSeat?: PlayerPosition, targetClientId?: string): void {
    this.send({
      type: 'TRANSFER_HOST',
      payload: { targetSeat, targetClientId },
    });
  }

  public rematch(): void {
    this.startMatch(true);
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
    setActiveTableId(null);
    setConfirmedSeat(null);
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

  public onTurnTimer(listener: TurnTimerListener): () => void {
    this.turnTimerListeners.add(listener);
    return () => this.turnTimerListeners.delete(listener);
  }

  public onToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  public onPlayerLeft(listener: PlayerLeftListener): () => void {
    this.playerLeftListeners.add(listener);
    return () => this.playerLeftListeners.delete(listener);
  }

  public onPlayerDisconnected(listener: PlayerDisconnectedListener): () => void {
    this.playerDisconnectedListeners.add(listener);
    return () => this.playerDisconnectedListeners.delete(listener);
  }

  public onJoinRequest(listener: JoinRequestListener): () => void {
    this.joinRequestListeners.add(listener);
    return () => this.joinRequestListeners.delete(listener);
  }

  public onJoinRequestStatus(listener: JoinRequestStatusListener): () => void {
    this.joinRequestStatusListeners.add(listener);
    return () => this.joinRequestStatusListeners.delete(listener);
  }
}

export const sharedMultiplayerClient = MultiplayerClient.getInstance();
