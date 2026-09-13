/**
 * Table Menu Modal (☰)
 * Sleek, semi-transparent in-table drawer / modal providing fast access to:
 * - Resume Game
 * - Sound & Haptic Toggle
 * - Call Break Rules Summary
 * - Scoreboard / Overview
 * - Leave Game (with exit guard)
 * Inspired by commercial Call Break benchmarks (Teslatech).
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Volume2,
  VolumeX,
  Vibrate,
  BookOpen,
  Trophy,
  LogOut,
  X,
  Share2,
  ShieldAlert,
  Smartphone,
  RotateCcw,
  Users,
  Settings,
} from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useSound } from '../../core/sound/useSound';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';
import { GameState } from '../../models/gameState';
import { SUIT_CONFIG } from '../../models/card';

export interface TableMenuModalProps {
  isOpen: boolean;
  gameState: GameState;
  roomCode?: string | null;
  isHost?: boolean;
  onClose: () => void;
  onOpenRules: () => void;
  onOpenScoreboard: () => void;
  onLeaveGame: () => void;
  onShareRoom?: () => void;
  onStartNewGame?: () => void;
  onOpenModes?: () => void;
  onOpenSettings?: () => void;
}

export const TableMenuModal: React.FC<TableMenuModalProps> = ({
  isOpen,
  gameState,
  roomCode,
  isHost = false,
  onClose,
  onOpenRules,
  onOpenScoreboard,
  onLeaveGame,
  onShareRoom,
  onStartNewGame,
  onOpenModes,
  onOpenSettings,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { isMuted, toggleMute } = useSound();

  // Haptic feedback state
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('callbreak_haptics_enabled');
      return stored !== 'false';
    }
    return true;
  });

  const toggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('callbreak_haptics_enabled', String(next));
      }
      if (next && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    } catch {
      // Ignore storage errors
    }
    soundManager.play('click');
  };

  const trumpInfo = SUIT_CONFIG[gameState.config.trumpSuit];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="modal-table-menu-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto select-none"
        onClick={onClose}
      >
        <motion.div
          id="modal-table-menu-card"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 10 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={transitions.springFast}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] p-5 flex flex-col relative overflow-hidden ring-1 ring-white/10"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-800/80 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center text-amber-300 font-serif text-sm shadow-sm">
                ♠
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight">Game Menu</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-mono">
                  <span>Round {gameState.currentRound}/{gameState.config.totalRounds}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">{trumpInfo.symbol} Trump</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              id="btn-close-table-menu"
              onClick={() => {
                soundManager.play('click');
                onClose();
              }}
              className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Multiplayer Room Badge & Invite (if room code exists) */}
          {roomCode && (
            <div className="mb-4 p-3 rounded-2xl bg-stone-950/80 border border-amber-900/50 flex items-center justify-between shadow-inner">
              <div className="text-left">
                <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-bold block">
                  Room Code
                </span>
                <span className="font-mono text-base font-black text-amber-300 tracking-wider">
                  {roomCode}
                </span>
              </div>
              {onShareRoom && (
                <button
                  type="button"
                  id="btn-table-menu-share"
                  onClick={() => {
                    soundManager.play('click');
                    onShareRoom();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#25D366]/20 cursor-pointer transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Invite</span>
                </button>
              )}
            </div>
          )}

          {/* Primary Actions List */}
          <div className="space-y-2 mb-4">
            {/* 1. Resume Game (Prominent CTA) */}
            <button
              type="button"
              id="btn-menu-resume"
              onClick={() => {
                soundManager.play('click');
                onClose();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Resume Game</span>
            </button>

            {/* 2. Sound & Haptic Controls */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Sound Toggle */}
              <button
                type="button"
                id="btn-menu-sound-toggle"
                onClick={toggleMute}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border-rose-800/80 shadow-xs'
                    : 'bg-stone-800/90 hover:bg-stone-700 text-emerald-300 border-stone-700/80 shadow-xs'
                }`}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isMuted ? 'Sound: Off' : 'Sound: On'}</span>
              </button>

              {/* Haptic Toggle */}
              <button
                type="button"
                id="btn-menu-haptic-toggle"
                onClick={toggleHaptics}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  hapticsEnabled
                    ? 'bg-stone-800/90 hover:bg-stone-700 text-emerald-300 border-stone-700/80 shadow-xs'
                    : 'bg-stone-900/80 hover:bg-stone-800 text-stone-400 border-stone-800 shadow-xs'
                }`}
              >
                <Vibrate className={`w-4 h-4 ${hapticsEnabled ? 'text-emerald-400' : 'text-stone-500'}`} />
                <span>{hapticsEnabled ? 'Haptics: On' : 'Haptics: Off'}</span>
              </button>
            </div>

            {/* 3. Call Break Rules Summary */}
            <button
              type="button"
              id="btn-menu-rules"
              onClick={() => {
                soundManager.play('click');
                onClose();
                onOpenRules();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>Call Break Rules Summary</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">Guide</span>
            </button>

            {/* 4. Scoreboard */}
            <button
              type="button"
              id="btn-menu-scoreboard"
              onClick={() => {
                soundManager.play('click');
                onClose();
                onOpenScoreboard();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <span>Scoreboard & Round History</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">Scores</span>
            </button>

            {/* 5. Game Modes (Play with Friends / Solo) */}
            {onOpenModes && (
              <button
                type="button"
                id="btn-menu-modes"
                onClick={() => {
                  soundManager.play('click');
                  onClose();
                  onOpenModes();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 font-bold text-xs border border-amber-800/60 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Game Modes / Play with Friends</span>
                </div>
                <span className="text-[10px] text-amber-400/80 font-mono">Modes</span>
              </button>
            )}

            {/* 6. Settings / Preferences */}
            {onOpenSettings && (
              <button
                type="button"
                id="btn-menu-settings"
                onClick={() => {
                  soundManager.play('click');
                  onClose();
                  onOpenSettings();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-stone-300" />
                  <span>Game Settings & Preferences</span>
                </div>
                <span className="text-[10px] text-stone-400 font-mono">Config</span>
              </button>
            )}

            {/* 7. Start New Match */}
            {onStartNewGame && (
              <button
                type="button"
                id="btn-menu-new-game"
                onClick={() => {
                  soundManager.play('click');
                  onClose();
                  onStartNewGame();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-emerald-300 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span>Start New Match</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono">Restart</span>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-stone-800/80 my-1 pt-3">
            {/* 5. Destructive Leave Game Button */}
            <button
              type="button"
              id="btn-menu-leave-game"
              onClick={() => {
                soundManager.play('warning');
                onClose();
                onLeaveGame();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 active:bg-rose-950 text-rose-200 hover:text-rose-100 font-bold text-xs border border-rose-700/80 flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Leave Game</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
