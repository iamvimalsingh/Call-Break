/**
 * Settings Storage Repository
 * Provides offline-first persistence, schema versioning, corrupt-data recovery,
 * and isolated reset capability for user settings.
 * Phase 10 Settings & Interactive Tutorial
 */

import {
  UserSettings,
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  MotionPreference,
  GameSpeed,
} from './settingsTypes';

export interface ISettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SettingsRepository {
  private storage: ISettingsStorage;

  constructor(customStorage?: ISettingsStorage) {
    if (customStorage) {
      this.storage = customStorage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      // Memory fallback for headless/SSR test environments
      const map = new Map<string, string>();
      this.storage = {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => map.set(k, v),
        removeItem: (k: string) => map.delete(k),
      };
    }
  }

  /**
   * Loads settings from storage with safe fallback for missing or corrupted data.
   */
  public async loadSettings(): Promise<UserSettings> {
    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { ...DEFAULT_SETTINGS };
      }

      // Validate & sanitize fields
      const soundEnabled = typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled;
      const rawVolume = typeof parsed.soundVolume === 'number' ? parsed.soundVolume : DEFAULT_SETTINGS.soundVolume;
      const soundVolume = Math.max(0, Math.min(1, isNaN(rawVolume) ? DEFAULT_SETTINGS.soundVolume : rawVolume));

      const motionPreference: MotionPreference =
        parsed.motionPreference === 'reduced' || parsed.motionPreference === 'full'
          ? parsed.motionPreference
          : DEFAULT_SETTINGS.motionPreference;

      const gameSpeed: GameSpeed =
        parsed.gameSpeed === 'fast' || parsed.gameSpeed === 'normal'
          ? parsed.gameSpeed
          : DEFAULT_SETTINGS.gameSpeed;

      const tutorialEnabled = typeof parsed.tutorialEnabled === 'boolean' ? parsed.tutorialEnabled : DEFAULT_SETTINGS.tutorialEnabled;
      const tutorialCompleted = typeof parsed.tutorialCompleted === 'boolean' ? parsed.tutorialCompleted : DEFAULT_SETTINGS.tutorialCompleted;
      const ruleCoachEnabled = typeof parsed.ruleCoachEnabled === 'boolean' ? parsed.ruleCoachEnabled : DEFAULT_SETTINGS.ruleCoachEnabled;

      const validated: UserSettings = Object.freeze({
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        soundEnabled,
        soundVolume,
        motionPreference,
        gameSpeed,
        tutorialEnabled,
        tutorialCompleted,
        ruleCoachEnabled,
      });

      return validated;
    } catch {
      // JSON parse error or unexpected structure -> safe fallback to defaults
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Persists updated settings to storage.
   */
  public async saveSettings(settings: UserSettings): Promise<boolean> {
    try {
      const frozen: UserSettings = Object.freeze({
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        soundEnabled: Boolean(settings.soundEnabled),
        soundVolume: Math.max(0, Math.min(1, Number(settings.soundVolume) || 0)),
        motionPreference: settings.motionPreference === 'reduced' ? 'reduced' : 'full',
        gameSpeed: settings.gameSpeed === 'fast' ? 'fast' : 'normal',
        tutorialEnabled: Boolean(settings.tutorialEnabled),
        tutorialCompleted: Boolean(settings.tutorialCompleted),
        ruleCoachEnabled: Boolean(settings.ruleCoachEnabled),
      });

      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(frozen));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely resets ONLY settings to default values.
   * Explicitly avoids touching match history, active game state, or statistics.
   */
  public async resetSettings(): Promise<UserSettings> {
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}
