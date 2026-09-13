/**
 * Match History Repository
 * Provides resilient, idempotent storage for completed match records.
 * Uses storage abstraction to isolate file/browser persistence.
 * Phase 9 Home, Match History & Player Statistics
 */

import { MatchHistoryRecord, MAX_HISTORY_RECORDS } from './historyTypes';
import { sanitizeHistoryRecords } from './historyValidation';

export interface IHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY_HISTORY = 'cb_lakdi_match_history_v2';

export class HistoryRepository {
  private storage: IHistoryStorage;

  constructor(storage?: IHistoryStorage) {
    if (storage) {
      this.storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      // Memory fallback for headless / SSR test environments
      const mem = new Map<string, string>();
      this.storage = {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => mem.set(k, v),
        removeItem: (k) => mem.delete(k),
      };
    }
  }

  /**
   * Saves a completed match record.
   * Idempotent: If the matchId already exists, ignores duplicate without error.
   * Automatically bounds storage to MAX_HISTORY_RECORDS (newest preserved).
   */
  public async saveMatch(record: MatchHistoryRecord): Promise<boolean> {
    try {
      const existing = await this.getMatches();

      // Idempotency check: Do not re-save existing matchId
      if (existing.some((m) => m.matchId === record.matchId)) {
        return true;
      }

      // Prepend newest match and cap at maximum records
      const updated = [record, ...existing].slice(0, MAX_HISTORY_RECORDS);
      this.storage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      return true;
    } catch (err) {
      console.error('Failed to save match history record:', err);
      return false;
    }
  }

  /**
   * Retrieves all valid match records sorted newest first.
   * Gracefully filters out any corrupt records without throwing.
   */
  public async getMatches(limit?: number): Promise<readonly MatchHistoryRecord[]> {
    try {
      const raw = this.storage.getItem(STORAGE_KEY_HISTORY);
      if (!raw) {
        return [];
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Corrupted JSON; return empty without crashing
        return [];
      }

      const validRecords = sanitizeHistoryRecords(parsed);
      return typeof limit === 'number' && limit > 0
        ? validRecords.slice(0, limit)
        : validRecords;
    } catch {
      return [];
    }
  }

  /**
   * Retrieves a specific match by ID.
   */
  public async getMatchById(matchId: string): Promise<MatchHistoryRecord | null> {
    const all = await this.getMatches();
    return all.find((m) => m.matchId === matchId) ?? null;
  }

  /**
   * Checks if a match ID is already stored.
   */
  public async hasMatch(matchId: string): Promise<boolean> {
    const all = await this.getMatches();
    return all.some((m) => m.matchId === matchId);
  }

  /**
   * Deletes only match history.
   * STRICT GUARANTEE: Never touches active game state, settings, or audio state.
   */
  public async clearHistory(): Promise<boolean> {
    try {
      this.storage.removeItem(STORAGE_KEY_HISTORY);
      return true;
    } catch (err) {
      console.error('Failed to clear match history:', err);
      return false;
    }
  }
}
