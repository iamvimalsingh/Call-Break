/**
 * Room and Multiplayer Lobby Types for Call Break / Lakdi
 */

import { PlayerPosition } from '../models/player';
import { BotDifficulty } from '../core/contracts/IBotStrategy';

export type GameModeSelection = 'SOLO_BOTS' | 'FRIENDS_ROOM';

export interface RoomPlayerSlot {
  readonly position: PlayerPosition;
  readonly name: string;
  readonly isHost: boolean;
  readonly isHuman: boolean;
  readonly isReady: boolean;
  readonly avatar?: string;
}

export type RoomStatus = 'waiting' | 'ready' | 'starting' | 'in_game';

export interface PrivateRoomState {
  readonly roomCode: string;
  readonly hostName: string;
  readonly status: RoomStatus;
  readonly createdAt: number;
  readonly autoFillBots: boolean;
  readonly botDifficulty: BotDifficulty;
  readonly players: readonly RoomPlayerSlot[];
}

export interface RoomInviteDetails {
  readonly roomCode: string;
  readonly shareUrl: string;
  readonly whatsappShareUrl: string;
  readonly inviteMessage: string;
}
