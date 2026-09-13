/**
 * QA Data Corruption & Crash-Resilience Stress Suite
 * Validates graceful failure, automatic recovery, and data isolation
 * when encountering corrupted payload structures in persistence.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { ActiveGameService } from '../../core/persistence/ActiveGameService';
import { HistoryRepository, IHistoryStorage } from '../../core/history/HistoryRepository';
import { SettingsService } from '../../core/settings/SettingsService';
import { ISettingsStorage } from '../../core/settings/SettingsRepository';
import { InvariantViolation } from './QATypes';

export class QACorruptionStress {
  public static createStorage(): IHistoryStorage & ISettingsStorage {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    };
  }

  public static runCorruptionTests(): { success: boolean; violations: InvariantViolation[] } {
    const violations: InvariantViolation[] = [];
    const storage = this.createStorage();

    // 1. Initialize valid settings to verify settings isolation
    const settingsService = new SettingsService(storage);
    const initialSettings = settingsService.getSettings();
    if (!initialSettings) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: 'Failed to initialize default settings',
      });
    }

    const activeGameKey = 'cb_lakdi_active_game_v1';
    const historyKey = 'cb_lakdi_match_history_v2';
    const activeService = new ActiveGameService(storage);
    const historyRepo = new HistoryRepository(storage);

    // List of corrupted payloads to inject
    const corruptPayloads: { name: string; value: string }[] = [
      { name: 'Malformed JSON (truncated)', value: '{"matchId": "test_1", "stat' },
      { name: 'Empty String', value: '' },
      { name: 'Null literal in JSON', value: 'null' },
      { name: 'Primitive number', value: '12345' },
      { name: 'Array instead of object', value: '[1, 2, 3, "state"]' },
      { name: 'Missing required status/round', value: JSON.stringify({ matchId: 'm1' }) },
      { name: 'Impossible trick count (99)', value: JSON.stringify({ matchId: 'm2', status: 'PLAYING', currentRound: 1, config: { cardsPerPlayer: 13, trumpSuit: 'SPADES' }, dealer: 'SOUTH', currentPlayer: 'WEST', players: {}, currentTrick: { trickNumber: 99 } }) },
      { name: 'Invalid player position', value: JSON.stringify({ matchId: 'm3', status: 'PLAYING', currentRound: 1, config: { cardsPerPlayer: 13, trumpSuit: 'SPADES' }, dealer: 'INVALID_POS', currentPlayer: 'WEST' }) },
      { name: 'Invalid game status', value: JSON.stringify({ matchId: 'm4', status: 'NON_EXISTENT_PHASE', currentRound: 1 }) },
    ];

    for (const testCase of corruptPayloads) {
      // Inject into active game
      storage.setItem(activeGameKey, testCase.value);

      try {
        const loaded = activeService.loadActiveGameSync();
        if (loaded !== null) {
          violations.push({
            category: 'PERSISTENCE_PARITY',
            message: `ActiveGameService failed to reject corrupted payload: ${testCase.name}`,
          });
        }
      } catch (err: any) {
        violations.push({
          category: 'PERSISTENCE_PARITY',
          message: `ActiveGameService threw unhandled exception on ${testCase.name}: ${err.message}`,
        });
      }

      // Inject into history repository
      storage.setItem(historyKey, testCase.value);
      historyRepo.getMatches().then((matches) => {
        if (!Array.isArray(matches)) {
          violations.push({
            category: 'HISTORY_INTEGRITY',
            message: `HistoryRepository did not recover to array on ${testCase.name}`,
          });
        }
      }).catch((err) => {
        violations.push({
          category: 'HISTORY_INTEGRITY',
          message: `HistoryRepository threw unhandled exception on ${testCase.name}: ${err.message}`,
        });
      });
    }

    // Check settings isolation: settings must remain completely intact
    const currentSettings = settingsService.getSettings();
    if (!currentSettings || currentSettings.schemaVersion !== initialSettings.schemaVersion) {
      violations.push({
        category: 'PERSISTENCE_PARITY',
        message: 'Settings were corrupted or deleted during corrupted payload injection',
      });
    }

    return {
      success: violations.length === 0,
      violations,
    };
  }
}
