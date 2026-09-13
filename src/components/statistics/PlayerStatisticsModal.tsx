/**
 * Player Statistics Modal Component
 * Displays overall player statistics computed directly from historical matches.
 * Provides empty states and clear, transparent metrics.
 * Phase 9 Home, Match History & Player Statistics
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  Trophy,
  Target,
  Flame,
  Award,
  ArrowLeft,
  X,
  RotateCcw,
  Sparkles,
  Percent,
} from 'lucide-react';
import { sharedHistoryService } from '../../core/history/HistoryService';
import { StatisticsService } from '../../core/statistics/StatisticsService';
import { PlayerPosition } from '../../models/player';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { soundManager } from '../../core/sound/SoundManager';

export interface PlayerStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewGame: () => void;
  userPosition?: PlayerPosition;
}

export const PlayerStatisticsModal: React.FC<PlayerStatisticsModalProps> = ({
  isOpen,
  onClose,
  onStartNewGame,
  userPosition = PlayerPosition.SOUTH,
}) => {
  const [matches, setMatches] = useState<any[]>([]);
  const prefersReducedMotion = useReducedMotion();

  const loadHistory = useCallback(async () => {
    const list = await sharedHistoryService.getMatches();
    setMatches(list as any);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      soundManager.play('pop');
    }
  }, [isOpen, loadHistory]);

  useEffect(() => {
    const unsubscribe = sharedHistoryService.subscribe(() => {
      loadHistory();
    });
    return () => unsubscribe();
  }, [loadHistory]);

  const stats = useMemo(() => {
    return StatisticsService.calculate(matches, userPosition);
  }, [matches, userPosition]);

  if (!isOpen) return null;

  const hasMatches = stats.totalMatches > 0;

  return (
    <div
      id="modal-player-stats-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none"
    >
      <motion.div
        id="modal-player-stats-card"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh] text-stone-200 ring-1 ring-white/10"
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Player Statistics</h2>
                <p className="text-xs text-stone-400">Derived from completed offline matches</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            id="btn-stats-close"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {!hasMatches ? (
            /* Empty State */
            <div
              id="stats-empty-state"
              className="flex flex-col items-center justify-center text-center py-14 px-4 space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700/80 flex items-center justify-center text-stone-500 shadow-inner">
                <BarChart3 className="w-8 h-8 stroke-1" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-bold text-white">No statistics available yet</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-medium">
                  Career statistics, contract success rates, and scoring records appear here after completing your first match.
                </p>
              </div>
              <button
                type="button"
                id="btn-stats-empty-new-game"
                onClick={() => {
                  onClose();
                  onStartNewGame();
                }}
                className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/35 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Start New Game</span>
              </button>
            </div>
          ) : (
            <>
              {/* Category 1: Match Performance */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-400 uppercase tracking-wider">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Match Performance</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Total Matches</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                      {stats.totalMatches}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-emerald-950/20 border border-emerald-600/40 flex flex-col shadow-xs">
                    <span className="text-xs text-emerald-400 font-medium">Wins</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-1">
                      {stats.wins}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Losses / Ties</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-stone-300 mt-1">
                      {stats.losses} <span className="text-xs text-stone-500">/ {stats.ties}</span>
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-amber-950/40 to-amber-950/20 border border-amber-600/40 flex flex-col shadow-xs">
                    <span className="text-xs text-amber-400 font-medium">Win Rate</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-300 mt-1">
                      {stats.winRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Category 2: Scoring Records */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-400 uppercase tracking-wider">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scoring Records</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Total Score</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                      {stats.totalScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Avg Final Score</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                      {stats.averageFinalScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Highest Score</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-1">
                      {stats.highestFinalScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Lowest Score</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-stone-300 mt-1">
                      {stats.lowestFinalScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Category 3: Tricks & Bidding */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-400 uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Bidding & Contracts</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Total Tricks Won</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
                      {stats.totalTricksWon}
                    </span>
                    <span className="text-[11px] text-stone-500 mt-1 font-mono">
                      Avg {stats.averageTricksPerMatch.toFixed(1)} / match (Max {stats.highestTricksInMatch})
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Bids Made</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-1">
                      {stats.totalBids}
                    </span>
                    <span className="text-[11px] text-stone-500 mt-1 font-mono">
                      Avg Bid: {stats.averageBid.toFixed(1)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col col-span-2 sm:col-span-1 shadow-xs">
                    <span className="text-xs text-stone-400 font-medium">Contract Success</span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-1">
                      {stats.contractSuccessRate}%
                    </span>
                    <span className="text-[11px] text-stone-500 mt-1 font-mono">
                      {stats.successfulContracts} met / {stats.failedContracts} missed
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
