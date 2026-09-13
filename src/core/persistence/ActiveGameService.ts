/**
 * Active Game Persistence Service
 * Manages saving and loading of in-progress matches for seamless session continuation.
 * Ensures interrupted matches are resumable without polluting match history.
 * Phase 9 Home, Match History & Player Statistics
 */

import { GameState, GameStatus } from '../../models/gameState';
import { IHistoryStorage } from '../history/HistoryRepository';
import { validateResumableGameState } from './gameStateValidation';

const ACTIVE_GAME_KEY = 'cb_lakdi_active_game_v1';

export class ActiveGameService {
  private storage: IHistoryStorage;

  constructor(storage?: IHistoryStorage) {
    if (storage) {
      this.storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      const mem = new Map<string, string>();
      this.storage = {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => mem.set(k, v),
        removeItem: (k) => mem.delete(k),
      };
    }
  }

  /**
   * Persists the active game state if the match is in-progress (not IDLE or MATCH_FINISHED).
   */
  public async saveActiveGame(state: GameState): Promise<boolean> {
    if (state.status === GameStatus.IDLE || state.status === GameStatus.MATCH_FINISHED) {
      // Completed or uninitialized matches should not be saved as resumable active games
      await this.clearActiveGame();
      return true;
    }

    try {
      this.storage.setItem(ACTIVE_GAME_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loads the saved active game synchronously if storage is synchronous (e.g. window.localStorage).
   * Automatically validates integrity and recovers from corrupted state.
   */
  public loadActiveGameSync(): GameState | null {
    try {
      const raw = this.storage.getItem(ACTIVE_GAME_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const validation = validateResumableGameState(parsed);
      if (!validation.isValid || !validation.state) {
        this.storage.removeItem(ACTIVE_GAME_KEY);
        return null;
      }
      return validation.state;
    } catch {
      try {
        this.storage.removeItem(ACTIVE_GAME_KEY);
      } catch {
        // Safe fallback
      }
      return null;
    }
  }

  /**
   * Synchronous check for active game existence.
   */
  public hasActiveGameSync(): boolean {
    return this.loadActiveGameSync() !== null;
  }

  /**
   * Loads the saved active game if one exists and is resumable.
   */
  public async loadActiveGame(): Promise<GameState | null> {
    return this.loadActiveGameSync();
  }

  /**
   * Checks whether a valid resumable game currently exists.
   */
  public async hasActiveGame(): Promise<boolean> {
    const game = await this.loadActiveGame();
    return game !== null;
  }

  /**
   * Clears the active game from storage.
   */
  public async clearActiveGame(): Promise<boolean> {
    try {
      this.storage.removeItem(ACTIVE_GAME_KEY);
      return true;
    } catch {
      return false;
    }
  }
}

export const sharedActiveGameService = new ActiveGameService();

