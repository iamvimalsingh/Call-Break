/**
 * Match History Modal Component
 * Displays past completed matches with expandable round-by-round score breakdowns and standings.
 * Features safe empty states and idempotent history deletion with confirmation.
 * Phase 9 Home, Match History & Player Statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  Trophy,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  X,
  Calendar,
  Layers,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { MatchHistoryRecord } from '../../core/history/historyTypes';
import { sharedHistoryService } from '../../core/history/HistoryService';
import { PlayerPosition } from '../../models/player';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { soundManager } from '../../core/sound/SoundManager';

export interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewGame: () => void;
}

export const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({
  isOpen,
  onClose,
  onStartNewGame,
}) => {
  const [matches, setMatches] = useState<readonly MatchHistoryRecord[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const loadHistory = useCallback(async () => {
    const list = await sharedHistoryService.getMatches();
    setMatches(list);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      setIsConfirmingClear(false);
      soundManager.play('pop');
    }
  }, [isOpen, loadHistory]);

  // Subscribe to updates
  useEffect(() => {
    const unsubscribe = sharedHistoryService.subscribe(() => {
      loadHistory();
    });
    return () => unsubscribe();
  }, [loadHistory]);

  const handleToggleExpand = (matchId: string) => {
    soundManager.play('click');
    setExpandedMatchId((prev) => (prev === matchId ? null : matchId));
  };

  const handleClearHistory = async () => {
    soundManager.play('click');
    await sharedHistoryService.clearHistory();
    setIsConfirmingClear(false);
    setExpandedMatchId(null);
    loadHistory();
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-match-history-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none"
    >
      <motion.div
        id="modal-match-history-card"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh] text-stone-200 ring-1 ring-white/10"
      >
        {/* Modal Header */}
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-inner">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Match History</h2>
                <p className="text-xs text-stone-400">
                  {matches.length} {matches.length === 1 ? 'match' : 'matches'} completed
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {matches.length > 0 && (
              <button
                type="button"
                id="btn-history-clear"
                onClick={() => setIsConfirmingClear(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/60 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Clear Match History"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <button
              type="button"
              id="btn-history-close"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clear Confirmation Prompt */}
        {isConfirmingClear && (
          <div className="bg-rose-950/90 border-b border-rose-800/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Clear all match records? Active game and sound settings will not be affected.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-history-cancel-clear"
                onClick={() => setIsConfirmingClear(false)}
                className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-history-confirm-clear"
                onClick={handleClearHistory}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {matches.length === 0 ? (
            /* Empty State */
            <div
              id="history-empty-state"
              className="flex flex-col items-center justify-center text-center py-14 px-4 space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700/80 flex items-center justify-center text-stone-500 shadow-inner">
                <History className="w-8 h-8 stroke-1" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-bold text-white">No completed matches yet</h3>
                <p className="text-xs text-stone-400 leading-relaxed font-medium">
                  Play a full 5-round game against offline bots. When the match finishes, your score breakdown and rankings will be recorded here.
                </p>
              </div>
              <button
                type="button"
                id="btn-history-empty-new-game"
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
            /* Matches List */
            matches.map((match) => {
              const userPos = match.userPosition;
              const userScore = match.finalScores[userPos] ?? 0;
              const isUserWinner = match.winnerPosition === userPos;
              const isUserTied = match.isTie && match.winnerPositions.includes(userPos);
              const isExpanded = expandedMatchId === match.matchId;

              // Opponent leader score
              const opponentScores: number[] = Object.entries(match.finalScores)
                .filter(([pos]) => pos !== userPos)
                .map(([, score]) => Number(score));
              const topOpponentScore = opponentScores.length > 0 ? Math.max(...opponentScores) : 0;

              const formattedDate = new Date(match.completedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={match.matchId}
                  className="rounded-2xl bg-stone-950/70 border border-stone-800/90 hover:border-stone-700/90 transition-all overflow-hidden shadow-xs"
                >
                  {/* Match Header Row */}
                  <div
                    onClick={() => handleToggleExpand(match.matchId)}
                    className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {/* Result Badge */}
                      <div
                        className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold text-xs border ${
                          isUserWinner
                            ? 'bg-gradient-to-b from-amber-500/20 to-amber-700/20 text-amber-300 border-amber-500/50 shadow-sm'
                            : isUserTied
                            ? 'bg-gradient-to-b from-blue-500/20 to-blue-700/20 text-blue-300 border-blue-500/50'
                            : 'bg-stone-800/80 text-stone-400 border-stone-700'
                        }`}
                      >
                        <Trophy className="w-4 h-4 mb-0.5" />
                        <span className="text-[10px] tracking-tight font-black">
                          {isUserWinner ? 'WON' : isUserTied ? 'TIE' : 'LOST'}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {isUserWinner ? 'Victory' : isUserTied ? 'Tie Game' : 'Match Defeat'}
                          </span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-stone-800 text-stone-400 border border-stone-700/60 font-medium">
                            {match.totalRounds} Rounds
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-stone-400 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-stone-500" />
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Scores & Expand Action */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-400 font-mono">
                          {userScore.toFixed(1)} <span className="text-[10px] text-stone-500">pts</span>
                        </div>
                        <div className="text-[11px] text-stone-400 font-medium">
                          Opponent: <span className="font-mono text-stone-300 font-semibold">{topOpponentScore.toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg bg-stone-800/80 text-stone-400 border border-stone-700/60">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-4 pt-1 border-t border-stone-800/80 bg-stone-900/40 space-y-4"
                      >
                        {/* Final Standings Table */}
                        <div className="space-y-1.5 pt-2">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
                            Final Standings
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {match.rankings.map((standing) => {
                              const isSelf = standing.position === userPos;
                              return (
                                <div
                                  key={standing.position}
                                  className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between gap-1 shadow-xs ${
                                    isSelf
                                      ? 'bg-emerald-950/50 border-emerald-600/70 text-emerald-200 ring-1 ring-emerald-500/20'
                                      : 'bg-stone-950/60 border-stone-800 text-stone-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-black text-amber-400">#{standing.rank}</span>
                                    <span className="font-mono text-stone-500 uppercase text-[10px] font-semibold">{standing.position}</span>
                                  </div>
                                  <div className="font-bold truncate">{standing.name}</div>
                                  <div className="font-mono font-black text-sm text-right text-white">
                                    {standing.score.toFixed(1)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Round by Round Breakdown */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
                            Round-by-Round Breakdown
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-stone-800/80">
                            <table className="w-full text-left text-xs font-mono">
                              <thead className="bg-stone-950/90 text-stone-400 text-[11px] uppercase border-b border-stone-800">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">Rnd</th>
                                  <th className="px-3 py-2 font-semibold">Dealer</th>
                                  <th className="px-3 py-2 text-center font-semibold">Bid</th>
                                  <th className="px-3 py-2 text-center font-semibold">Won</th>
                                  <th className="px-3 py-2 text-right font-semibold">Score</th>
                                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-800/60 bg-stone-950/40">
                                {match.rounds.map((round) => {
                                  const userRound = round.scores[userPos];
                                  if (!userRound) return null;
                                  const metBid = userRound.tricksWon >= userRound.bid;
                                  return (
                                    <tr key={round.roundNumber} className="hover:bg-stone-800/30">
                                      <td className="px-3 py-2 font-bold text-stone-300">
                                        R{round.roundNumber}
                                      </td>
                                      <td className="px-3 py-2 text-stone-400 text-[11px]">
                                        {round.dealer === userPos ? 'You' : round.dealer}
                                      </td>
                                      <td className="px-3 py-2 text-center text-amber-400 font-bold">
                                        {userRound.bid}
                                      </td>
                                      <td
                                        className={`px-3 py-2 text-center font-bold ${
                                          metBid ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                      >
                                        {userRound.tricksWon}
                                      </td>
                                      <td
                                        className={`px-3 py-2 text-right font-bold ${
                                          userRound.roundScore >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                      >
                                        {userRound.roundScore > 0 ? `+${userRound.roundScore.toFixed(1)}` : userRound.roundScore.toFixed(1)}
                                      </td>
                                      <td className="px-3 py-2 text-right font-bold text-stone-200">
                                        {userRound.cumulativeScore.toFixed(1)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
};
