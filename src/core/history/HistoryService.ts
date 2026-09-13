/**
 * Match History Service
 * Domain coordinator for history operations, event broadcasting, and UI read queries.
 * Phase 9 Home, Match History & Player Statistics
 */

import { GameState, GameStatus } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { createMatchHistoryRecord, MatchHistoryRecord } from './historyTypes';
import { HistoryRepository, IHistoryStorage } from './HistoryRepository';

export class HistoryService {
  private repository: HistoryRepository;
  private subscribers: Set<() => void> = new Set();

  constructor(storage?: IHistoryStorage) {
    this.repository = new HistoryRepository(storage);
  }

  /**
   * Records a match if and only if it has reached MATCH_FINISHED status.
   * Prevents recording incomplete matches or duplicate events.
   */
  public async recordMatchFinished(
    state: GameState,
    userPosition: PlayerPosition = PlayerPosition.SOUTH
  ): Promise<boolean> {
    if (state.status !== GameStatus.MATCH_FINISHED || !state.matchResult) {
      return false;
    }

    try {
      const record = createMatchHistoryRecord(state, userPosition);
      const saved = await this.repository.saveMatch(record);
      if (saved) {
        this.notifySubscribers();
      }
      return saved;
    } catch (err) {
      console.error('Error in recordMatchFinished:', err);
      return false;
    }
  }

  /**
   * Retrieves all completed match records sorted newest first.
   */
  public async getMatches(limit?: number): Promise<readonly MatchHistoryRecord[]> {
    return this.repository.getMatches(limit);
  }

  /**
   * Retrieves a single match by ID.
   */
  public async getMatchById(matchId: string): Promise<MatchHistoryRecord | null> {
    return this.repository.getMatchById(matchId);
  }

  /**
   * Clears historical matches and alerts subscribers.
   */
  public async clearHistory(): Promise<boolean> {
    const cleared = await this.repository.clearHistory();
    if (cleared) {
      this.notifySubscribers();
    }
    return cleared;
  }

  /**
   * Subscribes to history updates.
   */
  public subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub();
      } catch (err) {
        console.error('Error in HistoryService subscriber:', err);
      }
    }
  }
}

/**
 * Shared singleton instance for application runtime.
 */
export const sharedHistoryService = new HistoryService();
