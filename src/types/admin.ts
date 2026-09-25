/**
 * Admin REST API Types & DTOs
 * Matches the authoritative server-side serializers in server/src/adminSerializers.ts
 */

import { PlayerPosition } from '../models/player';
import { PlayerSeatId } from '../models/multiplayer';
import { GameStatus, RoundScoreRecord } from '../models/gameState';

export interface AdminStatsDTO {
  serverUptimeSeconds: number;
  activeWebSocketConnections: number;
  activeRoomsCount: number;
  humanPlayerCount: number;
  botSeatCount: number;
  roomsByStatus: {
    LOBBY: number;
    PLAYING: number;
    FINISHED: number;
  };
  processMemory: {
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
    externalBytes: number;
  };
  serverVersion: string;
  persistence?: {
    enabled: boolean;
    connected: boolean;
    driver: string;
  };
}

export interface AdminRoomSeatSummaryDTO {
  seat: PlayerSeatId;
  position: PlayerPosition;
  name: string;
  isBot: boolean;
  isConnected: boolean;
  isHost: boolean;
}

export interface AdminRoomSummaryDTO {
  roomCode: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  hostSeat: PlayerSeatId;
  hostName: string;
  currentRound: number;
  totalRounds: number;
  activeTurn: {
    seat: PlayerSeatId;
    position: PlayerPosition;
  } | null;
  seats: AdminRoomSeatSummaryDTO[];
  isJoinable: boolean;
  connectedClientsCount: number;
  humanCount: number;
  botCount: number;
}

export interface SanitizedCardDTO {
  suit: string;
  rank: string | number;
  id: string;
}

export interface AdminSeatDebugDTO {
  seat: PlayerSeatId;
  position: PlayerPosition;
  name: string;
  isBot: boolean;
  isConnected: boolean;
  isHost: boolean;
  hasReservation: boolean;
  reservationRemainingMs: number | null;
  clientId: string | null;
  currentBid: number | null;
  tricksWon: number;
  privateCards: {
    cardsRemaining: number;
    hand: SanitizedCardDTO[];
    playedCards: SanitizedCardDTO[];
  };
}

export interface AdminRoomDebugDTO {
  room: {
    roomCode: string;
    status: 'LOBBY' | 'PLAYING' | 'FINISHED';
    hostSeat: PlayerSeatId;
    hostClientId: string;
    hostName: string;
    currentRound: number;
    totalRounds: number;
    dealerSeat: { seat: PlayerSeatId; position: PlayerPosition } | null;
    activeTurnSeat: { seat: PlayerSeatId; position: PlayerPosition } | null;
    phase: string;
  };
  seats: AdminSeatDebugDTO[];
  gameState: {
    status: GameStatus;
    phase: string;
    biddingComplete: boolean;
    currentBids: Record<PlayerPosition, number | null>;
    currentTrick: {
      trickNumber: number;
      leader: PlayerPosition;
      leadSuit: string | null;
      cards: Array<{
        position: PlayerPosition;
        card: SanitizedCardDTO;
        isLeading: boolean;
      }>;
      winner: PlayerPosition | null;
    };
    completedTricksCount: number;
    completedTricks: Array<{
      trickNumber: number;
      leader: PlayerPosition;
      leadSuit: string;
      cards: Array<{
        position: PlayerPosition;
        card: SanitizedCardDTO;
      }>;
      winner: PlayerPosition;
      winningCard: SanitizedCardDTO | null;
    }>;
    tricksWon: Record<PlayerPosition, number>;
    scores: Record<PlayerPosition, number>;
    roundScores: readonly RoundScoreRecord[];
    lastTrickWinner: PlayerPosition | null;
    lastWinningCard: SanitizedCardDTO | null;
  } | null;
  timers: {
    activeTimer: {
      type: 'TURN';
      position: PlayerPosition;
      rawPosition: PlayerPosition;
      remainingSec: number;
      totalSec: number;
      isExtraTime: boolean;
    } | null;
  };
}

export type AdminViewTab = 'overview' | 'rooms' | 'inspect' | 'raw';
