/**
 * Complete Call Break Rules Engine
 * Implements IRulesEngine.
 * Encapsulates call/bid phase, turn progression, follow-suit rules, trump logic,
 * trick resolution, dealer rotation, and round state transitions.
 * Pure TypeScript. Zero UI or rendering dependencies.
 * Phase 3 Call Break Rules Engine
 */

import { Card, Suit } from '../../models/card';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import {
  GameMode,
  GameState,
  GameStatus,
  PlayedCard,
  TrickState,
  CompletedTrick,
} from '../../models/gameState';
import { ICardEngine } from '../contracts/ICardEngine';
import { IRulesEngine, ValidationResult } from '../contracts/IRulesEngine';
import { areCardsEqual } from '../deck/cardUtils';
import {
  DEFAULT_TRUMP_SUIT,
  TRICKS_PER_ROUND,
  getNextPlayerClockwise,
  getDealerForRound,
  getStartingPlayerForRound,
  getExpectedBiddingPlayer,
  validateBid,
  getLegalMoves,
  validateCardPlay,
  isLegalPlay,
  determineTrickWinner,
} from './rulesUtils';
import {
  IDealerDirectionPolicy,
  defaultDealerDirectionPolicy,
} from './dealerDirectionPolicy';

export class CallBreakRulesEngine implements IRulesEngine {
  private readonly trumpSuit: Suit;
  private readonly dealerDirectionPolicy: IDealerDirectionPolicy;

  constructor(
    trumpSuitOrPolicy: Suit | IDealerDirectionPolicy = DEFAULT_TRUMP_SUIT,
    dealerDirectionPolicy: IDealerDirectionPolicy = defaultDealerDirectionPolicy
  ) {
    if (typeof trumpSuitOrPolicy === 'object' && 'getNextPlayer' in trumpSuitOrPolicy) {
      this.trumpSuit = DEFAULT_TRUMP_SUIT;
      this.dealerDirectionPolicy = trumpSuitOrPolicy;
    } else {
      this.trumpSuit = trumpSuitOrPolicy as Suit;
      this.dealerDirectionPolicy = dealerDirectionPolicy;
    }
  }

  public getDealerDirectionPolicy(): IDealerDirectionPolicy {
    return this.dealerDirectionPolicy;
  }

  public getNextPlayer(current: PlayerPosition): PlayerPosition {
    return this.dealerDirectionPolicy.getNextPlayer(current);
  }

  public getDealerForRound(
    roundNumber: number,
    initialDealer: PlayerPosition = PlayerPosition.SOUTH
  ): PlayerPosition {
    return this.dealerDirectionPolicy.getDealerForRound(roundNumber, initialDealer);
  }

  public getStartingPlayer(dealer: PlayerPosition): PlayerPosition {
    return this.dealerDirectionPolicy.getStartingPlayer(dealer);
  }

  public getExpectedBiddingPlayer(state: GameState): PlayerPosition | null {
    return getExpectedBiddingPlayer(state);
  }

  public validateBid(
    bid: number,
    playerPosition: PlayerPosition,
    state: GameState
  ): ValidationResult {
    return validateBid(bid, playerPosition, state);
  }

  public getLegalMoves(
    playerHand: readonly Card[],
    currentTrick: TrickState,
    trumpSuit: Suit = this.trumpSuit
  ): readonly Card[] {
    return getLegalMoves(playerHand, currentTrick, trumpSuit);
  }

  public validateCardPlay(
    cardToPlay: Card,
    playerHand: readonly Card[],
    currentTrick: TrickState,
    trumpSuit: Suit = this.trumpSuit
  ): ValidationResult {
    return validateCardPlay(cardToPlay, playerHand, currentTrick, trumpSuit);
  }

  public isLegalPlay(
    state: GameState,
    playerPosition: PlayerPosition,
    card: Card
  ): ValidationResult {
    return isLegalPlay(state, playerPosition, card);
  }

  public determineTrickWinner(
    playedCards: readonly PlayedCard[],
    leadSuit: Suit,
    trumpSuit: Suit = this.trumpSuit
  ): PlayerPosition {
    return determineTrickWinner(playedCards, leadSuit, trumpSuit);
  }

  /**
   * Deterministic round initialization:
   * 1. Establishes dealer according to round rotation
   * 2. Establishes starting player (clockwise from dealer)
   * 3. Creates fresh 52-card deck and shuffles via ICardEngine
   * 4. Deals 13 cards each to SOUTH, WEST, NORTH, EAST
   * 5. Clears trick and bid states
   * 6. Sets status to BIDDING with currentPlayer as starting player
   */
  public initializeRound(
    state: GameState,
    cardEngine: ICardEngine,
    seed?: number
  ): GameState {
    const roundNumber = state.currentRound;
    const dealer = this.getDealerForRound(roundNumber, PlayerPosition.SOUTH);
    const startingPlayer = this.getStartingPlayer(dealer);

    // Deck lifecycle
    const deck = cardEngine.createDeck();
    const shuffledDeck = cardEngine.shuffle(deck, seed);

    // Solo Offline mode (human vs bots): 10%-12% weighted deal boost for South
    // Online Multiplayer mode or seeded test runs: strictly unweighted uniform random Fisher-Yates deal
    let dealtHands: Readonly<Record<PlayerPosition, readonly Card[]>>;
    if (state.mode === GameMode.OFFLINE_BOTS && seed === undefined && typeof cardEngine.dealWeighted === 'function') {
      dealtHands = cardEngine.dealWeighted(shuffledDeck, PlayerPosition.SOUTH);
    } else {
      dealtHands = cardEngine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
    }

    // Prepare fresh player states
    const updatedPlayers: Record<PlayerPosition, any> = { ...state.players };

    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const rawHand = dealtHands[pos] ?? [];
      // All player hands sorted according to standard Call Break rules (Spades -> Hearts -> Diamonds -> Clubs, rank descending)
      const hand = cardEngine.sortHand(rawHand);

      updatedPlayers[pos] = {
        ...state.players[pos],
        hand,
        currentBid: null,
        tricksWon: 0,
        isTurn: pos === startingPlayer,
        isDealer: pos === dealer,
      };
    }

    return Object.freeze({
      ...state,
      status: GameStatus.BIDDING,
      dealer,
      currentPlayer: startingPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        trickNumber: 1,
        leader: startingPlayer,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null,
      }),
      completedTricks: Object.freeze([]),
      lastActionMessage: `Round ${roundNumber} started. Dealer is ${dealer}. Waiting for ${startingPlayer} to call.`,
    });
  }

  /**
   * Applies a player's bid:
   * 1. Validates bid
   * 2. Updates player's bid
   * 3. Advances turn to next bidder or transitions to PLAYING if all 4 have bid
   */
  public applyBid(
    state: GameState,
    playerPosition: PlayerPosition,
    bid: number
  ): GameState {
    const validation = this.validateBid(bid, playerPosition, state);
    if (!validation.isValid) {
      throw new Error(`Invalid bid: ${validation.reason}`);
    }

    const updatedPlayers = {
      ...state.players,
      [playerPosition]: {
        ...state.players[playerPosition],
        currentBid: bid,
      },
    };

    const intermediateState: GameState = {
      ...state,
      players: updatedPlayers,
    };

    const nextBidder = this.getExpectedBiddingPlayer(intermediateState);

    // If there is another bidder, advance bidding turn
    if (nextBidder !== null) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        updatedPlayers[pos] = {
          ...updatedPlayers[pos],
          isTurn: pos === nextBidder,
        };
      }

      return Object.freeze({
        ...state,
        currentPlayer: nextBidder,
        players: Object.freeze(updatedPlayers),
        lastActionMessage: `${state.players[playerPosition].name} called ${bid}. Waiting for ${state.players[nextBidder].name}.`,
      });
    }

    // All 4 bids are complete -> Transition to PLAYING phase
    const startingPlayer = this.getStartingPlayer(state.dealer);
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      updatedPlayers[pos] = {
        ...updatedPlayers[pos],
        isTurn: pos === startingPlayer,
      };
    }

    return Object.freeze({
      ...state,
      status: GameStatus.PLAYING,
      currentPlayer: startingPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        trickNumber: 1,
        leader: startingPlayer,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null,
      }),
      lastActionMessage: `All bids placed. Round play started! ${state.players[startingPlayer].name} leads the first trick.`,
    });
  }

  /**
   * Applies a card play:
   * 1. Validates legal move
   * 2. Removes card from player's hand
   * 3. Adds card to current trick
   * 4. If trick reaches 4 cards, automatically resolves trick
   * 5. Otherwise advances to next player
   */
  public applyCardPlay(
    state: GameState,
    playerPosition: PlayerPosition,
    card: Card
  ): GameState {
    const validation = this.isLegalPlay(state, playerPosition, card);
    if (!validation.isValid) {
      throw new Error(`Illegal card play: ${validation.reason}`);
    }

    const player = state.players[playerPosition];
    const newHand = player.hand.filter((c) => !areCardsEqual(c, card));

    const playedCard: PlayedCard = Object.freeze({
      playerPosition,
      card,
      playedAt: Date.now(),
    });

    const isFirstCard = state.currentTrick.cards.length === 0;
    const leadSuit = isFirstCard ? card.suit : state.currentTrick.leadSuit;
    const updatedCards = Object.freeze([...state.currentTrick.cards, playedCard]);

    const updatedPlayers = {
      ...state.players,
      [playerPosition]: {
        ...player,
        hand: Object.freeze(newHand),
      },
    };

    // If trick now contains 4 cards, resolve the trick
    if (updatedCards.length === 4) {
      const trickWinner = this.determineTrickWinner(
        updatedCards,
        leadSuit!,
        state.config.trumpSuit
      );

      const resolvedTrickState: TrickState = Object.freeze({
        ...state.currentTrick,
        leadSuit,
        cards: updatedCards,
        winner: trickWinner,
      });

      const stateWithCompletedTrick: GameState = {
        ...state,
        players: updatedPlayers,
        currentTrick: resolvedTrickState,
      };

      return this.resolveCurrentTrick(stateWithCompletedTrick);
    }

    // Otherwise, advance to next player in clockwise order
    const nextPlayer = this.getNextPlayer(playerPosition);
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      updatedPlayers[pos] = {
        ...updatedPlayers[pos],
        isTurn: pos === nextPlayer,
      };
    }

    return Object.freeze({
      ...state,
      currentPlayer: nextPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        ...state.currentTrick,
        leadSuit,
        cards: updatedCards,
      }),
      lastActionMessage: `${player.name} played ${card.rank} of ${card.suit}. Turn: ${state.players[nextPlayer].name}.`,
    });
  }

  /**
   * Resolves a completed 4-card trick:
   * 1. Records trick in completedTricks
   * 2. Increments trick winner's tricksWon count
   * 3. If 13 tricks are completed, transitions round to ROUND_ENDED
   * 4. Otherwise, starts next trick with winner leading
   */
  public resolveCurrentTrick(state: GameState): GameState {
    const { currentTrick } = state;
    if (currentTrick.cards.length !== 4) {
      throw new Error(
        `Cannot resolve trick: trick contains ${currentTrick.cards.length} cards, expected 4.`
      );
    }

    const winner =
      currentTrick.winner ??
      this.determineTrickWinner(
        currentTrick.cards,
        currentTrick.leadSuit!,
        state.config.trumpSuit
      );

    const completedTrick: CompletedTrick = Object.freeze({
      trickNumber: currentTrick.trickNumber,
      leader: currentTrick.leader,
      leadSuit: currentTrick.leadSuit!,
      cards: currentTrick.cards,
      winner,
    });

    const completedTricks = Object.freeze([...state.completedTricks, completedTrick]);
    const winnerPlayer = state.players[winner];

    const updatedPlayers = {
      ...state.players,
      [winner]: {
        ...winnerPlayer,
        tricksWon: winnerPlayer.tricksWon + 1,
      },
    };

    // Check if 13 tricks are complete -> Round ends
    if (completedTricks.length >= TRICKS_PER_ROUND) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        updatedPlayers[pos] = {
          ...updatedPlayers[pos],
          isTurn: false,
        };
      }

      return Object.freeze({
        ...state,
        status: GameStatus.ROUND_ENDED,
        players: Object.freeze(updatedPlayers),
        completedTricks,
        lastActionMessage: `Round ${state.currentRound} complete! All 13 tricks played. ${winnerPlayer.name} won trick 13.`,
      });
    }

    // Set up next trick with trick winner as leader
    const nextTrickNumber = completedTricks.length + 1;
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      updatedPlayers[pos] = {
        ...updatedPlayers[pos],
        isTurn: pos === winner,
      };
    }

    return Object.freeze({
      ...state,
      currentPlayer: winner,
      players: Object.freeze(updatedPlayers),
      completedTricks,
      currentTrick: Object.freeze({
        trickNumber: nextTrickNumber,
        leader: winner,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null,
      }),
      lastActionMessage: `${winnerPlayer.name} won trick ${currentTrick.trickNumber} and leads trick ${nextTrickNumber}.`,
    });
  }

  public calculateRoundScore(bid: number, tricksWon: number): number {
    if (tricksWon >= bid) {
      // Made bid: bid points + 0.1 for each overtrick
      return Number((bid + (tricksWon - bid) * 0.1).toFixed(1));
    }
    // Failed bid: negative bid points
    return -bid;
  }

  public isRoundComplete(completedTricksCount: number): boolean {
    return completedTricksCount >= TRICKS_PER_ROUND;
  }

  public isMatchComplete(currentRound: number, totalRounds: number): boolean {
    return currentRound >= totalRounds;
  }

  public rankPlayersByScore(
    cumulativeScores: Readonly<Record<PlayerPosition, number>>
  ): readonly { position: PlayerPosition; score: number; rank: number }[] {
    const list = CLOCKWISE_PLAYER_ORDER.map((pos) => ({
      position: pos,
      score: cumulativeScores[pos] ?? 0,
      rank: 1,
    }));

    list.sort((a, b) => b.score - a.score);

    return Object.freeze(
      list.map((item, index) => ({
        ...item,
        rank: index + 1,
      }))
    );
  }

  /**
   * Calculates the sum of all 4 players' current bids in the round.
   */
  public getTotalBids(state: GameState): number {
    return CLOCKWISE_PLAYER_ORDER.reduce((sum, pos) => {
      const bid = state.players[pos]?.currentBid;
      return sum + (typeof bid === 'number' ? bid : 0);
    }, 0);
  }

  /**
   * Checks whether re-bidding is required for the round after all 4 players have submitted their bids.
   * Special Call Break rule: if the sum of all 4 bids is <= 8, minimum bid total was not reached.
   */
  public isRebidRequired(state: GameState): boolean {
    const allHaveBid = CLOCKWISE_PLAYER_ORDER.every(
      (pos) => typeof state.players[pos]?.currentBid === 'number'
    );
    if (!allHaveBid) return false;
    return this.getTotalBids(state) <= 8;
  }

  /**
   * Re-deals 13 cards to all players and restarts bidding phase for the current round
   * without penalizing cumulative scores or advancing the dealer.
   */
  public redealRound(
    state: GameState,
    cardEngine: ICardEngine,
    seed?: number
  ): GameState {
    const roundNumber = state.currentRound;
    const dealer = state.dealer;
    const startingPlayer = this.getStartingPlayer(dealer);

    // Deck lifecycle
    const deck = cardEngine.createDeck();
    const shuffledDeck = cardEngine.shuffle(deck, seed);

    // Solo Offline mode (human vs bots): 10%-12% weighted deal boost for South
    // Online Multiplayer mode or seeded test runs: strictly unweighted uniform random Fisher-Yates deal
    let dealtHands: Readonly<Record<PlayerPosition, readonly Card[]>>;
    if (state.mode === GameMode.OFFLINE_BOTS && seed === undefined && typeof cardEngine.dealWeighted === 'function') {
      dealtHands = cardEngine.dealWeighted(shuffledDeck, PlayerPosition.SOUTH);
    } else {
      dealtHands = cardEngine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
    }

    // Prepare fresh player states for re-bid, keeping cumulative scores intact
    const updatedPlayers: Record<PlayerPosition, any> = { ...state.players };

    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const rawHand = dealtHands[pos] ?? [];
      const hand = pos === PlayerPosition.SOUTH ? cardEngine.sortHand(rawHand) : rawHand;

      updatedPlayers[pos] = {
        ...state.players[pos],
        hand,
        currentBid: null,
        tricksWon: 0,
        isTurn: pos === startingPlayer,
        isDealer: pos === dealer,
      };
    }

    const totalBids = this.getTotalBids(state);

    return Object.freeze({
      ...state,
      status: GameStatus.BIDDING,
      dealer,
      currentPlayer: startingPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        trickNumber: 1,
        leader: startingPlayer,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null,
      }),
      completedTricks: Object.freeze([]),
      lastActionMessage: `Total bids = ${totalBids} (≤ 8). Minimum bid total not reached. Re-bidding round!`,
    });
  }
}
