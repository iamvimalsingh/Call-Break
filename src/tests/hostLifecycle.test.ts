/**
 * Authoritative Host Lifecycle Invariant Tests
 * Verifies:
 * RULE 1: If there is at least ONE connected/active Human participant in the room, the Host MUST be a Human.
 * RULE 2: A Bot may be Host ONLY when ZERO Humans remain in the room.
 * RULE 3: Host timeout causing Human -> Bot conversion MUST immediately trigger Host transfer when another Human exists.
 * RULE 4: Do not make a Bot Host while any Human is available.
 * RULE 5: If Host disconnects/leaves, existing Host-transfer behavior must choose a Human when any Human remains.
 * RULE 6: If Host times out: convert seat to Bot, immediately transfer host to remaining human if any exists.
 *
 * Events:
 * 1. Host Human times out
 * 2. Host disconnects
 * 3. Host explicitly leaves
 * 4. Human joins an existing Bot-only table
 * 5. Bot -> Human takeover
 * 6. Human -> Bot timeout takeover
 * 7. Host transfer
 * 8. Host reconnects within 45 seconds
 * 9. Host reservation expires
 * 10. Last Human disconnects
 * 11. New Human becomes available after a Bot-only state
 */

import { TestHarness } from './testHarness';
import { GameRoom } from '../../server/src/RoomManager';
import { PlayerPosition } from '../models/player';
import { WebSocket } from 'ws';

function createMockSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: () => {},
  } as unknown as WebSocket;
}

export function buildHostLifecycleTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Host Lifecycle Invariant';

  harness.register(category, '1. Host Human turn timeout transfers host to remaining Human immediately', () => {
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const room = new GameRoom('TEST01', 'p1_host', 'Host Player', s1);

    // West is non-host human (p2_human)
    room.addPlayer('p2_human', 'Human West', s2);

    // Start game
    room.startMatch('p1_host', true, 5);

    // Verify initial host is p1_host (SOUTH)
    if (room.hostClientId !== 'p1_host') {
      throw new Error(`Expected host to be p1_host, got ${room.hostClientId}`);
    }

    // Trigger turn timeout for SOUTH (the host)
    const rawRoom = room as any;
    if (rawRoom.controller) {
      rawRoom.controller.replacePlayerWithBot(PlayerPosition.SOUTH, '🤖 Host Player (Auto-Play)');
      // Simulate the timeout takeover trigger
      const participant = rawRoom.players.get(PlayerPosition.SOUTH);
      if (participant) {
        participant.isBot = true;
      }
      rawRoom.ensureHumanHost(true);
    }

    // Host MUST have transferred to p2_human (WEST)
    if ((room.hostClientId as string) !== 'p2_human') {
      throw new Error(`Expected host to transfer to p2_human, got ${room.hostClientId}`);
    }
    const westParticipant = rawRoom.players.get(PlayerPosition.WEST);
    if (!westParticipant || !westParticipant.isHost || westParticipant.isBot) {
      throw new Error('West participant must be marked as human host');
    }
  });

  harness.register(category, '2. Host disconnects (implicit) transfers host to remaining Human', () => {
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const room = new GameRoom('TEST02', 'p1_host', 'Host Player', s1);

    room.addPlayer('p2_human', 'Human West', s2);
    room.startMatch('p1_host', true, 5);

    // p1_host disconnects implicitly (e.g. tab closed or reload)
    room.removeClient('p1_host', false);

    if ((room.hostClientId as string) !== 'p2_human') {
      throw new Error(`Expected host to transfer to remaining human p2_human, got ${room.hostClientId}`);
    }
  });

  harness.register(category, '3. Host explicitly leaves transfers host to remaining Human', () => {
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const room = new GameRoom('TEST03', 'p1_host', 'Host Player', s1);

    room.addPlayer('p2_human', 'Human West', s2);
    room.startMatch('p1_host', true, 5);

    // p1_host explicitly exits
    room.removeClient('p1_host', true);

    if ((room.hostClientId as string) !== 'p2_human') {
      throw new Error(`Expected host to transfer to remaining human p2_human, got ${room.hostClientId}`);
    }
  });

  harness.register(category, '4. Last Human disconnects allows Bot to be host (0 Humans remain)', () => {
    const s1 = createMockSocket();
    const room = new GameRoom('TEST04', 'p1_host', 'Solo Human', s1);

    room.startMatch('p1_host', true, 5);

    // Only human leaves
    room.removeClient('p1_host', false);

    // With 0 humans, bot is allowed to be host
    const rawRoom = room as any;
    const hostParticipant = Array.from(rawRoom.players.values() as any[]).find((p: any) => p.isHost);
    if (!hostParticipant || !hostParticipant.isBot) {
      throw new Error('When 0 humans remain, Bot should hold host role');
    }
  });

  harness.register(category, '5. New Human joins an existing Bot-only table and immediately becomes Host', () => {
    const s1 = createMockSocket();
    const room = new GameRoom('TEST05', 'p1_host', 'Solo Human', s1);

    room.startMatch('p1_host', true, 5);

    // p1 leaves, making table 0 humans
    room.removeClient('p1_host', true);

    // New human joins the bot-only table
    const sNew = createMockSocket();
    const joinResult = room.addPlayer('p_new_human', 'Incoming Champion', sNew);
    if (!joinResult.success) {
      throw new Error(`Expected new human to join bot-only table, failed: ${joinResult.error}`);
    }

    if ((room.hostClientId as string) !== 'p_new_human') {
      throw new Error(`Incoming human should have become Host, got ${room.hostClientId}`);
    }
    const rawRoom = room as any;
    const newHumanPart = rawRoom.players.get(joinResult.position!);
    if (!newHumanPart || !newHumanPart.isHost || newHumanPart.isBot) {
      throw new Error('New human participant must be marked as human host');
    }
  });

  harness.register(category, '6. Reconnecting former host does NOT steal host if another connected Human is Host', () => {
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const room = new GameRoom('TEST06', 'p1_host', 'Host One', s1);

    room.addPlayer('p2_human', 'Human Two', s2);
    room.startMatch('p1_host', true, 5);

    // Host 1 disconnects (implicit)
    room.removeClient('p1_host', false);

    // Host 2 is now the active human host
    if ((room.hostClientId as string) !== 'p2_human') {
      throw new Error('p2_human should be current host');
    }

    // Host 1 reconnects with same client ID within 45 seconds
    const s1Reconnect = createMockSocket();
    const reconnectResult = room.addPlayer('p1_host', 'Host One', s1Reconnect);
    if (!reconnectResult.success) {
      throw new Error(`Reconnect failed: ${reconnectResult.error}`);
    }

    // Host MUST remain p2_human because p2_human is active connected human
    if ((room.hostClientId as string) !== 'p2_human') {
      throw new Error(`Host should remain p2_human, got ${room.hostClientId}`);
    }
  });

  harness.register(category, '7. Reconnecting former host DOES regain host if 0 other humans were present', () => {
    const s1 = createMockSocket();
    const room = new GameRoom('TEST07', 'p1_host', 'Solo Host', s1);

    room.startMatch('p1_host', true, 5);

    // Host 1 disconnects (implicit)
    room.removeClient('p1_host', false);

    // Host 1 reconnects
    const s1Reconnect = createMockSocket();
    const reconnectResult = room.addPlayer('p1_host', 'Solo Host', s1Reconnect);
    if (!reconnectResult.success) {
      throw new Error(`Reconnect failed: ${reconnectResult.error}`);
    }

    // Host MUST be p1_host because no other humans exist
    if ((room.hostClientId as string) !== 'p1_host') {
      throw new Error(`Host should be p1_host, got ${room.hostClientId}`);
    }
  });

  harness.register(category, '8. Host transfer strictly rejects bots and allows only connected Humans', () => {
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const room = new GameRoom('TEST08', 'p1_host', 'Host Player', s1);

    room.addPlayer('p2_human', 'Human West', s2);
    room.startMatch('p1_host', true, 5);

    // Attempt to transfer host to a bot seat (NORTH)
    const botTransfer = room.transferHost('p1_host', PlayerPosition.NORTH);
    if (botTransfer.success) {
      throw new Error('Host transfer to a bot seat should fail');
    }

    // Transfer host to human seat (WEST)
    const humanTransfer = room.transferHost('p1_host', PlayerPosition.WEST);
    if (!humanTransfer.success) {
      throw new Error(`Host transfer to human failed: ${humanTransfer.error}`);
    }
    if ((room.hostClientId as string) !== 'p2_human') {
      throw new Error(`Expected host to be p2_human, got ${room.hostClientId}`);
    }
  });

  return harness;
}
