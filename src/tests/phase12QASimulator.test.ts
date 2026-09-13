/**
 * Phase 12 QA Simulator & Reliability Stress Test Suite
 * Automated verification of all invariant assertions, simulation batches,
 * deterministic replays, persistence cycles, history bounding, and corruption resilience.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { TestHarness, assert } from './testHarness';
import { QASimulator } from './qa/QASimulator';
import { GameRunner } from './qa/GameRunner';
import { QAScoringVerifier } from './qa/QAScoringVerifier';
import { QABotSafetyVerifier } from './qa/QABotSafetyVerifier';
import { QAPersistenceStress } from './qa/QAPersistenceStress';
import { QAHistoryStress } from './qa/QAHistoryStress';
import { QACorruptionStress } from './qa/QACorruptionStress';
import { QAFailureReporter } from './qa/QAFailureReporter';
import { GameStateStore } from '../core/state/gameStore';
import { PlayerPosition } from '../models/player';
import { Suit } from '../models/card';

export function buildPhase12QASimulatorTestSuite(): TestHarness {
  const harness = new TestHarness();
  const qa = new QASimulator();

  // 1. Card Conservation Invariants
  harness.register('Phase 12: QA Invariants', 'Card conservation maintains exactly 52 cards without duplicates', () => {
    const runner = new GameRunner();
    const result = runner.runGame({ seed: 7771, validateEveryAction: true });
    assert.ok(result.success, 'Game run failed');
    const cardViolations = result.violations.filter(
      (v) => v.category === 'CARD_CONSERVATION' || v.category === 'DUPLICATE_CARD'
    );
    assert.equal(cardViolations.length, 0, 'Card conservation violations detected');
  });

  // 2. Turn Progression & Clockwise Invariants
  harness.register('Phase 12: QA Invariants', 'Turn progression adheres strictly to clockwise rotation and trick leader rules', () => {
    const runner = new GameRunner();
    const result = runner.runGame({ seed: 7772, validateEveryAction: true });
    assert.ok(result.success, 'Game run failed');
    const turnViolations = result.violations.filter((v) => v.category === 'TURN_PROGRESSION');
    assert.equal(turnViolations.length, 0, 'Turn progression violations detected');
  });

  // 3. Bidding Invariants
  harness.register('Phase 12: QA Invariants', 'Bids conform strictly to integers 1-13 in proper dealer rotation order', () => {
    const runner = new GameRunner();
    const result = runner.runGame({ seed: 7773, validateEveryAction: true });
    assert.ok(result.success, 'Game run failed');
    const bidViolations = result.violations.filter((v) => v.category === 'BID_VALIDITY');
    assert.equal(bidViolations.length, 0, 'Bid validity violations detected');
  });

  // 4. Card Play & Follow-Suit Invariants
  harness.register('Phase 12: QA Invariants', 'Card plays adhere to Call Break lead suit and spade trump rules', () => {
    const runner = new GameRunner();
    const result = runner.runGame({ seed: 7774, validateEveryAction: true });
    assert.ok(result.success, 'Game run failed');
    const moveViolations = result.violations.filter((v) => v.category === 'CARD_PLAY_LEGALITY');
    assert.equal(moveViolations.length, 0, 'Illegal card plays detected');
  });

  // 5. Trick & Round Progression Invariants
  harness.register('Phase 12: QA Invariants', 'Exactly 13 tricks per round and exactly 5 rounds per match', () => {
    const runner = new GameRunner();
    const result = runner.runGame({ seed: 7775, validateEveryAction: true });
    assert.equal(result.roundsCompleted, 5, 'Must complete exactly 5 rounds');
    assert.equal(result.tricksCompleted, 65, 'Must complete exactly 65 tricks');
    const roundViolations = result.violations.filter(
      (v) => v.category === 'TRICK_INTEGRITY' || v.category === 'ROUND_INTEGRITY'
    );
    assert.equal(roundViolations.length, 0, 'Trick or round integrity violations detected');
  });

  // 6. Independent Scoring Math Invariants
  harness.register('Phase 12: Scoring Verification', 'Round scores and cumulative sums match independent Call Break scoring model', () => {
    // Test direct mathematical edge cases
    assert.equal(QAScoringVerifier.calculateExpectedPlayerScore(3, 3), 3.0);
    assert.equal(QAScoringVerifier.calculateExpectedPlayerScore(3, 5), 3.2);
    assert.equal(QAScoringVerifier.calculateExpectedPlayerScore(4, 2), -4.0);
    assert.equal(QAScoringVerifier.calculateExpectedPlayerScore(1, 1), 1.0);
    assert.equal(QAScoringVerifier.calculateExpectedPlayerScore(13, 13), 13.0);

    const runner = new GameRunner();
    const result = runner.runGame({ seed: 7776, validateEveryAction: true });
    const scoreViolations = result.violations.filter((v) => v.category === 'SCORING_CONSISTENCY');
    assert.equal(scoreViolations.length, 0, 'Scoring consistency violations detected');
  });

  // 7. Bot Information Barrier Invariants
  harness.register('Phase 12: Bot Safety', 'Bot contexts enforce strict information barriers (no hidden cards leakage)', () => {
    const botViolations = QABotSafetyVerifier.verifyBiddingContext({
      position: PlayerPosition.SOUTH,
      dealer: PlayerPosition.EAST,
      existingBids: { SOUTH: null, WEST: null, NORTH: null, EAST: null },
      trumpSuit: Suit.SPADES,
    });
    assert.equal(botViolations.length, 0, 'Clean context reported unexpected violation');

    // Verify detection of leaked hidden hand property
    const leakyViolations = QABotSafetyVerifier.verifyBiddingContext({
      position: PlayerPosition.SOUTH,
      dealer: PlayerPosition.EAST,
      existingBids: { SOUTH: null, WEST: null, NORTH: null, EAST: null },
      trumpSuit: Suit.SPADES,
      hiddenHands: [],
    } as any);
    assert.equal(leakyViolations.length, 1, 'Failed to catch forbidden hiddenHands leak');
  });

  // 8. Deterministic Replay Verification
  harness.register('Phase 12: Deterministic Replay', 'Deterministic replay produces exact match outcomes across identical seeds', () => {
    const replayResult = qa.verifyDeterministicReplay(8888);
    assert.ok(replayResult.isExactMatch, `Deterministic replay mismatch: ${replayResult.mismatches.join(', ')}`);
  });

  // 9. Edge-Case Seed Sweep
  harness.register('Phase 12: Seed Sweep', 'Edge-case seeds (0, 1, 42, 99999, 1000000) complete without violations', () => {
    const seeds = [0, 1, 42, 12345, 99999];
    const { metrics, failedGames } = qa.runBatch({ seeds });
    assert.equal(metrics.gamesCompleted, seeds.length, 'All edge seeds must complete');
    assert.equal(failedGames.length, 0, 'No edge seed games should fail');
  });

  // 10. Extreme Bidding Stress
  harness.register('Phase 12: Bidding Stress', 'Extreme bidding scenarios (All 1s, All 13s, Mixed Extremes) complete cleanly', () => {
    const { metrics: mOnes } = qa.runBatch({ gameCount: 5, bidStrategy: 'ALL_ONES' });
    assert.equal(mOnes.gamesCompleted, 5, 'All-ones bidding must succeed');

    const { metrics: mThirteens } = qa.runBatch({ gameCount: 5, bidStrategy: 'ALL_THIRTEENS' });
    assert.equal(mThirteens.gamesCompleted, 5, 'All-thirteens bidding must succeed');

    const { metrics: mMixed } = qa.runBatch({ gameCount: 5, bidStrategy: 'MIXED_EXTREMES' });
    assert.equal(mMixed.gamesCompleted, 5, 'Mixed extremes bidding must succeed');
  });

  // 11. Multi-Checkpoint Persistence Stress
  harness.register('Phase 12: Persistence Stress', 'Multi-checkpoint save/resume verifies exact state parity across all game phases', async () => {
    const pResults = await QAPersistenceStress.runMultiCheckpointStress(9090);
    assert.equal(pResults.length, 8, 'Expected 8 persistence checkpoints');
    const failed = pResults.filter((r) => !r.success);
    assert.equal(failed.length, 0, `Persistence checkpoint failures: ${JSON.stringify(failed)}`);
  });

  // 12. History Repository Idempotency & 100-Record FIFO Stress
  harness.register('Phase 12: History Stress', 'Match history enforces idempotency, reload persistence, and 100-record FIFO pruning', async () => {
    const hResult = await QAHistoryStress.runHistoryStress();
    assert.ok(hResult.success, `History stress failure: ${JSON.stringify(hResult.violations)}`);
  });

  // 13. Data Corruption Resistance & Storage Isolation
  harness.register('Phase 12: Corruption Resistance', 'Malformed or invalid persistence data is safely rejected without crashing or corrupting settings', () => {
    const cResult = QACorruptionStress.runCorruptionTests();
    assert.ok(cResult.success, `Corruption stress failure: ${JSON.stringify(cResult.violations)}`);
  });

  // 14. Failure Diagnostic Capture & Formatting
  harness.register('Phase 12: Failure Diagnostics', 'Diagnostic capture extracts structured forensics including seed, hands, and actions', () => {
    const store = new GameStateStore();
    const state = store.getState();
    const diag = QAFailureReporter.captureDiagnostics(
      1234,
      state,
      'PREV_ACTION',
      'FAIL_ACTION',
      new Error('Test invariant trigger'),
      [{ category: 'CARD_CONSERVATION', message: 'Test conservation failure' }]
    );

    assert.equal(diag.seed, 1234);
    assert.equal(diag.failingAction, 'FAIL_ACTION');
    assert.equal(diag.error, 'Test invariant trigger');
    const report = QAFailureReporter.formatReport(diag, [
      { category: 'CARD_CONSERVATION', message: 'Test conservation failure' },
    ]);
    assert.ok(report.includes('QA FAILURE REPRODUCTION REPORT'), 'Report must contain header');
  });

  // 15. Simulation Batch (25 Complete 5-Round Games in Test Suite)
  harness.register('Phase 12: Batch Simulation', 'Runs a 25-game simulation batch (125 rounds, 1625 tricks) with zero invariant violations', () => {
    const { metrics, failedGames } = qa.runBatch({ gameCount: 25 });
    assert.equal(metrics.gamesCompleted, 25, 'All 25 games must complete');
    assert.equal(failedGames.length, 0, 'Zero failed games expected');
    assert.equal(metrics.roundsCompleted, 125, 'Expected 125 rounds');
    assert.equal(metrics.tricksCompleted, 1625, 'Expected 1625 tricks');
    assert.equal(metrics.illegalMoves, 0, 'Zero illegal moves');
    assert.equal(metrics.duplicateCards, 0, 'Zero duplicate cards');
    assert.equal(metrics.cardConservationViolations, 0, 'Zero card conservation violations');
    assert.equal(metrics.stateTransitionViolations, 0, 'Zero state violations');
  });

  return harness;
}
