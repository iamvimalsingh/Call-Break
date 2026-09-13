/**
 * Room Manager
 * Manages 6-digit game rooms, player seating, bot auto-fill, and multiplayer game routing.
 */

import { WebSocket } from 'ws';
import { PlayerPosition } from '../../src/models/player';
import { RoomParticipant, RoomState, ServerMessage } from '../../src/models/multiplayer';
import { AuthoritativeGameController, PlayerSetupInfo } from './AuthoritativeGameController';
import { Card } from '../../src/models/card';

const SEAT_ORDER: readonly PlayerPosition[] = [
  PlayerPosition.SOUTH,
  PlayerPosition.WEST,
  PlayerPosition.NORTH,
  PlayerPosition.EAST,
];

export class GameRoom {
  public readonly roomCode: string;
  public hostClientId: string;
  public status: 'LOBBY' | 'PLAYING' | 'FINISHED' = 'LOBBY';
  public autoFillBots: boolean = true;
  
  // Position to participant
  private players = new Map<PlayerPosition, RoomParticipant>();
  // Client ID to WebSocket
  private clientSockets = new Map<string, WebSocket>();
  // Client ID to Position
  private clientPositions = new Map<string, PlayerPosition>();

  private controller: AuthoritativeGameController | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private unsubscribeState: (() => void) | null = null;

  constructor(roomCode: string, hostClientId: string, hostName: string, hostSocket: WebSocket) {
    this.roomCode = roomCode;
    this.hostClientId = hostClientId;

    // Host is assigned South
    const hostParticipant: RoomParticipant = {
      id: hostClientId,
      name: hostName || 'Player 1 (Host)',
      position: PlayerPosition.SOUTH,
      isHost: true,
      isReady: true,
      isBot: false,
    };

    this.players.set(PlayerPosition.SOUTH, hostParticipant);
    this.clientSockets.set(hostClientId, hostSocket);
    this.clientPositions.set(hostClientId, PlayerPosition.SOUTH);
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getConnectedClientCount(): number {
    return this.clientSockets.size;
  }

  public hasClient(clientId: string): boolean {
    return this.clientSockets.has(clientId);
  }

  public getClientPosition(clientId: string): PlayerPosition | undefined {
    return this.clientPositions.get(clientId);
  }

  public addPlayer(
    clientId: string,
    playerName: string,
    socket: WebSocket
  ): { success: boolean; position?: PlayerPosition; error?: string } {
    if (this.status !== 'LOBBY') {
      return { success: false, error: 'Match has already started in this room.' };
    }

    // Check if already in room
    if (this.clientSockets.has(clientId)) {
      this.clientSockets.set(clientId, socket);
      return { success: true, position: this.clientPositions.get(clientId) };
    }

    // Find next available seat in SEAT_ORDER (West, North, East)
    let openPosition: PlayerPosition | null = null;
    for (const pos of SEAT_ORDER) {
      if (!this.players.has(pos)) {
        openPosition = pos;
        break;
      }
    }

    if (!openPosition) {
      return { success: false, error: 'Room is already full (4/4 players).' };
    }

    const participant: RoomParticipant = {
      id: clientId,
      name: playerName || `Player ${this.players.size + 1}`,
      position: openPosition,
      isHost: false,
      isReady: true,
      isBot: false,
    };

    this.players.set(openPosition, participant);
    this.clientSockets.set(clientId, socket);
    this.clientPositions.set(clientId, openPosition);

    this.broadcastRoomState();
    return { success: true, position: openPosition };
  }

  public removeClient(clientId: string): void {
    const pos = this.clientPositions.get(clientId);
    this.clientSockets.delete(clientId);
    this.clientPositions.delete(clientId);

    if (this.status === 'LOBBY' && pos) {
      this.players.delete(pos);

      // If host left, transfer host to next human or South
      if (clientId === this.hostClientId && this.players.size > 0) {
        const remaining = Array.from(this.players.values())[0];
        remaining.isHost = true;
        this.hostClientId = remaining.id;
      }

      this.broadcastRoomState();
    }
  }

  public startMatch(
    requestingClientId: string,
    autoFillBots: boolean
  ): { success: boolean; error?: string } {
    if (requestingClientId !== this.hostClientId) {
      return { success: false, error: 'Only the room host can start the table.' };
    }

    if (this.status === 'PLAYING') {
      return { success: false, error: 'Game is already in progress.' };
    }

    this.autoFillBots = autoFillBots;

    // Fill missing seats with Bots
    const botNames: Record<PlayerPosition, string> = {
      [PlayerPosition.SOUTH]: 'Bot (South)',
      [PlayerPosition.WEST]: 'Bot (West)',
      [PlayerPosition.NORTH]: 'Bot (North)',
      [PlayerPosition.EAST]: 'Bot (East)',
    };

    for (const pos of SEAT_ORDER) {
      if (!this.players.has(pos)) {
        this.players.set(pos, {
          id: `bot_${pos}`,
          name: botNames[pos],
          position: pos,
          isHost: false,
          isReady: true,
          isBot: true,
        });
      }
    }

    this.status = 'PLAYING';

    // Broadcast MATCH_STARTED and GAME_STARTED and updated room state
    this.broadcast({
      type: 'MATCH_STARTED',
      payload: { roomCode: this.roomCode },
    });
    this.broadcast({
      type: 'GAME_STARTED',
      payload: { roomCode: this.roomCode },
    });
    this.broadcastRoomState();

    // Prepare player setup info
    const playerConfigs: Record<PlayerPosition, PlayerSetupInfo> = {
      [PlayerPosition.SOUTH]: {
        id: this.players.get(PlayerPosition.SOUTH)!.id,
        name: this.players.get(PlayerPosition.SOUTH)!.name,
        isBot: this.players.get(PlayerPosition.SOUTH)!.isBot,
        position: PlayerPosition.SOUTH,
      },
      [PlayerPosition.WEST]: {
        id: this.players.get(PlayerPosition.WEST)!.id,
        name: this.players.get(PlayerPosition.WEST)!.name,
        isBot: this.players.get(PlayerPosition.WEST)!.isBot,
        position: PlayerPosition.WEST,
      },
      [PlayerPosition.NORTH]: {
        id: this.players.get(PlayerPosition.NORTH)!.id,
        name: this.players.get(PlayerPosition.NORTH)!.name,
        isBot: this.players.get(PlayerPosition.NORTH)!.isBot,
        position: PlayerPosition.NORTH,
      },
      [PlayerPosition.EAST]: {
        id: this.players.get(PlayerPosition.EAST)!.id,
        name: this.players.get(PlayerPosition.EAST)!.name,
        isBot: this.players.get(PlayerPosition.EAST)!.isBot,
        position: PlayerPosition.EAST,
      },
    };

    // Initialize Authoritative Controller
    this.controller = new AuthoritativeGameController();

    this.unsubscribeEvents = this.controller.onEvent((event) => {
      this.broadcast({
        type: 'GAME_EVENT',
        payload: event,
      });
    });

    this.unsubscribeState = this.controller.onStateChange(() => {
      this.broadcastGameState();
    });

    this.controller.initializeMatch(playerConfigs);
    return { success: true };
  }

  public handleBid(clientId: string, bid: number): { success: boolean; error?: string } {
    if (!this.controller || this.status !== 'PLAYING') {
      return { success: false, error: 'Game is not active.' };
    }

    const pos = this.clientPositions.get(clientId);
    if (!pos) {
      return { success: false, error: 'Player is not seated in this match.' };
    }

    const success = this.controller.submitBid(pos, bid);
    return { success, error: success ? undefined : 'Illegal or out-of-turn bid.' };
  }

  public handlePlayCard(clientId: string, card: Card): { success: boolean; error?: string } {
    if (!this.controller || this.status !== 'PLAYING') {
      return { success: false, error: 'Game is not active.' };
    }

    const pos = this.clientPositions.get(clientId);
    if (!pos) {
      return { success: false, error: 'Player is not seated in this match.' };
    }

    const success = this.controller.playCard(pos, card);
    return { success, error: success ? undefined : 'Illegal or out-of-turn card play.' };
  }

  public handleNextRound(clientId: string): { success: boolean; error?: string } {
    if (!this.controller || this.status !== 'PLAYING') {
      return { success: false, error: 'Game is not active.' };
    }

    const success = this.controller.nextRound();
    return { success, error: success ? undefined : 'Cannot advance round at this time.' };
  }

  public broadcastRoomState(): void {
    const playerList = Array.from(this.players.values());

    for (const [clientId, socket] of this.clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        const assignedPos = this.clientPositions.get(clientId);
        const roomStatePayload: RoomState = {
          roomCode: this.roomCode,
          hostId: this.hostClientId,
          status: this.status,
          players: playerList,
          assignedPosition: assignedPos,
          myClientId: clientId,
          autoFillBots: this.autoFillBots,
        };

        const msg: ServerMessage = {
          type: 'ROOM_STATE',
          payload: roomStatePayload,
        };

        socket.send(JSON.stringify(msg));
      }
    }
  }

  public broadcastGameState(): void {
    if (!this.controller) return;

    for (const [clientId, socket] of this.clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        const rawPos = this.clientPositions.get(clientId) ?? PlayerPosition.SOUTH;
        const perspectiveState = this.controller.getPerspectiveState(rawPos);

        const msg: ServerMessage = {
          type: 'GAME_STATE',
          payload: {
            state: perspectiveState,
            myPosition: PlayerPosition.SOUTH,
            rawPosition: rawPos,
          },
        };

        socket.send(JSON.stringify(msg));
      }
    }
  }

  public broadcast(message: ServerMessage): void {
    const serialized = JSON.stringify(message);
    for (const socket of this.clientSockets.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serialized);
      }
    }
  }

  public destroy(): void {
    if (this.unsubscribeEvents) this.unsubscribeEvents();
    if (this.unsubscribeState) this.unsubscribeState();
    if (this.controller) this.controller.destroy();
    this.clientSockets.clear();
    this.clientPositions.clear();
    this.players.clear();
  }
}

export class RoomManager {
  private static instance: RoomManager | null = null;
  private rooms = new Map<string, GameRoom>();
  private clientRoomMap = new Map<string, string>(); // clientId -> roomCode

  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  public generateRoomCode(): string {
    let code: string;
    let attempts = 0;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }

  public createRoom(
    hostClientId: string,
    hostName: string,
    hostSocket: WebSocket,
    requestedCode?: string
  ): GameRoom {
    // Leave any existing room
    this.leaveRoom(hostClientId);

    let roomCode = requestedCode ? requestedCode.trim().toUpperCase() : this.generateRoomCode();
    if (this.rooms.has(roomCode)) {
      roomCode = this.generateRoomCode();
    }

    const room = new GameRoom(roomCode, hostClientId, hostName, hostSocket);
    this.rooms.set(roomCode, room);
    this.clientRoomMap.set(hostClientId, roomCode);

    room.broadcastRoomState();
    return room;
  }

  public joinRoom(
    roomCode: string,
    clientId: string,
    playerName: string,
    socket: WebSocket
  ): { success: boolean; room?: GameRoom; error?: string } {
    const cleanCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(cleanCode);

    if (!room) {
      return { success: false, error: `Room code "${cleanCode}" not found.` };
    }

    // Leave any previous room
    this.leaveRoom(clientId);

    const result = room.addPlayer(clientId, playerName, socket);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    this.clientRoomMap.set(clientId, cleanCode);
    return { success: true, room };
  }

  public leaveRoom(clientId: string): void {
    const roomCode = this.clientRoomMap.get(clientId);
    if (!roomCode) return;

    this.clientRoomMap.delete(clientId);
    const room = this.rooms.get(roomCode);
    if (room) {
      room.removeClient(clientId);
      if (room.getConnectedClientCount() === 0) {
        room.destroy();
        this.rooms.delete(roomCode);
      }
    }
  }

  public getRoomByClientId(clientId: string): GameRoom | undefined {
    const roomCode = this.clientRoomMap.get(clientId);
    if (!roomCode) return undefined;
    return this.rooms.get(roomCode);
  }

  public getRoom(roomCode: string): GameRoom | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }
}
