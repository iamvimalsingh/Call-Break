/**
 * Player Authoritative Seat Prefix Unit Tests
 * Verifies:
 * 1. getSeatPrefixLetter maps SOUTH=S, WEST=W, NORTH=N, EAST=E
 * 2. formatPlayerSeatIdentity formats "S • You"
 * 3. formatPlayerSeatIdentity formats custom human names (e.g. "E • Rahul", "N • Amit")
 * 4. formatPlayerSeatIdentity formats bot names (e.g. "W • Bot: Shield", "N • Bot: Shark")
 * 5. formatPlayerSeatIdentity handles fallback names correctly
 * 6. formatPlayerSeatIdentity prevents duplicate prefixes
 */

import { TestHarness } from './testHarness';
import {
  PlayerPosition,
  getSeatPrefixLetter,
  formatPlayerSeatIdentity,
} from '../models/player';

export function buildPlayerSeatPrefixTestSuite(): TestHarness {
  const harness = new TestHarness();
  const category = 'Player Authoritative Seat Prefix';

  harness.register(category, '1. getSeatPrefixLetter maps each PlayerPosition to single character', () => {
    if (getSeatPrefixLetter(PlayerPosition.SOUTH) !== 'S') throw new Error('SOUTH must be S');
    if (getSeatPrefixLetter(PlayerPosition.WEST) !== 'W') throw new Error('WEST must be W');
    if (getSeatPrefixLetter(PlayerPosition.NORTH) !== 'N') throw new Error('NORTH must be N');
    if (getSeatPrefixLetter(PlayerPosition.EAST) !== 'E') throw new Error('EAST must be E');
  });

  harness.register(category, '2. formatPlayerSeatIdentity preserves "S • You" without replacing prefix', () => {
    const formatted = formatPlayerSeatIdentity(PlayerPosition.SOUTH, 'You');
    if (formatted !== 'S • You') {
      throw new Error(`Expected "S • You", got "${formatted}"`);
    }
  });

  harness.register(category, '3. formatPlayerSeatIdentity formats custom human names correctly', () => {
    const rahul = formatPlayerSeatIdentity(PlayerPosition.EAST, 'Rahul');
    if (rahul !== 'E • Rahul') {
      throw new Error(`Expected "E • Rahul", got "${rahul}"`);
    }

    const amit = formatPlayerSeatIdentity(PlayerPosition.NORTH, 'Amit');
    if (amit !== 'N • Amit') {
      throw new Error(`Expected "N • Amit", got "${amit}"`);
    }
  });

  harness.register(category, '4. formatPlayerSeatIdentity formats bot names with seat prefix', () => {
    const botWest = formatPlayerSeatIdentity(PlayerPosition.WEST, 'Bot: Shield');
    if (botWest !== 'W • Bot: Shield') {
      throw new Error(`Expected "W • Bot: Shield", got "${botWest}"`);
    }

    const botNorth = formatPlayerSeatIdentity(PlayerPosition.NORTH, 'Bot: Shark');
    if (botNorth !== 'N • Bot: Shark') {
      throw new Error(`Expected "N • Bot: Shark", got "${botNorth}"`);
    }
  });

  harness.register(category, '5. formatPlayerSeatIdentity prevents duplicate seat prefixes', () => {
    const alreadyPrefixed = formatPlayerSeatIdentity(PlayerPosition.SOUTH, 'S • You');
    if (alreadyPrefixed !== 'S • You') {
      throw new Error(`Expected "S • You", got "${alreadyPrefixed}"`);
    }

    const doublePrefixed = formatPlayerSeatIdentity(PlayerPosition.NORTH, 'N • Bot: Shark');
    if (doublePrefixed !== 'N • Bot: Shark') {
      throw new Error(`Expected "N • Bot: Shark", got "${doublePrefixed}"`);
    }
  });

  harness.register(category, '6. Seat prefix remains authoritative when player seat transitions', () => {
    // Before: Bot in North seat
    const before = formatPlayerSeatIdentity(PlayerPosition.NORTH, 'Bot: Shield');
    if (before !== 'N • Bot: Shield') throw new Error(`Expected "N • Bot: Shield", got "${before}"`);

    // After: Human takes North seat
    const after = formatPlayerSeatIdentity(PlayerPosition.NORTH, 'Rahul');
    if (after !== 'N • Rahul') throw new Error(`Expected "N • Rahul", got "${after}"`);
  });

  return harness;
}
