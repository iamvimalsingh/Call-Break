/**
 * Comprehensive Unit Test Suite for Call Break Scoring Engine
 * Phase 4 Call Break Scoring Engine
 */

import { TestHarness, assert, assertDefined } from './testHarness';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../models/player';
import { GameStatus, GameState } from '../models/gameState';
import {
  ScoringEngine,
  StandardCallBreakScoringPolicy,
  ConfigurableScoringPolicy,
  roundToPrecision,
} from '../core/scoring';
import { RoundScoringInput } from '../core/contracts/IScoringEngine';
import { createInitialGameState } from '../core/state/initialState';
import { GameStateStore } from '../core/state/gameStore';
import { LocalGameController } from '../core/controller/LocalGameController';

export function buildScoringEngineTestSuite(): TestHarness {
  const harness = new TestHarness();
  const scoringEngine = new ScoringEngine();
  const standardPolicy = new StandardCallBreakScoringPolicy();

  // Test 1: Basic Successful Bids (tricksWon === bid)
  harness.register('Basic Successful Bids', 'Validates round scores when tricksWon equals bid', () => {
    assert.equal(scoringEngine.calculatePlayerScore(1, 1), 1.0);
    assert.equal(scoringEngine.calculatePlayerScore(5, 5), 5.0);
    assert.equal(scoringEngine.calculatePlayerScore(13, 13), 13.0);
    assert.equal(standardPolicy.calculatePlayerRoundScore(8, 8), 8.0);
  });

  // Test 2: Overtricks (tricksWon > bid)
  harness.register('Overtrick Calculations', 'Applies 0.1 per overtrick correctly with floating precision safety', () => {
    // Bid 5, Tricks 6 -> 5.1
    assert.equal(scoringEngine.calculatePlayerScore(5, 6), 5.1);
    // Bid 5, Tricks 7 -> 5.2
    assert.equal(scoringEngine.calculatePlayerScore(5, 7), 5.2);
    // Bid 3, Tricks 5 -> 3 + (5-3)*0.1 = 3.2
    assert.equal(scoringEngine.calculatePlayerScore(3, 5), 3.2);
    // Bid 1, Tricks 4 -> 1 + (4-1)*0.1 = 1.3
    assert.equal(scoringEngine.calculatePlayerScore(1, 4), 1.3);
    // Bid 1, Tricks 13 -> 1 + (13-1)*0.1 = 2.2
    assert.equal(scoringEngine.calculatePlayerScore(1, 13), 2.2);
    // Bid 2, Tricks 8 -> 2 + (8-2)*0.1 = 2.6
    assert.equal(scoringEngine.calculatePlayerScore(2, 8), 2.6);
  });

  // Test 3: Failed Bids (tricksWon < bid)
  harness.register('Failed Bid Penalties', 'Applies -bid penalty when tricksWon is strictly less than bid', () => {
    // Bid 1, Tricks 0 -> -1
    assert.equal(scoringEngine.calculatePlayerScore(1, 0), -1.0);
    // Bid 5, Tricks 4 -> -5
    assert.equal(scoringEngine.calculatePlayerScore(5, 4), -5.0);
    // Bid 5, Tricks 3 -> -5
    assert.equal(scoringEngine.calculatePlayerScore(5, 3), -5.0);
    // Bid 5, Tricks 0 -> -5
    assert.equal(scoringEngine.calculatePlayerScore(5, 0), -5.0);
    // Bid 8, Tricks 7 -> -8
    assert.equal(scoringEngine.calculatePlayerScore(8, 7), -8.0);
    // Bid 3, Tricks 2 -> -3
    assert.equal(scoringEngine.calculatePlayerScore(3, 2), -3.0);
    // Bid 13, Tricks 12 -> -13
    assert.equal(scoringEngine.calculatePlayerScore(13, 12), -13.0);
  });

  // Test 4: Boundary Validation
  harness.register('Boundary Validation', 'Rejects out-of-range bids, negative values, and non-integers', () => {
    // Bid 0 rejected
    assert.throws(() => scoringEngine.calculatePlayerScore(0, 0), 'range');
    // Bid 14 rejected
    assert.throws(() => scoringEngine.calculatePlayerScore(14, 14), 'range');
    // Negative bid rejected
    assert.throws(() => scoringEngine.calculatePlayerScore(-2, 0), 'range');
    // Non-integer bid rejected
    assert.throws(() => scoringEngine.calculatePlayerScore(3.5, 4), 'integer');
    // Tricks -1 rejected
    assert.throws(() => scoringEngine.calculatePlayerScore(3, -1), 'range');
    // Tricks 14 rejected
    assert.throws(() => scoringEngine.calculatePlayerScore(3, 14), 'range');
    // Non-integer tricks rejected
    assert.throws(() => scoringEngine.calculatePlayerScore(3, 3.2), 'integer');
  });

  // Test 5: Four-Player Round Consistency (Total Tricks = 13)
  harness.register('Four-Player Round Scoring', 'Calculates all 4 scores with total tricks summing to 13', () => {
    const input: RoundScoringInput = {
      roundNumber: 1,
      playerResults: [
        { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 5 }, // 4 + 0.1 = 4.1
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 2 },  // -3.0
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 }, // 3.0
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },  // 3.0
      ],
      previousCumulativeScores: {
        [PlayerPosition.SOUTH]: 0,
        [PlayerPosition.WEST]: 0,
        [PlayerPosition.NORTH]: 0,
        [PlayerPosition.EAST]: 0,
      },
    };

    const record = scoringEngine.calculateRoundScores(input);
    assert.equal(record.roundNumber, 1);
    assert.equal(record.scores[PlayerPosition.SOUTH].roundScore, 4.1);
    assert.equal(record.scores[PlayerPosition.SOUTH].cumulativeScore, 4.1);
    assert.equal(record.scores[PlayerPosition.WEST].roundScore, -3.0);
    assert.equal(record.scores[PlayerPosition.WEST].cumulativeScore, -3.0);
    assert.equal(record.scores[PlayerPosition.NORTH].roundScore, 3.0);
    assert.equal(record.scores[PlayerPosition.NORTH].cumulativeScore, 3.0);
    assert.equal(record.scores[PlayerPosition.EAST].roundScore, 3.0);
    assert.equal(record.scores[PlayerPosition.EAST].cumulativeScore, 3.0);
  });

  // Test 6: Match Accumulation Across 5 Rounds
  harness.register('5-Round Match Accumulation', 'Accumulates scores across 5 rounds and completes match', () => {
    let cumulative: Record<PlayerPosition, number> = {
      [PlayerPosition.SOUTH]: 0,
      [PlayerPosition.WEST]: 0,
      [PlayerPosition.NORTH]: 0,
      [PlayerPosition.EAST]: 0,
    };

    const roundData = [
      // R1: S: 4 bid (5 won = 4.1), W: 3 (2 = -3), N: 3 (3 = 3), E: 3 (3 = 3)
      [
        { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 5 },
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 2 },
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
      // R2: S: 3 (4 won = 3.1), W: 4 (4 = 4), N: 2 (2 = 2), E: 3 (3 = 3)
      [
        { position: PlayerPosition.SOUTH, bid: 3, tricksWon: 4 },
        { position: PlayerPosition.WEST, bid: 4, tricksWon: 4 },
        { position: PlayerPosition.NORTH, bid: 2, tricksWon: 2 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
      // R3: S: 2 (2 = 2), W: 3 (3 = 3), N: 5 (5 = 5), E: 3 (3 = 3)
      [
        { position: PlayerPosition.SOUTH, bid: 2, tricksWon: 2 },
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.NORTH, bid: 5, tricksWon: 5 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
      // R4: S: 5 (5 = 5), W: 2 (1 = -2), N: 3 (4 = 3.1), E: 3 (3 = 3)
      [
        { position: PlayerPosition.SOUTH, bid: 5, tricksWon: 5 },
        { position: PlayerPosition.WEST, bid: 2, tricksWon: 1 },
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 4 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
      // R5: S: 3 (3 = 3), W: 3 (3 = 3), N: 4 (4 = 4), E: 3 (3 = 3)
      [
        { position: PlayerPosition.SOUTH, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.NORTH, bid: 4, tricksWon: 4 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
    ];

    const records = [];
    for (let r = 1; r <= 5; r++) {
      const record = scoringEngine.calculateRoundScores({
        roundNumber: r,
        playerResults: roundData[r - 1],
        previousCumulativeScores: cumulative,
      });
      records.push(record);

      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        cumulative[pos] = record.scores[pos].cumulativeScore;
      }
    }

    // Expected cumulatives:
    // S: 4.1 + 3.1 + 2 + 5 + 3 = 17.2
    // W: -3 + 4 + 3 - 2 + 3 = 5.0
    // N: 3 + 2 + 5 + 3.1 + 4 = 17.1
    // E: 3 + 3 + 3 + 3 + 3 = 15.0
    assert.equal(cumulative[PlayerPosition.SOUTH], 17.2);
    assert.equal(cumulative[PlayerPosition.WEST], 5.0);
    assert.equal(cumulative[PlayerPosition.NORTH], 17.1);
    assert.equal(cumulative[PlayerPosition.EAST], 15.0);

    // Verify Match Result
    const matchResult = scoringEngine.calculateMatchResult(cumulative, records);
    assert.equal(matchResult.winnerPosition, PlayerPosition.SOUTH);
    assert.equal(matchResult.isTie, false);
    assert.equal(matchResult.rankings[0].position, PlayerPosition.SOUTH);
    assert.equal(matchResult.rankings[0].rank, 1);
    assert.equal(matchResult.rankings[1].position, PlayerPosition.NORTH);
    assert.equal(matchResult.rankings[1].rank, 2);

    // Verify Match Complete flag
    assert.equal(scoringEngine.isMatchComplete(4, 5), false);
    assert.equal(scoringEngine.isMatchComplete(5, 5), true);
  });

  // Test 7: Tie Handling (Equal Top Scores)
  harness.register('Tie Handling', 'Exposes tied winners cleanly without inventing arbitrary tie-breaks', () => {
    const tiedScores: Record<PlayerPosition, number> = {
      [PlayerPosition.SOUTH]: 15.2,
      [PlayerPosition.WEST]: 8.0,
      [PlayerPosition.NORTH]: 11.0,
      [PlayerPosition.EAST]: 15.2, // Tied with SOUTH!
    };

    const matchResult = scoringEngine.calculateMatchResult(tiedScores);
    assert.equal(matchResult.isTie, true);
    assert.equal(matchResult.winnerPositions.length, 2);
    assert.ok(matchResult.winnerPositions.includes(PlayerPosition.SOUTH));
    assert.ok(matchResult.winnerPositions.includes(PlayerPosition.EAST));
    // Check rankings: both rank 1
    const rank1Players = matchResult.rankings.filter((r) => r.rank === 1);
    assert.equal(rank1Players.length, 2);
  });

  // Test 8: Invalid States Rejection
  harness.register('Invalid State Rejections', 'Rejects missing players, trick sum != 13, and duplicate scoring', () => {
    // 1. Missing a player (only 3 players provided)
    const missingPlayerInput: RoundScoringInput = {
      roundNumber: 1,
      playerResults: [
        { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 5 },
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 4 },
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 4 },
      ],
    };
    const check1 = scoringEngine.validateRoundScoringInput(missingPlayerInput);
    assert.equal(check1.isValid, false);
    assert.ok(check1.reason?.includes('exactly 4'));

    // 2. Duplicate player position
    const duplicatePlayerInput: RoundScoringInput = {
      roundNumber: 1,
      playerResults: [
        { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 5 },
        { position: PlayerPosition.SOUTH, bid: 3, tricksWon: 2 }, // Duplicate SOUTH
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
    };
    const check2 = scoringEngine.validateRoundScoringInput(duplicatePlayerInput);
    assert.equal(check2.isValid, false);
    assert.ok(check2.reason?.includes('Duplicate'));

    // 3. Tricks sum does NOT equal 13 (sum is 12)
    const invalidSumInput: RoundScoringInput = {
      roundNumber: 1,
      playerResults: [
        { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 4 },
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 2 }, // total = 12
      ],
    };
    const check3 = scoringEngine.validateRoundScoringInput(invalidSumInput);
    assert.equal(check3.isValid, false);
    assert.ok(check3.reason?.includes('must equal 13'));

    // 4. Invalid round number (e.g. 0 or 11)
    const invalidRoundInput: RoundScoringInput = {
      roundNumber: 11,
      playerResults: [
        { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 4 },
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
    };
    const check4 = scoringEngine.validateRoundScoringInput(invalidRoundInput);
    assert.equal(check4.isValid, false);
    assert.ok(check4.reason?.includes('Invalid round number'));
  });

  // Test 9: State Immutability
  harness.register('Immutability', 'Ensures scoring operations do not mutate inputs or original state', () => {
    const input: RoundScoringInput = {
      roundNumber: 1,
      playerResults: [
        { position: PlayerPosition.SOUTH, bid: 3, tricksWon: 4 },
        { position: PlayerPosition.WEST, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 },
        { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
      ],
      previousCumulativeScores: {
        [PlayerPosition.SOUTH]: 10,
        [PlayerPosition.WEST]: 10,
        [PlayerPosition.NORTH]: 10,
        [PlayerPosition.EAST]: 10,
      },
    };

    const inputSnapshot = JSON.stringify(input);
    scoringEngine.calculateRoundScores(input);
    assert.equal(JSON.stringify(input), inputSnapshot);
  });

  // Test 10: Determinism
  harness.register('Determinism', 'Produces identical scores for identical inputs across multiple runs', () => {
    const run1 = scoringEngine.calculatePlayerScore(4, 6);
    const run2 = scoringEngine.calculatePlayerScore(4, 6);
    const run3 = scoringEngine.calculatePlayerScore(4, 6);
    assert.equal(run1, 4.2);
    assert.equal(run2, 4.2);
    assert.equal(run3, 4.2);
  });

  // Test 11: Configurable Scoring Policy
  harness.register('Configurable Scoring Policy', 'Supports alternative overtrick weights and penalty policies', () => {
    // Policy with 0.2 overtrick bonus and ZERO penalty mode
    const customPolicy = new ConfigurableScoringPolicy({
      name: 'Generous Variant',
      overtrickValue: 0.2,
      failedBidPenaltyMode: 'ZERO',
    });

    const customEngine = new ScoringEngine(customPolicy);

    // Bid 4, Tricks 6 -> 4 + 2 * 0.2 = 4.4
    assert.equal(customEngine.calculatePlayerScore(4, 6), 4.4);
    // Bid 4, Tricks 2 -> 0 (ZERO penalty mode instead of -4)
    assert.equal(customEngine.calculatePlayerScore(4, 2), 0);
  });

  // Test 12: Controller & State Integration
  harness.register('Controller Scoring Integration', 'Applies scoring to GameState and transitions status cleanly', () => {
    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      scoringEngine,
    });

    // Prepare state simulating round 1 end
    store.setState((prev) => ({
      ...prev,
      currentRound: 1,
      status: GameStatus.ROUND_ENDED,
      completedTricks: new Array(13).fill({}) as any,
      players: {
        ...prev.players,
        SOUTH: { ...prev.players.SOUTH, currentBid: 4, tricksWon: 5 },
        WEST: { ...prev.players.WEST, currentBid: 3, tricksWon: 2 },
        NORTH: { ...prev.players.NORTH, currentBid: 3, tricksWon: 3 },
        EAST: { ...prev.players.EAST, currentBid: 3, tricksWon: 3 },
      },
    }));

    controller.completeRound();

    const finalState = store.getState();
    assert.equal(finalState.roundScores.length, 1);
    assert.equal(finalState.roundScores[0].scores.SOUTH.roundScore, 4.1);
    assert.equal(finalState.cumulativeScores.SOUTH, 4.1);
    assert.equal(finalState.cumulativeScores.WEST, -3.0);
  });

  // Test 13: Already Scored Round Rejection
  harness.register('Already Scored Round Rejection', 'Rejects re-scoring a round that already has recorded scores', () => {
    const store = new GameStateStore();
    const state: GameState = {
      ...createInitialGameState(),
      currentRound: 1,
      status: GameStatus.ROUND_ENDED,
      completedTricks: new Array(13).fill({}) as any,
      players: {
        ...createInitialGameState().players,
        SOUTH: { ...createInitialGameState().players.SOUTH, currentBid: 4, tricksWon: 5 },
        WEST: { ...createInitialGameState().players.WEST, currentBid: 3, tricksWon: 2 },
        NORTH: { ...createInitialGameState().players.NORTH, currentBid: 3, tricksWon: 3 },
        EAST: { ...createInitialGameState().players.EAST, currentBid: 3, tricksWon: 3 },
      },
    };

    // First scoring passes
    const scoredState = scoringEngine.applyRoundScoresToState(state);
    assert.equal(scoredState.roundScores.length, 1);

    // Second scoring on the same state must throw
    assert.throws(() => scoringEngine.applyRoundScoresToState(scoredState), 'already been scored');
  });

  // Test 14: Incomplete Round Rejection
  harness.register('Incomplete Round Rejection', 'Rejects scoring when game is still PLAYING or tricks < 13', () => {
    const activeState: GameState = {
      ...createInitialGameState(),
      currentRound: 1,
      status: GameStatus.PLAYING,
      completedTricks: new Array(10).fill({}) as any, // Only 10 tricks
    };

    assert.throws(() => scoringEngine.applyRoundScoresToState(activeState), 'Cannot score round');
  });

  return harness;
}
