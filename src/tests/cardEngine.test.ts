/**
 * Automated Test Suite for Card & Deck Engine
 * Conforms to ICardEngine specification.
 * Phase 2 Card & Deck Engine
 */

import { TestHarness, assert, assertDefined } from './testHarness';
import { CardEngine, STANDARD_SUIT_ORDER, STANDARD_RANK_ORDER } from '../core/deck/CardEngine';
import {
  createCard,
  getCardId,
  areCardsEqual,
  serializeCard,
  deserializeCard,
  serializeHand,
  deserializeHand,
  isValidCard,
  CardValidationError,
} from '../core/deck/cardUtils';
import { checkDeckIntegrityDetailed } from '../core/deck/validation';
import { DeterministicRandomSource, CryptoRandomSource } from '../core/random/IRandomSource';
import { Rank, Suit } from '../models/card';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../models/player';

export function buildCardEngineTestSuite(): TestHarness {
  const harness = new TestHarness();
  const engine = new CardEngine();

  // -------------------------------------------------------------
  // 1. DECK CREATION TESTS
  // -------------------------------------------------------------
  harness.register('Deck Creation', 'Creates exactly 52 cards', () => {
    const deck = engine.createDeck();
    assert.equal(deck.length, 52, 'Deck must have exactly 52 cards');
  });

  harness.register('Deck Creation', 'Every suit appears exactly 13 times', () => {
    const deck = engine.createDeck();
    const suitCounts: Record<Suit, number> = {
      [Suit.SPADES]: 0,
      [Suit.HEARTS]: 0,
      [Suit.DIAMONDS]: 0,
      [Suit.CLUBS]: 0,
    };

    for (const card of deck) {
      suitCounts[card.suit]++;
    }

    assert.equal(suitCounts[Suit.SPADES], 13, 'Must have 13 Spades');
    assert.equal(suitCounts[Suit.HEARTS], 13, 'Must have 13 Hearts');
    assert.equal(suitCounts[Suit.DIAMONDS], 13, 'Must have 13 Diamonds');
    assert.equal(suitCounts[Suit.CLUBS], 13, 'Must have 13 Clubs');
  });

  harness.register('Deck Creation', 'Every rank exists once in each suit without duplicates', () => {
    const deck = engine.createDeck();
    const seenIds = new Set<string>();

    for (const card of deck) {
      assert.ok(!seenIds.has(card.id), `Duplicate card found: ${card.id}`);
      seenIds.add(card.id);
    }

    assert.equal(seenIds.size, 52, 'Must have 52 unique card identities');

    // Verify all 13 ranks in each suit
    for (const suit of STANDARD_SUIT_ORDER) {
      for (const rank of STANDARD_RANK_ORDER) {
        const expectedId = getCardId(suit, rank);
        assert.ok(seenIds.has(expectedId), `Missing card: ${expectedId}`);
      }
    }
  });

  harness.register('Deck Creation', 'Initial deck ordering is deterministic and immutable', () => {
    const deck1 = engine.createDeck();
    const deck2 = engine.createDeck();

    assert.equal(deck1.length, deck2.length);
    for (let i = 0; i < deck1.length; i++) {
      assert.equal(deck1[i].id, deck2[i].id, `Card at index ${i} should match`);
    }

    // Check immutability: Object.isFrozen
    assert.ok(Object.isFrozen(deck1), 'Deck array must be frozen');
  });

  // -------------------------------------------------------------
  // 2. INTEGRITY VALIDATION TESTS
  // -------------------------------------------------------------
  harness.register('Deck Validation', 'Validates standard 52-card pristine deck', () => {
    const deck = engine.createDeck();
    const isValid = engine.validateDeckIntegrity(deck);
    assert.ok(isValid, 'Freshly generated deck must pass integrity check');

    const report = checkDeckIntegrityDetailed(deck);
    assert.ok(report.isValid, 'Detailed report isValid must be true');
    assert.equal(report.errors.length, 0, 'Detailed report should have zero errors');
    assert.equal(report.totalCards, 52);
    assert.equal(report.uniqueCardCount, 52);
  });

  harness.register('Deck Validation', 'Rejects deck with invalid size', () => {
    const deck = engine.createDeck();
    const truncatedDeck = deck.slice(0, 51); // 51 cards
    assert.equal(
      engine.validateDeckIntegrity(truncatedDeck),
      false,
      'Deck with 51 cards must be rejected'
    );

    const report = checkDeckIntegrityDetailed(truncatedDeck);
    assert.equal(report.isValid, false);
    assert.ok(report.errors.some((e) => e.includes('expected exactly 52')));
  });

  harness.register('Deck Validation', 'Rejects deck with duplicate card', () => {
    const deck = engine.createDeck();
    // Replace last card with duplicate of first card
    const corruptedDeck = [...deck.slice(0, 51), deck[0]];
    assert.equal(
      engine.validateDeckIntegrity(corruptedDeck),
      false,
      'Deck with duplicate card must be rejected'
    );

    const report = checkDeckIntegrityDetailed(corruptedDeck);
    assert.equal(report.isValid, false);
    assert.ok(report.errors.some((e) => e.includes('Duplicate card detected')));
  });

  // -------------------------------------------------------------
  // 3. RANDOM SOURCE & SHUFFLE TESTS
  // -------------------------------------------------------------
  harness.register('Random Source', 'Deterministic random source is reproducible', () => {
    const rng1 = new DeterministicRandomSource(42);
    const rng2 = new DeterministicRandomSource(42);

    for (let i = 0; i < 20; i++) {
      const v1 = rng1.next();
      const v2 = rng2.next();
      assert.equal(v1, v2, `Values at index ${i} should be identical for same seed`);
    }

    const int1 = rng1.nextInt(5, 15);
    rng1.reset(42);
    // after reset, skip 20 calls
    for (let i = 0; i < 20; i++) rng1.next();
    const int2 = rng1.nextInt(5, 15);
    assert.equal(int1, int2, 'nextInt must be reproducible after reset');
  });

  harness.register('Random Source', 'CryptoRandomSource produces valid numbers in [0, 1) and ranges', () => {
    const cryptoRng = new CryptoRandomSource();
    for (let i = 0; i < 50; i++) {
      const floatVal = cryptoRng.next();
      assert.ok(floatVal >= 0 && floatVal < 1, 'Crypto float must be in [0, 1)');

      const intVal = cryptoRng.nextInt(1, 13);
      assert.ok(intVal >= 1 && intVal <= 13, 'Crypto integer must be in [1, 13]');
    }
  });

  harness.register('Shuffle', 'Shuffled deck retains all 52 unique cards without loss', () => {
    const original = engine.createDeck();
    const shuffled = engine.shuffle(original);

    assert.equal(shuffled.length, 52, 'Shuffled deck must have 52 cards');
    assert.ok(engine.validateDeckIntegrity(shuffled), 'Shuffled deck must pass integrity validation');

    // Immutability check: original deck is not mutated
    assert.equal(original[0].id, getCardId(Suit.SPADES, Rank.TWO));
    assert.equal(original.length, 52);

    // Verify all original card IDs exist in shuffled
    const originalIds = new Set(original.map((c) => c.id));
    const shuffledIds = new Set(shuffled.map((c) => c.id));
    assert.equal(shuffledIds.size, 52);
    for (const id of originalIds) {
      assert.ok(shuffledIds.has(id), `Shuffled deck missing card ${id}`);
    }
  });

  harness.register('Shuffle', 'Deterministic seed produces identical reproducible shuffles', () => {
    const original = engine.createDeck();
    const seed = 987654321;

    const shuffledA = engine.shuffle(original, seed);
    const shuffledB = engine.shuffle(original, seed);

    assert.equal(shuffledA.length, shuffledB.length);
    for (let i = 0; i < 52; i++) {
      assert.equal(
        shuffledA[i].id,
        shuffledB[i].id,
        `Cards at position ${i} must match for deterministic seed ${seed}`
      );
    }
  });

  harness.register('Shuffle', 'Different seeds produce different deck orderings', () => {
    const original = engine.createDeck();
    const shuffled1 = engine.shuffle(original, 1111);
    const shuffled2 = engine.shuffle(original, 9999);

    let differences = 0;
    for (let i = 0; i < 52; i++) {
      if (shuffled1[i].id !== shuffled2[i].id) {
        differences++;
      }
    }
    assert.ok(
      differences > 30,
      `Expected substantial divergence between different seeds, got ${differences} differences`
    );
  });

  // -------------------------------------------------------------
  // 4. DEALING TESTS
  // -------------------------------------------------------------
  harness.register('Dealing', 'Deals exactly 13 cards to all 4 players (total 52)', () => {
    const deck = engine.shuffle(engine.createDeck(), 555);
    const hands = engine.deal(deck, CLOCKWISE_PLAYER_ORDER);

    const positions = [
      PlayerPosition.SOUTH,
      PlayerPosition.WEST,
      PlayerPosition.NORTH,
      PlayerPosition.EAST,
    ];

    let totalDealt = 0;
    const allDealtCardIds = new Set<string>();

    for (const pos of positions) {
      const hand = hands[pos];
      assertDefined(hand, `Hand for ${pos} must exist`);
      assert.equal(hand.length, 13, `Player ${pos} must receive exactly 13 cards`);
      totalDealt += hand.length;

      for (const card of hand) {
        assert.ok(!allDealtCardIds.has(card.id), `Duplicate dealt card found: ${card.id}`);
        allDealtCardIds.add(card.id);
      }
    }

    assert.equal(totalDealt, 52, 'Total dealt cards must be exactly 52');
    assert.equal(allDealtCardIds.size, 52, 'All 52 dealt cards must be mutually unique');
  });

  harness.register('Dealing', 'Throws error if deck has insufficient cards', () => {
    const insufficientDeck = engine.createDeck().slice(0, 40); // 40 cards < 52
    let threw = false;
    try {
      engine.deal(insufficientDeck, CLOCKWISE_PLAYER_ORDER);
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('Insufficient cards to deal'));
    }
    assert.ok(threw, 'Dealing with insufficient cards must throw');
  });

  // -------------------------------------------------------------
  // 5. HAND SORTING TESTS
  // -------------------------------------------------------------
  harness.register('Hand Sorting', 'Sorts hand by suit priority (Spades first) and rank descending', () => {
    // Manually create an unsorted hand
    const rawHand = [
      createCard(Suit.HEARTS, Rank.TWO),
      createCard(Suit.SPADES, Rank.FIVE),
      createCard(Suit.CLUBS, Rank.ACE),
      createCard(Suit.SPADES, Rank.ACE),
      createCard(Suit.HEARTS, Rank.KING),
      createCard(Suit.DIAMONDS, Rank.TEN),
    ];

    const sorted = engine.sortHand(rawHand);

    assert.equal(sorted.length, rawHand.length, 'Sorted hand must have same length');

    // Expected order:
    // Spades (A, 5) -> Hearts (K, 2) -> Diamonds (10) -> Clubs (A)
    assert.equal(sorted[0].id, 'SPADES_A');
    assert.equal(sorted[1].id, 'SPADES_5');
    assert.equal(sorted[2].id, 'HEARTS_K');
    assert.equal(sorted[3].id, 'HEARTS_2');
    assert.equal(sorted[4].id, 'DIAMONDS_10');
    assert.equal(sorted[5].id, 'CLUBS_A');

    // Verify input was not mutated
    assert.equal(rawHand[0].id, 'HEARTS_2');
  });

  harness.register('Hand Sorting', 'Sorting a 13-card hand preserves all cards without loss', () => {
    const deck = engine.shuffle(engine.createDeck(), 777);
    const hands = engine.deal(deck);
    const southHand = hands[PlayerPosition.SOUTH];

    const sorted = engine.sortHand(southHand);
    assert.equal(sorted.length, 13);

    const originalIds = new Set(southHand.map((c) => c.id));
    const sortedIds = new Set(sorted.map((c) => c.id));

    assert.equal(sortedIds.size, 13);
    for (const id of originalIds) {
      assert.ok(sortedIds.has(id), `Card ${id} missing after sorting`);
    }
  });

  // -------------------------------------------------------------
  // 6. SERIALIZATION & CARD UTILITIES TESTS
  // -------------------------------------------------------------
  harness.register('Serialization', 'Serializes and deserializes cards cleanly and deterministically', () => {
    const card = createCard(Suit.SPADES, Rank.ACE);
    const serialized = serializeCard(card);
    assert.equal(serialized, 'SPADES_A');

    const restored = deserializeCard(serialized);
    assert.ok(areCardsEqual(card, restored), 'Restored card must equal original');
    assert.equal(restored.value, 14);
    assert.equal(restored.suit, Suit.SPADES);
    assert.equal(restored.rank, Rank.ACE);
  });

  harness.register('Serialization', 'Serializes and deserializes an entire hand', () => {
    const hand = [
      createCard(Suit.SPADES, Rank.ACE),
      createCard(Suit.HEARTS, Rank.TEN),
      createCard(Suit.DIAMONDS, Rank.SEVEN),
    ];

    const serializedHand = serializeHand(hand);
    assert.equal(serializedHand.length, 3);
    assert.equal(serializedHand[0], 'SPADES_A');
    assert.equal(serializedHand[1], 'HEARTS_10');
    assert.equal(serializedHand[2], 'DIAMONDS_7');

    const restoredHand = deserializeHand(serializedHand);
    assert.equal(restoredHand.length, 3);
    assert.ok(areCardsEqual(hand[0], restoredHand[0]));
    assert.ok(areCardsEqual(hand[1], restoredHand[1]));
    assert.ok(areCardsEqual(hand[2], restoredHand[2]));
  });

  harness.register('Error Cases', 'Rejects malformed serialized card strings', () => {
    const invalidInputs = [
      '',
      '   ',
      'INVALID_CARD',
      'SPADES',
      'SPADES_99',
      'UNKNOWN_SUIT_A',
      'SPADES_A_EXTRA',
      123 as any,
      null as any,
    ];

    for (const badInput of invalidInputs) {
      let rejected = false;
      try {
        deserializeCard(badInput);
      } catch (err) {
        if (err instanceof CardValidationError || err instanceof Error) {
          rejected = true;
        }
      }
      assert.ok(rejected, `Malformed input "${badInput}" must be rejected`);
    }
  });

  harness.register('Error Cases', 'createCard rejects invalid suit and rank inputs', () => {
    let suitRejected = false;
    try {
      createCard('INVALID_SUIT' as any, Rank.ACE);
    } catch (e) {
      suitRejected = true;
    }
    assert.ok(suitRejected, 'createCard must reject invalid suit');

    let rankRejected = false;
    try {
      createCard(Suit.SPADES, '99' as any);
    } catch (e) {
      rankRejected = true;
    }
    assert.ok(rankRejected, 'createCard must reject invalid rank');
  });

  harness.register('Utilities', 'isValidCard accurately validates card shapes', () => {
    const valid = createCard(Suit.HEARTS, Rank.JACK);
    assert.ok(isValidCard(valid), 'Valid card must return true');

    assert.equal(isValidCard(null), false);
    assert.equal(isValidCard({}), false);
    assert.equal(isValidCard({ id: 'SPADES_A', suit: Suit.SPADES }), false);
    assert.equal(
      isValidCard({ id: 'WRONG_ID', suit: Suit.SPADES, rank: Rank.ACE, value: 14 }),
      false
    );
  });

  return harness;
}
