/**
 * Multiplayer Domain Models & WebSocket Contracts
 * Shared between Server (RoomManager/WebSocketServer) and Client (RoomLobbyModal/MultiplayerClient).
 */

import { PlayerPosition } from './player';
import { Card } from './card';
import { GameState } from './gameState';
import { GameEvent } from './events';

export type PlayerSeatId = 'P1' | 'P2' | 'P3' | 'P4';

export interface RoomParticipant {
  id: string;
  playerId?: PlayerSeatId;
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
  totalRounds?: number;
}

export type ConnectionState = 'CONNECTING' | 'OPEN' | 'CLOSED' | 'ERROR';

export interface TurnTimerPayload {
  position: PlayerPosition;
  rawPosition: PlayerPosition;
  remainingSec: number;
  totalSec: number;
  isExtraTime: boolean;
}

export interface ToastPayload {
  message: string;
  type?: 'info' | 'warning' | 'success';
}

export interface JoinRequestSeatOption {
  seat: PlayerPosition;
  seatId?: PlayerSeatId;
  type: 'auto_play' | 'bot';
  label: string;
}

export interface JoinRequestPayload {
  requestId: string;
  playerName: string;
  clientId: string;
  position?: PlayerPosition;
  availableSeats?: JoinRequestSeatOption[];
}

export interface JoinRequestStatusPayload {
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  message?: string;
  requestId?: string;
}

export type ClientMessage =
  | { type: 'CLIENT_READY'; payload?: { roomCode?: string } }
  | { type: 'CREATE_ROOM'; payload: { roomCode?: string; playerName?: string; totalRounds?: number; playerId?: string } }
  | { type: 'JOIN_ROOM'; payload: { roomCode: string; playerName?: string; playerId?: string } }
  | { type: 'RESPOND_JOIN_REQUEST'; payload: { requestId: string; accept: boolean; targetSeat?: PlayerPosition } }
  | { type: 'CONVERT_TO_BOT'; payload: { seat: PlayerPosition } }
  | { type: 'KICK_PLAYER'; payload: { seat: PlayerPosition } }
  | { type: 'SWAP_SEATS'; payload: { seatA: PlayerPosition; seatB: PlayerPosition } }
  | { type: 'START_MATCH'; payload?: { autoFillBots?: boolean; totalRounds?: number } }
  | { type: 'START_GAME'; payload?: { autoFillBots?: boolean; totalRounds?: number } }
  | { type: 'RENAME_PLAYER'; payload: { seat: PlayerPosition; name: string } }
  | { type: 'TRANSFER_HOST'; payload: { targetSeat?: PlayerPosition; targetClientId?: string } }
  | { type: 'SUBMIT_BID'; payload: { bid: number } }
  | { type: 'PLAY_CARD'; payload: { card: Card } }
  | { type: 'NEXT_ROUND' }
  | { type: 'LEAVE_ROOM' }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'ROOM_STATE'; payload: RoomState }
  | { type: 'MATCH_STARTED'; payload: { roomCode: string } }
  | { type: 'GAME_STARTED'; payload: { roomCode: string } }
  | { type: 'MATCH_SYNC'; payload: { roomCode: string; state: GameState; myPosition: PlayerPosition; rawPosition: PlayerPosition } }
  | { type: 'GAME_STATE'; payload: { state: GameState; myPosition: PlayerPosition; rawPosition: PlayerPosition } }
  | { type: 'PLAYER_LEFT'; payload: { clientId: string; playerName: string; position: PlayerPosition } }
  | { type: 'PLAYER_DISCONNECTED'; payload: { seat: PlayerPosition; playerName: string } }
  | { type: 'JOIN_REQUEST'; payload: JoinRequestPayload }
  | { type: 'JOIN_REQUEST_STATUS'; payload: JoinRequestStatusPayload }
  | { type: 'TURN_TIMER'; payload: TurnTimerPayload }
  | { type: 'TURN_TIMER_TICK'; payload: TurnTimerPayload }
  | { type: 'TOAST_NOTIFICATION'; payload: ToastPayload }
  | { type: 'GAME_EVENT'; payload: GameEvent }
  | { type: 'ERROR'; payload: { message: string; code?: string } }
  | { type: 'PONG' };
