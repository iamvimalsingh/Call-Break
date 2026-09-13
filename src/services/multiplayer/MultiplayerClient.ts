/**
 * Multiplayer Client Service
 * Manages WebSocket connection, message dispatching, and state synchronization with the game server.
 */

import { Card } from '../../models/card';
import { GameEvent } from '../../models/events';
import { GameState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { ClientMessage, RoomState, ServerMessage } from '../../models/multiplayer';

export type RoomStateListener = (roomState: RoomState) => void;
export type GameStateListener = (data: {
  state: GameState;
  myPosition: PlayerPosition;
  rawPosition: PlayerPosition;
}) => void;
export type GameEventListener = (event: GameEvent) => void;
export type ErrorListener = (error: { message: string; code?: string }) => void;
export type GameStartedListener = (roomCode: string) => void;

export class MultiplayerClient {
  private static instance: MultiplayerClient | null = null;
  private socket: WebSocket | null = null;
  private currentRoomState: RoomState | null = null;
  private isConnecting: boolean = false;
  private pendingQueue: ClientMessage[] = [];

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

  public getRoomState(): RoomState | null {
    return this.currentRoomState;
  }

  public connect(): Promise<void> {
    if (this.isConnected()) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.isConnected()) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const defaultWsUrl =
          (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
          window.location.hostname +
          ':3001';

        let wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;

        // Auto-convert http/https prefix to ws/wss if provided from Render dashboard
        if (wsUrl.startsWith('https://')) {
          wsUrl = 'wss://' + wsUrl.slice('https://'.length);
        } else if (wsUrl.startsWith('http://')) {
          wsUrl = 'ws://' + wsUrl.slice('http://'.length);
        }

        // In AI Studio / Cloud Run dev container preview without VITE_WS_URL,
        // external port 3001 is not accessible through Cloud Run reverse proxy.
        // Fall back to same-origin /ws so the in-browser preview works seamlessly.
        if (
          !import.meta.env.VITE_WS_URL &&
          typeof window !== 'undefined' &&
          (window.location.hostname.includes('run.app') ||
            window.location.hostname.includes('ai.studio') ||
            window.location.port === '3000')
        ) {
          wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
        }

        console.log(`[WebSocket] Connecting to CallBreak multiplayer server at ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          this.socket = ws;
          this.isConnecting = false;
          // Flush pending
          while (this.pendingQueue.length > 0) {
            const msg = this.pendingQueue.shift();
            if (msg) this.send(msg);
          }
          resolve();
        };

        ws.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };

        ws.onclose = () => {
          this.socket = null;
          this.isConnecting = false;
        };

        ws.onerror = (err) => {
          this.socket = null;
          this.isConnecting = false;
          reject(err);
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.send({ type: 'LEAVE_ROOM' });
      this.socket.close();
      this.socket = null;
    }
    this.currentRoomState = null;
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
      const msg = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)) as ServerMessage;

      switch (msg.type) {
        case 'ROOM_STATE':
          this.currentRoomState = msg.payload;
          this.roomStateListeners.forEach((fn) => fn(msg.payload));
          break;

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

  public startGame(autoFillBots: boolean = true): void {
    this.send({
      type: 'START_GAME',
      payload: { autoFillBots },
    });
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
