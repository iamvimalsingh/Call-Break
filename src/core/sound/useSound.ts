/**
 * Sound Manager React Hook
 * Provides reactive mute state and sound playback triggers.
 * Phase 8 Animations & Sound
 */

import { useState, useEffect, useCallback } from 'react';
import { soundManager, SoundEffect } from './SoundManager';

export function useSound() {
  const [isMuted, setIsMuted] = useState<boolean>(() => soundManager.isMuted());

  useEffect(() => {
    const unsubscribe = soundManager.subscribe((muted) => {
      setIsMuted(muted);
    });
    return unsubscribe;
  }, []);

  const playSound = useCallback((effect: SoundEffect) => {
    soundManager.play(effect);
  }, []);

  const toggleMute = useCallback(() => {
    return soundManager.toggleMute();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    soundManager.setMuted(muted);
  }, []);

  const unlockAudio = useCallback(() => {
    soundManager.unlockAudio();
  }, []);

  return {
    isMuted,
    playSound,
    toggleMute,
    setMuted,
    unlockAudio,
  };
}
