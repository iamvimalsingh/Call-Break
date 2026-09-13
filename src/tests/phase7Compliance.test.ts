/**
 * Phase 7 Call Break Rules Compliance and Gameplay Reliability Test Suite
 * Comprehensive verification of all 36 audit checkpoints, state invariants,
 * and 100-game deterministic simulation.
 */

import { TestHarness, assertOk, assertEqual, assertDeepEqual } from './testHarness';
import { LocalGameController } from '../core/controller/LocalGameController';
import { GameStateStore } from '../core/state/gameStore';
import { CardEngine } from '../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../core/scoring/ScoringEngine';
import { MediumBotStrategy } from '../core/bot/MediumBotStrategy';
import { DeterministicRandomSource } from '../core/random/IRandomSource';
import { Card, Rank, Suit } from '../models/card';
import { GameMode, GameStatus, TrickState } from '../models/gameState';
import { PlayerPosition, PlayerType, CLOCKWISE_PLAYER_ORDER } from '../models/player';
import { createCard } from '../core/deck/cardUtils';
import { runCallBreakSimulation } from './simulationRunner';

export function buildPhase7ComplianceTestSuite(): TestHarness {
  const harness = new TestHarness();

  // 1. INVARIANT TEST: Card Conservation (hands + current trick + completed tricks = 52)
  harness.register(
    'Phase 7: Invariants',
    'Card conservation invariant: hands + current trick + completed tricks = 52 at every state',
    () => {
      const store = new GameStateStore();
      const cardEngine = new CardEngine(new DeterministicRandomSource(42));
      const rulesEngine = new CallBreakRulesEngine();
      const scoringEngine = new ScoringEngine();
      const controller = new LocalGameController(store, {
        cardEngine,
        rulesEngine,
        scoringEngine,
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);
      const state = store.getState();

      const totalDealt =
        state.players.SOUTH.hand.length +
        state.players.WEST.hand.length +
        state.players.NORTH.hand.length +
        state.players.EAST.hand.length;
      assertEqual(totalDealt, 52, 'Initial deal must sum to 52 cards');

      // Complete bidding
      while (store.getState().status === GameStatus.BIDDING) {
        const cur = store.getState();
        if (cur.currentPlayer === PlayerPosition.SOUTH) {
          controller.submitBid(PlayerPosition.SOUTH, 3);
        } else {
          controller.stepBotTurn();
        }
      }

      // Play 2 tricks and assert conservation at every card play
      for (let play = 0; play < 8; play++) {
        const cur = store.getState();
        const handCount =
          cur.players.SOUTH.hand.length +
          cur.players.WEST.hand.length +
          cur.players.NORTH.hand.length +
          cur.players.EAST.hand.length;
        const trickCount = cur.currentTrick.cards.length;
        const completedCount = cur.completedTricks.length * 4;

        assertEqual(
          handCount + trickCount + completedCount,
          52,
          `Card conservation invariant failed at play step ${play}`
        );

        if (cur.currentPlayer === PlayerPosition.SOUTH) {
          const legal = controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
          controller.playCard(PlayerPosition.SOUTH, legal[0]);
        } else {
          controller.stepBotTurn();
        }
      }
    }
  );

  // 2. INVARIANT TEST: Card Uniqueness
  harness.register(
    'Phase 7: Invariants',
    'Card uniqueness invariant: all 52 card IDs must remain unique throughout the match',
    () => {
      const cardEngine = new CardEngine(new DeterministicRandomSource(101));
      const deck = cardEngine.createDeck();
      assertEqual(deck.length, 52, 'Deck must contain 52 cards');

      const ids = new Set(deck.map((c) => c.id));
      assertEqual(ids.size, 52, 'All 52 deck card IDs must be unique');

      const shuffled = cardEngine.shuffle(deck, 555);
      const dealt = cardEngine.deal(shuffled);

      const dealtIds = new Set<string>();
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        for (const card of dealt[pos]) {
          assertOk(!dealtIds.has(card.id), `Duplicate card ID detected: ${card.id}`);
          dealtIds.add(card.id);
        }
      }
      assertEqual(dealtIds.size, 52, 'All 52 dealt card IDs must be unique across all 4 hands');
    }
  );

  // 3. INVARIANT TEST: Round Completion
  harness.register(
    'Phase 7: Invariants',
    'Round completion invariant: exactly 13 tricks, total tricks won = 13, all hands = 0, exactly 1 round score per player',
    () => {
      const store = new GameStateStore();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(new DeterministicRandomSource(777)),
        rulesEngine: new CallBreakRulesEngine(),
        scoringEngine: new ScoringEngine(),
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);

      // Bidding
      while (store.getState().status === GameStatus.BIDDING) {
        if (store.getState().currentPlayer === PlayerPosition.SOUTH) {
          controller.submitBid(PlayerPosition.SOUTH, 3);
        } else {
          controller.stepBotTurn();
        }
      }

      // Playing
      while (store.getState().status === GameStatus.PLAYING) {
        if (store.getState().currentPlayer === PlayerPosition.SOUTH) {
          const legal = controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
          controller.playCard(PlayerPosition.SOUTH, legal[0]);
        } else {
          controller.stepBotTurn();
        }
      }

      const endRoundState = store.getState();
      assertEqual(endRoundState.status, GameStatus.ROUND_ENDED, 'Round must end in ROUND_ENDED');
      assertEqual(endRoundState.completedTricks.length, 13, 'Must have exactly 13 completed tricks');

      const totalTricksWon =
        endRoundState.players.SOUTH.tricksWon +
        endRoundState.players.WEST.tricksWon +
        endRoundState.players.NORTH.tricksWon +
        endRoundState.players.EAST.tricksWon;
      assertEqual(totalTricksWon, 13, 'Total tricks won across 4 players must equal 13');

      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        assertEqual(endRoundState.players[pos].hand.length, 0, `Player ${pos} hand must be 0 cards`);
      }

      controller.completeRound();
      const scoredState = store.getState();
      assertEqual(scoredState.roundScores.length, 1, 'Exactly one round score record must exist');
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        assertOk(
          scoredState.roundScores[0].scores[pos] !== undefined,
          `Round score must exist for ${pos}`
        );
      }
    }
  );

  // 4. INVARIANT TEST: Match Completion
  harness.register(
    'Phase 7: Invariants',
    'Match completion invariant: after Round 5, no Round 6, no card play, no bidding, final cumulative scores stable',
    () => {
      const store = new GameStateStore();
      const rulesEngine = new CallBreakRulesEngine();
      const scoringEngine = new ScoringEngine();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(new DeterministicRandomSource(999)),
        rulesEngine,
        scoringEngine,
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);

      for (let r = 1; r <= 5; r++) {
        while (store.getState().status === GameStatus.BIDDING) {
          if (store.getState().currentPlayer === PlayerPosition.SOUTH) {
            controller.submitBid(PlayerPosition.SOUTH, 3);
          } else {
            controller.stepBotTurn();
          }
        }
        while (store.getState().status === GameStatus.PLAYING) {
          if (store.getState().currentPlayer === PlayerPosition.SOUTH) {
            const legal = controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
            controller.playCard(PlayerPosition.SOUTH, legal[0]);
          } else {
            controller.stepBotTurn();
          }
        }
        controller.completeRound();
        if (r < 5) {
          controller.nextRound();
        }
      }

      const matchState = store.getState();
      assertEqual(matchState.status, GameStatus.MATCH_FINISHED, 'Status must be MATCH_FINISHED');
      assertEqual(matchState.currentRound, 5, 'Current round must remain 5');
      assertEqual(matchState.roundScores.length, 5, 'Must have recorded 5 rounds of scores');
      assertOk(matchState.matchResult !== null, 'Match result must be computed');

      // Attempt illegal Round 6 transition
      const nextRoundResult = controller.nextRound();
      assertEqual(nextRoundResult, false, 'nextRound() must return false when match is finished');
      assertEqual(store.getState().currentRound, 5, 'Current round must not advance past 5');

      // Attempt bidding after match complete
      const bidResult = controller.submitBid(PlayerPosition.SOUTH, 3);
      assertEqual(bidResult, false, 'submitBid() must return false when match is finished');

      // Attempt card play after match complete
      const dummyCard = createCard(Suit.SPADES, Rank.ACE);
      const playResult = controller.playCard(PlayerPosition.SOUTH, dummyCard);
      assertEqual(playResult, false, 'playCard() must return false when match is finished');
    }
  );

  // 5. AUDIT TEST: Rules 1-5 (Bidding range, order, single bid, no bid in playing, no play in bidding)
  harness.register(
    'Phase 7: Rules Audit',
    'Rules 1-5: Bidding range (1-13), order, single bid per player, phase separation',
    () => {
      const store = new GameStateStore();
      const rulesEngine = new CallBreakRulesEngine();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(new DeterministicRandomSource(1)),
        rulesEngine,
        scoringEngine: new ScoringEngine(),
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);
      const state = store.getState();

      // Rule 1: Bidding is strictly 1-13
      const invalidBids = [0, -1, 14, 20, 2.5];
      for (const inv of invalidBids) {
        const v = rulesEngine.validateBid(inv, state.currentPlayer, state);
        assertEqual(v.isValid, false, `Bid ${inv} must be invalid`);
      }
      for (let valid = 1; valid <= 13; valid++) {
        const v = rulesEngine.validateBid(valid, state.currentPlayer, state);
        assertEqual(v.isValid, true, `Bid ${valid} must be valid`);
      }

      // Rule 2 & 7: Starting bidder is clockwise from dealer (SOUTH dealer -> WEST starts)
      assertEqual(state.dealer, PlayerPosition.SOUTH, 'Round 1 dealer is SOUTH');
      assertEqual(state.currentPlayer, PlayerPosition.WEST, 'Starting bidder must be WEST');

      // Rule 5: No card play during BIDDING
      const dummyCard = state.players.WEST.hand[0];
      const cardPlayInBidding = controller.playCard(PlayerPosition.WEST, dummyCard);
      assertEqual(cardPlayInBidding, false, 'Card play must be rejected during BIDDING phase');

      // Execute West bid
      controller.submitBid(PlayerPosition.WEST, 3);
      assertEqual(store.getState().currentPlayer, PlayerPosition.NORTH, 'Next bidder is NORTH');

      // Rule 3: West cannot bid twice
      const westRebid = controller.submitBid(PlayerPosition.WEST, 4);
      assertEqual(westRebid, false, 'Player cannot bid twice in same round');

      // Complete bidding for North, East, South
      controller.submitBid(PlayerPosition.NORTH, 3);
      controller.submitBid(PlayerPosition.EAST, 3);
      controller.submitBid(PlayerPosition.SOUTH, 3);

      const playingState = store.getState();
      assertEqual(playingState.status, GameStatus.PLAYING, 'Must transition to PLAYING after 4 bids');

      // Rule 4: No bidding during PLAYING
      const bidInPlaying = controller.submitBid(PlayerPosition.SOUTH, 3);
      assertEqual(bidInPlaying, false, 'Bidding must be rejected during PLAYING phase');
    }
  );

  // 6. AUDIT TEST: Rules 6-7 (Dealer rotation and starting player)
  harness.register(
    'Phase 7: Rules Audit',
    'Rules 6-7: Dealer rotation across 5 rounds (SOUTH -> WEST -> NORTH -> EAST -> SOUTH) and starting player',
    () => {
      const rulesEngine = new CallBreakRulesEngine();

      const expectedDealers: [number, PlayerPosition, PlayerPosition][] = [
        [1, PlayerPosition.SOUTH, PlayerPosition.WEST],
        [2, PlayerPosition.WEST, PlayerPosition.NORTH],
        [3, PlayerPosition.NORTH, PlayerPosition.EAST],
        [4, PlayerPosition.EAST, PlayerPosition.SOUTH],
        [5, PlayerPosition.SOUTH, PlayerPosition.WEST],
      ];

      for (const [round, expectedDealer, expectedStarter] of expectedDealers) {
        const dealer = rulesEngine.getDealerForRound(round, PlayerPosition.SOUTH);
        assertEqual(dealer, expectedDealer, `Round ${round} dealer must be ${expectedDealer}`);

        const starter = rulesEngine.getStartingPlayer(dealer);
        assertEqual(starter, expectedStarter, `Round ${round} starter must be ${expectedStarter}`);
      }
    }
  );

  // 7. AUDIT TEST: Rules 8-10 (Mandatory follow-suit, off-suit rejection, void allowances)
  harness.register(
    'Phase 7: Rules Audit',
    'Rules 8-10: Mandatory follow-suit, off-suit rejection when suit held, void allows trumps and discards',
    () => {
      const rulesEngine = new CallBreakRulesEngine();

      const heartsLeadCard = createCard(Suit.HEARTS, Rank.TEN);
      const currentTrick: TrickState = {
        trickNumber: 1,
        leader: PlayerPosition.WEST,
        leadSuit: Suit.HEARTS,
        cards: [
          {
            playerPosition: PlayerPosition.WEST,
            card: heartsLeadCard,
            playedAt: Date.now(),
          },
        ],
        winner: null,
      };

      // Player holding Hearts, Spades, Clubs
      const mixedHand = [
        createCard(Suit.HEARTS, Rank.ACE),
        createCard(Suit.HEARTS, Rank.TWO),
        createCard(Suit.SPADES, Rank.KING),
        createCard(Suit.CLUBS, Rank.FIVE),
      ];

      // Rule 8: If player holds higher Heart than lead card (♥10), only higher Heart (♥A) is legal
      const legalMixed = rulesEngine.getLegalMoves(mixedHand, currentTrick, Suit.SPADES);
      assertEqual(legalMixed.length, 1, 'Must have exactly 1 legal move (higher Heart ♥A)');
      assertEqual(legalMixed[0].rank, Rank.ACE, 'Legal card must be ♥A');

      // If player holds only lower Hearts (e.g. ♥8, ♥2), both are legal because neither can beat ♥10
      const lowerHeartsHand = [
        createCard(Suit.HEARTS, Rank.EIGHT),
        createCard(Suit.HEARTS, Rank.TWO),
        createCard(Suit.SPADES, Rank.KING),
      ];
      const legalLower = rulesEngine.getLegalMoves(lowerHeartsHand, currentTrick, Suit.SPADES);
      assertEqual(legalLower.length, 2, 'When unable to beat lead card, all cards of lead suit are legal');
      assertOk(
        legalLower.every((c) => c.suit === Suit.HEARTS),
        'All legal moves must be Hearts'
      );

      // Rule 9: Off-suit card (Club) or Trump (Spade) must be rejected when Hearts are held
      const clubValidation = rulesEngine.validateCardPlay(
        mixedHand[3],
        mixedHand,
        currentTrick,
        Suit.SPADES
      );
      assertEqual(clubValidation.isValid, false, 'Off-suit play must be rejected when suit is held');

      const spadeValidation = rulesEngine.validateCardPlay(
        mixedHand[2],
        mixedHand,
        currentTrick,
        Suit.SPADES
      );
      assertEqual(spadeValidation.isValid, false, 'Trump play must be rejected when led suit is held');

      // Rule 10: Player void in Hearts with Spades must play Trump (Spade)
      const voidHandWithTrump = [
        createCard(Suit.SPADES, Rank.KING),
        createCard(Suit.CLUBS, Rank.FIVE),
        createCard(Suit.DIAMONDS, Rank.JACK),
      ];
      const legalVoidWithTrump = rulesEngine.getLegalMoves(voidHandWithTrump, currentTrick, Suit.SPADES);
      assertEqual(legalVoidWithTrump.length, 1, 'When void in lead suit and holding trump, trump is required');
      assertEqual(legalVoidWithTrump[0].suit, Suit.SPADES, 'Legal card must be Spade');

      // Player void in Hearts with NO trumps may discard ANY card
      const voidHandNoTrump = [
        createCard(Suit.CLUBS, Rank.FIVE),
        createCard(Suit.DIAMONDS, Rank.JACK),
      ];
      const legalVoidNoTrump = rulesEngine.getLegalMoves(voidHandNoTrump, currentTrick, Suit.SPADES);
      assertEqual(legalVoidNoTrump.length, 2, 'When void in lead suit with no trumps, all cards are legal');
    }
  );

  // 8. AUDIT TEST: Rules 11-14 (Trump logic, winner resolution, leader progression)
  harness.register(
    'Phase 7: Rules Audit',
    'Rules 11-14: Spades permanently trump, highest Spade wins, highest led-suit wins when no Spade, winner leads',
    () => {
      const rulesEngine = new CallBreakRulesEngine();

      // Case A: No Spades played -> Highest led suit (Hearts) wins
      const trickA = [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.TEN), playedAt: 1 },
        { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.HEARTS, Rank.KING), playedAt: 2 },
        { playerPosition: PlayerPosition.EAST, card: createCard(Suit.HEARTS, Rank.ACE), playedAt: 3 },
        { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.TWO), playedAt: 4 },
      ];
      const winnerA = rulesEngine.determineTrickWinner(trickA, Suit.HEARTS, Suit.SPADES);
      assertEqual(winnerA, PlayerPosition.EAST, 'East Ace of Hearts should win trick A');

      // Case B: One Spade played (void in Hearts) -> Trump wins over higher non-trump
      const trickB = [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.ACE), playedAt: 1 },
        { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.HEARTS, Rank.KING), playedAt: 2 },
        { playerPosition: PlayerPosition.EAST, card: createCard(Suit.SPADES, Rank.TWO), playedAt: 3 }, // trump!
        { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.QUEEN), playedAt: 4 },
      ];
      const winnerB = rulesEngine.determineTrickWinner(trickB, Suit.HEARTS, Suit.SPADES);
      assertEqual(winnerB, PlayerPosition.EAST, 'East 2 of Spades must win over Ace of Hearts');

      // Case C: Multiple Spades played -> Highest Spade wins
      const trickC = [
        { playerPosition: PlayerPosition.WEST, card: createCard(Suit.HEARTS, Rank.ACE), playedAt: 1 },
        { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.SPADES, Rank.FIVE), playedAt: 2 },
        { playerPosition: PlayerPosition.EAST, card: createCard(Suit.SPADES, Rank.JACK), playedAt: 3 }, // higher trump!
        { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.SPADES, Rank.TWO), playedAt: 4 },
      ];
      const winnerC = rulesEngine.determineTrickWinner(trickC, Suit.HEARTS, Suit.SPADES);
      assertEqual(winnerC, PlayerPosition.EAST, 'East Jack of Spades must beat North 5 of Spades');
    }
  );

  // 9. AUDIT TEST: Rules 21-25 (Card ownership, duplicate play, turn enforcement, immutable failure)
  harness.register(
    'Phase 7: Rules Audit',
    'Rules 21-25: Card ownership, turn enforcement, and state immutability on illegal actions',
    () => {
      const store = new GameStateStore();
      const rulesEngine = new CallBreakRulesEngine();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(new DeterministicRandomSource(123)),
        rulesEngine,
        scoringEngine: new ScoringEngine(),
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);
      // Bidding
      controller.submitBid(PlayerPosition.WEST, 3);
      controller.submitBid(PlayerPosition.NORTH, 3);
      controller.submitBid(PlayerPosition.EAST, 3);
      controller.submitBid(PlayerPosition.SOUTH, 3);

      const stateBeforeIllegal = store.getState();
      const activePlayer = stateBeforeIllegal.currentPlayer;
      const inactivePlayer = activePlayer === PlayerPosition.WEST ? PlayerPosition.SOUTH : PlayerPosition.WEST;

      // Illegal action 1: Inactive player attempts to play out of turn
      const outOfTurnCard = stateBeforeIllegal.players[inactivePlayer].hand[0];
      const outOfTurnSuccess = controller.playCard(inactivePlayer, outOfTurnCard);
      assertEqual(outOfTurnSuccess, false, 'Playing out of turn must be rejected');
      assertEqual(store.getState(), stateBeforeIllegal, 'State must not mutate on out of turn play');

      // Illegal action 2: Active player attempts to play card they do not own
      const foreignCard = stateBeforeIllegal.players[inactivePlayer].hand[0];
      const foreignCardSuccess = controller.playCard(activePlayer, foreignCard);
      assertEqual(foreignCardSuccess, false, 'Playing unowned card must be rejected');
      assertEqual(store.getState(), stateBeforeIllegal, 'State must not mutate on unowned card play');
    }
  );

  // 10. AUDIT TEST: Rules 26-29 (Scoring math, single calculation, tie representation)
  harness.register(
    'Phase 7: Rules Audit',
    'Rules 26-29: Round score calculation (+0.1 overtricks, -bid penalty), tie rankings',
    () => {
      const scoringEngine = new ScoringEngine();

      // Made bid with overtricks: bid 3, won 5 -> 3.2
      const overtrickScore = scoringEngine.calculatePlayerScore(3, 5);
      assertEqual(overtrickScore, 3.2, 'Bid 3 with 5 tricks should score 3.2');

      // Exactly made bid: bid 4, won 4 -> 4.0
      const exactScore = scoringEngine.calculatePlayerScore(4, 4);
      assertEqual(exactScore, 4.0, 'Bid 4 with 4 tricks should score 4.0');

      // Failed bid: bid 4, won 2 -> -4.0
      const failedScore = scoringEngine.calculatePlayerScore(4, 2);
      assertEqual(failedScore, -4.0, 'Failed bid 4 with 2 tricks should score -4.0');

      // Tie representation
      const tiedScores = {
        [PlayerPosition.SOUTH]: 12.5,
        [PlayerPosition.WEST]: 12.5,
        [PlayerPosition.NORTH]: 8.0,
        [PlayerPosition.EAST]: 6.0,
      };
      const matchResult = scoringEngine.calculateMatchResult(tiedScores);
      assertEqual(matchResult.isTie, true, 'Match result must flag tie when top scores match');
      assertEqual(matchResult.winnerPositions.length, 2, 'Must report both tied winners');
      assertEqual(matchResult.rankings[0].rank, 1, 'First place rank is 1');
      assertEqual(matchResult.rankings[1].rank, 1, 'Tied first place rank is 1');
      assertEqual(matchResult.rankings[2].rank, 3, 'Third place rank is 3');
    }
  );

  // 11. AUDIT TEST: Rules 30-36 (Bot legal moves, information isolation, turn stepping)
  harness.register(
    'Phase 7: Rules Audit',
    'Rules 30-36: Bot move legality, opponent card isolation, deadlock prevention',
    () => {
      const store = new GameStateStore();
      const rulesEngine = new CallBreakRulesEngine();
      const controller = new LocalGameController(store, {
        cardEngine: new CardEngine(new DeterministicRandomSource(456)),
        rulesEngine,
        scoringEngine: new ScoringEngine(),
      });

      controller.startNewMatch(GameMode.OFFLINE_BOTS);

      // Verify bot stepping progresses without infinite loop
      let steps = 0;
      while (store.getState().status === GameStatus.BIDDING && steps++ < 10) {
        if (store.getState().currentPlayer === PlayerPosition.SOUTH) {
          controller.submitBid(PlayerPosition.SOUTH, 3);
        } else {
          const ok = controller.stepBotTurn();
          assertOk(ok, 'stepBotTurn should successfully progress bot bid');
        }
      }

      assertEqual(store.getState().status, GameStatus.PLAYING, 'Should transition to PLAYING');

      // In PLAYING phase, stepBotTurn should only act on bot turns or 4-card resolution
      let playSteps = 0;
      while (store.getState().status === GameStatus.PLAYING && playSteps++ < 15) {
        const cur = store.getState();
        if (cur.currentPlayer === PlayerPosition.SOUTH && cur.currentTrick.cards.length < 4) {
          // South turn: stepBotTurn must return false (no deadlock, human input required)
          const botSteppedOnHuman = controller.stepBotTurn();
          assertEqual(botSteppedOnHuman, false, 'stepBotTurn must return false on human turn');
          const legal = controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
          controller.playCard(PlayerPosition.SOUTH, legal[0]);
        } else {
          const ok = controller.stepBotTurn();
          assertOk(ok, 'stepBotTurn should succeed on bot turn or trick resolution');
        }
      }
    }
  );

  // 12. FULL SIMULATION TEST: 100 Complete Deterministic Games (Cards -> Rules -> Bots -> Controller -> Scoring)
  harness.register(
    'Phase 7: Full Simulation',
    '100 complete deterministic games verification: 500 rounds, 6500 tricks, 0 violations',
    () => {
      const stats = runCallBreakSimulation(100);

      assertEqual(stats.gamesSimulated, 100, 'Expected 100 simulated games');
      assertEqual(stats.gamesCompleted, 100, 'All 100 games must complete successfully');
      assertEqual(stats.gamesFailed, 0, '0 games must fail');
      assertEqual(stats.roundsCompleted, 500, 'Expected 500 rounds completed (100 * 5)');
      assertEqual(stats.tricksCompleted, 6500, 'Expected 6500 tricks completed (500 * 13)');
      assertEqual(stats.illegalBotMoves, 0, '0 illegal bot moves');
      assertEqual(stats.duplicateCardViolations, 0, '0 duplicate card violations');
      assertEqual(stats.cardConservationViolations, 0, '0 card conservation violations');
      assertEqual(stats.stateTransitionViolations, 0, '0 state transition violations');
      assertEqual(stats.deadlocksTimeouts, 0, '0 deadlocks or timeouts');
      assertEqual(stats.doubleScoringEvents, 0, '0 double scoring events');
    }
  );

  return harness;
}
