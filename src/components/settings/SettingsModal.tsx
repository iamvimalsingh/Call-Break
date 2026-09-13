/**
 * Settings Modal Component
 * Manages audio volume & mute, motion preference, presentation game speed,
 * interactive tutorial preference & replay, isolated settings reset, and match history clearing.
 * Phase 10 Settings & Interactive Tutorial
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Volume2,
  VolumeX,
  Eye,
  Trash2,
  X,
  ArrowLeft,
  AlertTriangle,
  Check,
  Zap,
  GraduationCap,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useSettings } from '../../core/settings/useSettings';
import { sharedHistoryService } from '../../core/history/HistoryService';
import { soundManager } from '../../core/sound/SoundManager';
import { transitions } from '../../core/animation/animationConfig';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayTutorial?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onReplayTutorial,
}) => {
  const {
    settings,
    updateSettings,
    resetSettings,
    effectiveReducedMotion,
    osPrefersReducedMotion,
  } = useSettings();

  const [isConfirmingClearHistory, setIsConfirmingClearHistory] = useState(false);
  const [isConfirmingResetSettings, setIsConfirmingResetSettings] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleSound = async () => {
    soundManager.play('click');
    const nextState = !settings.soundEnabled;
    await updateSettings({ soundEnabled: nextState });
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    await updateSettings({ soundVolume: vol });
  };

  const handleToggleMotion = async () => {
    soundManager.play('click');
    const next = settings.motionPreference === 'reduced' ? 'full' : 'reduced';
    await updateSettings({ motionPreference: next });
  };

  const handleToggleGameSpeed = async () => {
    soundManager.play('click');
    const next = settings.gameSpeed === 'fast' ? 'normal' : 'fast';
    await updateSettings({ gameSpeed: next });
  };

  const handleToggleTutorial = async () => {
    soundManager.play('click');
    const next = !settings.tutorialEnabled;
    await updateSettings({ tutorialEnabled: next });
  };

  const handleToggleRuleCoach = async () => {
    soundManager.play('click');
    const next = !settings.ruleCoachEnabled;
    await updateSettings({ ruleCoachEnabled: next });
  };

  const handleReplayTutorial = () => {
    soundManager.play('click');
    onClose();
    if (onReplayTutorial) {
      onReplayTutorial();
    }
  };

  const handleResetSettings = async () => {
    soundManager.play('click');
    await resetSettings();
    setIsConfirmingResetSettings(false);
    setStatusMessage('Settings restored to defaults.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleClearHistory = async () => {
    soundManager.play('click');
    await sharedHistoryService.clearHistory();
    setIsConfirmingClearHistory(false);
    setStatusMessage('Match history records cleared successfully.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div
      id="modal-settings-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none"
    >
      <motion.div
        id="modal-settings-card"
        initial={effectiveReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        animate={effectiveReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={effectiveReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={transitions.springFast}
        className="w-full max-w-lg bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col text-stone-200 max-h-[90vh] ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950/90 border-b border-stone-800/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-stone-800/80 border border-stone-700/80 flex items-center justify-center text-stone-300 shadow-inner">
                <Settings className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Game Settings</h2>
            </div>
          </div>

          <button
            type="button"
            id="btn-settings-close"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Status Message Banner */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 text-xs flex items-center gap-2 shadow-sm">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* SECTION 1: AUDIO & SOUND */}
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
              Audio & Sound Effects
            </div>

            {/* Sound Mute Toggle */}
            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    !settings.soundEnabled
                      ? 'bg-rose-950/60 border-rose-800/60 text-rose-400'
                      : 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                  }`}
                >
                  {!settings.soundEnabled ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Audio Effects</div>
                  <div className="text-xs text-stone-400">Card deal, play, and trick sounds</div>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-toggle-sound"
                onClick={handleToggleSound}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer shadow-xs ${
                  !settings.soundEnabled
                    ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/30'
                }`}
              >
                {settings.soundEnabled ? 'Enabled' : 'Muted'}
              </button>
            </div>

            {/* Sound Volume Slider */}
            {settings.soundEnabled && (
              <div className="p-3.5 rounded-2xl bg-stone-950/50 border border-stone-800/80 flex items-center justify-between gap-4 text-xs">
                <span className="text-stone-300 font-medium">Volume</span>
                <div className="flex items-center gap-3 flex-1 max-w-[200px]">
                  <input
                    type="range"
                    id="input-settings-volume"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.soundVolume}
                    onChange={handleVolumeChange}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-700 rounded-lg appearance-none"
                    aria-label="Sound volume control"
                  />
                  <span className="font-mono text-stone-400 w-9 text-right font-semibold">
                    {Math.round(settings.soundVolume * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: MOTION & PRESENTATION */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
              Display & Presentation
            </div>

            {/* Motion Preference */}
            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-800/80 border border-stone-700 flex items-center justify-center text-stone-300">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Motion Preference</div>
                  <div className="text-xs text-stone-400">
                    {osPrefersReducedMotion
                      ? 'OS reduced-motion active (animations minimized)'
                      : settings.motionPreference === 'reduced'
                      ? 'User selected reduced animations'
                      : 'Full smooth spring animations'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-toggle-motion"
                onClick={handleToggleMotion}
                disabled={osPrefersReducedMotion}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition-colors ${
                  osPrefersReducedMotion
                    ? 'bg-stone-800 text-stone-500 border-stone-800 cursor-not-allowed'
                    : settings.motionPreference === 'reduced'
                    ? 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border-amber-800/70 cursor-pointer'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700 cursor-pointer'
                }`}
                title={osPrefersReducedMotion ? 'Locked by system accessibility setting' : 'Toggle animation motion'}
              >
                {effectiveReducedMotion ? 'Reduced' : 'Full'}
              </button>
            </div>

            {/* Game Speed (Presentation Timing Only) */}
            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    settings.gameSpeed === 'fast'
                      ? 'bg-amber-950/60 border-amber-800/60 text-amber-400'
                      : 'bg-stone-800 border-stone-700 text-stone-300'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Game Speed</div>
                  <div className="text-xs text-stone-400">
                    {settings.gameSpeed === 'fast'
                      ? 'Fast bot play transitions (~200ms delay)'
                      : 'Normal presentation pace (~600ms delay)'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-toggle-speed"
                onClick={handleToggleGameSpeed}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer shadow-xs ${
                  settings.gameSpeed === 'fast'
                    ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 border-amber-500 shadow-amber-600/30'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                }`}
              >
                {settings.gameSpeed === 'fast' ? 'Fast' : 'Normal'}
              </button>
            </div>
          </div>

          {/* SECTION 3: TUTORIAL & RULE COACH */}
          <div className="space-y-2 pt-1">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
              Learning & Guidance
            </div>

            {/* Tutorial Enablement */}
            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Tutorial Prompts</div>
                  <div className="text-xs text-stone-400">Offer first-time interactive tutorial</div>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-toggle-tutorial"
                onClick={handleToggleTutorial}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer shadow-xs ${
                  settings.tutorialEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/30'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-400 border-stone-700'
                }`}
              >
                {settings.tutorialEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Contextual Rule Coach */}
            <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">In-Game Rule Coach</div>
                  <div className="text-xs text-stone-400">Contextual bidding hints & suit alerts</div>
                </div>
              </div>

              <button
                type="button"
                id="btn-settings-toggle-coach"
                onClick={handleToggleRuleCoach}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs border transition-colors cursor-pointer shadow-xs ${
                  settings.ruleCoachEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-600/30'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-400 border-stone-700'
                }`}
              >
                {settings.ruleCoachEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Replay Tutorial Action */}
            <button
              type="button"
              id="btn-settings-replay-tutorial"
              onClick={handleReplayTutorial}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>Replay Interactive Tutorial</span>
            </button>
          </div>

          {/* SECTION 4: PWA & OFFLINE PLAY */}
          <div className="space-y-2 pt-1 border-t border-stone-800/80">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
              Application & Offline Play
            </div>
            <PWAInstallButton variant="card" />
          </div>

          {/* SECTION 5: RESET SETTINGS & DATA MANAGEMENT */}
          <div className="space-y-2 pt-1 border-t border-stone-800/80">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
              Management & Reset
            </div>

            {/* Reset Settings Action */}
            {!isConfirmingResetSettings ? (
              <button
                type="button"
                id="btn-settings-reset-all"
                onClick={() => {
                  soundManager.play('click');
                  setIsConfirmingResetSettings(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-950/60 hover:bg-stone-800 text-stone-300 border border-stone-800/90 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-stone-400" />
                  <span>Reset Settings to Defaults</span>
                </div>
                <span className="text-[11px] text-stone-500">History & active game preserved</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-700 space-y-2.5 text-xs text-stone-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Restore all settings to their original factory defaults? Your match history and games will not be changed.
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingResetSettings(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="btn-settings-confirm-reset"
                    onClick={handleResetSettings}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold cursor-pointer"
                  >
                    Reset Settings
                  </button>
                </div>
              </div>
            )}

            {/* Clear Match History */}
            {!isConfirmingClearHistory ? (
              <button
                type="button"
                id="btn-settings-clear-history"
                onClick={() => {
                  soundManager.play('click');
                  setIsConfirmingClearHistory(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-950/60 hover:bg-rose-950/40 text-stone-400 hover:text-rose-300 border border-stone-800/90 hover:border-rose-900/50 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-stone-400" />
                  <span>Clear Match History</span>
                </div>
                <span className="text-[11px] text-stone-500">Only removes finished match logs</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800/80 space-y-2.5 text-xs text-rose-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    Are you sure you want to delete all match records? Any active in-progress match will not be lost.
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-settings-cancel-clear"
                    onClick={() => setIsConfirmingClearHistory(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="btn-settings-confirm-clear"
                    onClick={handleClearHistory}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                  >
                    Delete Records
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
