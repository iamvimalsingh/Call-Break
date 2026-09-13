/**
 * QA Match History Stress Suite
 * Validates history record immutability, idempotency, storage reload persistence,
 * and strict 100-record FIFO boundary behavior.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { HistoryRepository, IHistoryStorage } from '../../core/history/HistoryRepository';
import { MatchHistoryRecord, MAX_HISTORY_RECORDS } from '../../core/history/historyTypes';
import { PlayerPosition } from '../../models/player';
import { InvariantViolation } from './QATypes';

export class QAHistoryStress {
  public static createMockStorage(): IHistoryStorage {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    };
  }

  public static generateDummyMatchRecord(index: number): MatchHistoryRecord {
    return {
      version: 1,
      matchId: `match_qa_stress_${index}_${Date.now()}`,
      completedAt: 1700000000000 + index * 1000,
      totalRounds: 5,
      winnerPosition: PlayerPosition.SOUTH,
      winnerPositions: [PlayerPosition.SOUTH],
      isTie: false,
      finalScores: {
        SOUTH: 15.5,
        WEST: 12.1,
        NORTH: 9.3,
        EAST: -4.0,
      },
      rankings: [
        { position: PlayerPosition.SOUTH, name: 'Player (You)', isHuman: true, score: 15.5, rank: 1 },
        { position: PlayerPosition.WEST, name: 'West Bot', isHuman: false, score: 12.1, rank: 2 },
        { position: PlayerPosition.NORTH, name: 'North Bot', isHuman: false, score: 9.3, rank: 3 },
        { position: PlayerPosition.EAST, name: 'East Bot', isHuman: false, score: -4.0, rank: 4 },
      ],
      rounds: [
        {
          roundNumber: 1,
          dealer: PlayerPosition.SOUTH,
          scores: {
            SOUTH: { bid: 3, tricksWon: 3, roundScore: 3.0, cumulativeScore: 3.0 },
            WEST: { bid: 2, tricksWon: 3, roundScore: 2.1, cumulativeScore: 2.1 },
            NORTH: { bid: 3, tricksWon: 3, roundScore: 3.0, cumulativeScore: 3.0 },
            EAST: { bid: 4, tricksWon: 4, roundScore: 4.0, cumulativeScore: 4.0 },
          },
        },
      ],
      userPosition: PlayerPosition.SOUTH,
      playerNames: {
        SOUTH: 'Player (You)',
        WEST: 'West Bot',
        NORTH: 'North Bot',
        EAST: 'East Bot',
      },
    };
  }

  /**
   * Stresses the history repository with duplicate saves and > 100 records.
   */
  public static async runHistoryStress(): Promise<{ success: boolean; violations: InvariantViolation[] }> {
    const violations: InvariantViolation[] = [];
    const storage = this.createMockStorage();
    const repo = new HistoryRepository(storage);

    // 1. Initial save
    const initialRecord = this.generateDummyMatchRecord(1);
    await repo.saveMatch(initialRecord);
    let matches = await repo.getMatches();
    if (matches.length !== 1) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: `Expected 1 record after first save, found ${matches.length}`,
      });
    }

    // 2. Idempotency test (duplicate save of same record)
    await repo.saveMatch(initialRecord);
    matches = await repo.getMatches();
    if (matches.length !== 1) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: `Idempotency failure: duplicate matchId was saved, length is now ${matches.length}`,
      });
    }

    // 3. Storage reload persistence
    const freshRepo = new HistoryRepository(storage);
    const reloaded = await freshRepo.getMatches();
    if (reloaded.length !== 1 || reloaded[0].matchId !== initialRecord.matchId) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: 'Reloaded repository failed to retrieve the persisted match correctly',
      });
    }

    // 4. Immutability verification
    const fetched = reloaded[0];
    try {
      (fetched as any).winnerPosition = PlayerPosition.EAST;
    } catch {
      // Ignored if Object.freeze active
    }
    const refetched = await freshRepo.getMatches();
    if (refetched[0].winnerPosition !== PlayerPosition.SOUTH) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: 'History record mutation leaked into persistent storage',
      });
    }

    // 5. FIFO Capping: Stress with 150 unique records
    const testRecords: MatchHistoryRecord[] = [];
    for (let i = 2; i <= 150; i++) {
      const rec = this.generateDummyMatchRecord(i);
      testRecords.push(rec);
      await repo.saveMatch(rec);
    }

    const cappedMatches = await repo.getMatches();
    if (cappedMatches.length !== MAX_HISTORY_RECORDS) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: `FIFO cap failure: expected exactly ${MAX_HISTORY_RECORDS} records, found ${cappedMatches.length}`,
      });
    }

    // Check unique match IDs (no duplicates)
    const matchIds = cappedMatches.map((m) => m.matchId);
    const uniqueIds = new Set(matchIds);
    if (uniqueIds.size !== cappedMatches.length) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: `Duplicate matchIds found in capped history: ${cappedMatches.length - uniqueIds.size} duplicates`,
      });
    }

    // Check that the newest record (record 150) is retained and record 1 was dropped
    const hasNewest = cappedMatches.some((m) => m.matchId === testRecords[testRecords.length - 1].matchId);
    const hasOldest = cappedMatches.some((m) => m.matchId === initialRecord.matchId);

    if (!hasNewest) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: 'Newest record was not retained in FIFO history',
      });
    }

    if (hasOldest) {
      violations.push({
        category: 'HISTORY_INTEGRITY',
        message: 'Oldest record was not pruned in FIFO history',
      });
    }

    return {
      success: violations.length === 0,
      violations,
    };
  }
}
