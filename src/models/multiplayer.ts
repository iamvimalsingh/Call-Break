/**
 * Multiplayer Domain Models & WebSocket Contracts
 * Shared between Server (RoomManager/WebSocketServer) and Client (RoomLobbyModal/MultiplayerClient).
 */

import { PlayerPosition } from './player';
import { Card } from './card';
import { GameState } from './gameState';
import { GameEvent } from './events';

export interface RoomParticipant {
  id: string;
  name: string;
  position: PlayerPosition;
  isHost: boolean;
  isReady: boolean;
  isBot: boolean;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  players: RoomParticipant[];
  assignedPosition?: PlayerPosition;
  myClientId?: string;
  autoFillBots: boolean;
}

export type ClientMessage =
  | { type: 'CREATE_ROOM'; payload: { roomCode?: string; playerName?: string } }
  | { type: 'JOIN_ROOM'; payload: { roomCode: string; playerName?: string } }
  | { type: 'START_GAME'; payload: { autoFillBots?: boolean } }
  | { type: 'SUBMIT_BID'; payload: { bid: number } }
  | { type: 'PLAY_CARD'; payload: { card: Card } }
  | { type: 'NEXT_ROUND' }
  | { type: 'LEAVE_ROOM' }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'ROOM_STATE'; payload: RoomState }
  | { type: 'GAME_STARTED'; payload: { roomCode: string } }
  | { type: 'GAME_STATE'; payload: { state: GameState; myPosition: PlayerPosition; rawPosition: PlayerPosition } }
  | { type: 'GAME_EVENT'; payload: GameEvent }
  | { type: 'ERROR'; payload: { message: string; code?: string } }
  | { type: 'PONG' };
