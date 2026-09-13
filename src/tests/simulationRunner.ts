import { GameStateStore } from '../core/state/gameStore';
import { LocalGameController } from '../core/controller/LocalGameController';
import { CardEngine } from '../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../core/scoring/ScoringEngine';
import { MediumBotStrategy } from '../core/bot/MediumBotStrategy';
import { DeterministicRandomSource } from '../core/random/IRandomSource';
import { Card } from '../models/card';
import { GameMode, GameStatus } from '../models/gameState';
import { PlayerPosition, PlayerType, CLOCKWISE_PLAYER_ORDER } from '../models/player';
import { areCardsEqual } from '../core/deck/cardUtils';

export interface SimulationAuditStats {
  gamesSimulated: number;
  gamesCompleted: number;
  gamesFailed: number;
  roundsCompleted: number;
  tricksCompleted: number;
  illegalBotMoves: number;
  duplicateCardViolations: number;
  cardConservationViolations: number;
  stateTransitionViolations: number;
  deadlocksTimeouts: number;
  doubleScoringEvents: number;
}

/**
 * Runs deterministic simulation of complete 5-round Call Break matches
 * strictly using the architectural stack:
 * CardEngine -> RulesEngine -> BotStrategy -> GameController -> ScoringEngine.
 */
export function runCallBreakSimulation(gameCount: number = 100): SimulationAuditStats {
  const stats: SimulationAuditStats = {
    gamesSimulated: gameCount,
    gamesCompleted: 0,
    gamesFailed: 0,
    roundsCompleted: 0,
    tricksCompleted: 0,
    illegalBotMoves: 0,
    duplicateCardViolations: 0,
    cardConservationViolations: 0,
    stateTransitionViolations: 0,
    deadlocksTimeouts: 0,
    doubleScoringEvents: 0,
  };

  const rulesEngine = new CallBreakRulesEngine();
  const scoringEngine = new ScoringEngine();
  const botStrategy = new MediumBotStrategy();

  for (let gameIdx = 1; gameIdx <= gameCount; gameIdx++) {
    // Deterministic seed per game for 100% reproducibility
    const seed = 10007 + gameIdx * 7919;
    const rng = new DeterministicRandomSource(seed);
    const cardEngine = new CardEngine(rng);
    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      cardEngine,
      rulesEngine,
      scoringEngine,
    });

    let gameFailed = false;

    // Start match
    controller.startNewMatch(GameMode.OFFLINE_BOTS);

    // Set all players to BOT type to run headless simulation through controller
    store.setState((prev) => {
      const updatedPlayers = { ...prev.players };
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        updatedPlayers[pos] = {
          ...updatedPlayers[pos],
          type: PlayerType.BOT,
        };
      }
      return {
        ...prev,
        players: updatedPlayers,
      };
    });

    for (let round = 1; round <= 5; round++) {
      let state = store.getState();

      // Ensure all players are BOT type in case round re-initialized
      store.setState((prev) => {
        const updatedPlayers = { ...prev.players };
        for (const pos of CLOCKWISE_PLAYER_ORDER) {
          updatedPlayers[pos] = {
            ...updatedPlayers[pos],
            type: PlayerType.BOT,
          };
        }
        return {
          ...prev,
          players: updatedPlayers,
        };
      });

      // Verify Round start invariants
      if (state.currentRound !== round || state.status !== GameStatus.BIDDING) {
        stats.stateTransitionViolations++;
        gameFailed = true;
        break;
      }

      // Check card uniqueness & conservation at deal
      const allDealtCards = [
        ...state.players.SOUTH.hand,
        ...state.players.WEST.hand,
        ...state.players.NORTH.hand,
        ...state.players.EAST.hand,
      ];
      if (allDealtCards.length !== 52) {
        stats.cardConservationViolations++;
        gameFailed = true;
        break;
      }
      const cardIdSet = new Set(allDealtCards.map((c) => c.id));
      if (cardIdSet.size !== 52) {
        stats.duplicateCardViolations++;
        gameFailed = true;
        break;
      }

      // Phase A: Bidding (all 4 players)
      let biddingSteps = 0;
      while (store.getState().status === GameStatus.BIDDING && biddingSteps++ < 30) {
        const cur = store.getState();
        const expected = rulesEngine.getExpectedBiddingPlayer(cur);
        if (!expected) break;

        const playerHand = cur.players[expected].hand;
        const bid = botStrategy.decideBid(playerHand, {
          position: expected,
          dealer: cur.dealer,
          existingBids: {
            SOUTH: cur.players.SOUTH.currentBid,
            WEST: cur.players.WEST.currentBid,
            NORTH: cur.players.NORTH.currentBid,
            EAST: cur.players.EAST.currentBid,
          },
          trumpSuit: cur.config.trumpSuit,
        });

        const validation = rulesEngine.validateBid(bid, expected, cur);
        if (!validation.isValid) {
          stats.illegalBotMoves++;
          gameFailed = true;
          break;
        }

        const bidSuccess = controller.submitBid(expected, bid);
        if (!bidSuccess) {
          stats.illegalBotMoves++;
          gameFailed = true;
          break;
        }
      }

      if (biddingSteps >= 30) {
        stats.deadlocksTimeouts++;
        gameFailed = true;
        break;
      }

      state = store.getState();
      if (state.status !== GameStatus.PLAYING) {
        stats.stateTransitionViolations++;
        gameFailed = true;
        break;
      }

      // Phase B: Playing (13 tricks)
      let playSteps = 0;
      let tricksInRound = 0;

      while (store.getState().status === GameStatus.PLAYING && playSteps++ < 300) {
        const cur = store.getState();

        // Check card conservation invariant:
        // total cards in hand + current trick cards + completed tricks cards = 52
        const handCards =
          cur.players.SOUTH.hand.length +
          cur.players.WEST.hand.length +
          cur.players.NORTH.hand.length +
          cur.players.EAST.hand.length;
        const currentTrickCards = cur.currentTrick.cards.length;
        const completedTrickCards = cur.completedTricks.length * 4;

        if (handCards + currentTrickCards + completedTrickCards !== 52) {
          stats.cardConservationViolations++;
          gameFailed = true;
          break;
        }

        const activePlayer = cur.currentPlayer;
        const legalMoves = controller.getLegalMovesForPlayer(activePlayer);

        if (legalMoves.length === 0) {
          stats.illegalBotMoves++;
          gameFailed = true;
          break;
        }

        // Context for bot decision
        const playDecision = botStrategy.decideCardPlay({
          position: activePlayer,
          hand: cur.players[activePlayer].hand,
          legalMoves,
          currentTrick: cur.currentTrick,
          trumpSuit: cur.config.trumpSuit,
          playerBid: cur.players[activePlayer].currentBid ?? 1,
          playerTricksWon: cur.players[activePlayer].tricksWon,
          remainingCardsCount: {
            SOUTH: cur.players.SOUTH.hand.length,
            WEST: cur.players.WEST.hand.length,
            NORTH: cur.players.NORTH.hand.length,
            EAST: cur.players.EAST.hand.length,
          },
          completedTricks: cur.completedTricks,
        });

        const chosenCard: Card =
          'card' in (playDecision as object)
            ? (playDecision as unknown as { card: Card }).card
            : (playDecision as unknown as Card);

        // Verify legal move
        const moveValidation = rulesEngine.isLegalPlay(cur, activePlayer, chosenCard);
        if (!moveValidation.isValid) {
          stats.illegalBotMoves++;
          gameFailed = true;
          break;
        }

        const completedTricksBefore = cur.completedTricks.length;
        const playSuccess = controller.playCard(activePlayer, chosenCard);

        if (!playSuccess) {
          stats.illegalBotMoves++;
          gameFailed = true;
          break;
        }

        const afterPlay = store.getState();
        if (afterPlay.completedTricks.length > completedTricksBefore) {
          tricksInRound++;
          stats.tricksCompleted++;
        }
      }

      if (playSteps >= 300) {
        stats.deadlocksTimeouts++;
        gameFailed = true;
        break;
      }

      state = store.getState();
      if (state.status !== GameStatus.ROUND_ENDED || tricksInRound !== 13) {
        stats.stateTransitionViolations++;
        gameFailed = true;
        break;
      }

      stats.roundsCompleted++;

      // Phase C: Scoring Round
      const scoredCountBefore = state.roundScores.length;
      controller.completeRound();
      state = store.getState();

      if (state.roundScores.length !== scoredCountBefore + 1) {
        stats.doubleScoringEvents++;
        gameFailed = true;
        break;
      }

      // Check if another completeRound would cause double scoring
      const doubleScoreValidation = scoringEngine.validateStateForScoring(state);
      if (doubleScoreValidation.isValid) {
        stats.doubleScoringEvents++;
        gameFailed = true;
      }

      // Transition to next round if round < 5
      if (round < 5) {
        const nextRoundSuccess = controller.nextRound();
        if (!nextRoundSuccess) {
          stats.stateTransitionViolations++;
          gameFailed = true;
          break;
        }
      }
    }

    const finalState = store.getState();
    if (
      !gameFailed &&
      finalState.status === GameStatus.MATCH_FINISHED &&
      finalState.roundScores.length === 5 &&
      finalState.matchResult !== null
    ) {
      stats.gamesCompleted++;
    } else {
      stats.gamesFailed++;
    }
  }

  return stats;
}
