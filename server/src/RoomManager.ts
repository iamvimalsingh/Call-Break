/**
 * Room Manager
 * Manages 6-digit game rooms, player seating, bot auto-fill, and multiplayer game routing.
 */

import { WebSocket } from 'ws';
import { PlayerPosition } from '../../src/models/player';
import { PlayerSeatId, RoomParticipant, RoomState, ServerMessage, TurnTimerPayload } from '../../src/models/multiplayer';
import { AuthoritativeGameController, PlayerSetupInfo } from './AuthoritativeGameController';
import { Card } from '../../src/models/card';
import { GameStatus } from '../../src/models/gameState';

export const SEAT_ORDER: readonly PlayerPosition[] = [
  PlayerPosition.SOUTH,
  PlayerPosition.WEST,
  PlayerPosition.NORTH,
  PlayerPosition.EAST,
];

export const POSITION_TO_SEAT: Record<PlayerPosition, PlayerSeatId> = {
  [PlayerPosition.SOUTH]: 'P1',
  [PlayerPosition.WEST]: 'P2',
  [PlayerPosition.NORTH]: 'P3',
  [PlayerPosition.EAST]: 'P4',
};

export const SEAT_TO_POSITION: Record<PlayerSeatId, PlayerPosition> = {
  P1: PlayerPosition.SOUTH,
  P2: PlayerPosition.WEST,
  P3: PlayerPosition.NORTH,
  P4: PlayerPosition.EAST,
};

export const DEFAULT_BOT_NAMES: Record<PlayerPosition, string> = {
  [PlayerPosition.SOUTH]: 'Bot: Shield',
  [PlayerPosition.WEST]: 'Bot: Shield',
  [PlayerPosition.NORTH]: 'Bot: Shark',
  [PlayerPosition.EAST]: 'Bot: Tactician',
};

export function normalizeRoomCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .replace(/^CB-?/i, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

interface DisconnectedSeatInfo {
  position: PlayerPosition;
  name: string;
  originalClientId: string;
  wasHost: boolean;
  disconnectedAt: number;
  reservationTimeout?: NodeJS.Timeout;
}

interface PendingJoinRequestInfo {
  requestId: string;
  clientId: string;
  playerName: string;
  socket: WebSocket;
  targetPos: PlayerPosition;
  timestamp: number;
}

export class GameRoom {
  public readonly roomCode: string;
  public hostClientId: string;
  public status: 'LOBBY' | 'PLAYING' | 'FINISHED' = 'LOBBY';
  public autoFillBots: boolean = true;
  public totalRounds: number = 5;
  
  // Position to participant (Always contains 4 stable seats: P1, P2, P3, P4)
  private players = new Map<PlayerPosition, RoomParticipant>();
  // Client ID to WebSocket
  private clientSockets = new Map<string, WebSocket>();
  // Client ID to Position
  private clientPositions = new Map<string, PlayerPosition>();
  // Disconnected seats map for seamless same-seat re-connection
  private disconnectedSeats = new Map<string, DisconnectedSeatInfo>();
  // Pending join requests awaiting Host approval
  private pendingJoinRequests = new Map<string, PendingJoinRequestInfo>();

  private controller: AuthoritativeGameController | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeTimer: (() => void) | null = null;
  private unsubscribeRebid: (() => void) | null = null;
  private unsubscribeTimeoutTakeover: (() => void) | null = null;
  private readyFallbackTimer: NodeJS.Timeout | null = null;

  constructor(roomCode: string, hostClientId: string, hostName: string, hostSocket: WebSocket) {
    this.roomCode = normalizeRoomCode(roomCode);
    this.hostClientId = hostClientId;

    const cleanHostName = (hostName || '')
      .replace(/\s*\(You\)$/i, '')
      .replace(/\s*\(Host\)$/i, '')
      .replace(/^Host Player$/i, '')
      .trim();

    const finalHostName =
      cleanHostName && !/^(host|player|player 1|you)$/i.test(cleanHostName)
        ? cleanHostName
        : 'Host (Player 1)';

    // Every room strictly contains exactly 4 stable gameplay seats: P1, P2, P3, P4
    // Seat P1 (South) is permanently bound to Host
    const hostParticipant: RoomParticipant = {
      id: hostClientId,
      playerId: 'P1',
      name: finalHostName,
      position: PlayerPosition.SOUTH,
      isHost: true,
      isReady: true,
      isBot: false,
    };

    this.players.set(PlayerPosition.SOUTH, hostParticipant);
    this.clientSockets.set(hostClientId, hostSocket);
    this.clientPositions.set(hostClientId, PlayerPosition.SOUTH);

    // Initialise P2 (West), P3 (North), P4 (East) as Bot seats (No seat is ever empty/vacant)
    this.players.set(PlayerPosition.WEST, {
      id: 'bot_WEST',
      playerId: 'P2',
      name: DEFAULT_BOT_NAMES[PlayerPosition.WEST],
      position: PlayerPosition.WEST,
      isHost: false,
      isReady: true,
      isBot: true,
    });

    this.players.set(PlayerPosition.NORTH, {
      id: 'bot_NORTH',
      playerId: 'P3',
      name: DEFAULT_BOT_NAMES[PlayerPosition.NORTH],
      position: PlayerPosition.NORTH,
      isHost: false,
      isReady: true,
      isBot: true,
    });

    this.players.set(PlayerPosition.EAST, {
      id: 'bot_EAST',
      playerId: 'P4',
      name: DEFAULT_BOT_NAMES[PlayerPosition.EAST],
      position: PlayerPosition.EAST,
      isHost: false,
      isReady: true,
      isBot: true,
    });
  }

  public getPlayerCount(): number {
    return Array.from(this.players.values()).filter((p) => !p.isBot).length;
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
  ): { success: boolean; position?: PlayerPosition; error?: string; errorCode?: string } {
    const cleanPlayerName = (playerName || '')
      .replace(/\s*\(You\)$/i, '')
      .replace(/\s*\(Bot\)$/i, '')
      .replace(/^🤖\s*/, '')
      .trim();

    // 1. Direct Reconnection for already seated active client ID
    if (this.clientPositions.has(clientId)) {
      this.clientSockets.set(clientId, socket);
      const assignedPos = this.clientPositions.get(clientId)!;
      if (this.status === 'PLAYING' || this.status === 'FINISHED') {
        if (this.controller) {
          const perspectiveState = this.controller.getPerspectiveState(assignedPos);
          const syncMsg: ServerMessage = {
            type: 'MATCH_SYNC',
            payload: {
              roomCode: this.roomCode,
              state: perspectiveState,
              myPosition: PlayerPosition.SOUTH,
              rawPosition: assignedPos,
            },
          };
          socket.send(JSON.stringify(syncMsg));

          // Immediately sync current active turn timer if running
          const currentTimer = this.controller.getCurrentTimer();
          if (currentTimer) {
            const clientIdx = SEAT_ORDER.indexOf(assignedPos);
            const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
            const mappedIdx = (rawIdx - clientIdx + 4) % 4;
            const mappedPos = SEAT_ORDER[mappedIdx];

            const timerMsg: ServerMessage = {
              type: 'TURN_TIMER',
              payload: {
                ...currentTimer,
                position: mappedPos,
              },
            };
            socket.send(JSON.stringify(timerMsg));
          }
        }
      }
      return { success: true, position: assignedPos };
    }

    // Full-Table Check: If all 4 seats are already human (isBot: false), reject join request
    const humanSeats = Array.from(this.players.values()).filter((p) => !p.isBot);
    if (humanSeats.length >= 4) {
      return { success: false, error: 'Table is full (4/4 players)' };
    }

    // 2. PLAYING / FINISHED status reconnection and mid-game joining
    if (this.status === 'PLAYING' || this.status === 'FINISHED') {
      let targetPos: PlayerPosition | null = null;
      let matchedSeatInfo: DisconnectedSeatInfo | undefined;
      const now = Date.now();

      if (this.disconnectedSeats.has(clientId)) {
        const info = this.disconnectedSeats.get(clientId);
        if (info && now - info.disconnectedAt <= 45000) {
          matchedSeatInfo = info;
          targetPos = info.position;
        } else if (info) {
          // Expired reservation (past 45s)
          this.clearSeatReservation(info.position);
        }
      } else if (cleanPlayerName && this.disconnectedSeats.has(cleanPlayerName.toLowerCase())) {
        const info = this.disconnectedSeats.get(cleanPlayerName.toLowerCase());
        if (info && now - info.disconnectedAt <= 45000) {
          matchedSeatInfo = info;
          targetPos = info.position;
        } else if (info) {
          // Expired reservation (past 45s)
          this.clearSeatReservation(info.position);
        }
      }

      const isReturningPlayer = matchedSeatInfo !== undefined;

      // If returning player: target their seat if occupied by a bot (or find available bot seat)
      if (isReturningPlayer) {
        if (targetPos && this.players.get(targetPos)?.isBot) {
          // Re-claiming original seat!
        } else {
          targetPos = null;
          for (const pos of SEAT_ORDER) {
            const participant = this.players.get(pos);
            if (participant && participant.isBot) {
              targetPos = pos;
              break;
            }
          }
        }

        if (!targetPos) {
          return { success: false, error: 'Table is full (4/4 players)' };
        }

        // Hot-swap the Bot seat with the returning human player immediately
        const incomingName = cleanPlayerName || matchedSeatInfo?.name || `Player ${targetPos}`;
        const seatId = POSITION_TO_SEAT[targetPos];

        // Host transfer rule: If previous host reconnects later, they do NOT automatically regain host role
        // if an active connected human host exists
        const currentHostPos = this.clientPositions.get(this.hostClientId);
        const currentHost = currentHostPos ? this.players.get(currentHostPos) : undefined;
        const isCurrentHostConnected =
          currentHost &&
          !currentHost.isBot &&
          this.clientSockets.has(currentHost.id) &&
          this.clientSockets.get(currentHost.id)?.readyState === WebSocket.OPEN;
        const shouldBeHost = !isCurrentHostConnected && (matchedSeatInfo?.wasHost ?? false);

        const newParticipant: RoomParticipant = {
          id: clientId,
          playerId: seatId,
          name: incomingName,
          position: targetPos,
          isHost: shouldBeHost,
          isReady: true,
          isBot: false,
        };

        if (shouldBeHost) {
          this.hostClientId = clientId;
        }

        this.players.set(targetPos, newParticipant);
        this.clientSockets.set(clientId, socket);
        this.clientPositions.set(clientId, targetPos);

        // Clean up disconnected seat records
        this.clearSeatReservation(targetPos);

        // Enforce Human-Host Invariant
        this.ensureHumanHost(false);

        if (this.controller) {
          this.controller.takeoverBotSeat(targetPos, clientId, incomingName);
          const perspectiveState = this.controller.getPerspectiveState(targetPos);
          const syncMsg: ServerMessage = {
            type: 'MATCH_SYNC',
            payload: {
              roomCode: this.roomCode,
              state: perspectiveState,
              myPosition: PlayerPosition.SOUTH,
              rawPosition: targetPos,
            },
          };
          socket.send(JSON.stringify(syncMsg));

          const currentTimer = this.controller.getCurrentTimer();
          if (currentTimer) {
            const clientIdx = SEAT_ORDER.indexOf(targetPos);
            const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
            const mappedIdx = (rawIdx - clientIdx + 4) % 4;
            const mappedPos = SEAT_ORDER[mappedIdx];

            const timerMsg: ServerMessage = {
              type: 'TURN_TIMER',
              payload: {
                ...currentTimer,
                position: mappedPos,
              },
            };
            socket.send(JSON.stringify(timerMsg));
          }
        }

        this.broadcastRoomState();
        this.broadcastGameState();

        const reconnectedMsg = `🎉 ${incomingName} reconnected to their seat!`;
        this.broadcast({
          type: 'TOAST_NOTIFICATION',
          payload: {
            message: reconnectedMsg,
            type: 'success',
          },
        });

        return { success: true, position: targetPos };
      }

      // NEW Player joining mid-game (Host Approval Flow)
      const availableSeats: Array<{
        seat: PlayerPosition;
        seatId: PlayerSeatId;
        type: 'auto_play' | 'bot';
        label: string;
      }> = [];

      for (const pos of SEAT_ORDER) {
        const participant = this.players.get(pos);
        if (participant && participant.isBot) {
          const seatId = POSITION_TO_SEAT[pos];
          const isAutoPlay =
            participant.name.toLowerCase().includes('auto-play') ||
            this.disconnectedSeats.has(participant.name.toLowerCase());
          const rawName = participant.name
            .replace(/\s*\(You\)$/i, '')
            .replace(/\s*\(Host\)$/i, '')
            .replace(/\s*\(Auto-Play\)$/i, '')
            .replace(/\s*\(Bot\)$/i, '')
            .replace(/^🤖\s*/, '')
            .trim();

          availableSeats.push({
            seat: pos,
            seatId,
            type: isAutoPlay ? 'auto_play' : 'bot',
            label: isAutoPlay && rawName
              ? `Replace Bot on Seat ${seatId} (${rawName})`
              : `Replace Bot on Seat ${seatId}`,
          });
        }
      }

      if (availableSeats.length === 0) {
        return { success: false, error: 'Table is full (4/4 players)' };
      }

      targetPos = availableSeats[0].seat;
      const incomingName = cleanPlayerName || `Player ${targetPos}`;
      this.ensureHumanHost(false);
      let hostSocket = this.clientSockets.get(this.hostClientId);
      let isHostConnected =
        hostSocket &&
        (hostSocket.readyState === undefined || hostSocket.readyState === WebSocket.OPEN);
      const isHostHuman = Array.from(this.players.values()).some(
        (p) => p.id === this.hostClientId && !p.isBot
      );

      if (isHostConnected && hostSocket && isHostHuman) {
        // Send Join Request to Human Host for approval
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.pendingJoinRequests.set(requestId, {
          requestId,
          clientId,
          playerName: incomingName,
          socket,
          targetPos,
          timestamp: Date.now(),
        });

        // Inform joining user they are pending approval
        const pendingStatus: ServerMessage = {
          type: 'JOIN_REQUEST_STATUS',
          payload: {
            status: 'PENDING',
            message: 'Waiting for table host to accept your request...',
            requestId,
          },
        };
        try {
          socket.send(JSON.stringify(pendingStatus));
        } catch {}

        // Send JOIN_REQUEST modal prompt to Host
        const joinReqMsg: ServerMessage = {
          type: 'JOIN_REQUEST',
          payload: {
            requestId,
            playerName: incomingName,
            clientId,
            position: targetPos,
            availableSeats,
          },
        };
        try {
          hostSocket.send(JSON.stringify(joinReqMsg));
        } catch {}

        return { success: true, position: targetPos };
      } else if (!isHostHuman) {
        // Table is currently Bot-only (0 active humans). Admitted directly and promoted to Human Host!
        this.clearSeatReservation(targetPos);
        const seatId = POSITION_TO_SEAT[targetPos];
        const newParticipant: RoomParticipant = {
          id: clientId,
          playerId: seatId,
          name: incomingName,
          position: targetPos,
          isHost: true,
          isReady: true,
          isBot: false,
        };
        this.players.set(targetPos, newParticipant);
        this.clientSockets.set(clientId, socket);
        this.clientPositions.set(clientId, targetPos);
        this.hostClientId = clientId;
        RoomManager.getInstance().registerClientRoom(clientId, this.roomCode);

        if (this.controller) {
          this.controller.takeoverBotSeat(targetPos, clientId, incomingName);
          const perspectiveState = this.controller.getPerspectiveState(targetPos);
          const syncMsg: ServerMessage = {
            type: 'MATCH_SYNC',
            payload: {
              roomCode: this.roomCode,
              state: perspectiveState,
              myPosition: PlayerPosition.SOUTH,
              rawPosition: targetPos,
            },
          };
          socket.send(JSON.stringify(syncMsg));

          const currentTimer = this.controller.getCurrentTimer();
          if (currentTimer) {
            const clientIdx = SEAT_ORDER.indexOf(targetPos);
            const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
            const mappedIdx = (rawIdx - clientIdx + 4) % 4;
            const mappedPos = SEAT_ORDER[mappedIdx];

            const timerMsg: ServerMessage = {
              type: 'TURN_TIMER',
              payload: {
                ...currentTimer,
                position: mappedPos,
              },
            };
            socket.send(JSON.stringify(timerMsg));
          }
        }

        this.ensureHumanHost(false);
        this.broadcastRoomState();
        this.broadcastGameState();

        this.broadcast({
          type: 'TOAST_NOTIFICATION',
          payload: {
            message: `👑 ${incomingName} joined the table and is now Table Host.`,
            type: 'success',
          },
        });

        return { success: true, position: targetPos };
      } else {
        // Host is temporarily disconnected/unavailable
        try {
          const errMsg: ServerMessage = {
            type: 'ERROR',
            payload: {
              code: 'HOST_UNAVAILABLE',
              message: 'Table host is currently unreachable. Please try again in a moment.',
            },
          };
          socket.send(JSON.stringify(errMsg));
        } catch {}
        return { success: false, error: 'Table host is unreachable', errorCode: 'HOST_UNAVAILABLE' };
      }
    }

    // 3. LOBBY status logic:
    // Find next available Bot seat in SEAT_ORDER (West/P2, North/P3, East/P4, South/P1)
    let openPosition: PlayerPosition | null = null;
    for (const pos of SEAT_ORDER) {
      const p = this.players.get(pos);
      if (p && p.isBot) {
        openPosition = pos;
        break;
      }
    }

    if (!openPosition) {
      return { success: false, error: 'Table is full (4/4 players)' };
    }

    const seatId = POSITION_TO_SEAT[openPosition];
    let defaultName = 'Friend 1';
    if (openPosition === PlayerPosition.WEST) defaultName = 'Friend 1';
    else if (openPosition === PlayerPosition.NORTH) defaultName = 'Friend 2';
    else if (openPosition === PlayerPosition.EAST) defaultName = 'Friend 3';
    else if (openPosition === PlayerPosition.SOUTH) defaultName = 'Host (Player 1)';

    const rawIncoming = (cleanPlayerName || '').trim();
    const isGeneric =
      !rawIncoming ||
      /^(friend|player|guest|user|friend \(you\)|host player|host player \(you\))$/i.test(rawIncoming);
    const assignedName = isGeneric ? defaultName : rawIncoming;

    const participant: RoomParticipant = {
      id: clientId,
      playerId: seatId,
      name: assignedName,
      position: openPosition,
      isHost: false,
      isReady: true,
      isBot: false,
    };

    this.players.set(openPosition, participant);
    this.clientSockets.set(clientId, socket);
    this.clientPositions.set(clientId, openPosition);

    this.ensureHumanHost(false);
    this.broadcastRoomState();
    return { success: true, position: openPosition };
  }

  public getActiveReservationCount(): number {
    const now = Date.now();
    let count = 0;
    const countedPositions = new Set<PlayerPosition>();
    for (const info of this.disconnectedSeats.values()) {
      if (now - info.disconnectedAt <= 45000 && !countedPositions.has(info.position)) {
        countedPositions.add(info.position);
        count++;
      }
    }
    return count;
  }

  public hasActiveReservations(): boolean {
    return this.getActiveReservationCount() > 0;
  }

  public hasSeatReservation(seat: PlayerPosition): boolean {
    const now = Date.now();
    for (const info of this.disconnectedSeats.values()) {
      if (info.position === seat && now - info.disconnectedAt <= 45000) {
        return true;
      }
    }
    return false;
  }

  /**
   * Authoritative Human-Host Invariant:
   * RULE 1: If there is at least ONE connected/active Human participant in the room, the Host MUST be a Human.
   * RULE 2: A Bot may be Host ONLY when ZERO Humans remain in the room.
   * RULE 3: Host timeout causing Human → Bot conversion MUST immediately trigger Host transfer when another Human exists.
   * RULE 4: Do not make a Bot Host while any Human is available.
   * RULE 5: If Host disconnects/leaves, existing Host-transfer behavior must choose a Human when any Human remains.
   * RULE 6: If Host times out: convert seat to Bot, immediately transfer host to remaining human if any exists.
   */
  public ensureHumanHost(notify: boolean = true): boolean {
    // 1. Gather all currently active, connected Human participants in SEAT_ORDER
    const connectedHumans: RoomParticipant[] = [];
    for (const pos of SEAT_ORDER) {
      const p = this.players.get(pos);
      if (
        p &&
        !p.isBot &&
        this.clientSockets.has(p.id) &&
        (this.clientSockets.get(p.id)?.readyState === undefined ||
          this.clientSockets.get(p.id)?.readyState === WebSocket.OPEN)
      ) {
        connectedHumans.push(p);
      }
    }

    // 2. Check if current host is already one of the active connected humans
    const currentHost = connectedHumans.find((p) => p.id === this.hostClientId && p.isHost);
    if (currentHost) {
      // Invariant satisfied. Ensure no other seat has isHost = true
      for (const p of this.players.values()) {
        if (p.id !== currentHost.id && p.isHost) {
          p.isHost = false;
        }
      }
      return false;
    }

    // 3. Current host is NOT an active connected human (e.g. isBot, disconnected, or timed out).
    if (connectedHumans.length > 0) {
      // Pick the first available human in canonical seat order
      const newHost = connectedHumans[0];
      for (const p of this.players.values()) {
        p.isHost = false;
      }
      newHost.isHost = true;
      this.hostClientId = newHost.id;

      if (notify) {
        const cleanName =
          newHost.name
            .replace(/\s*\(You\)$/i, '')
            .replace(/\s*\(Host\)$/i, '')
            .replace(/\s*\(Bot\)$/i, '')
            .trim() || 'Player';

        this.broadcast({
          type: 'TOAST_NOTIFICATION',
          payload: {
            message: `👑 ${cleanName} is now the Table Host.`,
            type: 'info',
          },
        });
      }
      return true;
    }

    // 4. ZERO connected humans remain in the room.
    // A Bot may be Host ONLY when 0 humans remain.
    let existingBotHost = Array.from(this.players.values()).find((p) => p.isHost);
    if (!existingBotHost) {
      const southBot = this.players.get(PlayerPosition.SOUTH) || Array.from(this.players.values())[0];
      if (southBot) {
        southBot.isHost = true;
        this.hostClientId = southBot.id;
      }
    } else {
      this.hostClientId = existingBotHost.id;
    }

    return false;
  }

  public removeClient(clientId: string, isExplicit: boolean = false): void {
    const pos = this.clientPositions.get(clientId);
    const leavingPlayer = pos ? this.players.get(pos) : undefined;
    const rawPlayerName = leavingPlayer ? leavingPlayer.name : 'A player';
    const cleanPlayerName = rawPlayerName
      .replace(/\s*\(You\)$/i, '')
      .replace(/\s*\(Host\)$/i, '')
      .replace(/\s*\(Bot\)$/i, '')
      .replace(/^🤖\s*/, '')
      .trim();

    this.clientSockets.delete(clientId);
    this.clientPositions.delete(clientId);

    if (!pos) return;

    const seatId = POSITION_TO_SEAT[pos];
    const wasHost = clientId === this.hostClientId || (leavingPlayer?.isHost === true);

    // Rule 1: DO NOT remove the seat (P# remains active). Convert to Bot.
    const persona = DEFAULT_BOT_NAMES[pos] || 'Bot: Shield';
    const botName = this.status === 'PLAYING' && cleanPlayerName && !isExplicit ? `🤖 ${cleanPlayerName} (Auto-Play)` : persona;

    const botParticipant: RoomParticipant = {
      id: `bot_${pos}`,
      playerId: seatId,
      name: botName,
      position: pos,
      isHost: false,
      isReady: true,
      isBot: true,
    };
    this.players.set(pos, botParticipant);

    // Rule 2: Deterministic Host Transfer Rule - Enforce Human-Host Invariant immediately and atomically
    this.ensureHumanHost(true);

    if (this.status === 'LOBBY') {
      this.broadcastRoomState();
    } else if (this.status === 'PLAYING') {
      // Clear any previous reservations for this seat
      this.clearSeatReservation(pos);

      if (isExplicit) {
        // Explicit exit: do NOT create a 45s reservation, player deliberately abandoned table
        if (this.controller) {
          this.controller.replacePlayerWithBot(pos, botName);
        }
      } else {
        // Implicit disconnect (e.g. reload, network drop): record 45-second reservation
        const disconnectTime = Date.now();
        const reservationTimer = setTimeout(() => {
          // After 45 seconds without successful reconnect, clear reservation
          const currentInfo = this.disconnectedSeats.get(clientId);
          if (currentInfo && currentInfo.position === pos) {
            this.clearSeatReservation(pos);

            // Update seat participant name to standard bot if it was an auto-play label
            const seatPart = this.players.get(pos);
            if (seatPart && seatPart.isBot) {
              const defaultBot = DEFAULT_BOT_NAMES[pos] || `Bot: ${pos}`;
              seatPart.name = defaultBot;
              if (this.controller) {
                this.controller.replacePlayerWithBot(pos, defaultBot);
              }
            }

            this.broadcast({
              type: 'TOAST_NOTIFICATION',
              payload: {
                message: `⏱️ Reconnect reservation expired for seat ${pos}. Now open for takeover.`,
                type: 'info',
              },
            });
            this.broadcastRoomState();
            this.broadcastGameState();

            // Cleanup empty room if no clients or reservations remain
            RoomManager.getInstance().cleanupRoomIfEmpty(this.roomCode);
          }
        }, 45000);

        const seatInfo: DisconnectedSeatInfo = {
          position: pos,
          name: cleanPlayerName,
          originalClientId: clientId,
          wasHost,
          disconnectedAt: disconnectTime,
          reservationTimeout: reservationTimer,
        };

        this.disconnectedSeats.set(clientId, seatInfo);
        if (cleanPlayerName) {
          this.disconnectedSeats.set(cleanPlayerName.toLowerCase(), seatInfo);
        }

        // Update authoritative game controller with bot takeover
        if (this.controller) {
          this.controller.replacePlayerWithBot(pos, botName);
        }
      }

      // Broadcast PLAYER_DISCONNECTED & PLAYER_LEFT events to all remaining clients
      this.broadcast({
        type: 'PLAYER_DISCONNECTED',
        payload: {
          seat: pos,
          playerName: cleanPlayerName,
        },
      });

      this.broadcast({
        type: 'PLAYER_LEFT',
        payload: {
          clientId,
          playerName: cleanPlayerName,
          position: pos,
        },
      });

      // Broadcast Toast notification on remaining players' screens
      this.broadcast({
        type: 'TOAST_NOTIFICATION',
        payload: {
          message: isExplicit ? `🚪 ${cleanPlayerName} left the table.` : `⚠️ ${cleanPlayerName} disconnected. Bot is now playing.`,
          type: 'warning',
        },
      });

      // Broadcast updated Room State and Game State
      this.broadcastRoomState();
      this.broadcastGameState();
    }
  }

  public handleJoinResponse(
    hostClientId: string,
    requestId: string,
    accept: boolean,
    targetSeat?: PlayerPosition
  ): { success: boolean; error?: string } {
    if (hostClientId !== this.hostClientId) {
      return { success: false, error: 'Only the room host can approve join requests.' };
    }

    const pending = this.pendingJoinRequests.get(requestId);
    if (!pending) {
      return { success: false, error: 'Join request not found or expired.' };
    }

    this.pendingJoinRequests.delete(requestId);

    if (!accept) {
      try {
        const declineMsg: ServerMessage = {
          type: 'JOIN_REQUEST_STATUS',
          payload: {
            status: 'DECLINED',
            message: 'Host declined your join request.',
            requestId,
          },
        };
        pending.socket.send(JSON.stringify(declineMsg));

        const errMsg: ServerMessage = {
          type: 'ERROR',
          payload: {
            code: 'JOIN_DECLINED',
            message: 'Host declined your join request.',
          },
        };
        pending.socket.send(JSON.stringify(errMsg));
      } catch (err) {}
      return { success: true };
    }

    // Host Accepted: Find target seat or first available bot seat
    let chosenSeat = targetSeat || pending.targetPos;
    if (!this.players.get(chosenSeat)?.isBot) {
      chosenSeat = null as any;
      for (const pos of SEAT_ORDER) {
        if (this.players.get(pos)?.isBot) {
          chosenSeat = pos;
          break;
        }
      }
    }

    if (!chosenSeat) {
      try {
        pending.socket.send(
          JSON.stringify({
            type: 'ERROR',
            payload: { message: 'Table is full (4/4 players)' },
          })
        );
      } catch {}
      return { success: false, error: 'Table is full (4/4 players)' };
    }

    // Remove from disconnectedSeats if recovering an auto-play seat
    this.clearSeatReservation(chosenSeat);

    const chosenSeatId = POSITION_TO_SEAT[chosenSeat];
    const newParticipant: RoomParticipant = {
      id: pending.clientId,
      playerId: chosenSeatId,
      name: pending.playerName,
      position: chosenSeat,
      isHost: false,
      isReady: true,
      isBot: false,
    };

    this.players.set(chosenSeat, newParticipant);
    this.clientSockets.set(pending.clientId, pending.socket);
    this.clientPositions.set(pending.clientId, chosenSeat);
    RoomManager.getInstance().registerClientRoom(pending.clientId, this.roomCode);

    if (this.controller) {
      this.controller.takeoverBotSeat(chosenSeat, pending.clientId, pending.playerName);
    }

    // Send status ACCEPTED to joiner
    try {
      const acceptedStatus: ServerMessage = {
        type: 'JOIN_REQUEST_STATUS',
        payload: {
          status: 'ACCEPTED',
          message: 'Join request accepted!',
          requestId,
        },
      };
      pending.socket.send(JSON.stringify(acceptedStatus));

      // Send authoritative MATCH_SYNC snapshot
      if (this.controller) {
        const perspectiveState = this.controller.getPerspectiveState(chosenSeat);
        const syncMsg: ServerMessage = {
          type: 'MATCH_SYNC',
          payload: {
            roomCode: this.roomCode,
            state: perspectiveState,
            myPosition: PlayerPosition.SOUTH,
            rawPosition: chosenSeat,
          },
        };
        pending.socket.send(JSON.stringify(syncMsg));

        // Sync active turn timer if running
        const currentTimer = this.controller.getCurrentTimer();
        if (currentTimer) {
          const clientIdx = SEAT_ORDER.indexOf(chosenSeat);
          const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
          const mappedIdx = (rawIdx - clientIdx + 4) % 4;
          const mappedPos = SEAT_ORDER[mappedIdx];

          const timerMsg: ServerMessage = {
            type: 'TURN_TIMER',
            payload: {
              ...currentTimer,
              position: mappedPos,
            },
          };
          pending.socket.send(JSON.stringify(timerMsg));
        }
      }
    } catch (err) {
      console.error('[RoomManager] Failed to send sync to admitted player:', err);
    }

    // Broadcast toast to remaining table players
    this.broadcast({
      type: 'TOAST_NOTIFICATION',
      payload: {
        message: `${pending.playerName} joined the table!`,
        type: 'success',
      },
    });

    // Register admitted player to room mapping
    RoomManager.getInstance().registerClientRoom(pending.clientId, this.roomCode);

    this.ensureHumanHost(false);
    this.broadcastRoomState();
    this.broadcastGameState();

    return { success: true };
  }

  public clearSeatReservation(seat: PlayerPosition): void {
    for (const [key, info] of Array.from(this.disconnectedSeats.entries())) {
      if (info.position === seat) {
        if (info.reservationTimeout) {
          clearTimeout(info.reservationTimeout);
        }
        this.disconnectedSeats.delete(key);
      }
    }
  }

  public handleConvertToBot(
    hostClientId: string,
    seat: PlayerPosition
  ): { success: boolean; error?: string } {
    if (hostClientId !== this.hostClientId) {
      return { success: false, error: 'Only the room host can convert seats to permanent bots.' };
    }

    const participant = this.players.get(seat);
    if (!participant) {
      return { success: false, error: 'Player seat not found.' };
    }

    // Host cannot convert themselves to a bot unless they transfer host first
    if (participant.id === hostClientId || participant.isHost) {
      return { success: false, error: 'Host cannot convert their own seat to a bot. Transfer host role first.' };
    }

    // Clear disconnected seat reservation
    this.clearSeatReservation(seat);

    // If a human player is currently connected on this seat, notify and detach them
    if (!participant.isBot && this.clientSockets.has(participant.id)) {
      const targetSocket = this.clientSockets.get(participant.id);
      if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
        try {
          targetSocket.send(
            JSON.stringify({
              type: 'TOAST_NOTIFICATION',
              payload: {
                message: 'The table host converted your seat to an AI Bot.',
                type: 'warning',
              },
            })
          );
        } catch {}
      }
      this.clientPositions.delete(participant.id);
      this.clientSockets.delete(participant.id);
    }

    const botName = DEFAULT_BOT_NAMES[seat] || `Bot: ${seat}`;

    participant.id = `bot_${seat}`;
    participant.isBot = true;
    participant.playerId = POSITION_TO_SEAT[seat];
    participant.name = botName;

    if (this.controller) {
      this.controller.replacePlayerWithBot(seat, botName);
    }

    this.broadcast({
      type: 'TOAST_NOTIFICATION',
      payload: {
        message: `🤖 Seat ${POSITION_TO_SEAT[seat]} (${seat}) converted to AI Bot.`,
        type: 'info',
      },
    });

    this.ensureHumanHost(true);
    this.broadcastRoomState();
    this.broadcastGameState();

    return { success: true };
  }

  public handleKickPlayer(
    hostClientId: string,
    seat: PlayerPosition
  ): { success: boolean; error?: string } {
    return this.handleConvertToBot(hostClientId, seat);
  }

  public handleSwapSeats(
    hostClientId: string,
    seatA: PlayerPosition,
    seatB: PlayerPosition
  ): { success: boolean; error?: string } {
    if (hostClientId !== this.hostClientId) {
      return { success: false, error: 'Only the room host can swap player seats.' };
    }
    if (seatA === seatB) {
      return { success: true };
    }

    const partA = this.players.get(seatA);
    const partB = this.players.get(seatB);

    if (!partA || !partB) {
      return { success: false, error: 'Invalid seats specified for swap.' };
    }

    // Clear any reservations for both seats
    this.clearSeatReservation(seatA);
    this.clearSeatReservation(seatB);

    // Swap positions & playerId
    partA.position = seatB;
    partA.playerId = POSITION_TO_SEAT[seatB];
    partB.position = seatA;
    partB.playerId = POSITION_TO_SEAT[seatA];

    this.players.set(seatA, partB);
    this.players.set(seatB, partA);

    // Update client position mappings
    if (!partA.isBot && this.clientSockets.has(partA.id)) {
      this.clientPositions.set(partA.id, seatB);
    }
    if (!partB.isBot && this.clientSockets.has(partB.id)) {
      this.clientPositions.set(partB.id, seatA);
    }

    // If game is in progress, sync player info with controller while preserving seat score/state
    if (this.controller) {
      if (partB.isBot) {
        this.controller.replacePlayerWithBot(seatA, partB.name);
      } else {
        this.controller.takeoverBotSeat(seatA, partB.id, partB.name);
      }

      if (partA.isBot) {
        this.controller.replacePlayerWithBot(seatB, partA.name);
      } else {
        this.controller.takeoverBotSeat(seatB, partA.id, partA.name);
      }
    }

    this.broadcast({
      type: 'TOAST_NOTIFICATION',
      payload: {
        message: `🔄 Host swapped Seat ${POSITION_TO_SEAT[seatA]} (${seatA}) and Seat ${POSITION_TO_SEAT[seatB]} (${seatB}).`,
        type: 'info',
      },
    });

    this.broadcastRoomState();
    this.broadcastGameState();

    return { success: true };
  }

  public startMatch(
    requestingClientId: string,
    autoFillBots: boolean,
    totalRounds: number = 5
  ): { success: boolean; error?: string } {
    if (requestingClientId !== this.hostClientId) {
      return { success: false, error: 'Only the room host can start the table.' };
    }

    const isMatchEnded =
      this.status === 'FINISHED' ||
      (this.controller && this.controller.getState().status === GameStatus.MATCH_FINISHED);

    if (this.status === 'PLAYING' && !isMatchEnded) {
      return { success: false, error: 'Game is already in progress.' };
    }

    // Clean up previous controller resources if restarting a match
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
      this.unsubscribeEvents = null;
    }
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
    if (this.unsubscribeTimer) {
      this.unsubscribeTimer();
      this.unsubscribeTimer = null;
    }
    if (this.unsubscribeRebid) {
      this.unsubscribeRebid();
      this.unsubscribeRebid = null;
    }
    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }

    this.autoFillBots = autoFillBots;
    this.totalRounds = totalRounds === 10 ? 10 : 5;

    for (const pos of SEAT_ORDER) {
      if (!this.players.has(pos)) {
        const seatId = POSITION_TO_SEAT[pos];
        this.players.set(pos, {
          id: `bot_${pos}`,
          playerId: seatId,
          name: DEFAULT_BOT_NAMES[pos],
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
    this.controller.setHostPositionProvider((pos: PlayerPosition) => {
      const participant = this.players.get(pos);
      return !!participant && participant.isHost && !participant.isBot;
    });

    this.unsubscribeEvents = this.controller.onEvent((event) => {
      this.broadcast({
        type: 'GAME_EVENT',
        payload: event,
      });
      if (event.type === 'MATCH_COMPLETED') {
        this.status = 'FINISHED';
        this.broadcastRoomState();
      }
    });

    this.unsubscribeState = this.controller.onStateChange(() => {
      this.broadcastGameState();
    });

    this.unsubscribeTimer = this.controller.onTimerTick((payload) => {
      this.broadcastTimer(payload);
    });

    this.unsubscribeRebid = this.controller.onRebid(({ message }) => {
      this.broadcast({
        type: 'TOAST_NOTIFICATION',
        payload: {
          message,
          type: 'warning',
        },
      });
    });

    this.unsubscribeTimeoutTakeover = this.controller.onTimeoutTakeover((pos) => {
      const participant = this.players.get(pos);
      if (participant && !participant.isBot) {
        const wasHost = participant.isHost;
        participant.isBot = true;
        const cleanName = participant.name
          .replace(/\s*\(You\)$/i, '')
          .replace(/\s*\(Host\)$/i, '')
          .replace(/\s*\(Bot\)$/i, '')
          .trim();

        // Enforce Human-Host Invariant immediately and atomically upon timeout
        this.ensureHumanHost(true);

        this.broadcastRoomState();
        this.broadcastGameState();
        const timeoutSec = wasHost ? 50 : 30;
        this.broadcast({
          type: 'TOAST_NOTIFICATION',
          payload: {
            message: `⏱️ ${cleanName || 'Player'} timed out (${timeoutSec}s). Auto-play Bot took over seat.`,
            type: 'info',
          },
        });
      }
    });

    this.controller.initializeMatch(playerConfigs, this.totalRounds, false);
    this.broadcastGameState();

    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
    }
    this.readyFallbackTimer = setTimeout(() => {
      if (this.status === 'PLAYING' && this.controller) {
        this.controller.startTurnProgression();
      }
    }, 1500);

    return { success: true };
  }

  public handleClientReady(_clientId: string): void {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    if (this.status === 'PLAYING' && this.controller) {
      this.controller.startTurnProgression();
    }
  }

  public renameSeat(
    requestingClientId: string,
    targetSeat: PlayerPosition,
    newName: string
  ): { success: boolean; error?: string } {
    if (requestingClientId !== this.hostClientId) {
      return { success: false, error: 'Only the host can rename player seats.' };
    }
    const player = this.players.get(targetSeat);
    if (!player) {
      return { success: false, error: 'Target seat is empty.' };
    }
    const defaultName = targetSeat === PlayerPosition.SOUTH ? 'Host' : `Friend ${targetSeat === PlayerPosition.WEST ? 1 : targetSeat === PlayerPosition.NORTH ? 2 : 3}`;
    const clean = newName.trim() || defaultName;
    player.name = clean;
    if (this.controller) {
      this.controller.takeoverBotSeat(targetSeat, player.id, clean);
    }
    this.broadcastRoomState();
    this.broadcastGameState();
    return { success: true };
  }

  public transferHost(
    requestingClientId: string,
    targetSeatOrClientId: PlayerPosition | string
  ): { success: boolean; error?: string } {
    if (requestingClientId !== this.hostClientId) {
      return { success: false, error: 'Only the room host can transfer the host role.' };
    }

    let targetParticipant: RoomParticipant | undefined;
    if (Object.values(PlayerPosition).includes(targetSeatOrClientId as PlayerPosition)) {
      targetParticipant = this.players.get(targetSeatOrClientId as PlayerPosition);
    } else {
      targetParticipant = Array.from(this.players.values()).find((p) => p.id === targetSeatOrClientId);
    }

    if (!targetParticipant) {
      return { success: false, error: 'Target player not found.' };
    }

    if (targetParticipant.isBot || !this.clientSockets.has(targetParticipant.id)) {
      return { success: false, error: 'Cannot transfer host role to a bot or offline player.' };
    }

    if (targetParticipant.id === this.hostClientId) {
      return { success: true };
    }

    // Unmark old host
    for (const p of this.players.values()) {
      if (p.isHost) {
        p.isHost = false;
      }
    }

    // Assign new host
    targetParticipant.isHost = true;
    this.hostClientId = targetParticipant.id;

    const cleanNewHostName = targetParticipant.name
      .replace(/\s*\(You\)$/i, '')
      .replace(/\s*\(Host\)$/i, '')
      .trim() || 'Player';

    this.broadcast({
      type: 'TOAST_NOTIFICATION',
      payload: {
        message: `👑 ${cleanNewHostName} is now the Table Host.`,
        type: 'info',
      },
    });

    this.ensureHumanHost(false);
    this.broadcastRoomState();
    this.broadcastGameState();
    if (this.controller) {
      const activeTimer = this.controller.getCurrentTimer();
      if (activeTimer) {
        this.broadcastTimer(activeTimer);
      }
    }
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
          totalRounds: this.totalRounds,
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

  public broadcastTimer(payload: TurnTimerPayload): void {
    for (const [clientId, socket] of this.clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        const clientRawPos = this.clientPositions.get(clientId) ?? PlayerPosition.SOUTH;
        const clientIdx = SEAT_ORDER.indexOf(clientRawPos);
        const rawIdx = SEAT_ORDER.indexOf(payload.rawPosition);
        const mappedIdx = (rawIdx - clientIdx + 4) % 4;
        const mappedPos = SEAT_ORDER[mappedIdx];

        const msg: ServerMessage = {
          type: 'TURN_TIMER',
          payload: {
            position: mappedPos,
            rawPosition: payload.rawPosition,
            remainingSec: payload.remainingSec,
            totalSec: payload.totalSec,
            isExtraTime: payload.isExtraTime,
          },
        };
        socket.send(JSON.stringify(msg));
      }
    }
  }

  public destroy(): void {
    for (const info of Array.from(this.disconnectedSeats.values())) {
      if (info.reservationTimeout) {
        clearTimeout(info.reservationTimeout);
      }
    }
    this.disconnectedSeats.clear();
    this.pendingJoinRequests.clear();
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    if (this.unsubscribeEvents) this.unsubscribeEvents();
    if (this.unsubscribeState) this.unsubscribeState();
    if (this.unsubscribeTimer) this.unsubscribeTimer();
    if (this.unsubscribeRebid) this.unsubscribeRebid();
    if (this.unsubscribeTimeoutTakeover) this.unsubscribeTimeoutTakeover();
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
  ): { success: boolean; room?: GameRoom; error?: string; errorCode?: string } {
    let roomCode: string;

    if (requestedCode && requestedCode.trim().length > 0) {
      const cleanRequested = normalizeRoomCode(requestedCode);
      if (this.rooms.has(cleanRequested)) {
        return {
          success: false,
          error: `Room ID "${cleanRequested}" is already active.`,
          errorCode: 'ROOM_ALREADY_EXISTS',
        };
      }
      roomCode = cleanRequested;
    } else {
      roomCode = this.generateRoomCode();
    }

    // Leave any existing room
    this.leaveRoom(hostClientId);

    const room = new GameRoom(roomCode, hostClientId, hostName, hostSocket);
    this.rooms.set(roomCode, room);
    this.clientRoomMap.set(hostClientId, roomCode);

    room.broadcastRoomState();
    return { success: true, room };
  }

  public joinRoom(
    roomCode: string,
    clientId: string,
    playerName: string,
    socket: WebSocket
  ): { success: boolean; room?: GameRoom; error?: string; errorCode?: string } {
    const cleanCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(cleanCode);

    if (!room) {
      return {
        success: false,
        error: `No active table found with code: ${cleanCode}`,
        errorCode: 'ROOM_NOT_FOUND',
      };
    }

    // Leave any DIFFERENT previous room
    const currentRoomCode = this.clientRoomMap.get(clientId);
    if (currentRoomCode && currentRoomCode !== cleanCode) {
      this.leaveRoom(clientId, true);
    }

    const result = room.addPlayer(clientId, playerName, socket);
    if (!result.success) {
      return { success: false, error: result.error, errorCode: (result as any).errorCode || 'JOIN_FAILED' };
    }

    this.clientRoomMap.set(clientId, cleanCode);
    return { success: true, room };
  }

  public leaveRoom(clientId: string, isExplicit: boolean = false): void {
    const roomCode = this.clientRoomMap.get(clientId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (room) {
      room.removeClient(clientId, isExplicit);
      if (room.getConnectedClientCount() === 0 && !room.hasActiveReservations()) {
        room.destroy();
        this.rooms.delete(roomCode);
      }
    }
    if (isExplicit) {
      this.clientRoomMap.delete(clientId);
    }
  }

  public cleanupRoomIfEmpty(roomCode: string): void {
    const cleanCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(cleanCode);
    if (room && room.getConnectedClientCount() === 0 && !room.hasActiveReservations()) {
      room.destroy();
      this.rooms.delete(cleanCode);
    }
  }

  public registerClientRoom(clientId: string, roomCode: string): void {
    this.clientRoomMap.set(clientId, normalizeRoomCode(roomCode));
  }

  public getRoomByClientId(clientId: string): GameRoom | undefined {
    const roomCode = this.clientRoomMap.get(clientId);
    if (!roomCode) return undefined;
    return this.rooms.get(roomCode);
  }

  public getRoom(roomCode: string): GameRoom | undefined {
    return this.rooms.get(normalizeRoomCode(roomCode));
  }
}
