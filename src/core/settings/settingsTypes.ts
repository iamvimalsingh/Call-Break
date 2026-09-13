/**
 * User Settings Data Types & Defaults
 * Defines persistent user configurations for sound, motion, game speed, and tutorial.
 * Phase 10 Settings & Interactive Tutorial
 */

export type MotionPreference = 'full' | 'reduced';
export type GameSpeed = 'normal' | 'fast';

export interface UserSettings {
  readonly schemaVersion: number;
  readonly soundEnabled: boolean;
  readonly soundVolume: number; // 0.0 to 1.0
  readonly motionPreference: MotionPreference;
  readonly gameSpeed: GameSpeed;
  readonly tutorialEnabled: boolean;
  readonly tutorialCompleted: boolean;
  readonly ruleCoachEnabled: boolean;
}

export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'cb_lakdi_settings_v1';

export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  soundEnabled: true,
  soundVolume: 0.7,
  motionPreference: 'full',
  gameSpeed: 'normal',
  tutorialEnabled: true,
  tutorialCompleted: false,
  ruleCoachEnabled: true,
});
