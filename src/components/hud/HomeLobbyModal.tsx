/**
 * Home / Lobby Screen Component
 * The central hub for Call Break: Create New Table, Join Existing Table,
 * Return to Active Live Table, Match History, Statistics, Rules Guide, Settings,
 * and Interactive Rule Coach.
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Users,
  BookOpen,
  History,
  BarChart3,
  Settings,
  Shield,
  UserCheck,
  GraduationCap,
  PlusCircle,
  LogIn,
} from 'lucide-react';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { soundManager } from '../../core/sound/SoundManager';
import { transitions } from '../../core/animation/animationConfig';

export interface HomeLobbyModalProps {
  isOpen: boolean;
  onCreateTable: () => void;
  onJoinTable: () => void;
  onOpenRules: () => void;
  onOpenScorecard: () => void;
  onOpenHistory: () => void;
  onOpenStatistics: () => void;
  onOpenSettings: () => void;
  onOpenTutorial?: () => void;
  hasActiveGame?: boolean;
  activeGameRound?: number;
  onResumeGame?: () => void;
  isConnected: boolean;
}

export const HomeLobbyModal: React.FC<HomeLobbyModalProps> = ({
  isOpen,
  onCreateTable,
  onJoinTable,
  onOpenRules,
  onOpenScorecard,
  onOpenHistory,
  onOpenStatistics,
  onOpenSettings,
  onOpenTutorial,
  hasActiveGame = false,
  activeGameRound,
  onResumeGame,
  isConnected,
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
            Live Online Server Match
          </span>
        </div>

        {/* Actions Menu */}
        <div className="w-full space-y-2.5">
          {/* Active Live Game Return Action */}
          {hasActiveGame && onResumeGame && (
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
              <span>Return to Live Table {activeGameRound ? `(Round ${activeGameRound})` : ''}</span>
            </button>
          )}

          {/* Connection Warning Banner if offline */}
          {!isConnected && (
            <div
              id="lobby-connection-warning"
              className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs font-mono text-center flex items-center justify-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span>Connecting to live server... Online required.</span>
            </div>
          )}

          {/* 1. Create New Table Action */}
          <button
            type="button"
            id="btn-lobby-create-table"
            disabled={!isConnected}
            onClick={() => {
              soundManager.play('deal');
              onCreateTable();
            }}
            className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white shadow-lg shadow-emerald-600/35 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <PlusCircle className="w-5 h-5 text-emerald-200" />
            <span>Create New Table</span>
          </button>

          {/* 2. Join Existing Table Action */}
          <button
            type="button"
            id="btn-lobby-join-table"
            disabled={!isConnected}
            onClick={() => {
              soundManager.play('click');
              onJoinTable();
            }}
            className="w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:from-amber-700 text-stone-950 shadow-md shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <LogIn className="w-4 h-4 text-stone-950" />
            <span>Join Existing Table</span>
          </button>

          {/* Tutorial Button */}
          {onOpenTutorial && (
            <button
              type="button"
              id="btn-lobby-tutorial"
              onClick={() => {
                soundManager.play('click');
                onOpenTutorial();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 font-semibold text-xs flex items-center justify-center gap-2 border border-stone-700/70 shadow-xs transition-colors cursor-pointer"
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
          <span>Server-Authoritative Live Call Break</span>
        </div>
      </motion.div>
    </div>
  );
};
