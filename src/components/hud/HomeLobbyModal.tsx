/**
 * Home / Lobby Screen Component
 * The central hub for Call Break: New Game, Continue Resumable Game, Match History,
 * Overall Statistics, Rules Guide, Settings, and Interactive Tutorial.
 * Phase 10 Settings & Interactive Tutorial
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Play,
  RotateCcw,
  BookOpen,
  History,
  BarChart3,
  Settings,
  Shield,
  UserCheck,
  GraduationCap,
  Users,
} from 'lucide-react';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { soundManager } from '../../core/sound/SoundManager';
import { transitions } from '../../core/animation/animationConfig';

export interface HomeLobbyModalProps {
  isOpen: boolean;
  onStartNewGame: () => void;
  onOpenRules: () => void;
  onOpenScorecard: () => void;
  onOpenHistory: () => void;
  onOpenStatistics: () => void;
  onOpenSettings: () => void;
  onOpenTutorial?: () => void;
  onOpenGameMode?: () => void;
  hasActiveGame?: boolean;
  activeGameRound?: number;
  onResumeGame?: () => void;
}

export const HomeLobbyModal: React.FC<HomeLobbyModalProps> = ({
  isOpen,
  onStartNewGame,
  onOpenRules,
  onOpenScorecard,
  onOpenHistory,
  onOpenStatistics,
  onOpenSettings,
  onOpenTutorial,
  onOpenGameMode,
  hasActiveGame = false,
  activeGameRound,
  onResumeGame,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <div
      id="modal-home-lobby-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none"
    >
      <motion.div
        id="modal-home-lobby-card"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 15 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
        transition={transitions.springFast}
        className="w-full max-w-md bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-[2rem] shadow-[0_30px_90px_rgba(0,0,0,0.85)] p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden ring-1 ring-white/10"
      >
        {/* Background Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Emblem */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-950 border border-emerald-400/50 flex items-center justify-center shadow-xl shadow-emerald-950/70 mb-4 sm:mb-5 ring-1 ring-amber-400/30">
          <span className="font-serif text-3xl sm:text-4xl text-amber-300 drop-shadow-md">♠</span>
        </div>

        {/* Title & Tagline */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Call Break
        </h1>
        <div className="flex items-center gap-2 mt-1 mb-5 sm:mb-6">
          <span className="text-xs uppercase font-mono tracking-widest text-emerald-400 font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-700/80 shadow-xs">
            Lakdi
          </span>
          <span className="text-xs text-stone-400 flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-stone-500" />
            Standard 5-Round Match
          </span>
        </div>

        {/* Actions Menu */}
        <div className="w-full space-y-2.5">
          {/* Continue Game Action */}
          {hasActiveGame && onResumeGame ? (
            <button
              type="button"
              id="btn-lobby-resume-game"
              onClick={() => {
                soundManager.play('click');
                onResumeGame();
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/35 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current text-white" />
              <span>Continue Match {activeGameRound ? `(Round ${activeGameRound})` : ''}</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-lobby-resume-disabled"
              disabled
              className="w-full py-3 px-4 rounded-xl bg-stone-950/60 text-stone-600 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border border-stone-800/80 cursor-not-allowed"
              title="No match currently in progress"
            >
              <span>Continue Match (No Active Game)</span>
            </button>
          )}

          {/* New Game Primary Action */}
          <button
            type="button"
            id="btn-lobby-new-game"
            onClick={() => {
              soundManager.play('deal');
              onStartNewGame();
            }}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              hasActiveGame
                ? 'bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/90 shadow-sm'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white shadow-lg shadow-emerald-600/35 text-base font-extrabold'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span>{hasActiveGame ? 'Start Fresh Match' : 'Play New Game'}</span>
          </button>

          {/* Game Modes & Play with Friends Action */}
          {onOpenGameMode && (
            <button
              type="button"
              id="btn-lobby-game-modes"
              onClick={() => {
                soundManager.play('click');
                onOpenGameMode();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:from-amber-700 text-stone-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-950/40 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4 text-stone-950" />
              <span>Choose Mode / Play with Friends</span>
            </button>
          )}

          {/* Tutorial Button */}
          {onOpenTutorial && (
            <button
              type="button"
              id="btn-lobby-tutorial"
              onClick={() => {
                soundManager.play('click');
                onOpenTutorial();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-2 border border-emerald-700/60 shadow-xs transition-colors cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>Interactive Rule Coach / Tutorial</span>
            </button>
          )}

          {/* Navigation Hub: History & Statistics */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              id="btn-lobby-history"
              onClick={() => {
                soundManager.play('click');
                onOpenHistory();
              }}
              className="py-2.5 px-3 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-700/80 shadow-xs transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Match History</span>
            </button>

            <button
              type="button"
              id="btn-lobby-statistics"
              onClick={() => {
                soundManager.play('click');
                onOpenStatistics();
              }}
              className="py-2.5 px-3 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-700/80 shadow-xs transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Statistics</span>
            </button>
          </div>

          {/* Navigation Hub: Rules & Settings */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              id="btn-lobby-rules"
              onClick={() => {
                soundManager.play('click');
                onOpenRules();
              }}
              className="py-2 px-3 rounded-xl bg-stone-950/70 hover:bg-stone-800 text-stone-300 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-800 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
              <span>How to Play</span>
            </button>

            <button
              type="button"
              id="btn-lobby-settings"
              onClick={() => {
                soundManager.play('click');
                onOpenSettings();
              }}
              className="py-2 px-3 rounded-xl bg-stone-950/70 hover:bg-stone-800 text-stone-300 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-800 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-stone-400" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-5 text-[11px] text-stone-400 font-mono flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>Single-player offline table vs West, North, and East</span>
        </div>
      </motion.div>
    </div>
  );
};
