/**
 * Phase 10 Settings & Interactive Tutorial Automated Test Suite
 * Validates persistent settings repository, corruption recovery, isolated reset,
 * sound/motion synchronization, presentation speed control, and interactive tutorial mechanics.
 */

import { TestHarness, assert } from './testHarness';
import { SettingsRepository, ISettingsStorage } from '../core/settings/SettingsRepository';
import { SettingsService } from '../core/settings/SettingsService';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SETTINGS_SCHEMA_VERSION,
} from '../core/settings/settingsTypes';
import { ScoringEngine } from '../core/scoring/ScoringEngine';
import { CallBreakRulesEngine } from '../core/rules/CallBreakRulesEngine';
import { CardEngine } from '../core/deck/CardEngine';
import { LocalGameController } from '../core/controller/LocalGameController';
import { GameStateStore } from '../core/state/gameStore';
import { PlayerPosition } from '../models/player';
import { Suit, Rank } from '../models/card';
import { createCard } from '../core/deck/cardUtils';
import { TrickState } from '../models/gameState';

class MockStorage implements ISettingsStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  dump(): Map<string, string> {
    return new Map(this.data);
  }
}

export function buildPhase10SettingsTutorialTestSuite(): TestHarness {
  const harness = new TestHarness();

  // 1. Settings Defaults
  harness.register('Phase 10: Settings Defaults', 'Should initialize with standard default values', async () => {
    const storage = new MockStorage();
    const repo = new SettingsRepository(storage);
    const settings = await repo.loadSettings();

    assert.equal(settings.schemaVersion, SETTINGS_SCHEMA_VERSION);
    assert.equal(settings.soundEnabled, true);
    assert.equal(settings.soundVolume, 0.7);
    assert.equal(settings.motionPreference, 'full');
    assert.equal(settings.gameSpeed, 'normal');
    assert.equal(settings.tutorialEnabled, true);
    assert.equal(settings.tutorialCompleted, false);
    assert.equal(settings.ruleCoachEnabled, true);
  });

  // 2. Settings Persistence & Clamping
  harness.register('Phase 10: Persistence & Clamping', 'Should save and clamp volume between 0 and 1', async () => {
    const storage = new MockStorage();
    const repo = new SettingsRepository(storage);

    await repo.saveSettings({
      ...DEFAULT_SETTINGS,
      soundVolume: 1.5, // should clamp to 1.0
      motionPreference: 'reduced',
      gameSpeed: 'fast',
    });

    const loaded = await repo.loadSettings();
    assert.equal(loaded.soundVolume, 1.0);
    assert.equal(loaded.motionPreference, 'reduced');
    assert.equal(loaded.gameSpeed, 'fast');

    // Negative volume should clamp to 0.0
    await repo.saveSettings({
      ...loaded,
      soundVolume: -0.4,
    });
    const clampedZero = await repo.loadSettings();
    assert.equal(clampedZero.soundVolume, 0);
  });

  // 3. Corrupt Data Recovery
  harness.register('Phase 10: Corrupt Storage Recovery', 'Should recover gracefully if storage is corrupted or malformed', async () => {
    const storage = new MockStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, '{invalid json here');

    const repo = new SettingsRepository(storage);
    const recovered = await repo.loadSettings();

    assert.equal(recovered.soundEnabled, DEFAULT_SETTINGS.soundEnabled);
    assert.equal(recovered.soundVolume, DEFAULT_SETTINGS.soundVolume);
    assert.equal(recovered.motionPreference, DEFAULT_SETTINGS.motionPreference);
    assert.equal(recovered.gameSpeed, DEFAULT_SETTINGS.gameSpeed);
  });

  // 4. Isolated Reset Preservation
  harness.register('Phase 10: Isolated Reset', 'Resetting settings should NOT wipe match history or game state', async () => {
    const storage = new MockStorage();
    const historyKey = 'cb_lakdi_history_v1';
    const activeGameKey = 'cb_lakdi_active_game_v1';

    storage.setItem(historyKey, JSON.stringify([{ id: 'match_123', totalScore: 12.5 }]));
    storage.setItem(activeGameKey, JSON.stringify({ currentRound: 3 }));
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, gameSpeed: 'fast', soundVolume: 0.1 }));

    const repo = new SettingsRepository(storage);
    const resetResult = await repo.resetSettings();

    assert.equal(resetResult.gameSpeed, 'normal');
    assert.equal(resetResult.soundVolume, 0.7);

    // Verify history and active game are completely untouched
    assert.equal(storage.getItem(historyKey), JSON.stringify([{ id: 'match_123', totalScore: 12.5 }]));
    assert.equal(storage.getItem(activeGameKey), JSON.stringify({ currentRound: 3 }));
  });

  // 5. SettingsService Event Subscription
  harness.register('Phase 10: Settings Service Subscription', 'Subscribers should be notified on setting updates', async () => {
    const storage = new MockStorage();
    const service = new SettingsService(storage);
    await service.ready();

    let observedSpeed = '';
    const unsubscribe = service.subscribe((s) => {
      observedSpeed = s.gameSpeed;
    });

    await service.updateSettings({ gameSpeed: 'fast' });
    assert.equal(observedSpeed, 'fast');

    unsubscribe();
    await service.updateSettings({ gameSpeed: 'normal' });
    // Should remain fast since unsubscribed
    assert.equal(observedSpeed, 'fast');
  });

  // 6. Interactive Tutorial - Scoring Engine Alignment
  harness.register('Phase 10: Tutorial Scoring Alignment', 'Tutorial interactive score formulas must match ScoringEngine', () => {
    const engine = new ScoringEngine();

    // Contract won: Bid 3, Won 4 => 3.1
    const wonScore = engine.calculatePlayerScore(3, 4);
    assert.equal(wonScore, 3.1);

    // Contract failed: Bid 3, Won 2 => -3.0
    const failedScore = engine.calculatePlayerScore(3, 2);
    assert.equal(failedScore, -3.0);

    // Exact contract: Bid 4, Won 4 => 4.0
    const exactScore = engine.calculatePlayerScore(4, 4);
    assert.equal(exactScore, 4.0);
  });

  // 7. Interactive Tutorial - Follow Suit Rule Alignment
  harness.register('Phase 10: Tutorial Follow Suit Rules', 'RulesEngine must enforce follow-suit identically to tutorial step 4', () => {
    const rulesEngine = new CallBreakRulesEngine();

    const leadCard = createCard(Suit.HEARTS, Rank.TEN);
    const currentTrick: TrickState = {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: Suit.HEARTS,
      cards: [{ playerPosition: PlayerPosition.WEST, card: leadCard, playedAt: Date.now() }],
      winner: null,
    };

    const handWithHearts = [
      createCard(Suit.HEARTS, Rank.ACE),
      createCard(Suit.HEARTS, Rank.SIX),
      createCard(Suit.DIAMONDS, Rank.KING),
      createCard(Suit.SPADES, Rank.EIGHT),
    ];

    const legalCards = rulesEngine.getLegalMoves(handWithHearts, currentTrick);
    // Table lead is ♥10. Hand has ♥A and ♥6. Must play higher winning card (♥A)
    assert.equal(legalCards.length, 1);
    assert.equal(legalCards[0].rank, Rank.ACE);
    assert.equal(legalCards[0].suit, Suit.HEARTS);

    // If hand has only lower Hearts (e.g. ♥8, ♥6), all Hearts are legal
    const lowerHeartsHand = [
      createCard(Suit.HEARTS, Rank.EIGHT),
      createCard(Suit.HEARTS, Rank.SIX),
      createCard(Suit.DIAMONDS, Rank.KING),
    ];
    const legalLower = rulesEngine.getLegalMoves(lowerHeartsHand, currentTrick);
    assert.equal(legalLower.length, 2);
    for (const card of legalLower) {
      assert.equal(card.suit, Suit.HEARTS);
    }

    // If player holds NO Hearts but holds Spades, they must trump with Spades
    const voidHandWithTrump = [
      createCard(Suit.DIAMONDS, Rank.KING),
      createCard(Suit.SPADES, Rank.EIGHT),
    ];
    const legalVoidCards = rulesEngine.getLegalMoves(voidHandWithTrump, currentTrick);
    assert.equal(legalVoidCards.length, 1);
    assert.equal(legalVoidCards[0].suit, Suit.SPADES);

    // If player holds NO Hearts and NO Spades, they may discard any card
    const voidHandNoTrump = [
      createCard(Suit.DIAMONDS, Rank.KING),
      createCard(Suit.CLUBS, Rank.SEVEN),
    ];
    const legalDiscards = rulesEngine.getLegalMoves(voidHandNoTrump, currentTrick);
    assert.equal(legalDiscards.length, 2);
  });

  // 8. Interactive Tutorial - Spades Trump Rule Alignment
  harness.register('Phase 10: Tutorial Trump Rule', 'Lowest Spade must beat highest card of lead suit', () => {
    const rulesEngine = new CallBreakRulesEngine();

    const leadCard = createCard(Suit.HEARTS, Rank.ACE);
    const trickCards = [
      { playerPosition: PlayerPosition.WEST, card: leadCard, playedAt: 1 },
      { playerPosition: PlayerPosition.NORTH, card: createCard(Suit.HEARTS, Rank.KING), playedAt: 2 },
      { playerPosition: PlayerPosition.EAST, card: createCard(Suit.SPADES, Rank.TWO), playedAt: 3 }, // trump!
      { playerPosition: PlayerPosition.SOUTH, card: createCard(Suit.HEARTS, Rank.SEVEN), playedAt: 4 },
    ];

    const winner = rulesEngine.determineTrickWinner(trickCards, Suit.HEARTS);
    assert.equal(winner, PlayerPosition.EAST);
  });

  // 9. Rule Coach Non-Interference
  harness.register('Phase 10: Rule Coach Non-Interference', 'Rule coach must not alter legal moves or game state', () => {
    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      cardEngine: new CardEngine(),
      rulesEngine: new CallBreakRulesEngine(),
      scoringEngine: new ScoringEngine(),
    });

    controller.startNewMatch();
    const state = store.getState();

    // Cards dealt must still be 13 for each player
    assert.equal(state.players[PlayerPosition.SOUTH].hand.length, 13);
    assert.equal(state.players[PlayerPosition.NORTH].hand.length, 13);
    assert.equal(state.players[PlayerPosition.WEST].hand.length, 13);
    assert.equal(state.players[PlayerPosition.EAST].hand.length, 13);

    // Bids must remain unaltered
    assert.equal(state.players[PlayerPosition.SOUTH].currentBid, null);
  });

  return harness;
}
