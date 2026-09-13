/**
 * In-Memory Persistence Adapter
 * Useful for headless testing, Node.js simulations, and transient play.
 * Phase 1 Architecture Foundation
 */

import { GameState, GameStatus, MatchResult } from '../../models/gameState';
import { IPersistenceAdapter, PlayerStatistics } from '../../core/contracts/IPersistenceAdapter';
import { validateResumableGameState } from '../../core/persistence/gameStateValidation';

export class MemoryStorageAdapter implements IPersistenceAdapter {
  private savedState: GameState | null = null;
  private history: MatchResult[] = [];
  private stats: PlayerStatistics = {
    matchesPlayed: 0,
    matchesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    totalBidsMade: 0,
    successfulBids: 0,
    highestSingleMatchScore: 0,
    lastPlayedAt: Date.now(),
  };

  public async saveGame(state: GameState): Promise<boolean> {
    if (state.status === GameStatus.MATCH_FINISHED) {
      this.savedState = null;
      return true;
    }
    this.savedState = JSON.parse(JSON.stringify(state));
    return true;
  }

  public async loadSavedGame(): Promise<GameState | null> {
    if (!this.savedState) return null;
    return JSON.parse(JSON.stringify(this.savedState));
  }

  public async clearSavedGame(): Promise<boolean> {
    this.savedState = null;
    return true;
  }

  public async saveMatchHistory(result: MatchResult): Promise<boolean> {
    this.history.unshift(JSON.parse(JSON.stringify(result)));
    return true;
  }

  public async getMatchHistory(limit = 20): Promise<readonly MatchResult[]> {
    return this.history.slice(0, limit);
  }

  public async getStatistics(): Promise<PlayerStatistics> {
    return { ...this.stats };
  }

  public async updateStatistics(statsUpdate: Partial<PlayerStatistics>): Promise<boolean> {
    this.stats = { ...this.stats, ...statsUpdate, lastPlayedAt: Date.now() };
    return true;
  }
}
