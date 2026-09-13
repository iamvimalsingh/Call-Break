/**
 * Future Multiplayer Network Adapter Contract
 * Anticipates future authoritative server synchronization while reusing core game engine.
 * Phase 1 Architecture Foundation
 */

import { GameEvent } from '../../models/events';
import { GameState } from '../../models/gameState';

export enum NetworkConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

export interface MultiplayerRoomInfo {
  readonly roomId: string;
  readonly roomCode: string;
  readonly hostId: string;
  readonly maxPlayers: number;
  readonly currentPlayersCount: number;
  readonly isPrivate: boolean;
}

export interface IMultiplayerAdapter {
  readonly connectionStatus: NetworkConnectionStatus;

  /**
   * Connects to authoritative game server or room.
   */
  connect(serverUrl: string, roomId: string, authToken?: string): Promise<boolean>;

  /**
   * Gracefully disconnects from game server.
   */
  disconnect(): Promise<void>;

  /**
   * Dispatches player action to authoritative server.
   */
  sendAction<T = unknown>(actionType: string, payload: T): Promise<void>;

  /**
   * Subscribes to server-authoritative state sync snapshots.
   */
  onServerStateSync(handler: (syncedState: GameState) => void): () => void;

  /**
   * Subscribes to broadcasted server game events.
   */
  onServerEvent(handler: (event: GameEvent) => void): () => void;
}
