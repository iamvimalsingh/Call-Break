/**
 * Comprehensive Unit and Simulation Test Suite for Bot Intelligence & Strategy Engine
 * Validates deterministic bidding, conservative hand evaluation, legal card selection,
 * follow-suit rules, trump and over-trump strategy, discard logic, no-cheating,
 * and complete 13-trick round simulation with 3 bots + 1 human.
 * Phase 5 Bot Intelligence & Strategy Engine
 */

import { TestHarness, assert } from './testHarness';
import { Card, Rank, Suit } from '../models/card';
import { PlayerPosition, PlayerType } from '../models/player';
import { GameMode, GameStatus, TrickState } from '../models/gameState';
import { createCard } from '../core/deck/cardUtils';
import { CardEngine } from '../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../core/scoring/ScoringEngine';
import { LocalGameController } from '../core/controller/LocalGameController';
import { GameStateStore } from '../core/state/gameStore';
import { createInitialGameState } from '../core/state/initialState';
import {
  BiddingContext,
  BotDifficulty,
  PlayCardContext,
} from '../core/contracts/IBotStrategy';
import {
  MediumBotStrategy,
  EasyBotStrategy,
  BotStrategyFactory,
  evaluateHandStrength,
  isBossCardInSuit,
  selectLowestDiscard,
} from '../core/bot';

export function buildBotStrategyTestSuite(): TestHarness {
  const harness = new TestHarness();
  const rulesEngine = new CallBreakRulesEngine();
  const botStrategy = new MediumBotStrategy();

  const dummyBiddingContext: BiddingContext = {
    position: PlayerPosition.WEST,
    dealer: PlayerPosition.SOUTH,
    existingBids: {
      [PlayerPosition.SOUTH]: 3,
      [PlayerPosition.WEST]: null,
      [PlayerPosition.NORTH]: null,
      [PlayerPosition.EAST]: null,
    },
    trumpSuit: Suit.SPADES,
  };

  // -------------------------------------------------------------------------
  // 1. Bid Validity and Bounds
  // -------------------------------------------------------------------------
  harness.register(
    'Bot Bidding — Bounds and Integer Check',
    'Ensures bot bids are always integers strictly within 1 to 13',
    () => {
      const hand = [
        createCard(Suit.SPADES, Rank.ACE),
        createCard(Suit.SPADES, Rank.KING),
        createCard(Suit.HEARTS, Rank.ACE),
        createCard(Suit.CLUBS, Rank.TEN),
        createCard(Suit.DIAMONDS, Rank.SEVEN),
      ];

      const bid = botStrategy.decideBid(hand, dummyBiddingContext);
      assert.ok(Number.isInteger(bid), 'Bid must be an integer');
      assert.ok(bid >= 1, 'Bid must be at least 1');
      assert.ok(bid <= 13, 'Bid must be at most 13');
    }
  );

  // -------------------------------------------------------------------------
  // 2. Strong Hand Evaluation
  // -------------------------------------------------------------------------
  harness.register(
    'Bot Bidding — Strong Hand Evaluation',
    'Evaluates monster hands with high Spades and side Aces to produce sensible bids',
    () => {
      const strongHand: Card[] = [
        createCard(Suit.SPADES, Rank.ACE),
        createCard(Suit.SPADES, Rank.KING),
        createCard(Suit.SPADES, Rank.QUEEN),
        createCard(Suit.SPADES, Rank.JACK),
        createCard(Suit.SPADES, Rank.TEN),
        createCard(Suit.HEARTS, Rank.ACE),
        createCard(Suit.HEARTS, Rank.KING),
        createCard(Suit.DIAMONDS, Rank.ACE),
        createCard(Suit.CLUBS, Rank.ACE),
        createCard(Suit.CLUBS, Rank.KING),
        createCard(Suit.CLUBS, Rank.QUEEN),
        createCard(Suit.HEARTS, Rank.TWO),
        createCard(Suit.DIAMONDS, Rank.THREE),
      ];

      const evaluation = botStrategy.evaluateHand(strongHand, dummyBiddingContext);
      assert.ok(evaluation.estimatedTricks >= 6, 'Strong hand must estimate at least 6 tricks');
      assert.ok(evaluation.recommendedBid >= 5, 'Strong hand bid must be at least 5');
      assert.ok(evaluation.spadeStrength >= 3, 'Spade strength should reflect 5 top honors');
    }
  );

  // -------------------------------------------------------------------------
  // 3. Weak Hand Conservative Bidding
  // -------------------------------------------------------------------------
  harness.register(
    'Bot Bidding — Weak Hand Conservative Bid',
    'Ensures weak hands with no honors or trumps bid minimum 1 and never exceed 2',
    () => {
      const weakHand: Card[] = [
        createCard(Suit.HEARTS, Rank.TWO),
        createCard(Suit.HEARTS, Rank.THREE),
        createCard(Suit.HEARTS, Rank.FOUR),
        createCard(Suit.HEARTS, Rank.FIVE),
        createCard(Suit.DIAMONDS, Rank.TWO),
        createCard(Suit.DIAMONDS, Rank.THREE),
        createCard(Suit.DIAMONDS, Rank.FOUR),
        createCard(Suit.CLUBS, Rank.TWO),
        createCard(Suit.CLUBS, Rank.THREE),
        createCard(Suit.CLUBS, Rank.FOUR),
        createCard(Suit.CLUBS, Rank.FIVE),
        createCard(Suit.CLUBS, Rank.SIX),
        createCard(Suit.DIAMONDS, Rank.SIX),
      ];

      const evaluation = botStrategy.evaluateHand(weakHand, dummyBiddingContext);
      assert.equal(evaluation.recommendedBid, 1, 'Weakest hand must bid exactly 1');
      assert.ok(evaluation.estimatedTricks < 1.0, 'Estimated tricks should be very low');
    }
  );

  // -------------------------------------------------------------------------
  // 4. Bidding Determinism
  // -------------------------------------------------------------------------
  harness.register(
    'Bot Bidding — Determinism',
    'Verifies identical hands produce identical bids without random divergence',
    () => {
      const hand: Card[] = [
        createCard(Suit.SPADES, Rank.KING),
        createCard(Suit.SPADES, Rank.SEVEN),
        createCard(Suit.SPADES, Rank.THREE),
        createCard(Suit.HEARTS, Rank.ACE),
        createCard(Suit.HEARTS, Rank.EIGHT),
        createCard(Suit.DIAMONDS, Rank.QUEEN),
        createCard(Suit.DIAMONDS, Rank.NINE),
        createCard(Suit.DIAMONDS, Rank.FOUR),
        createCard(Suit.CLUBS, Rank.KING),
        createCard(Suit.CLUBS, Rank.JACK),
        createCard(Suit.CLUBS, Rank.SIX),
        createCard(Suit.CLUBS, Rank.TWO),
        createCard(Suit.HEARTS, Rank.FIVE),
      ];

      const bid1 = botStrategy.decideBid(hand, dummyBiddingContext);
      const bid2 = botStrategy.decideBid(hand, dummyBiddingContext);
      const bid3 = botStrategy.decideBid(hand, dummyBiddingContext);

      assert.equal(bid1, bid2, 'Repeated bid evaluations must be equal');
      assert.equal(bid2, bid3, 'Repeated bid evaluations must be equal');
    }
  );

  // -------------------------------------------------------------------------
  // 5. Card Selection: Follow Suit Obligation
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Follow Suit Obligation',
    'Ensures bot always follows lead suit when holding cards of that suit',
    () => {
      const hand: Card[] = [
        createCard(Suit.HEARTS, Rank.FOUR),
        createCard(Suit.HEARTS, Rank.JACK),
        createCard(Suit.SPADES, Rank.KING),
        createCard(Suit.DIAMONDS, Rank.ACE),
      ];

      const currentTrick: TrickState = {
        trickNumber: 1,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.HEARTS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.EIGHT), playedAt: 1 },
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.WEST,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 3,
        playerTricksWon: 0,
        remainingCardsCount: { SOUTH: 3, WEST: 4, NORTH: 4, EAST: 4 },
      };

      const play = botStrategy.decideCardPlay(context);
      assert.equal(play.suit, Suit.HEARTS, 'Bot must follow lead suit (HEARTS)');
      assert.ok(
        play.rank === Rank.FOUR || play.rank === Rank.JACK,
        'Selected card must be one of the legal Hearts'
      );
    }
  );

  // -------------------------------------------------------------------------
  // 6. Card Play: Winning Cheaply
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Win Cheaply Over Lower Lead Card',
    'Plays the lowest winning card to secure the trick while conserving higher honors',
    () => {
      const hand: Card[] = [
        createCard(Suit.CLUBS, Rank.FOUR),
        createCard(Suit.CLUBS, Rank.TEN),
        createCard(Suit.CLUBS, Rank.ACE),
        createCard(Suit.DIAMONDS, Rank.TWO),
      ];

      const currentTrick: TrickState = {
        trickNumber: 2,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.CLUBS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.CLUBS, Rank.EIGHT), playedAt: 1 },
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.WEST,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 3,
        playerTricksWon: 0,
        remainingCardsCount: { SOUTH: 3, WEST: 4, NORTH: 4, EAST: 4 },
      };

      const play = botStrategy.decideCardPlay(context);
      // Table has ♣8. Bot holds ♣4, ♣10, ♣A. Lowest winning card is ♣10.
      assert.equal(play.suit, Suit.CLUBS);
      assert.equal(play.rank, Rank.TEN, 'Bot should play ♣10 to win cheaply and conserve ♣A');
    }
  );

  // -------------------------------------------------------------------------
  // 7. Card Play: Ducking When Unable to Win
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Ducking With Lowest Card When Unable to Win',
    'Ducks with the lowest card of the lead suit when higher cards on table cannot be beaten',
    () => {
      const hand: Card[] = [
        createCard(Suit.DIAMONDS, Rank.TWO),
        createCard(Suit.DIAMONDS, Rank.FIVE),
        createCard(Suit.DIAMONDS, Rank.JACK),
        createCard(Suit.SPADES, Rank.ACE),
      ];

      const currentTrick: TrickState = {
        trickNumber: 3,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.DIAMONDS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.DIAMONDS, Rank.ACE), playedAt: 1 },
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.WEST,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 3,
        playerTricksWon: 0,
        remainingCardsCount: { SOUTH: 3, WEST: 4, NORTH: 4, EAST: 4 },
      };

      const play = botStrategy.decideCardPlay(context);
      // Table has ♦A. Bot holds ♦2, ♦5, ♦J. Must duck with ♦2.
      assert.equal(play.suit, Suit.DIAMONDS);
      assert.equal(play.rank, Rank.TWO, 'Bot should play ♦2 to conserve ♦J');
    }
  );

  // -------------------------------------------------------------------------
  // 8. Card Play: Ducking When Trick is Already Trumped
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Ducking When Trick is Already Trumped by Opponent',
    'Ducks with lowest card when lead suit cannot win because a trump was already played',
    () => {
      const hand: Card[] = [
        createCard(Suit.HEARTS, Rank.TWO),
        createCard(Suit.HEARTS, Rank.KING),
        createCard(Suit.HEARTS, Rank.ACE),
      ];

      const currentTrick: TrickState = {
        trickNumber: 4,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.HEARTS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.NINE), playedAt: 1 },
          { playerPosition: PlayerPosition.WEST, card: createCard(Suit.SPADES, Rank.THREE), playedAt: 2 }, // Trumped!
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.NORTH,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 2,
        playerTricksWon: 0,
        remainingCardsCount: { SOUTH: 2, WEST: 2, NORTH: 3, EAST: 3 },
      };

      const play = botStrategy.decideCardPlay(context);
      // Trump ♠3 is on table. North holds ♥2, ♥K, ♥A. No Heart can beat a Spade!
      assert.equal(play.suit, Suit.HEARTS);
      assert.equal(play.rank, Rank.TWO, 'Bot must duck with ♥2 rather than burning ♥A or ♥K');
    }
  );

  // -------------------------------------------------------------------------
  // 9. Card Play: Ruffing / Trumping When Void
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Ruffing With Lowest Trump When Void',
    'Trumps with lowest Spade to take a valuable trick when void in lead suit',
    () => {
      const hand: Card[] = [
        createCard(Suit.SPADES, Rank.THREE),
        createCard(Suit.SPADES, Rank.QUEEN),
        createCard(Suit.DIAMONDS, Rank.FOUR),
        createCard(Suit.CLUBS, Rank.FIVE),
      ];

      const currentTrick: TrickState = {
        trickNumber: 5,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.HEARTS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.ACE), playedAt: 1 },
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.WEST,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 2,
        playerTricksWon: 0, // Needs tricks
        remainingCardsCount: { SOUTH: 3, WEST: 4, NORTH: 4, EAST: 4 },
      };

      const play = botStrategy.decideCardPlay(context);
      // Table has ♥A. Bot is void in Hearts and needs tricks. Plays lowest Spade (♠3).
      assert.equal(play.suit, Suit.SPADES);
      assert.equal(play.rank, Rank.THREE, 'Bot should ruff with lowest Spade ♠3');
    }
  );

  // -------------------------------------------------------------------------
  // 10. Card Play: Over-Trumping
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Over-Trumping With Lowest Winning Trump',
    'Over-trumps with lowest higher Spade when opponent has already played a trump',
    () => {
      const hand: Card[] = [
        createCard(Suit.SPADES, Rank.TWO),
        createCard(Suit.SPADES, Rank.NINE),
        createCard(Suit.SPADES, Rank.ACE),
        createCard(Suit.CLUBS, Rank.FOUR),
      ];

      const currentTrick: TrickState = {
        trickNumber: 6,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.HEARTS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.KING), playedAt: 1 },
          { playerPosition: PlayerPosition.WEST, card: createCard(Suit.SPADES, Rank.SIX), playedAt: 2 }, // Trumped with ♠6
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.NORTH,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 3,
        playerTricksWon: 0, // Needs tricks
        remainingCardsCount: { SOUTH: 2, WEST: 2, NORTH: 4, EAST: 3 },
      };

      const play = botStrategy.decideCardPlay(context);
      // Table has ♠6. Bot has ♠2, ♠9, ♠A. Lowest higher Spade is ♠9.
      assert.equal(play.suit, Suit.SPADES);
      assert.equal(play.rank, Rank.NINE, 'Bot should over-trump with ♠9 and conserve ♠A');
    }
  );

  // -------------------------------------------------------------------------
  // 11. Card Play: Discarding Rather Than Wasting Lower Trump
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Discarding Off-Suit When Unable to Over-Trump',
    'Discards lowest off-suit card rather than wasting a lower Spade under a higher Spade',
    () => {
      const hand: Card[] = [
        createCard(Suit.SPADES, Rank.TWO),
        createCard(Suit.SPADES, Rank.FIVE),
        createCard(Suit.CLUBS, Rank.THREE),
        createCard(Suit.DIAMONDS, Rank.SIX),
      ];

      const currentTrick: TrickState = {
        trickNumber: 7,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.HEARTS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.QUEEN), playedAt: 1 },
          { playerPosition: PlayerPosition.WEST, card: createCard(Suit.SPADES, Rank.KING), playedAt: 2 }, // ♠K played!
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.NORTH,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 2,
        playerTricksWon: 0,
        remainingCardsCount: { SOUTH: 2, WEST: 2, NORTH: 4, EAST: 3 },
      };

      const play = botStrategy.decideCardPlay(context);
      // Table has ♠K. Bot cannot beat it with ♠2 or ♠5. Bot should NOT waste a Spade!
      assert.ok(play.suit !== Suit.SPADES, 'Bot should not waste a Spade when unable to beat ♠K');
      assert.equal(play.rank, Rank.THREE, 'Bot should discard lowest off-suit card (♣3)');
    }
  );

  // -------------------------------------------------------------------------
  // 12. Card Play: Leading Boss Card
  // -------------------------------------------------------------------------
  harness.register(
    'Card Play — Leading Boss Card',
    'Leads a side Ace to cash a trick when leading and tricks are needed',
    () => {
      const hand: Card[] = [
        createCard(Suit.HEARTS, Rank.ACE), // Boss card
        createCard(Suit.HEARTS, Rank.FOUR),
        createCard(Suit.DIAMONDS, Rank.SEVEN),
        createCard(Suit.CLUBS, Rank.THREE),
        createCard(Suit.SPADES, Rank.FOUR),
      ];

      const currentTrick: TrickState = {
        trickNumber: 1,
        leader: PlayerPosition.WEST,
        leadSuit: null,
        cards: [],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const context: PlayCardContext = {
        position: PlayerPosition.WEST,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 3,
        playerTricksWon: 0,
        remainingCardsCount: { SOUTH: 5, WEST: 5, NORTH: 5, EAST: 5 },
      };

      const play = botStrategy.decideCardPlay(context);
      assert.equal(play.suit, Suit.HEARTS);
      assert.equal(play.rank, Rank.ACE, 'Bot should lead boss Ace of Hearts');
    }
  );

  // -------------------------------------------------------------------------
  // 13. State Immutability
  // -------------------------------------------------------------------------
  harness.register(
    'Strategy Purity — State and Hand Immutability',
    'Ensures bot decision making does not mutate input context, hand, or trick arrays',
    () => {
      const hand = Object.freeze([
        createCard(Suit.HEARTS, Rank.FOUR),
        createCard(Suit.CLUBS, Rank.TEN),
      ]);

      const currentTrick: TrickState = Object.freeze({
        trickNumber: 1,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.HEARTS,
        cards: Object.freeze([
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.EIGHT), playedAt: 1 },
        ]),
        winner: null,
      });

      const legalMoves = Object.freeze([hand[0]]);
      const context: PlayCardContext = Object.freeze({
        position: PlayerPosition.WEST,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 2,
        playerTricksWon: 0,
        remainingCardsCount: Object.freeze({ SOUTH: 2, WEST: 2, NORTH: 2, EAST: 2 }),
      });

      botStrategy.decideCardPlay(context);

      assert.equal(hand.length, 2, 'Hand array must not be mutated');
      assert.equal(currentTrick.cards.length, 1, 'Current trick must not be mutated');
    }
  );

  // -------------------------------------------------------------------------
  // 14. Difficulty Strategy Factory
  // -------------------------------------------------------------------------
  harness.register(
    'Difficulty Abstraction — Factory Resolution',
    'Instantiates proper bot strategies through BotStrategyFactory',
    () => {
      const easy = BotStrategyFactory.create(BotDifficulty.EASY);
      const medium = BotStrategyFactory.create(BotDifficulty.MEDIUM);
      const hard = BotStrategyFactory.create(BotDifficulty.HARD);
      const expert = BotStrategyFactory.create(BotDifficulty.EXPERT);

      assert.equal(easy.difficulty, BotDifficulty.EASY);
      assert.equal(medium.difficulty, BotDifficulty.MEDIUM);
      assert.ok(hard !== null);
      assert.ok(expert !== null);
    }
  );

  // -------------------------------------------------------------------------
  // 15. Complete 4-Player Local Game Simulation (1 Human Driver + 3 Bots)
  // -------------------------------------------------------------------------
  harness.register(
    'End-to-End Simulation — Complete 13-Trick Round with 3 Bots',
    'Simulates full bidding, 13 trick plays, rules enforcement, and scoring with zero illegal moves',
    () => {
      const store = new GameStateStore(createInitialGameState(GameMode.OFFLINE_BOTS));
      const cardEngine = new CardEngine();
      const scoringEngine = new ScoringEngine();
      const controller = new LocalGameController(store, {
        cardEngine,
        rulesEngine,
        scoringEngine,
      });

      // Start round 1 (dealing 13 cards each)
      controller.startRound();
      let state = store.getState();
      assert.equal(state.status, GameStatus.BIDDING, 'Game must transition to BIDDING');

      // 1. Process Bidding
      // In round 1, dealer is SOUTH, so starting bidder is WEST (clockwise from SOUTH)
      for (let i = 0; i < 4; i++) {
        const expected = rulesEngine.getExpectedBiddingPlayer(store.getState());
        assert.ok(expected !== null, 'Expected bidder must be defined');

        if (expected === PlayerPosition.SOUTH) {
          // Human player places a valid bid
          controller.submitBid(PlayerPosition.SOUTH, 3);
        } else {
          // Bot executes bid
          const success = controller.executeBotBid(expected);
          assert.ok(success, `Bot ${expected} bid must succeed`);
        }
      }

      state = store.getState();
      assert.equal(state.status, GameStatus.PLAYING, 'Game must transition to PLAYING after 4 bids');
      for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
        const pBid = state.players[pos].currentBid;
        assert.ok(pBid !== null && pBid >= 1 && pBid <= 13, `${pos} bid must be valid (1-13)`);
      }

      // 2. Play 13 Tricks
      const playedCardSet = new Set<string>();

      for (let trickIdx = 1; trickIdx <= 13; trickIdx++) {
        // Play 4 cards in this trick
        for (let cardIdx = 0; cardIdx < 4; cardIdx++) {
          state = store.getState();
          const activePlayer = state.currentPlayer;
          const playerHand = state.players[activePlayer].hand;

          if (activePlayer === PlayerPosition.SOUTH) {
            // Human player plays first legal card
            const legalMoves = rulesEngine.getLegalMoves(
              playerHand,
              state.currentTrick,
              state.config.trumpSuit
            );
            assert.ok(legalMoves.length > 0, 'Human must have at least one legal move');
            const chosen = legalMoves[0];
            playedCardSet.add(chosen.id);
            const ok = controller.playCard(PlayerPosition.SOUTH, chosen);
            assert.ok(ok, 'Human card play must be legal and accepted');
          } else {
            // Bot plays via controller
            const preHandCount = playerHand.length;
            const legalMoves = rulesEngine.getLegalMoves(
              playerHand,
              state.currentTrick,
              state.config.trumpSuit
            );
            assert.ok(legalMoves.length > 0, `Bot ${activePlayer} must have legal moves`);

            const botCard = botStrategy.decideCardPlay({
              position: activePlayer,
              hand: playerHand,
              legalMoves,
              currentTrick: state.currentTrick,
              trumpSuit: state.config.trumpSuit,
              playerBid: state.players[activePlayer].currentBid ?? 1,
              playerTricksWon: state.players[activePlayer].tricksWon,
              remainingCardsCount: {
                SOUTH: state.players.SOUTH.hand.length,
                WEST: state.players.WEST.hand.length,
                NORTH: state.players.NORTH.hand.length,
                EAST: state.players.EAST.hand.length,
              },
              completedTricks: state.completedTricks,
            });

            assert.ok(
              legalMoves.some((m) => m.id === botCard.id),
              `Bot ${activePlayer} played ${botCard.id} which must be in legal moves`
            );
            assert.ok(!playedCardSet.has(botCard.id), `Card ${botCard.id} must not have been played previously`);
            playedCardSet.add(botCard.id);

            const ok = controller.playCard(activePlayer, botCard);
            assert.ok(ok, `Bot ${activePlayer} play must be accepted by controller and rules engine`);
          }
        }

        // Verify trick was completed and added to completedTricks
        state = store.getState();
        assert.equal(state.completedTricks.length, trickIdx, `Trick ${trickIdx} must be recorded in completedTricks`);
        const lastTrick = state.completedTricks[trickIdx - 1];
        assert.equal(lastTrick.cards.length, 4, `Trick ${trickIdx} must have 4 played cards`);
        assert.ok(lastTrick.winner !== null, `Trick ${trickIdx} must have a determined winner`);
      }

      // Verify all 52 cards were played uniquely
      assert.equal(playedCardSet.size, 52, 'All 52 unique cards must be played in 13 tricks');

      state = store.getState();
      assert.equal(state.completedTricks.length, 13, 'Exactly 13 tricks must be completed');
      assert.equal(state.status, GameStatus.ROUND_ENDED, 'Round must end after 13 tricks');

      // Complete round with scoring
      controller.completeRound();
      state = store.getState();
      assert.equal(state.roundScores.length, 1, 'Round scores record must be generated');

      const totalTricksWon =
        state.players.SOUTH.tricksWon +
        state.players.WEST.tricksWon +
        state.players.NORTH.tricksWon +
        state.players.EAST.tricksWon;
      assert.equal(totalTricksWon, 13, 'Total tricks won across 4 players must sum to 13');
    }
  );

  // -------------------------------------------------------------------------
  // 16. Diagnostic Reasoning and Details
  // -------------------------------------------------------------------------
  harness.register(
    'Bot Strategy Diagnostics — Reasoning and Explanation Labels',
    'Ensures decideCardPlayWithDetails returns human-readable diagnostic labels for decisions',
    () => {
      const hand = [
        createCard(Suit.SPADES, Rank.TWO),
        createCard(Suit.HEARTS, Rank.FOUR),
      ];

      const currentTrick: TrickState = {
        trickNumber: 1,
        leader: PlayerPosition.SOUTH,
        leadSuit: Suit.CLUBS,
        cards: [
          { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.CLUBS, Rank.ACE), playedAt: 1 },
        ],
        winner: null,
      };

      const legalMoves = rulesEngine.getLegalMoves(hand, currentTrick, Suit.SPADES);
      const decision = botStrategy.decideCardPlayWithDetails({
        position: PlayerPosition.WEST,
        hand,
        legalMoves,
        currentTrick,
        trumpSuit: Suit.SPADES,
        playerBid: 2,
        playerTricksWon: 0,
        remainingCardsCount: { SOUTH: 1, WEST: 2, NORTH: 2, EAST: 2 },
      });

      assert.ok(decision.card !== null);
      assert.ok(typeof decision.reasoning === 'string' && decision.reasoning.length > 5);
      assert.ok(decision.reasoning.includes('Ruffing') || decision.reasoning.includes('trump'));
    }
  );

  // -------------------------------------------------------------------------
  // 17. Controller stepBotTurn Orchestration
  // -------------------------------------------------------------------------
  harness.register(
    'Controller Integration — stepBotTurn Orchestration',
    'Validates that stepBotTurn automatically identifies and advances bot turns',
    () => {
      const store = new GameStateStore(createInitialGameState(GameMode.OFFLINE_BOTS));
      const cardEngine = new CardEngine();
      const scoringEngine = new ScoringEngine();
      const controller = new LocalGameController(store, {
        cardEngine,
        rulesEngine,
        scoringEngine,
      });

      controller.startRound();
      // South is dealer, so West (bot) is expected to bid first
      assert.equal(rulesEngine.getExpectedBiddingPlayer(store.getState()), PlayerPosition.WEST);
      const stepped = controller.stepBotTurn();
      assert.ok(stepped, 'stepBotTurn should execute West bot bid');

      // Now North (bot) is expected to bid
      assert.equal(rulesEngine.getExpectedBiddingPlayer(store.getState()), PlayerPosition.NORTH);
    }
  );

  return harness;
}
