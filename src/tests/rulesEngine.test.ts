/**
 * Comprehensive Unit Test Suite for Call Break Rules Engine
 * Phase 3 Call Break Rules Engine
 */

import { TestHarness, assert, assertDefined } from './testHarness';
import { Card, Rank, Suit } from '../models/card';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../models/player';
import { GameMode, GameState, GameStatus, PlayedCard, TrickState } from '../models/gameState';
import { createInitialGameState } from '../core/state/initialState';
import { CardEngine } from '../core/deck/CardEngine';
import { createCard } from '../core/deck/cardUtils';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import {
  getNextPlayerClockwise,
  getDealerForRound,
  getStartingPlayerForRound,
  determineTrickWinner,
  getLegalMoves,
  validateCardPlay,
  validateBid,
} from '../core/rules/rulesUtils';
import { GameStateStore } from '../core/state/gameStore';
import { LocalGameController } from '../core/controller/LocalGameController';

export function buildRulesEngineTestSuite(): TestHarness {
  const harness = new TestHarness();
  const rulesEngine = new CallBreakRulesEngine();
  const cardEngine = new CardEngine();

  // Test 1: Clockwise Player Rotation
  harness.register('Player Rotation', 'Rotates players clockwise: SOUTH -> WEST -> NORTH -> EAST -> SOUTH', () => {
    assert.equal(getNextPlayerClockwise(PlayerPosition.SOUTH), PlayerPosition.WEST);
    assert.equal(getNextPlayerClockwise(PlayerPosition.WEST), PlayerPosition.NORTH);
    assert.equal(getNextPlayerClockwise(PlayerPosition.NORTH), PlayerPosition.EAST);
    assert.equal(getNextPlayerClockwise(PlayerPosition.EAST), PlayerPosition.SOUTH);
  });

  // Test 2: Dealer Rotation
  harness.register('Dealer Rotation', 'Rotates dealer clockwise each round across 5 rounds', () => {
    assert.equal(getDealerForRound(1, PlayerPosition.SOUTH), PlayerPosition.SOUTH);
    assert.equal(getDealerForRound(2, PlayerPosition.SOUTH), PlayerPosition.WEST);
    assert.equal(getDealerForRound(3, PlayerPosition.SOUTH), PlayerPosition.NORTH);
    assert.equal(getDealerForRound(4, PlayerPosition.SOUTH), PlayerPosition.EAST);
    assert.equal(getDealerForRound(5, PlayerPosition.SOUTH), PlayerPosition.SOUTH);
  });

  // Test 3: Starting Player
  harness.register('Starting Player', 'Starting player is immediately clockwise from dealer', () => {
    assert.equal(getStartingPlayerForRound(PlayerPosition.SOUTH), PlayerPosition.WEST);
    assert.equal(getStartingPlayerForRound(PlayerPosition.WEST), PlayerPosition.NORTH);
    assert.equal(getStartingPlayerForRound(PlayerPosition.NORTH), PlayerPosition.EAST);
    assert.equal(getStartingPlayerForRound(PlayerPosition.EAST), PlayerPosition.SOUTH);
  });

  // Test 4: Deterministic Round Initialization
  harness.register('Round Initialization', 'Initializes round with deal, fresh trick state, and BIDDING status', () => {
    const initialState = createInitialGameState();
    const roundState = rulesEngine.initializeRound(initialState, cardEngine, 42);

    assert.equal(roundState.status, GameStatus.BIDDING);
    assert.equal(roundState.dealer, PlayerPosition.SOUTH);
    assert.equal(roundState.currentPlayer, PlayerPosition.WEST); // Clockwise from SOUTH
    assert.equal(roundState.completedTricks.length, 0);
    assert.equal(roundState.currentTrick.cards.length, 0);
    assert.equal(roundState.currentTrick.trickNumber, 1);
    assert.equal(roundState.currentTrick.leader, PlayerPosition.WEST);

    // Verify each player has exactly 13 cards and 0 tricks won
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const player = roundState.players[pos];
      assert.equal(player.hand.length, 13, `${pos} must receive 13 cards`);
      assert.equal(player.currentBid, null, `${pos} must have null bid initially`);
      assert.equal(player.tricksWon, 0, `${pos} must have 0 tricks won`);
      assert.equal(player.isDealer, pos === PlayerPosition.SOUTH);
      assert.equal(player.isTurn, pos === PlayerPosition.WEST);
    }
  });

  // Test 5: Call / Bid Validation
  harness.register('Bid Validation', 'Enforces 1-13 bounds, turn order, and rejects duplicate or invalid bids', () => {
    const initialState = createInitialGameState();
    const roundState = rulesEngine.initializeRound(initialState, cardEngine, 101);

    // Starting player is WEST
    const expectedFirst = rulesEngine.getExpectedBiddingPlayer(roundState);
    assert.equal(expectedFirst, PlayerPosition.WEST);

    // Valid bid for WEST
    const validBidResult = rulesEngine.validateBid(3, PlayerPosition.WEST, roundState);
    assert.ok(validBidResult.isValid, 'Bid of 3 for WEST should be valid');

    // Invalid bid: 0
    const zeroBid = rulesEngine.validateBid(0, PlayerPosition.WEST, roundState);
    assert.equal(zeroBid.isValid, false, 'Bid of 0 must be rejected');

    // Invalid bid: 14
    const overBid = rulesEngine.validateBid(14, PlayerPosition.WEST, roundState);
    assert.equal(overBid.isValid, false, 'Bid > 13 must be rejected');

    // Invalid bid: negative
    const negBid = rulesEngine.validateBid(-2, PlayerPosition.WEST, roundState);
    assert.equal(negBid.isValid, false, 'Negative bid must be rejected');

    // Out-of-turn bid: SOUTH tries to bid before WEST
    const outOfTurn = rulesEngine.validateBid(3, PlayerPosition.SOUTH, roundState);
    assert.equal(outOfTurn.isValid, false, 'Out-of-turn bid must be rejected');
  });

  // Test 6: Bidding Phase Sequence and Transition to Playing
  harness.register('Bidding Phase Progression', 'Cycles through all 4 bidders clockwise then transitions to PLAYING', () => {
    const initialState = createInitialGameState();
    let state = rulesEngine.initializeRound(initialState, cardEngine, 555);

    // WEST bids 2
    state = rulesEngine.applyBid(state, PlayerPosition.WEST, 2);
    assert.equal(state.players[PlayerPosition.WEST].currentBid, 2);
    assert.equal(state.currentPlayer, PlayerPosition.NORTH);

    // NORTH bids 3
    state = rulesEngine.applyBid(state, PlayerPosition.NORTH, 3);
    assert.equal(state.players[PlayerPosition.NORTH].currentBid, 3);
    assert.equal(state.currentPlayer, PlayerPosition.EAST);

    // EAST bids 4
    state = rulesEngine.applyBid(state, PlayerPosition.EAST, 4);
    assert.equal(state.players[PlayerPosition.EAST].currentBid, 4);
    assert.equal(state.currentPlayer, PlayerPosition.SOUTH);

    // SOUTH cannot bid twice or out of turn after already bidding, but hasn't bid yet:
    // SOUTH bids 1
    state = rulesEngine.applyBid(state, PlayerPosition.SOUTH, 1);
    assert.equal(state.players[PlayerPosition.SOUTH].currentBid, 1);

    // All 4 have bid -> status must now be PLAYING
    assert.equal(state.status, GameStatus.PLAYING);
    // First trick leader is starting player (WEST)
    assert.equal(state.currentPlayer, PlayerPosition.WEST);
    assert.equal(state.currentTrick.leader, PlayerPosition.WEST);
    assert.equal(state.currentTrick.cards.length, 0);

    // Cannot place another bid once in PLAYING status
    const postBiddingBid = rulesEngine.validateBid(2, PlayerPosition.WEST, state);
    assert.equal(postBiddingBid.isValid, false, 'Cannot bid during PLAYING status');
  });

  // Test 7: Follow-Suit Rule - Leading Trick
  harness.register('Follow-Suit - Leading', 'Player leading a trick may play any card from hand', () => {
    const hand: Card[] = [
      createCard(Suit.HEARTS, Rank.TEN),
      createCard(Suit.CLUBS, Rank.FOUR),
      createCard(Suit.SPADES, Rank.ACE),
    ];
    const emptyTrick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.SOUTH,
      leadSuit: null,
      cards: [],
      winner: null,
    };

    const moves = getLegalMoves(hand, emptyTrick, Suit.SPADES);
    assert.equal(moves.length, 3, 'When leading, all cards in hand are legal');
  });

  // Test 8: Follow-Suit Rule - Following when Holding Lead Suit
  harness.register('Follow-Suit - Has Lead Suit', 'Must follow lead suit if holding cards of that suit; other suits illegal', () => {
    const hand: Card[] = [
      createCard(Suit.HEARTS, Rank.TEN),
      createCard(Suit.HEARTS, Rank.TWO),
      createCard(Suit.CLUBS, Rank.ACE),
      createCard(Suit.SPADES, Rank.KING),
    ];
    const trickWithHeartLead: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        {
          playerPosition: PlayerPosition.WEST,
          card: createCard(Suit.HEARTS, Rank.QUEEN),
          playedAt: 1000,
        },
      ],
      winner: null,
    };

    const moves = getLegalMoves(hand, trickWithHeartLead, Suit.SPADES);
    assert.equal(moves.length, 2, 'Must only offer the 2 Hearts in hand');
    assert.ok(moves.every((c) => c.suit === Suit.HEARTS), 'All legal moves must be Hearts');

    // Validation checks
    const heartValidation = validateCardPlay(hand[0], hand, trickWithHeartLead, Suit.SPADES);
    assert.ok(heartValidation.isValid, 'Playing a Heart should be valid');

    const clubValidation = validateCardPlay(hand[2], hand, trickWithHeartLead, Suit.SPADES);
    assert.equal(clubValidation.isValid, false, 'Playing Club when holding Hearts must be illegal');

    const spadeValidation = validateCardPlay(hand[3], hand, trickWithHeartLead, Suit.SPADES);
    assert.equal(spadeValidation.isValid, false, 'Playing Spade when holding Hearts must be illegal');
  });

  // Test 9: Follow-Suit Rule - Void in Lead Suit (Trump-If-Void Rule)
  harness.register('Follow-Suit - Void in Lead Suit (Must Trump)', 'Void in lead suit requires playing trump (Spades) if held', () => {
    const hand: Card[] = [
      createCard(Suit.CLUBS, Rank.JACK),
      createCard(Suit.DIAMONDS, Rank.KING),
      createCard(Suit.SPADES, Rank.TWO),
    ];
    const trickWithHeartLead: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        {
          playerPosition: PlayerPosition.WEST,
          card: createCard(Suit.HEARTS, Rank.KING),
          playedAt: 1000,
        },
      ],
      winner: null,
    };

    const moves = getLegalMoves(hand, trickWithHeartLead, Suit.SPADES);
    // Since player has a Spade (trump) and no trump has been played, player must trump
    assert.equal(moves.length, 1, 'Must play trump when void in lead suit and holding trumps');
    assert.equal(moves[0].suit, Suit.SPADES, 'Legal move must be the Spade');

    // Trump play is valid
    const trumpPlay = validateCardPlay(hand[2], hand, trickWithHeartLead, Suit.SPADES);
    assert.ok(trumpPlay.isValid, 'Playing Spade when void in Hearts must be valid');

    // Discarding non-trump when holding trump is illegal
    const clubPlay = validateCardPlay(hand[0], hand, trickWithHeartLead, Suit.SPADES);
    assert.equal(clubPlay.isValid, false, 'Discarding Club when holding Spade trump must be illegal');
  });

  // Test 9B: Over-Trumping Rule
  harness.register('Over-Trumping Rule', 'Void in lead suit must over-trump if table has a trump and player has higher trump', () => {
    const hand: Card[] = [
      createCard(Suit.CLUBS, Rank.FOUR),
      createCard(Suit.SPADES, Rank.FIVE),
      createCard(Suit.SPADES, Rank.KING),
    ];
    const trickWithTrumpPlayed: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        {
          playerPosition: PlayerPosition.WEST,
          card: createCard(Suit.HEARTS, Rank.ACE),
          playedAt: 1000,
        },
        {
          playerPosition: PlayerPosition.NORTH,
          card: createCard(Suit.SPADES, Rank.NINE), // Table's highest trump is 9
          playedAt: 2000,
        },
      ],
      winner: null,
    };

    const moves = getLegalMoves(hand, trickWithTrumpPlayed, Suit.SPADES);
    // Must over-trump: SPADES KING (value 13 > 9); SPADES FIVE is lower
    assert.equal(moves.length, 1, 'Only higher trump (King of Spades) should be legal');
    assert.equal(moves[0].rank, Rank.KING);

    const kingPlay = validateCardPlay(hand[2], hand, trickWithTrumpPlayed, Suit.SPADES);
    assert.ok(kingPlay.isValid, 'Playing King of Spades over 9 is legal');

    const fivePlay = validateCardPlay(hand[1], hand, trickWithTrumpPlayed, Suit.SPADES);
    assert.equal(fivePlay.isValid, false, 'Under-trumping with 5 of Spades when holding King is illegal');
  });

  // Test 9C: Cannot Over-Trump Discard Rule
  harness.register('Cannot Over-Trump Discard', 'If player cannot beat table trump, any card in hand is legal', () => {
    const hand: Card[] = [
      createCard(Suit.CLUBS, Rank.FOUR),
      createCard(Suit.DIAMONDS, Rank.EIGHT),
      createCard(Suit.SPADES, Rank.FOUR),
    ];
    const trickWithHighTrump: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        {
          playerPosition: PlayerPosition.WEST,
          card: createCard(Suit.HEARTS, Rank.TEN),
          playedAt: 1000,
        },
        {
          playerPosition: PlayerPosition.NORTH,
          card: createCard(Suit.SPADES, Rank.ACE), // Ace is highest trump
          playedAt: 2000,
        },
      ],
      winner: null,
    };

    const moves = getLegalMoves(hand, trickWithHighTrump, Suit.SPADES);
    // Player cannot beat Ace of Spades; all 3 cards in hand become legal discards
    assert.equal(moves.length, 3, 'When unable to beat highest trump, all cards are legal discards');
  });

  // Test 9D: Void in Lead Suit with No Trumps
  harness.register('Void Without Trumps', 'Void in lead suit with no trumps allows any discard', () => {
    const hand: Card[] = [
      createCard(Suit.CLUBS, Rank.TEN),
      createCard(Suit.DIAMONDS, Rank.FIVE),
    ];
    const trickWithHeartLead: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        {
          playerPosition: PlayerPosition.WEST,
          card: createCard(Suit.HEARTS, Rank.JACK),
          playedAt: 1000,
        },
      ],
      winner: null,
    };

    const moves = getLegalMoves(hand, trickWithHeartLead, Suit.SPADES);
    assert.equal(moves.length, 2, 'Void in lead with no trumps allows all discards');
  });

  // Test 10: Trick Winner - No Trump Played
  harness.register('Trick Winner - No Trump', 'Highest-ranked card of lead suit wins; off-suit discards cannot win', () => {
    const playedCards: PlayedCard[] = [
      {
        playerPosition: PlayerPosition.SOUTH,
        card: createCard(Suit.DIAMONDS, Rank.SEVEN),
        playedAt: 1,
      },
      {
        playerPosition: PlayerPosition.WEST,
        card: createCard(Suit.DIAMONDS, Rank.JACK),
        playedAt: 2,
      },
      {
        playerPosition: PlayerPosition.NORTH,
        card: createCard(Suit.DIAMONDS, Rank.ACE),
        playedAt: 3,
      },
      {
        playerPosition: PlayerPosition.EAST,
        // Discarded Ace of Clubs - should NOT beat Ace of Diamonds (lead suit)
        card: createCard(Suit.CLUBS, Rank.ACE),
        playedAt: 4,
      },
    ];

    const winner = determineTrickWinner(playedCards, Suit.DIAMONDS, Suit.SPADES);
    assert.equal(winner, PlayerPosition.NORTH, 'North with Ace of Diamonds must win the trick');
  });

  // Test 11: Trick Winner - Trump Played
  harness.register('Trick Winner - Trump Played', 'Spade trumps beat non-trump cards; highest Spade wins', () => {
    const playedCards: PlayedCard[] = [
      {
        playerPosition: PlayerPosition.WEST,
        card: createCard(Suit.HEARTS, Rank.ACE), // High lead suit
        playedAt: 1,
      },
      {
        playerPosition: PlayerPosition.NORTH,
        card: createCard(Suit.SPADES, Rank.TWO), // Low trump
        playedAt: 2,
      },
      {
        playerPosition: PlayerPosition.EAST,
        card: createCard(Suit.SPADES, Rank.TEN), // Higher trump
        playedAt: 3,
      },
      {
        playerPosition: PlayerPosition.SOUTH,
        card: createCard(Suit.HEARTS, Rank.KING),
        playedAt: 4,
      },
    ];

    const winner = determineTrickWinner(playedCards, Suit.HEARTS, Suit.SPADES);
    assert.equal(winner, PlayerPosition.EAST, 'East with 10 of Spades must beat 2 of Spades and Ace of Hearts');
  });

  // Test 12: Turn Progression and Automatic Trick Resolution
  harness.register('Turn Progression', 'Advances turn on play; 4th card resolves trick and awards to winner', () => {
    const initialState = createInitialGameState();
    let state = rulesEngine.initializeRound(initialState, cardEngine, 777);

    // Complete bidding: WEST=2, NORTH=2, EAST=2, SOUTH=2
    state = rulesEngine.applyBid(state, PlayerPosition.WEST, 2);
    state = rulesEngine.applyBid(state, PlayerPosition.NORTH, 2);
    state = rulesEngine.applyBid(state, PlayerPosition.EAST, 2);
    state = rulesEngine.applyBid(state, PlayerPosition.SOUTH, 2);

    assert.equal(state.status, GameStatus.PLAYING);
    assert.equal(state.currentPlayer, PlayerPosition.WEST);

    // Player 1 (WEST) plays first legal card
    const westCard = rulesEngine.getLegalMoves(state.players[PlayerPosition.WEST].hand, state.currentTrick)[0];
    state = rulesEngine.applyCardPlay(state, PlayerPosition.WEST, westCard);

    assert.equal(state.currentTrick.cards.length, 1);
    assert.equal(state.currentTrick.leadSuit, westCard.suit);
    assert.equal(state.currentPlayer, PlayerPosition.NORTH);

    // Player 2 (NORTH) plays legal card
    const northCard = rulesEngine.getLegalMoves(state.players[PlayerPosition.NORTH].hand, state.currentTrick)[0];
    state = rulesEngine.applyCardPlay(state, PlayerPosition.NORTH, northCard);

    assert.equal(state.currentTrick.cards.length, 2);
    assert.equal(state.currentPlayer, PlayerPosition.EAST);

    // Player 3 (EAST) plays legal card
    const eastCard = rulesEngine.getLegalMoves(state.players[PlayerPosition.EAST].hand, state.currentTrick)[0];
    state = rulesEngine.applyCardPlay(state, PlayerPosition.EAST, eastCard);

    assert.equal(state.currentTrick.cards.length, 3);
    assert.equal(state.currentPlayer, PlayerPosition.SOUTH);

    // Player 4 (SOUTH) plays legal card -> 4th card triggers trick resolution
    const southCard = rulesEngine.getLegalMoves(state.players[PlayerPosition.SOUTH].hand, state.currentTrick)[0];
    state = rulesEngine.applyCardPlay(state, PlayerPosition.SOUTH, southCard);

    // Trick should now be resolved:
    assert.equal(state.completedTricks.length, 1);
    const completed = state.completedTricks[0];
    assert.equal(completed.cards.length, 4);

    // The trick winner must have 1 trick won
    const winnerPos = completed.winner;
    assert.equal(state.players[winnerPos].tricksWon, 1);

    // Next trick starts with the winner
    assert.equal(state.currentTrick.trickNumber, 2);
    assert.equal(state.currentTrick.leader, winnerPos);
    assert.equal(state.currentTrick.cards.length, 0);
    assert.equal(state.currentPlayer, winnerPos);
  });

  // Test 13: 13 Tricks Completes the Round
  harness.register('Round Completion', 'Simulating all 13 tricks marks status as ROUND_ENDED without computing scores', () => {
    const initialState = createInitialGameState();
    let state = rulesEngine.initializeRound(initialState, cardEngine, 12345);

    // Bidding
    state = rulesEngine.applyBid(state, PlayerPosition.WEST, 3);
    state = rulesEngine.applyBid(state, PlayerPosition.NORTH, 3);
    state = rulesEngine.applyBid(state, PlayerPosition.EAST, 3);
    state = rulesEngine.applyBid(state, PlayerPosition.SOUTH, 3);

    // Play all 13 tricks
    for (let trick = 1; trick <= 13; trick++) {
      for (let cardIdx = 0; cardIdx < 4; cardIdx++) {
        const curPlayer = state.currentPlayer;
        const legal = rulesEngine.getLegalMoves(state.players[curPlayer].hand, state.currentTrick);
        assert.ok(legal.length > 0, `Player ${curPlayer} must have legal cards`);
        state = rulesEngine.applyCardPlay(state, curPlayer, legal[0]);
      }
    }

    assert.equal(state.completedTricks.length, 13, 'Must have completed exactly 13 tricks');
    assert.equal(state.status, GameStatus.ROUND_ENDED, 'State status must transition to ROUND_ENDED');

    // Total tricks won by all 4 players must sum to 13
    const totalWon = CLOCKWISE_PLAYER_ORDER.reduce((sum, p) => sum + state.players[p].tricksWon, 0);
    assert.equal(totalWon, 13, 'Total tricks won across all 4 players must equal 13');
  });

  // Test 14: LocalGameController Full Stack Integration
  harness.register('Controller Integration', 'LocalGameController orchestrates round with CardEngine and RulesEngine', () => {
    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      cardEngine,
      rulesEngine,
    });

    controller.initMatch(GameMode.OFFLINE_BOTS);
    controller.startRound();

    const state = store.getState();
    assert.equal(state.status, GameStatus.BIDDING, 'Starting round with engines sets status to BIDDING');
    assert.equal(state.currentRound, 1);

    // Starting player is WEST
    const westBid = controller.submitBid(PlayerPosition.WEST, 3);
    assert.ok(westBid, 'WEST should successfully bid 3');
    assert.equal(store.getState().currentPlayer, PlayerPosition.NORTH);
  });

  // Test 15: Dealer & Direction Policy Injection
  harness.register('Dealer Direction Policy', 'Supports custom IDealerDirectionPolicy injection', () => {
    const customPolicy = {
      getNextPlayer: (current: PlayerPosition) => {
        // Counter-clockwise policy for testing injection
        switch (current) {
          case PlayerPosition.SOUTH: return PlayerPosition.EAST;
          case PlayerPosition.EAST: return PlayerPosition.NORTH;
          case PlayerPosition.NORTH: return PlayerPosition.WEST;
          case PlayerPosition.WEST: return PlayerPosition.SOUTH;
        }
      },
      getDealerForRound: (round: number) => PlayerPosition.NORTH,
      getStartingPlayer: (dealer: PlayerPosition) => PlayerPosition.EAST,
      getPlayerOrder: () => [PlayerPosition.SOUTH, PlayerPosition.EAST, PlayerPosition.NORTH, PlayerPosition.WEST],
    };

    const customRulesEngine = new CallBreakRulesEngine(customPolicy);
    assert.equal(customRulesEngine.getNextPlayer(PlayerPosition.SOUTH), PlayerPosition.EAST);
    assert.equal(customRulesEngine.getDealerForRound(1, PlayerPosition.SOUTH), PlayerPosition.NORTH);
    assert.equal(customRulesEngine.getStartingPlayer(PlayerPosition.NORTH), PlayerPosition.EAST);
  });

  // =========================================================================
  // MUST-BEAT RULE AUDIT TESTS (Cases A - G)
  // =========================================================================

  // Test Case A: Led suit + higher winning card available
  harness.register('Must-Beat: Case A - Higher Led Card Available', 'Only cards capable of beating the current winner are legal', () => {
    const hand: Card[] = [
      createCard(Suit.HEARTS, Rank.TEN),
      createCard(Suit.HEARTS, Rank.THREE),
      createCard(Suit.CLUBS, Rank.KING),
    ];
    const trick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.SEVEN), playedAt: 1 },
      ],
      winner: null,
    };

    const legal = getLegalMoves(hand, trick, Suit.SPADES);
    assert.equal(legal.length, 1, 'Only ♥10 is legal; ♥3 is illegal while higher winning card is available');
    assert.equal(legal[0].rank, Rank.TEN);
    assert.equal(legal[0].suit, Suit.HEARTS);

    const valTen = validateCardPlay(hand[0], hand, trick, Suit.SPADES);
    assert.ok(valTen.isValid, 'Playing ♥10 must be valid');

    const valThree = validateCardPlay(hand[1], hand, trick, Suit.SPADES);
    assert.equal(valThree.isValid, false, 'Playing ♥3 when holding winning ♥10 must be rejected');

    const valClub = validateCardPlay(hand[2], hand, trick, Suit.SPADES);
    assert.equal(valClub.isValid, false, 'Playing ♣K when holding Hearts must be rejected');
  });

  // Test Case B: Led suit + no card capable of beating current winner
  harness.register('Must-Beat: Case B - Cannot Beat Led Winner', 'All cards of led suit are legal when unable to beat current winner', () => {
    const hand: Card[] = [
      createCard(Suit.HEARTS, Rank.QUEEN),
      createCard(Suit.HEARTS, Rank.THREE),
      createCard(Suit.CLUBS, Rank.KING),
    ];
    const trick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.KING), playedAt: 1 },
      ],
      winner: null,
    };

    const legal = getLegalMoves(hand, trick, Suit.SPADES);
    assert.equal(legal.length, 2, 'Both ♥Q and ♥3 are legal because neither can beat ♥K');
    assert.ok(legal.every((c) => c.suit === Suit.HEARTS));

    const valQueen = validateCardPlay(hand[0], hand, trick, Suit.SPADES);
    assert.ok(valQueen.isValid, 'Playing ♥Q must be valid');

    const valThree = validateCardPlay(hand[1], hand, trick, Suit.SPADES);
    assert.ok(valThree.isValid, 'Playing ♥3 must be valid');

    // Sub-case B2: Trick already trumped by opponent -> all led suit cards are legal
    const trumpedTrick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.SEVEN), playedAt: 1 },
        { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.SPADES, Rank.TWO), playedAt: 2 },
      ],
      winner: null,
    };
    const handWithAce: Card[] = [
      createCard(Suit.HEARTS, Rank.ACE),
      createCard(Suit.HEARTS, Rank.THREE),
      createCard(Suit.DIAMONDS, Rank.KING),
    ];
    const legalWhenTrumped = getLegalMoves(handWithAce, trumpedTrick, Suit.SPADES);
    assert.equal(legalWhenTrumped.length, 2, 'All Hearts are legal when trick is already trumped');
    assert.ok(legalWhenTrumped.every((c) => c.suit === Suit.HEARTS));
  });

  // Test Case C: No led suit + Spade available
  harness.register('Must-Beat: Case C - Void in Lead with Spade', 'Spade is mandatory when void in led suit', () => {
    const hand: Card[] = [
      createCard(Suit.CLUBS, Rank.ACE),
      createCard(Suit.DIAMONDS, Rank.KING),
      createCard(Suit.SPADES, Rank.THREE),
    ];
    const trick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.NINE), playedAt: 1 },
      ],
      winner: null,
    };

    const legal = getLegalMoves(hand, trick, Suit.SPADES);
    assert.equal(legal.length, 1, 'Spade is mandatory');
    assert.equal(legal[0].suit, Suit.SPADES);
    assert.equal(legal[0].rank, Rank.THREE);

    const spadeVal = validateCardPlay(hand[2], hand, trick, Suit.SPADES);
    assert.ok(spadeVal.isValid, 'Spade play must be valid');

    const clubVal = validateCardPlay(hand[0], hand, trick, Suit.SPADES);
    assert.equal(clubVal.isValid, false, 'Discarding Club when holding Spade is illegal');
  });

  // Test Case D: No led suit + higher Spade available over current Spade
  harness.register('Must-Beat: Case D - Over-Trump Mandatory', 'Higher Spade is mandatory; lower Spade is illegal', () => {
    const hand: Card[] = [
      createCard(Suit.CLUBS, Rank.FOUR),
      createCard(Suit.SPADES, Rank.FIVE),
      createCard(Suit.SPADES, Rank.KING),
    ];
    const trick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.TEN), playedAt: 1 },
        { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.SPADES, Rank.NINE), playedAt: 2 },
      ],
      winner: null,
    };

    const legal = getLegalMoves(hand, trick, Suit.SPADES);
    assert.equal(legal.length, 1, 'Only higher Spade (♠K) is legal');
    assert.equal(legal[0].rank, Rank.KING);

    const kingVal = validateCardPlay(hand[2], hand, trick, Suit.SPADES);
    assert.ok(kingVal.isValid, '♠K over ♠9 is valid');

    const fiveVal = validateCardPlay(hand[1], hand, trick, Suit.SPADES);
    assert.equal(fiveVal.isValid, false, '♠5 when holding ♠K is illegal');

    const clubVal = validateCardPlay(hand[0], hand, trick, Suit.SPADES);
    assert.equal(clubVal.isValid, false, '♣4 when holding winning ♠K is illegal');
  });

  // Test Case E: No led suit + no Spade
  harness.register('Must-Beat: Case E - Void in Lead and Void in Spades', 'Any card in hand is legal discard', () => {
    const hand: Card[] = [
      createCard(Suit.CLUBS, Rank.FOUR),
      createCard(Suit.DIAMONDS, Rank.EIGHT),
      createCard(Suit.CLUBS, Rank.ACE),
    ];
    const trick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.TEN), playedAt: 1 },
      ],
      winner: null,
    };

    const legal = getLegalMoves(hand, trick, Suit.SPADES);
    assert.equal(legal.length, 3, 'All cards are legal discards');

    for (const card of hand) {
      const val = validateCardPlay(card, hand, trick, Suit.SPADES);
      assert.ok(val.isValid, `Playing ${card.rank} of ${card.suit} must be valid`);
    }
  });

  // Test Case F: Human and Bot legal-move authority parity
  harness.register('Must-Beat: Case F - Human and Bot Authority Parity', 'RulesEngine is single source of truth for all players', () => {
    const rules = new CallBreakRulesEngine();
    const hand: Card[] = [
      createCard(Suit.HEARTS, Rank.JACK),
      createCard(Suit.HEARTS, Rank.FOUR),
      createCard(Suit.SPADES, Rank.TWO),
    ];
    const trick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.EAST,
      leadSuit: Suit.HEARTS,
      cards: [
        { playerPosition: PlayerPosition.EAST, card: createCard(Suit.HEARTS, Rank.EIGHT), playedAt: 1 },
      ],
      winner: null,
    };

    // Human calculation via rulesEngine
    const humanLegal = rules.getLegalMoves(hand, trick, Suit.SPADES);
    // Bot calculation via rulesEngine
    const botLegal = rules.getLegalMoves(hand, trick, Suit.SPADES);

    assert.equal(humanLegal.length, 1);
    assert.equal(botLegal.length, 1);
    assert.equal(humanLegal[0].rank, Rank.JACK);
    assert.equal(botLegal[0].rank, Rank.JACK);
    assert.equal(humanLegal[0].id, botLegal[0].id);
  });

  // Test Case G: Trick winner calculation remains unchanged
  harness.register('Must-Beat: Case G - Trick Winner Unchanged', 'Trick winner rules remain deterministic and accurate', () => {
    const rules = new CallBreakRulesEngine();

    // No trump played: highest lead suit card wins
    const noTrumpTrick: PlayedCard[] = [
      { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.SEVEN), playedAt: 1 },
      { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.TEN), playedAt: 2 },
      { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.HEARTS, Rank.ACE), playedAt: 3 },
      { playerPosition: PlayerPosition.EAST, card: createCard(Suit.CLUBS, Rank.KING), playedAt: 4 }, // Discard
    ];
    const winner1 = rules.determineTrickWinner(noTrumpTrick, Suit.HEARTS, Suit.SPADES);
    assert.equal(winner1, PlayerPosition.NORTH, 'North with ♥A wins');

    // Trump played: highest trump wins
    const trumpTrick: PlayedCard[] = [
      { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.ACE), playedAt: 1 },
      { playerPosition: PlayerPosition.WEST, card: createCard(Suit.SPADES, Rank.FOUR), playedAt: 2 },
      { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.SPADES, Rank.KING), playedAt: 3 },
      { playerPosition: PlayerPosition.EAST, card: createCard(Suit.HEARTS, Rank.TEN), playedAt: 4 },
    ];
    const winner2 = rules.determineTrickWinner(trumpTrick, Suit.HEARTS, Suit.SPADES);
    assert.equal(winner2, PlayerPosition.NORTH, 'North with ♠K wins over ♠4 and ♥A');
  });

  // Re-Bidding Rule Tests
  harness.register('Re-Bidding: Sum(bids) <= 8 Triggers Re-deal', 'Re-deals cards and restarts bidding when sum of all 4 bids is <= 8', () => {
    const rules = new CallBreakRulesEngine();
    const cardEng = new CardEngine();
    const initState = createInitialGameState();
    const stateWithRebid = {
      ...initState,
      config: {
        ...initState.config,
        enableRebiddingRule: true,
      },
    };
    const store = new GameStateStore(stateWithRebid);
    const ctrl = new LocalGameController(store, {
      cardEngine: cardEng,
      rulesEngine: rules,
    });

    ctrl.startRound();
    const state0 = store.getState();
    assert.equal(state0.status, GameStatus.BIDDING);

    // Dealer is SOUTH -> starting bidder is WEST
    // Let WEST bid 2, NORTH bid 2, EAST bid 2, SOUTH bid 2 (Sum = 8 <= 8!)
    let rebidNotified = false;
    let notifiedTotal = 0;
    ctrl.onRebid((totalBids) => {
      rebidNotified = true;
      notifiedTotal = totalBids;
    });

    ctrl.submitBid(PlayerPosition.WEST, 2);
    ctrl.submitBid(PlayerPosition.NORTH, 2);
    ctrl.submitBid(PlayerPosition.EAST, 2);
    const lastBidSuccess = ctrl.submitBid(PlayerPosition.SOUTH, 2);

    assert.ok(lastBidSuccess, 'Bid should succeed');
    assert.ok(rebidNotified, 'Re-bid listener should have been notified');
    assert.equal(notifiedTotal, 8, 'Total bids should be 8');

    const stateAfterRebid = store.getState();
    assert.equal(stateAfterRebid.status, GameStatus.BIDDING, 'State must remain in BIDDING phase');
    assert.equal(stateAfterRebid.players[PlayerPosition.SOUTH].currentBid, null, 'SOUTH bid reset to null');
    assert.equal(stateAfterRebid.players[PlayerPosition.WEST].currentBid, null, 'WEST bid reset to null');
    assert.equal(stateAfterRebid.players[PlayerPosition.SOUTH].hand.length, 13, 'Hand re-dealt with 13 cards');
  });

  harness.register('Re-Bidding: Sum(bids) > 8 Advances to PLAYING', 'Transitions normally to PLAYING phase when sum > 8', () => {
    const rules = new CallBreakRulesEngine();
    const cardEng = new CardEngine();
    const store = new GameStateStore(createInitialGameState());
    const ctrl = new LocalGameController(store, {
      cardEngine: cardEng,
      rulesEngine: rules,
    });

    ctrl.startRound();
    // WEST bid 3, NORTH bid 2, EAST bid 2, SOUTH bid 2 (Sum = 9 > 8)
    ctrl.submitBid(PlayerPosition.WEST, 3);
    ctrl.submitBid(PlayerPosition.NORTH, 2);
    ctrl.submitBid(PlayerPosition.EAST, 2);
    ctrl.submitBid(PlayerPosition.SOUTH, 2);

    const state = store.getState();
    assert.equal(state.status, GameStatus.PLAYING, 'State must advance to PLAYING');
    assert.equal(state.players[PlayerPosition.WEST].currentBid, 3);
  });

  return harness;
}
