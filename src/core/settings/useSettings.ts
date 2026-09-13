/**
 * React Hook for User Settings
 * Reactive access to sound, motion, game speed, and tutorial settings.
 * Phase 10 Settings & Interactive Tutorial
 */

import { useState, useEffect, useCallback } from 'react';
import { sharedSettingsService } from './SettingsService';
import { UserSettings, DEFAULT_SETTINGS } from './settingsTypes';
import { useReducedMotion } from '../animation/useReducedMotion';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => sharedSettingsService.getSettings());
  const osPrefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const unsubscribe = sharedSettingsService.subscribe((updated) => {
      setSettings(updated);
    });
    return unsubscribe;
  }, []);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    return sharedSettingsService.updateSettings(updates);
  }, []);

  const resetSettings = useCallback(async () => {
    return sharedSettingsService.resetSettings();
  }, []);

  // Motion preference must NOT bypass OS prefers-reduced-motion:
  // If either OS prefers reduced motion OR user selected 'reduced', animations are minimized.
  const effectiveReducedMotion = osPrefersReducedMotion || settings.motionPreference === 'reduced';

  return {
    settings,
    updateSettings,
    resetSettings,
    effectiveReducedMotion,
    osPrefersReducedMotion,
  };
}
