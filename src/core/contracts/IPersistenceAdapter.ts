/**
 * Persistence Layer Abstraction
 * Decouples storage mechanisms (LocalStorage, IndexedDB, Memory, Cloud) from the game engine.
 * Phase 1 Architecture Foundation
 */

import { GameState, MatchResult } from '../../models/gameState';

export interface PlayerStatistics {
  readonly matchesPlayed: number;
  readonly matchesWon: number;
  readonly roundsPlayed: number;
  readonly roundsWon: number;
  readonly totalBidsMade: number;
  readonly successfulBids: number;
  readonly highestSingleMatchScore: number;
  readonly lastPlayedAt: number;
}

export interface IPersistenceAdapter {
  /**
   * Persists active game state for resume capability.
   */
  saveGame(state: GameState): Promise<boolean>;

  /**
   * Loads saved active game state if available.
   */
  loadSavedGame(): Promise<GameState | null>;

  /**
   * Clears any saved in-progress game.
   */
  clearSavedGame(): Promise<boolean>;

  /**
   * Appends completed match result to historical log.
   */
  saveMatchHistory(result: MatchResult): Promise<boolean>;

  /**
   * Retrieves historical match results.
   */
  getMatchHistory(limit?: number): Promise<readonly MatchResult[]>;

  /**
   * Retrieves player statistical records.
   */
  getStatistics(): Promise<PlayerStatistics>;

  /**
   * Updates player statistical records.
   */
  updateStatistics(stats: Partial<PlayerStatistics>): Promise<boolean>;
}
