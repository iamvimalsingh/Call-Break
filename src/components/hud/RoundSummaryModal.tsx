/**
 * Round Summary Modal Component
 * Displays authoritatively calculated round scores from ScoringEngine.
 * Features round transition animation and sound integration.
 * Phase 8 Animations & Sound
 */

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { GameState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { Trophy, ArrowRight, Layers, CheckCircle } from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface RoundSummaryModalProps {
  isOpen: boolean;
  state: GameState;
  onNextRound: () => void;
  onOpenScorecard: () => void;
  onViewFinalResult?: () => void;
}

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
  isOpen,
  state,
  onNextRound,
  onOpenScorecard,
  onViewFinalResult,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Play round end sound when opening
  useEffect(() => {
    if (isOpen) {
      soundManager.play('roundEnd');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Retrieve the latest scored round record
  const latestRoundRecord =
    state.roundScores.find((r) => r.roundNumber === state.currentRound) ??
    state.roundScores[state.roundScores.length - 1];

  const positions = [
    PlayerPosition.SOUTH,
    PlayerPosition.WEST,
    PlayerPosition.NORTH,
    PlayerPosition.EAST,
  ];

  const isMatchComplete = state.currentRound >= state.config.totalRounds;

  return (
    <div
      id="modal-round-summary-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none"
    >
      <motion.div
        id="modal-round-summary-dialog"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={transitions.springSmooth}
        className="w-full max-w-lg bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-emerald-500/40 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] overflow-hidden text-stone-200 select-none ring-1 ring-emerald-500/20"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-800/90 bg-gradient-to-r from-emerald-950/90 via-stone-900 to-stone-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-400/40 flex items-center justify-center text-white shadow-md shadow-emerald-950/60">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Round {state.currentRound} Complete!
              </h2>
              <p className="text-xs text-stone-400 font-medium">
                {isMatchComplete ? 'Final Round of Match' : `Round ${state.currentRound} of ${state.config.totalRounds}`}
              </p>
            </div>
          </div>
        </div>

        {/* Scores Table */}
        <div className="p-5 sm:p-6">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 text-[11px] font-mono uppercase tracking-wider">
                <th className="py-2.5 px-2 font-semibold">Player</th>
                <th className="py-2.5 px-2 text-center font-semibold">Bid</th>
                <th className="py-2.5 px-2 text-center font-semibold">Won</th>
                <th className="py-2.5 px-2 text-right font-semibold">Round Pts</th>
                <th className="py-2.5 px-2 text-right font-semibold">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono">
              {positions.map((pos) => {
                const player = state.players[pos];
                const scoreInfo = latestRoundRecord?.scores[pos];
                const roundScore = scoreInfo?.roundScore ?? 0;
                const totalScore = state.cumulativeScores[pos] ?? 0;
                const madeBid = scoreInfo ? scoreInfo.tricksWon >= scoreInfo.bid : false;
                const isSouth = pos === PlayerPosition.SOUTH;

                return (
                  <tr
                    key={pos}
                    className={`${
                      isSouth ? 'bg-emerald-950/40 text-white font-semibold' : 'text-stone-300'
                    }`}
                  >
                    <td className="py-3 px-2 font-sans flex items-center gap-1.5">
                      <span>{isSouth ? 'You' : player.name}</span>
                      {isSouth && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700/80">
                          You
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-2 text-center text-stone-300">
                      {scoreInfo?.bid ?? player.currentBid ?? '—'}
                    </td>

                    <td className="py-3 px-2 text-center font-bold">
                      <span className={madeBid ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                        {scoreInfo?.tricksWon ?? player.tricksWon}
                      </span>
                    </td>

                    <td className="py-3 px-2 text-right font-bold">
                      <span
                        className={
                          roundScore > 0
                            ? 'text-emerald-400'
                            : roundScore < 0
                            ? 'text-rose-400'
                            : 'text-stone-400'
                        }
                      >
                        {roundScore > 0 ? `+${roundScore.toFixed(1)}` : roundScore.toFixed(1)}
                      </span>
                    </td>

                    <td className="py-3 px-2 text-right font-bold text-white">
                      {totalScore.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Action Notice */}
          <div className="mt-5 p-3 rounded-xl bg-stone-950/80 border border-stone-800/90 text-xs text-stone-400 flex items-center gap-2 shadow-inner">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isMatchComplete
                ? 'All 5 rounds have concluded. Match results are ready.'
                : `Next round will rotate dealer and deal a fresh 52-card deck.`}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-800/90 bg-stone-950/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenScorecard}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Scorecard</span>
          </button>

          {isMatchComplete ? (
            <motion.button
              type="button"
              id="btn-view-final-result"
              onClick={onViewFinalResult}
              whileHover={!prefersReducedMotion ? { scale: 1.03 } : undefined}
              whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
              className="px-5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-600/35 transition-all cursor-pointer"
            >
              <span>View Match Result</span>
              <Trophy className="w-4 h-4 text-amber-300" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              id="btn-next-round"
              onClick={onNextRound}
              whileHover={!prefersReducedMotion ? { scale: 1.03 } : undefined}
              whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
              className="px-5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-600/35 transition-all cursor-pointer"
            >
              <span>Next Round ({state.currentRound + 1} / 5)</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
