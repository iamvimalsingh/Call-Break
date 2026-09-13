/**
 * Phase 9 Test Suite — Home, Match History & Player Statistics
 * Verifies snapshot immutability, idempotency, storage bounds, corrupted data recovery,
 * derived statistics accuracy, and real architectural pipeline integration.
 */

import { TestHarness } from './testHarness';
import { MatchHistoryRecord, createMatchHistoryRecord, MAX_HISTORY_RECORDS } from '../core/history/historyTypes';
import { HistoryRepository, IHistoryStorage } from '../core/history/HistoryRepository';
import { HistoryService } from '../core/history/HistoryService';
import { StatisticsService } from '../core/statistics/StatisticsService';
import { ActiveGameService } from '../core/persistence/ActiveGameService';
import { GameStateStore } from '../core/state/gameStore';
import { LocalGameController } from '../core/controller/LocalGameController';
import { CardEngine } from '../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../core/scoring/ScoringEngine';
import { MediumBotStrategy } from '../core/bot/MediumBotStrategy';
import { DeterministicRandomSource } from '../core/random/IRandomSource';
import { GameStatus } from '../models/gameState';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../models/player';
import { isValidHistoryRecord } from '../core/history/historyValidation';

function createMockStorage(): IHistoryStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

export function buildPhase9HistoryStatsTestSuite(): TestHarness {
  const harness = new TestHarness();

  // Test 1: Incomplete match protection
  harness.register('Phase 9 History', 'Refuses to record incomplete matches as history', async () => {
    const store = new GameStateStore();
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const cardEngine = new CardEngine(new DeterministicRandomSource(42));
    const controller = new LocalGameController(store, { cardEngine, rulesEngine, scoringEngine });

    controller.startNewMatch();
    const historyService = new HistoryService(createMockStorage());

    // Status is DEALING or BIDDING, not MATCH_FINISHED
    const recorded = await historyService.recordMatchFinished(store.getState());
    if (recorded) {
      throw new Error('Should not record match when status is not MATCH_FINISHED');
    }

    const matches = await historyService.getMatches();
    if (matches.length !== 0) {
      throw new Error(`Expected 0 matches in history, found ${matches.length}`);
    }
  });

  // Test 2: Snapshot immutability & data privacy
  harness.register('Phase 9 History', 'Creates immutable snapshot without live state mutation or hidden cards', async () => {
    // Generate a mock finished match state
    const finishedState: any = {
      matchId: 'match_immutability_test_001',
      status: GameStatus.MATCH_FINISHED,
      currentRound: 5,
      config: { totalRounds: 5, trumpSuit: 'SPADES' },
      players: {
        [PlayerPosition.SOUTH]: { id: 'p1', name: 'You', position: PlayerPosition.SOUTH, hand: [{ suit: 'SPADES', rank: 14 }] },
        [PlayerPosition.WEST]: { id: 'p2', name: 'West (Bot)', position: PlayerPosition.WEST, hand: [] },
        [PlayerPosition.NORTH]: { id: 'p3', name: 'North (Bot)', position: PlayerPosition.NORTH, hand: [] },
        [PlayerPosition.EAST]: { id: 'p4', name: 'East (Bot)', position: PlayerPosition.EAST, hand: [] },
      },
      dealer: PlayerPosition.SOUTH,
      roundScores: [
        {
          roundNumber: 1,
          scores: {
            [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 3, roundScore: 3.0, cumulativeScore: 3.0 },
            [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2.0, cumulativeScore: 2.0 },
            [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4.0, cumulativeScore: 4.0 },
            [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4.0, cumulativeScore: 4.0 },
          },
        },
      ],
      matchResult: {
        matchId: 'match_immutability_test_001',
        completedAt: 1700000000000,
        winnerPosition: PlayerPosition.NORTH,
        winnerPositions: [PlayerPosition.NORTH],
        isTie: false,
        finalScores: {
          [PlayerPosition.SOUTH]: 3.0,
          [PlayerPosition.WEST]: 2.0,
          [PlayerPosition.NORTH]: 4.0,
          [PlayerPosition.EAST]: 4.0,
        },
        rankings: [
          { position: PlayerPosition.NORTH, score: 4.0, rank: 1 },
          { position: PlayerPosition.SOUTH, score: 3.0, rank: 2 },
          { position: PlayerPosition.WEST, score: 2.0, rank: 3 },
          { position: PlayerPosition.EAST, score: 4.0, rank: 1 },
        ],
      },
    };

    const snapshot = createMatchHistoryRecord(finishedState);

    // Verify snapshot does NOT contain hands, undealt deck, or RNG
    if ((snapshot as any).players || (snapshot as any).deck || (snapshot as any).hands) {
      throw new Error('History snapshot leaked raw player hands or deck');
    }

    // Verify immutability: Object is frozen
    if (!Object.isFrozen(snapshot)) {
      throw new Error('History snapshot is not frozen');
    }
    if (!Object.isFrozen(snapshot.finalScores)) {
      throw new Error('History finalScores is not frozen');
    }

    // Attempt mutation should throw or fail in strict mode
    try {
      (snapshot as any).matchId = 'tampered';
    } catch {
      // Expected frozen error
    }
    if (snapshot.matchId !== 'match_immutability_test_001') {
      throw new Error('History snapshot was mutable');
    }
  });

  // Test 3: Idempotency of saving match history
  harness.register('Phase 9 History', 'Guarantees save idempotency (one match ID = one record)', async () => {
    const storage = createMockStorage();
    const repo = new HistoryRepository(storage);

    const record: MatchHistoryRecord = {
      version: 1,
      matchId: 'match_idempotent_123',
      completedAt: 1700000000000,
      totalRounds: 5,
      winnerPosition: PlayerPosition.SOUTH,
      winnerPositions: [PlayerPosition.SOUTH],
      isTie: false,
      finalScores: {
        [PlayerPosition.SOUTH]: 15.2,
        [PlayerPosition.WEST]: 10.0,
        [PlayerPosition.NORTH]: 8.5,
        [PlayerPosition.EAST]: 6.0,
      },
      rankings: [
        { position: PlayerPosition.SOUTH, name: 'You', isHuman: true, score: 15.2, rank: 1 },
        { position: PlayerPosition.WEST, name: 'West', isHuman: false, score: 10.0, rank: 2 },
        { position: PlayerPosition.NORTH, name: 'North', isHuman: false, score: 8.5, rank: 3 },
        { position: PlayerPosition.EAST, name: 'East', isHuman: false, score: 6.0, rank: 4 },
      ],
      rounds: [
        {
          roundNumber: 1,
          dealer: PlayerPosition.SOUTH,
          scores: {
            [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 3, roundScore: 3.0, cumulativeScore: 3.0 },
            [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2.0, cumulativeScore: 2.0 },
            [PlayerPosition.NORTH]: { bid: 2, tricksWon: 2, roundScore: 2.0, cumulativeScore: 2.0 },
            [PlayerPosition.EAST]: { bid: 6, tricksWon: 6, roundScore: 6.0, cumulativeScore: 6.0 },
          },
        },
      ],
      userPosition: PlayerPosition.SOUTH,
      playerNames: {
        [PlayerPosition.SOUTH]: 'You',
        [PlayerPosition.WEST]: 'West (Bot)',
        [PlayerPosition.NORTH]: 'North (Bot)',
        [PlayerPosition.EAST]: 'East (Bot)',
      },
    };

    // Save twice
    await repo.saveMatch(record);
    await repo.saveMatch(record);
    await repo.saveMatch(record);

    const stored = await repo.getMatches();
    if (stored.length !== 1) {
      throw new Error(`Expected exactly 1 record after duplicate saves, found ${stored.length}`);
    }
  });

  // Test 4: Storage cap & deterministic FIFO trimming
  harness.register('Phase 9 History', 'Bounds storage size and deterministically trims oldest records', async () => {
    const storage = createMockStorage();
    const repo = new HistoryRepository(storage);

    // Save MAX_HISTORY_RECORDS + 15 matches
    const totalToSave = MAX_HISTORY_RECORDS + 15;
    for (let i = 1; i <= totalToSave; i++) {
      const rec: MatchHistoryRecord = {
        version: 1,
        matchId: `match_overflow_${i}`,
        completedAt: 1700000000000 + i * 1000,
        totalRounds: 5,
        winnerPosition: PlayerPosition.SOUTH,
        winnerPositions: [PlayerPosition.SOUTH],
        isTie: false,
        finalScores: {
          [PlayerPosition.SOUTH]: 10 + i,
          [PlayerPosition.WEST]: 5,
          [PlayerPosition.NORTH]: 5,
          [PlayerPosition.EAST]: 5,
        },
        rankings: [
          { position: PlayerPosition.SOUTH, name: 'You', isHuman: true, score: 10 + i, rank: 1 },
          { position: PlayerPosition.WEST, name: 'West', isHuman: false, score: 5, rank: 2 },
          { position: PlayerPosition.NORTH, name: 'North', isHuman: false, score: 5, rank: 2 },
          { position: PlayerPosition.EAST, name: 'East', isHuman: false, score: 5, rank: 2 },
        ],
        rounds: [
          {
            roundNumber: 1,
            dealer: PlayerPosition.SOUTH,
            scores: {
              [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 3 },
              [PlayerPosition.WEST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 3 },
              [PlayerPosition.NORTH]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 3 },
              [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 },
            },
          },
        ],
        userPosition: PlayerPosition.SOUTH,
        playerNames: {
          [PlayerPosition.SOUTH]: 'You',
          [PlayerPosition.WEST]: 'West',
          [PlayerPosition.NORTH]: 'North',
          [PlayerPosition.EAST]: 'East',
        },
      };
      await repo.saveMatch(rec);
    }

    const stored = await repo.getMatches();
    if (stored.length !== MAX_HISTORY_RECORDS) {
      throw new Error(`Expected storage capped at ${MAX_HISTORY_RECORDS}, found ${stored.length}`);
    }

    // Newest match (totalToSave) must be present at index 0
    if (stored[0].matchId !== `match_overflow_${totalToSave}`) {
      throw new Error(`Expected newest match match_overflow_${totalToSave} at top, found ${stored[0].matchId}`);
    }

    // Oldest match (e.g. match_overflow_1) should have been trimmed
    const hasMatch1 = stored.some((m) => m.matchId === 'match_overflow_1');
    if (hasMatch1) {
      throw new Error('Oldest match_overflow_1 was not trimmed');
    }
  });

  // Test 5: Corrupted storage recovery & resilience
  harness.register('Phase 9 History', 'Recovers gracefully from malformed or corrupted storage payloads', async () => {
    const storage = createMockStorage();

    // 1. Completely malformed JSON
    storage.setItem('cb_lakdi_match_history_v2', '{ corrupt json syntax !! %%');
    const repo = new HistoryRepository(storage);
    const matchesFromCorruptJson = await repo.getMatches();
    if (!Array.isArray(matchesFromCorruptJson) || matchesFromCorruptJson.length !== 0) {
      throw new Error('Should gracefully handle invalid JSON syntax');
    }

    // 2. Mixed array with 1 valid record and several corrupted/invalid objects
    const validRecord: MatchHistoryRecord = {
      version: 1,
      matchId: 'valid_survivor_record',
      completedAt: 1700000000000,
      totalRounds: 5,
      winnerPosition: PlayerPosition.SOUTH,
      winnerPositions: [PlayerPosition.SOUTH],
      isTie: false,
      finalScores: {
        [PlayerPosition.SOUTH]: 12.0,
        [PlayerPosition.WEST]: 8.0,
        [PlayerPosition.NORTH]: 10.0,
        [PlayerPosition.EAST]: 9.0,
      },
      rankings: [
        { position: PlayerPosition.SOUTH, name: 'You', isHuman: true, score: 12.0, rank: 1 },
        { position: PlayerPosition.NORTH, name: 'North', isHuman: false, score: 10.0, rank: 2 },
        { position: PlayerPosition.EAST, name: 'East', isHuman: false, score: 9.0, rank: 3 },
        { position: PlayerPosition.WEST, name: 'West', isHuman: false, score: 8.0, rank: 4 },
      ],
      rounds: [
        {
          roundNumber: 1,
          dealer: PlayerPosition.SOUTH,
          scores: {
            [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 3 },
            [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 2 },
            [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 },
            [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 },
          },
        },
      ],
      userPosition: PlayerPosition.SOUTH,
      playerNames: {
        [PlayerPosition.SOUTH]: 'You',
        [PlayerPosition.WEST]: 'West',
        [PlayerPosition.NORTH]: 'North',
        [PlayerPosition.EAST]: 'East',
      },
    };

    const corruptArray = [
      null,
      'a random string',
      { version: 999, matchId: 'unsupported_version' },
      { version: 1, matchId: '', completedAt: -10 },
      validRecord,
      { version: 1, matchId: 'invalid_scores', completedAt: 17000, finalScores: { SOUTH: 'NaN' } },
    ];

    storage.setItem('cb_lakdi_match_history_v2', JSON.stringify(corruptArray));
    const sanitizedMatches = await repo.getMatches();
    if (sanitizedMatches.length !== 1 || sanitizedMatches[0].matchId !== 'valid_survivor_record') {
      throw new Error(`Expected only the 1 valid record to survive, found ${sanitizedMatches.length}`);
    }
  });

  // Test 6: Clear history isolation
  harness.register('Phase 9 History', 'Clear history leaves active game state untouched', async () => {
    const storage = createMockStorage();
    const historyRepo = new HistoryRepository(storage);
    const activeService = new ActiveGameService(storage);

    // Save an active game
    const dummyActiveState: any = {
      matchId: 'active_in_progress_001',
      status: GameStatus.PLAYING,
      currentRound: 3,
    };
    await activeService.saveActiveGame(dummyActiveState);

    // Save a history record
    await historyRepo.saveMatch({
      version: 1,
      matchId: 'finished_match_001',
      completedAt: 1700000000000,
      totalRounds: 5,
      winnerPosition: PlayerPosition.SOUTH,
      winnerPositions: [PlayerPosition.SOUTH],
      isTie: false,
      finalScores: { [PlayerPosition.SOUTH]: 10, [PlayerPosition.WEST]: 5, [PlayerPosition.NORTH]: 5, [PlayerPosition.EAST]: 5 },
      rankings: [
        { position: PlayerPosition.SOUTH, name: 'You', isHuman: true, score: 10, rank: 1 },
        { position: PlayerPosition.WEST, name: 'West', isHuman: false, score: 5, rank: 2 },
        { position: PlayerPosition.NORTH, name: 'North', isHuman: false, score: 5, rank: 2 },
        { position: PlayerPosition.EAST, name: 'East', isHuman: false, score: 5, rank: 2 },
      ],
      rounds: [
        {
          roundNumber: 1,
          dealer: PlayerPosition.SOUTH,
          scores: {
            [PlayerPosition.SOUTH]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 2 },
            [PlayerPosition.WEST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 3 },
            [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 },
            [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 },
          },
        },
      ],
      userPosition: PlayerPosition.SOUTH,
      playerNames: { [PlayerPosition.SOUTH]: 'You', [PlayerPosition.WEST]: 'W', [PlayerPosition.NORTH]: 'N', [PlayerPosition.EAST]: 'E' },
    });

    // Clear history
    await historyRepo.clearHistory();

    const historyAfter = await historyRepo.getMatches();
    if (historyAfter.length !== 0) {
      throw new Error('History was not cleared');
    }

    // Verify active game is still fully intact!
    const activeAfter = await activeService.loadActiveGame();
    if (!activeAfter || activeAfter.matchId !== 'active_in_progress_001') {
      throw new Error('Active game state was deleted when history was cleared!');
    }
  });

  // Test 7: Pure Player Statistics derivation
  harness.register('Phase 9 Statistics', 'Accurately derives player career statistics from match records', async () => {
    // Empty history test
    const emptyStats = StatisticsService.calculate([]);
    if (emptyStats.totalMatches !== 0 || emptyStats.winRate !== 0 || emptyStats.contractSuccessRate !== 0) {
      throw new Error('Empty stats must be cleanly zeroed');
    }

    // Construct 2 test matches:
    // Match 1: South Won (Score 15.2, 5 rounds). Round bids: [3, 4, 3, 2, 3]. Tricks won: [3, 4, 4, 1, 3] (4 met, 1 failed = contract success rate 80%)
    // Match 2: South Lost (Score 8.0, 5 rounds). Round bids: [2, 3, 2, 4, 2]. Tricks won: [2, 3, 1, 4, 2] (4 met, 1 failed)
    const match1: MatchHistoryRecord = {
      version: 1,
      matchId: 'stats_m1',
      completedAt: 1700000000000,
      totalRounds: 5,
      winnerPosition: PlayerPosition.SOUTH,
      winnerPositions: [PlayerPosition.SOUTH],
      isTie: false,
      finalScores: { [PlayerPosition.SOUTH]: 15.2, [PlayerPosition.WEST]: 10, [PlayerPosition.NORTH]: 8, [PlayerPosition.EAST]: 6 },
      rankings: [
        { position: PlayerPosition.SOUTH, name: 'You', isHuman: true, score: 15.2, rank: 1 },
        { position: PlayerPosition.WEST, name: 'W', isHuman: false, score: 10, rank: 2 },
        { position: PlayerPosition.NORTH, name: 'N', isHuman: false, score: 8, rank: 3 },
        { position: PlayerPosition.EAST, name: 'E', isHuman: false, score: 6, rank: 4 },
      ],
      rounds: [
        { roundNumber: 1, dealer: PlayerPosition.SOUTH, scores: { [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 3 }, [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 2 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 }, [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 } } },
        { roundNumber: 2, dealer: PlayerPosition.WEST, scores: { [PlayerPosition.SOUTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 7 }, [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 4 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 8 }, [PlayerPosition.EAST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 7 } } },
        { roundNumber: 3, dealer: PlayerPosition.NORTH, scores: { [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 4, roundScore: 3.1, cumulativeScore: 10.1 }, [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 6 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 12 }, [PlayerPosition.EAST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 10 } } },
        { roundNumber: 4, dealer: PlayerPosition.EAST, scores: { [PlayerPosition.SOUTH]: { bid: 2, tricksWon: 1, roundScore: -2.0, cumulativeScore: 8.1 }, [PlayerPosition.WEST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 9 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 16 }, [PlayerPosition.EAST]: { bid: 5, tricksWon: 5, roundScore: 5, cumulativeScore: 15 } } },
        { roundNumber: 5, dealer: PlayerPosition.SOUTH, scores: { [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 3, roundScore: 3.0, cumulativeScore: 11.1 }, [PlayerPosition.WEST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 12 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 20 }, [PlayerPosition.EAST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 18 } } },
      ],
      userPosition: PlayerPosition.SOUTH,
      playerNames: { [PlayerPosition.SOUTH]: 'You', [PlayerPosition.WEST]: 'W', [PlayerPosition.NORTH]: 'N', [PlayerPosition.EAST]: 'E' },
    };

    const match2: MatchHistoryRecord = {
      version: 1,
      matchId: 'stats_m2',
      completedAt: 1700000050000,
      totalRounds: 5,
      winnerPosition: PlayerPosition.NORTH,
      winnerPositions: [PlayerPosition.NORTH],
      isTie: false,
      finalScores: { [PlayerPosition.SOUTH]: 8.0, [PlayerPosition.WEST]: 10, [PlayerPosition.NORTH]: 18, [PlayerPosition.EAST]: 6 },
      rankings: [
        { position: PlayerPosition.NORTH, name: 'N', isHuman: false, score: 18, rank: 1 },
        { position: PlayerPosition.WEST, name: 'W', isHuman: false, score: 10, rank: 2 },
        { position: PlayerPosition.SOUTH, name: 'You', isHuman: true, score: 8.0, rank: 3 },
        { position: PlayerPosition.EAST, name: 'E', isHuman: false, score: 6, rank: 4 },
      ],
      rounds: [
        { roundNumber: 1, dealer: PlayerPosition.SOUTH, scores: { [PlayerPosition.SOUTH]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 2 }, [PlayerPosition.WEST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 3 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 }, [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 4 } } },
        { roundNumber: 2, dealer: PlayerPosition.WEST, scores: { [PlayerPosition.SOUTH]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 5 }, [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 5 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 8 }, [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 8 } } },
        { roundNumber: 3, dealer: PlayerPosition.NORTH, scores: { [PlayerPosition.SOUTH]: { bid: 2, tricksWon: 1, roundScore: -2, cumulativeScore: 3 }, [PlayerPosition.WEST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 8 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 12 }, [PlayerPosition.EAST]: { bid: 5, tricksWon: 5, roundScore: 5, cumulativeScore: 13 } } },
        { roundNumber: 4, dealer: PlayerPosition.EAST, scores: { [PlayerPosition.SOUTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 7 }, [PlayerPosition.WEST]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 10 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 16 }, [PlayerPosition.EAST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 16 } } },
        { roundNumber: 5, dealer: PlayerPosition.SOUTH, scores: { [PlayerPosition.SOUTH]: { bid: 2, tricksWon: 2, roundScore: 2, cumulativeScore: 9 }, [PlayerPosition.WEST]: { bid: 3, tricksWon: 3, roundScore: 3, cumulativeScore: 13 }, [PlayerPosition.NORTH]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 20 }, [PlayerPosition.EAST]: { bid: 4, tricksWon: 4, roundScore: 4, cumulativeScore: 20 } } },
      ],
      userPosition: PlayerPosition.SOUTH,
      playerNames: { [PlayerPosition.SOUTH]: 'You', [PlayerPosition.WEST]: 'W', [PlayerPosition.NORTH]: 'N', [PlayerPosition.EAST]: 'E' },
    };

    const stats = StatisticsService.calculate([match1, match2], PlayerPosition.SOUTH);

    if (stats.totalMatches !== 2) throw new Error(`Expected 2 matches, got ${stats.totalMatches}`);
    if (stats.wins !== 1) throw new Error(`Expected 1 win, got ${stats.wins}`);
    if (stats.losses !== 1) throw new Error(`Expected 1 loss, got ${stats.losses}`);
    if (stats.winRate !== 50.0) throw new Error(`Expected 50.0% win rate, got ${stats.winRate}`);

    // Total score = 15.2 + 8.0 = 23.2
    if (stats.totalScore !== 23.2) throw new Error(`Expected 23.2 total score, got ${stats.totalScore}`);
    if (stats.highestFinalScore !== 15.2) throw new Error(`Expected highest 15.2, got ${stats.highestFinalScore}`);
    if (stats.lowestFinalScore !== 8.0) throw new Error(`Expected lowest 8.0, got ${stats.lowestFinalScore}`);
    if (stats.averageFinalScore !== 11.6) throw new Error(`Expected avg 11.6, got ${stats.averageFinalScore}`);

    // Total tricks won: (3+4+4+1+3) + (2+3+1+4+2) = 15 + 12 = 27
    if (stats.totalTricksWon !== 27) throw new Error(`Expected 27 tricks, got ${stats.totalTricksWon}`);
    if (stats.highestTricksInMatch !== 15) throw new Error(`Expected highest match tricks 15, got ${stats.highestTricksInMatch}`);

    // Contracts: 10 total rounds. 8 met, 2 missed -> 80% contract success
    if (stats.totalBids !== 10) throw new Error(`Expected 10 total bids, got ${stats.totalBids}`);
    if (stats.successfulContracts !== 8) throw new Error(`Expected 8 successful contracts, got ${stats.successfulContracts}`);
    if (stats.failedContracts !== 2) throw new Error(`Expected 2 failed contracts, got ${stats.failedContracts}`);
    if (stats.contractSuccessRate !== 80.0) throw new Error(`Expected 80.0% contract success rate, got ${stats.contractSuccessRate}`);
  });

  // Test 8: End-to-end real simulation pipeline creates valid history & statistics
  harness.register('Phase 9 Pipeline', 'Simulates complete 5-round game and verifies history snapshot and derived stats', async () => {
    const rulesEngine = new CallBreakRulesEngine();
    const scoringEngine = new ScoringEngine();
    const botStrategy = new MediumBotStrategy();
    const rng = new DeterministicRandomSource(99991);
    const cardEngine = new CardEngine(rng);
    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      cardEngine,
      rulesEngine,
      scoringEngine,
      botStrategy,
    });

    const storage = createMockStorage();
    const historyService = new HistoryService(storage);

    controller.startNewMatch();

    // Play all 5 rounds deterministically
    for (let round = 1; round <= 5; round++) {
      // 1. Submit bids for all 4 players in clockwise order from left of dealer
      while (store.getState().status === GameStatus.BIDDING) {
        const cur = store.getState();
        const expected = rulesEngine.getExpectedBiddingPlayer(cur);
        if (!expected) break;

        const playerHand = cur.players[expected].hand;
        const bid = botStrategy.decideBid(playerHand, {
          position: expected,
          dealer: cur.dealer,
          existingBids: {
            SOUTH: cur.players.SOUTH.currentBid,
            WEST: cur.players.WEST.currentBid,
            NORTH: cur.players.NORTH.currentBid,
            EAST: cur.players.EAST.currentBid,
          },
          trumpSuit: cur.config.trumpSuit,
        });

        controller.submitBid(expected, bid);
      }

      // 2. Play all 13 tricks in the round
      while (store.getState().status === GameStatus.PLAYING) {
        const cur = store.getState();
        const activePlayer = cur.currentPlayer;
        const currentHand = cur.players[activePlayer].hand;
        const currentTrick = cur.currentTrick;
        const legalCards = rulesEngine.getLegalMoves(currentHand, currentTrick);

        const chosenCard = botStrategy.decideCardPlay({
          position: activePlayer,
          hand: currentHand,
          legalMoves: legalCards,
          currentTrick,
          trumpSuit: cur.config.trumpSuit,
          playerBid: cur.players[activePlayer].currentBid ?? 1,
          playerTricksWon: cur.players[activePlayer].tricksWon,
          remainingCardsCount: {
            SOUTH: cur.players.SOUTH.hand.length,
            WEST: cur.players.WEST.hand.length,
            NORTH: cur.players.NORTH.hand.length,
            EAST: cur.players.EAST.hand.length,
          },
        });

        controller.playCard(activePlayer, chosenCard);
      }

      // 3. Complete round scoring
      controller.completeRound();

      // 4. Advance to next round if match not finished
      if (round < 5) {
        controller.nextRound();
      }
    }

    const finishedState = store.getState();
    if (finishedState.status !== GameStatus.MATCH_FINISHED || !finishedState.matchResult) {
      throw new Error('Game did not reach MATCH_FINISHED after 5 rounds');
    }

    // Record match to history service
    const recorded = await historyService.recordMatchFinished(finishedState, PlayerPosition.SOUTH);
    if (!recorded) {
      throw new Error('Failed to record completed match in historyService');
    }

    const matches = await historyService.getMatches();
    if (matches.length !== 1) {
      throw new Error(`Expected 1 saved match, found ${matches.length}`);
    }

    const savedRecord = matches[0];
    if (!isValidHistoryRecord(savedRecord)) {
      throw new Error('Recorded match failed schema validation');
    }

    if (savedRecord.totalRounds !== 5) {
      throw new Error(`Expected 5 total rounds, got ${savedRecord.totalRounds}`);
    }

    if (savedRecord.rankings.length !== 4) {
      throw new Error('Rankings does not contain 4 players');
    }

    // Verify statistics derived from this actual match
    const stats = StatisticsService.calculate(matches, PlayerPosition.SOUTH);
    if (stats.totalMatches !== 1) {
      throw new Error(`Expected 1 total match in stats, got ${stats.totalMatches}`);
    }

    if (stats.totalScore !== savedRecord.finalScores[PlayerPosition.SOUTH]) {
      throw new Error(`Stats score ${stats.totalScore} does not match record score ${savedRecord.finalScores[PlayerPosition.SOUTH]}`);
    }
  });

  // Test 9: ActiveGameService lifecycle (save, resume check, corrupted recovery, clean removal)
  harness.register('Phase 9 Persistence', 'ActiveGameService manages in-progress games safely and validates state', async () => {
    const storage = createMockStorage();
    const activeService = new ActiveGameService(storage);

    // Initial state: no active game
    const hasInitial = await activeService.hasActiveGame();
    if (hasInitial) throw new Error('Expected no active game initially');

    // Save in-progress game
    const sampleState: any = {
      matchId: 'active_test_match_99',
      status: GameStatus.PLAYING,
      currentRound: 2,
      dealer: PlayerPosition.WEST,
      currentPlayer: PlayerPosition.SOUTH,
    };
    await activeService.saveActiveGame(sampleState);

    const hasSaved = await activeService.hasActiveGame();
    if (!hasSaved) throw new Error('Expected active game to exist after saving');

    const loaded = await activeService.loadActiveGame();
    if (!loaded || loaded.matchId !== 'active_test_match_99' || loaded.currentRound !== 2) {
      throw new Error('Loaded active game does not match saved payload');
    }

    // Saving MATCH_FINISHED state should NOT be considered an active resumable game
    sampleState.status = GameStatus.MATCH_FINISHED;
    await activeService.saveActiveGame(sampleState);
    const hasFinished = await activeService.hasActiveGame();
    if (hasFinished) throw new Error('MATCH_FINISHED must not count as an active game');

    // Clear active game
    await activeService.clearActiveGame();
    const hasAfterClear = await activeService.hasActiveGame();
    if (hasAfterClear) throw new Error('Active game must not exist after clearActiveGame');
  });

  // Test 10: Player streaks & finish rank distribution
  harness.register('Phase 9 Statistics', 'Calculates finish rank distribution and win/loss streaks accurately', async () => {
    const makeRecord = (id: string, time: number, rank: number, isWinner: boolean): MatchHistoryRecord => ({
      version: 1,
      matchId: id,
      completedAt: time,
      totalRounds: 5,
      winnerPosition: isWinner ? PlayerPosition.SOUTH : PlayerPosition.NORTH,
      winnerPositions: isWinner ? [PlayerPosition.SOUTH] : [PlayerPosition.NORTH],
      isTie: false,
      finalScores: { [PlayerPosition.SOUTH]: 10, [PlayerPosition.WEST]: 5, [PlayerPosition.NORTH]: 5, [PlayerPosition.EAST]: 5 },
      rankings: [
        { position: PlayerPosition.SOUTH, name: 'You', isHuman: true, score: 10, rank },
        { position: PlayerPosition.WEST, name: 'W', isHuman: false, score: 5, rank: rank === 1 ? 2 : 1 },
        { position: PlayerPosition.NORTH, name: 'N', isHuman: false, score: 5, rank: 3 },
        { position: PlayerPosition.EAST, name: 'E', isHuman: false, score: 5, rank: 4 },
      ],
      rounds: [],
      userPosition: PlayerPosition.SOUTH,
      playerNames: { [PlayerPosition.SOUTH]: 'You', [PlayerPosition.WEST]: 'W', [PlayerPosition.NORTH]: 'N', [PlayerPosition.EAST]: 'E' },
    });

    // Sequence of 5 matches chronologically (time ascending):
    // Match 1: Win (1st place)
    // Match 2: Win (1st place)
    // Match 3: Win (1st place)  -> 3 win streak
    // Match 4: Loss (3rd place) -> streak broken, now 1 loss streak
    // Match 5: Loss (2nd place) -> 2 loss streak
    const m1 = makeRecord('m1', 1000, 1, true);
    const m2 = makeRecord('m2', 2000, 1, true);
    const m3 = makeRecord('m3', 3000, 1, true);
    const m4 = makeRecord('m4', 4000, 3, false);
    const m5 = makeRecord('m5', 5000, 2, false);

    const stats = StatisticsService.calculate([m5, m4, m3, m2, m1], PlayerPosition.SOUTH);

    if (stats.totalMatches !== 5) throw new Error(`Expected 5 matches, got ${stats.totalMatches}`);
    if (stats.rankDistribution[1] !== 3) throw new Error(`Expected 3 first places, got ${stats.rankDistribution[1]}`);
    if (stats.rankDistribution[2] !== 1) throw new Error(`Expected 1 second place, got ${stats.rankDistribution[2]}`);
    if (stats.rankDistribution[3] !== 1) throw new Error(`Expected 1 third place, got ${stats.rankDistribution[3]}`);
    if (stats.rankDistribution[4] !== 0) throw new Error(`Expected 0 fourth places, got ${stats.rankDistribution[4]}`);

    if (stats.bestWinStreak !== 3) throw new Error(`Expected best win streak of 3, got ${stats.bestWinStreak}`);
    if (stats.currentStreak.type !== 'LOSS' || stats.currentStreak.count !== 2) {
      throw new Error(`Expected current streak of 2 LOSS, got ${stats.currentStreak.type} ${stats.currentStreak.count}`);
    }
  });

  return harness;
}
