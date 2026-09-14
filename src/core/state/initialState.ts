/**
 * Pristine Initial State Definition for Call Break (Lakdi)
 * Phase 1 Architecture Foundation
 */

import { Suit } from '../../models/card';
import { PlayerPosition, PlayerType } from '../../models/player';
import { GameMode, GameState, GameStatus } from '../../models/gameState';

export function createInitialPlayers() {
  return {
    [PlayerPosition.SOUTH]: {
      id: 'player_south',
      name: 'You',
      type: PlayerType.HUMAN,
      position: PlayerPosition.SOUTH,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: false,
    },
    [PlayerPosition.WEST]: {
      id: 'player_west',
      name: 'West Player',
      type: PlayerType.BOT,
      position: PlayerPosition.WEST,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: false,
    },
    [PlayerPosition.NORTH]: {
      id: 'player_north',
      name: 'North Player',
      type: PlayerType.BOT,
      position: PlayerPosition.NORTH,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: true, // Round 1 default dealer
    },
    [PlayerPosition.EAST]: {
      id: 'player_east',
      name: 'East Player',
      type: PlayerType.BOT,
      position: PlayerPosition.EAST,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: false,
    },
  };
}

export function createInitialGameState(mode: GameMode = GameMode.OFFLINE_BOTS): GameState {
  const players = createInitialPlayers();

  return {
    matchId: `match_${Date.now()}`,
    mode,
    status: GameStatus.IDLE,
    config: {
      totalRounds: 5,
      trumpSuit: Suit.SPADES,
      minBid: 1,
      maxBid: 13,
      cardsPerPlayer: 13,
    },
    currentRound: 1,
    dealer: PlayerPosition.NORTH,
    currentPlayer: PlayerPosition.EAST, // Traditional counter-clockwise lead from dealer
    players,
    currentTrick: {
      trickNumber: 1,
      leader: PlayerPosition.EAST,
      leadSuit: null,
      cards: [],
      winner: null,
    },
    completedTricks: [],
    roundScores: [],
    cumulativeScores: {
      [PlayerPosition.SOUTH]: 0,
      [PlayerPosition.WEST]: 0,
      [PlayerPosition.NORTH]: 0,
      [PlayerPosition.EAST]: 0,
    },
    matchResult: null,
    lastActionMessage: 'Phase 1 architectural foundation initialized. Ready for Phase 2 card engine integration.',
  };
}
