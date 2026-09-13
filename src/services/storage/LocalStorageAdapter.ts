/**
 * Browser LocalStorage Persistence Adapter
 * Stores active game state and statistics in client-side storage without engine coupling.
 * Phase 1 Architecture Foundation
 */

import { GameState, GameStatus, MatchResult } from '../../models/gameState';
import { IPersistenceAdapter, PlayerStatistics } from '../../core/contracts/IPersistenceAdapter';
import { validateResumableGameState } from '../../core/persistence/gameStateValidation';

const STORAGE_KEYS = {
  ACTIVE_GAME: 'cb_lakdi_active_game_v1',
  HISTORY: 'cb_lakdi_history_v1',
  STATISTICS: 'cb_lakdi_stats_v1',
} as const;

export class LocalStorageAdapter implements IPersistenceAdapter {
  private isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  public async saveGame(state: GameState): Promise<boolean> {
    if (!this.isAvailable()) return false;
    
    // Non-resumable states (IDLE, MATCH_FINISHED) must not be saved as active games
    if (state.status === GameStatus.IDLE || state.status === GameStatus.MATCH_FINISHED) {
      await this.clearSavedGame();
      return true;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.ACTIVE_GAME, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  public async loadSavedGame(): Promise<GameState | null> {
    if (!this.isAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.ACTIVE_GAME);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const validation = validateResumableGameState(parsed);
      if (!validation.isValid || !validation.state) {
        // Corrupted or invalid state payload: clean up to restore reliable operation
        await this.clearSavedGame();
        return null;
      }

      return validation.state;
    } catch {
      // JSON syntax error or storage error: clean up and return null
      await this.clearSavedGame();
      return null;
    }
  }

  public async clearSavedGame(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      window.localStorage.removeItem(STORAGE_KEYS.ACTIVE_GAME);
      return true;
    } catch {
      return false;
    }
  }

  public async saveMatchHistory(result: MatchResult): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const existing = await this.getMatchHistory();
      const updated = [result, ...existing].slice(0, 50);
      window.localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }

  public async getMatchHistory(limit = 20): Promise<readonly MatchResult[]> {
    if (!this.isAvailable()) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!raw) return [];
      const parsed: MatchResult[] = JSON.parse(raw);
      return parsed.slice(0, limit);
    } catch {
      return [];
    }
  }

  public async getStatistics(): Promise<PlayerStatistics> {
    const defaultStats: PlayerStatistics = {
      matchesPlayed: 0,
      matchesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      totalBidsMade: 0,
      successfulBids: 0,
      highestSingleMatchScore: 0,
      lastPlayedAt: Date.now(),
    };

    if (!this.isAvailable()) return defaultStats;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.STATISTICS);
      return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
    } catch {
      return defaultStats;
    }
  }

  public async updateStatistics(statsUpdate: Partial<PlayerStatistics>): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const current = await this.getStatistics();
      const updated: PlayerStatistics = {
        ...current,
        ...statsUpdate,
        lastPlayedAt: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }
}

export const sharedLocalStorageAdapter = new LocalStorageAdapter();

