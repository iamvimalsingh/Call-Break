/**
 * Centralized Game State Model for Call Break (Lakdi)
 * Phase 1 Architecture Foundation
 */

import { Card, Suit } from './card';
import { PlayerPosition, PlayerState } from './player';

export enum GameStatus {
  IDLE = 'IDLE',
  DEALING = 'DEALING',
  BIDDING = 'BIDDING',
  PLAYING = 'PLAYING',
  ROUND_ENDED = 'ROUND_ENDED',
  MATCH_FINISHED = 'MATCH_FINISHED',
}

export enum GameMode {
  OFFLINE_BOTS = 'OFFLINE_BOTS',
  PASS_AND_PLAY = 'PASS_AND_PLAY',
  ONLINE_MULTIPLAYER = 'ONLINE_MULTIPLAYER', // For future phases
}

export interface PlayedCard {
  readonly playerPosition: PlayerPosition;
  readonly card: Card;
  readonly playedAt: number; // timestamp
}

export interface TrickState {
  readonly trickNumber: number; // 1 to 13
  readonly leader: PlayerPosition;
  readonly leadSuit: Suit | null;
  readonly cards: readonly PlayedCard[];
  readonly winner: PlayerPosition | null;
}

export interface CompletedTrick {
  readonly trickNumber: number;
  readonly leader: PlayerPosition;
  readonly leadSuit: Suit;
  readonly cards: readonly PlayedCard[];
  readonly winner: PlayerPosition;
}

export interface PlayerRoundScore {
  readonly playerPosition: PlayerPosition;
  readonly bid: number;
  readonly tricksWon: number;
  readonly roundScore: number; // e.g. Bid 3 with 4 tricks = 3.1; Bid 3 with 2 tricks = -3.0
  readonly cumulativeScore: number;
}

export interface RoundScoreRecord {
  readonly roundNumber: number; // 1 to 5
  readonly scores: Readonly<Record<PlayerPosition, PlayerRoundScore>>;
}

export interface MatchResult {
  readonly winnerPosition: PlayerPosition; // Primary winner or first in tied rank
  readonly winnerPositions: readonly PlayerPosition[]; // All players tied for highest score
  readonly isTie: boolean;
  readonly finalScores: Readonly<Record<PlayerPosition, number>>;
  readonly rankings: readonly {
    readonly position: PlayerPosition;
    readonly score: number;
    readonly rank: number;
  }[];
  readonly completedAt: number;
}

export interface MatchConfig {
  readonly totalRounds: number; // Standard is 5
  readonly trumpSuit: Suit;     // Standard is SPADES
  readonly minBid: number;      // Standard is 1
  readonly maxBid: number;      // Standard is 13
  readonly cardsPerPlayer: number; // 13
}

/**
 * Immutable Centralized Game State.
 * Prevents game state from becoming scattered across UI components.
 */
export interface GameState {
  readonly matchId: string;
  readonly mode: GameMode;
  readonly status: GameStatus;
  readonly config: MatchConfig;
  readonly currentRound: number; // 1 to 5
  readonly dealer: PlayerPosition;
  readonly currentPlayer: PlayerPosition;
  readonly players: Readonly<Record<PlayerPosition, PlayerState>>;
  readonly currentTrick: TrickState;
  readonly completedTricks: readonly CompletedTrick[];
  readonly roundScores: readonly RoundScoreRecord[];
  readonly cumulativeScores: Readonly<Record<PlayerPosition, number>>;
  readonly matchResult: MatchResult | null;
  readonly lastActionMessage: string;
}
