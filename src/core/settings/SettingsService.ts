/**
 * Settings Service
 * Single source of truth for runtime user preferences.
 * Synchronizes with audio effects, motion hooks, and persistent storage.
 * Phase 10 Settings & Interactive Tutorial
 */

import { SettingsRepository, ISettingsStorage } from './SettingsRepository';
import { UserSettings, DEFAULT_SETTINGS } from './settingsTypes';
import { soundManager } from '../sound/SoundManager';

export class SettingsService {
  private repository: SettingsRepository;
  private currentSettings: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<(settings: UserSettings) => void> = new Set();
  private isInitialized: boolean = false;
  private initPromise: Promise<void>;

  constructor(customStorage?: ISettingsStorage) {
    this.repository = new SettingsRepository(customStorage);
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    const loaded = await this.repository.loadSettings();
    this.currentSettings = loaded;
    this.isInitialized = true;
    this.applyAudioSettings(loaded);
    this.notifyListeners();
  }

  public async ready(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Synchronizes sound manager volume and mute state with current settings.
   */
  private applyAudioSettings(settings: UserSettings): void {
    soundManager.setMuted(!settings.soundEnabled);
    soundManager.setVolume(settings.soundVolume);
  }

  public getSettings(): UserSettings {
    return this.currentSettings;
  }

  public async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    await this.initPromise;
    const next: UserSettings = Object.freeze({
      ...this.currentSettings,
      ...updates,
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    });

    this.currentSettings = next;
    this.applyAudioSettings(next);
    await this.repository.saveSettings(next);
    this.notifyListeners();
    return next;
  }

  public async resetSettings(): Promise<UserSettings> {
    await this.initPromise;
    const reset = await this.repository.resetSettings();
    this.currentSettings = reset;
    this.applyAudioSettings(reset);
    this.notifyListeners();
    return reset;
  }

  public subscribe(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentSettings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentSettings);
      } catch (err) {
        console.error('Error in settings listener:', err);
      }
    }
  }
}

export const sharedSettingsService = new SettingsService();
