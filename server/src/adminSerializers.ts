/**
 * Admin Serializers / DTOs
 * Provides explicit, sanitized serialization for admin inspection endpoints.
 * Guarantees zero leakage of raw WebSockets, Node timers, circular refs, or secrets.
 */

import { GameRoom, POSITION_TO_SEAT, SEAT_ORDER, RoomManager } from './RoomManager';
import { PlayerPosition } from '../../src/models/player';
import { PlayerSeatId } from '../../src/models/multiplayer';
import { GameStatus, RoundScoreRecord } from '../../src/models/gameState';
import { isDatabaseConfigured } from './db/dbPool';
import { PersistenceService } from './db/PersistenceService';

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

/**
 * Serializes server runtime metrics.
 */
export function serializeAdminStats(
  roomManager: RoomManager,
  getActiveConnectionsCount: () => number
): AdminStatsDTO {
  const rooms = roomManager.getAllRooms();
  let humanPlayerCount = 0;
  let botSeatCount = 0;
  const roomsByStatus = { LOBBY: 0, PLAYING: 0, FINISHED: 0 };

  for (const room of rooms) {
    if (room.status === 'LOBBY') roomsByStatus.LOBBY++;
    else if (room.status === 'PLAYING') roomsByStatus.PLAYING++;
    else if (room.status === 'FINISHED') roomsByStatus.FINISHED++;

    const participants = room.getParticipants();
    for (const p of participants) {
      if (p.isBot) {
        botSeatCount++;
      } else {
        humanPlayerCount++;
      }
    }
  }

  const mem = process.memoryUsage();
  return {
    serverUptimeSeconds: Math.floor(process.uptime()),
    activeWebSocketConnections: getActiveConnectionsCount(),
    activeRoomsCount: rooms.length,
    humanPlayerCount,
    botSeatCount,
    roomsByStatus,
    processMemory: {
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
      externalBytes: mem.external,
    },
    serverVersion: process.env.npm_package_version || '1.0.0',
    persistence: {
      enabled: isDatabaseConfigured(),
      connected: PersistenceService.getInstance().isAvailable(),
      driver: isDatabaseConfigured() ? 'postgres' : 'none',
    },
  };
}

/**
 * Serializes a sanitized room summary (DOES NOT EXPOSE PRIVATE CARDS).
 */
export function serializeAdminRoomSummary(room: GameRoom): AdminRoomSummaryDTO {
  const participants = room.getParticipants();
  const hostPart =
    participants.find((p) => p.isHost && !p.isBot) ||
    participants.find((p) => p.isHost) ||
    room.getParticipant(PlayerPosition.SOUTH);

  const hostSeat = hostPart ? POSITION_TO_SEAT[hostPart.position] : 'P1';
  const hostName = hostPart ? hostPart.name : 'Host';

  const controller = room.getController();
  let currentRound = 1;
  let activeTurn: { seat: PlayerSeatId; position: PlayerPosition } | null = null;

  if (controller && room.status === 'PLAYING') {
    const state = controller.getState();
    currentRound = state.currentRound;
    activeTurn = {
      seat: POSITION_TO_SEAT[state.currentPlayer],
      position: state.currentPlayer,
    };
  }

  const seats: AdminRoomSeatSummaryDTO[] = SEAT_ORDER.map((pos) => {
    const p = room.getParticipant(pos);
    const seatId = POSITION_TO_SEAT[pos];
    if (!p) {
      return {
        seat: seatId,
        position: pos,
        name: `Bot: ${pos}`,
        isBot: true,
        isConnected: true,
        isHost: false,
      };
    }
    const isConnected = p.isBot ? true : room.isSocketOpen(p.id);
    return {
      seat: seatId,
      position: pos,
      name: p.name,
      isBot: p.isBot,
      isConnected,
      isHost: p.isHost,
    };
  });

  const humanCount = seats.filter((s) => !s.isBot).length;
  const botCount = seats.filter((s) => s.isBot).length;
  const isJoinable = room.status !== 'FINISHED' && humanCount < 4;

  return {
    roomCode: room.roomCode,
    status: room.status,
    hostSeat,
    hostName,
    currentRound,
    totalRounds: room.totalRounds || 5,
    activeTurn,
    seats,
    isJoinable,
    connectedClientsCount: room.getConnectedClientCount(),
    humanCount,
    botCount,
  };
}

/**
 * Serializes a detailed authoritative debug snapshot for one room.
 * Exposes server-side private cards and game internals for authenticated admin only.
 */
export function serializeAdminRoomDebug(room: GameRoom): AdminRoomDebugDTO {
  const participants = room.getParticipants();
  const hostPart =
    participants.find((p) => p.isHost && !p.isBot) ||
    participants.find((p) => p.isHost) ||
    room.getParticipant(PlayerPosition.SOUTH);

  const hostSeat = hostPart ? POSITION_TO_SEAT[hostPart.position] : 'P1';
  const hostName = hostPart ? hostPart.name : 'Host';
  const hostClientId = room.hostClientId;

  const controller = room.getController();
  const controllerState = controller ? controller.getState() : null;

  let currentRound = 1;
  let dealerSeat: { seat: PlayerSeatId; position: PlayerPosition } | null = null;
  let activeTurnSeat: { seat: PlayerSeatId; position: PlayerPosition } | null = null;
  let phase = room.status === 'LOBBY' ? 'LOBBY' : 'PLAYING';

  if (controllerState) {
    currentRound = controllerState.currentRound;
    dealerSeat = {
      seat: POSITION_TO_SEAT[controllerState.dealer],
      position: controllerState.dealer,
    };
    activeTurnSeat = {
      seat: POSITION_TO_SEAT[controllerState.currentPlayer],
      position: controllerState.currentPlayer,
    };
    phase = controllerState.status;
  }

  // Seats with private cards
  const seats: AdminSeatDebugDTO[] = SEAT_ORDER.map((pos) => {
    const p = room.getParticipant(pos);
    const seatId = POSITION_TO_SEAT[pos];
    const isBot = p ? p.isBot : true;
    const name = p ? p.name : `Bot: ${pos}`;
    const isConnected = isBot ? true : (p ? room.isSocketOpen(p.id) : false);
    const isHost = p ? p.isHost : false;
    const reservationInfo = room.getSeatReservation(pos);
    const clientId = isBot ? null : (p ? p.id : null);

    const playerState = controllerState ? controllerState.players[pos] : null;
    const currentBid = playerState ? playerState.currentBid : null;
    const tricksWon = playerState ? playerState.tricksWon : 0;

    // Private hand cards
    const hand: SanitizedCardDTO[] = playerState
      ? playerState.hand.map((c) => ({ suit: c.suit, rank: c.rank, id: c.id }))
      : [];

    // Played cards for this seat
    const playedCards: SanitizedCardDTO[] = [];
    if (controllerState) {
      for (const trick of controllerState.completedTricks) {
        const pc = trick.cards.find((c) => c.playerPosition === pos);
        if (pc) {
          playedCards.push({ suit: pc.card.suit, rank: pc.card.rank, id: pc.card.id });
        }
      }
      const currentPlay = controllerState.currentTrick.cards.find((c) => c.playerPosition === pos);
      if (currentPlay) {
        playedCards.push({
          suit: currentPlay.card.suit,
          rank: currentPlay.card.rank,
          id: currentPlay.card.id,
        });
      }
    }

    return {
      seat: seatId,
      position: pos,
      name,
      isBot,
      isConnected,
      isHost,
      hasReservation: reservationInfo.hasReservation,
      reservationRemainingMs: reservationInfo.remainingMs,
      clientId,
      currentBid,
      tricksWon,
      privateCards: {
        cardsRemaining: hand.length,
        hand,
        playedCards,
      },
    };
  });

  // Game state details
  let gameState: AdminRoomDebugDTO['gameState'] = null;
  if (controllerState) {
    const currentBids: Record<PlayerPosition, number | null> = {
      [PlayerPosition.SOUTH]: controllerState.players[PlayerPosition.SOUTH]?.currentBid ?? null,
      [PlayerPosition.WEST]: controllerState.players[PlayerPosition.WEST]?.currentBid ?? null,
      [PlayerPosition.NORTH]: controllerState.players[PlayerPosition.NORTH]?.currentBid ?? null,
      [PlayerPosition.EAST]: controllerState.players[PlayerPosition.EAST]?.currentBid ?? null,
    };

    const biddingComplete = Object.values(currentBids).every((b) => b !== null);

    const tricksWon: Record<PlayerPosition, number> = {
      [PlayerPosition.SOUTH]: controllerState.players[PlayerPosition.SOUTH]?.tricksWon ?? 0,
      [PlayerPosition.WEST]: controllerState.players[PlayerPosition.WEST]?.tricksWon ?? 0,
      [PlayerPosition.NORTH]: controllerState.players[PlayerPosition.NORTH]?.tricksWon ?? 0,
      [PlayerPosition.EAST]: controllerState.players[PlayerPosition.EAST]?.tricksWon ?? 0,
    };

    const completedTricks = controllerState.completedTricks.map((t) => {
      const winningPlayedCard = t.cards.find((c) => c.playerPosition === t.winner);
      return {
        trickNumber: t.trickNumber,
        leader: t.leader,
        leadSuit: t.leadSuit,
        cards: t.cards.map((c) => ({
          position: c.playerPosition,
          card: { suit: c.card.suit, rank: c.card.rank, id: c.card.id },
        })),
        winner: t.winner,
        winningCard: winningPlayedCard
          ? {
              suit: winningPlayedCard.card.suit,
              rank: winningPlayedCard.card.rank,
              id: winningPlayedCard.card.id,
            }
          : null,
      };
    });

    const lastCompleted = completedTricks[completedTricks.length - 1] || null;

    gameState = {
      status: controllerState.status,
      phase: controllerState.status,
      biddingComplete,
      currentBids,
      currentTrick: {
        trickNumber: controllerState.currentTrick.trickNumber,
        leader: controllerState.currentTrick.leader,
        leadSuit: controllerState.currentTrick.leadSuit,
        cards: controllerState.currentTrick.cards.map((c) => ({
          position: c.playerPosition,
          card: { suit: c.card.suit, rank: c.card.rank, id: c.card.id },
          isLeading: c.playerPosition === controllerState.currentTrick.leader,
        })),
        winner: controllerState.currentTrick.winner,
      },
      completedTricksCount: completedTricks.length,
      completedTricks,
      tricksWon,
      scores: {
        [PlayerPosition.SOUTH]: controllerState.cumulativeScores[PlayerPosition.SOUTH] ?? 0,
        [PlayerPosition.WEST]: controllerState.cumulativeScores[PlayerPosition.WEST] ?? 0,
        [PlayerPosition.NORTH]: controllerState.cumulativeScores[PlayerPosition.NORTH] ?? 0,
        [PlayerPosition.EAST]: controllerState.cumulativeScores[PlayerPosition.EAST] ?? 0,
      },
      roundScores: controllerState.roundScores,
      lastTrickWinner: lastCompleted ? lastCompleted.winner : null,
      lastWinningCard: lastCompleted ? lastCompleted.winningCard : null,
    };
  }

  // Sanitized timers
  const rawTimer = controller ? controller.getCurrentTimer() : null;
  const activeTimer = rawTimer
    ? {
        type: 'TURN' as const,
        position: rawTimer.position,
        rawPosition: rawTimer.rawPosition,
        remainingSec: rawTimer.remainingSec,
        totalSec: rawTimer.totalSec,
        isExtraTime: rawTimer.isExtraTime,
      }
    : null;

  return {
    room: {
      roomCode: room.roomCode,
      status: room.status,
      hostSeat,
      hostClientId,
      hostName,
      currentRound,
      totalRounds: room.totalRounds || 5,
      dealerSeat,
      activeTurnSeat,
      phase,
    },
    seats,
    gameState,
    timers: {
      activeTimer,
    },
  };
}
