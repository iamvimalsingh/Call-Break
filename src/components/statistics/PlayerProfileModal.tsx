/**
 * Player Profile, Match History & Scorecard Modal Component
 * Displays persistent career statistics, match history, and detailed round scorecards.
 * Complies with frontend-design and 4_games_2d_casual guidelines.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  BarChart3,
  History,
  Award,
  ChevronRight,
  ArrowLeft,
  X,
  RotateCcw,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { playerApiClient, PlayerProfileDashboard } from '../../services/playerApiClient';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';

interface PlayerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewGame: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  isOpen,
  onClose,
  onStartNewGame,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'scorecard'>('overview');
  const [data, setData] = useState<PlayerProfileDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchScorecard, setMatchScorecard] = useState<any | null>(null);
  const [loadingScorecard, setLoadingScorecard] = useState<boolean>(false);
  const prefersReducedMotion = useReducedMotion();

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await playerApiClient.getProfile(20, 0);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
      soundManager.play('pop');
    }
  }, [isOpen, loadData]);

  const handleSelectMatch = async (matchId: string) => {
    soundManager.play('click');
    setSelectedMatchId(matchId);
    setActiveTab('scorecard');
    setLoadingScorecard(true);
    const details = await playerApiClient.getScorecard(matchId);
    setMatchScorecard(details);
    setLoadingScorecard(false);
  };

  if (!isOpen) return null;

  const stats = data?.stats || {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalScore: 0,
    avgScore: 0,
    bestScore: 0,
    totalTricks: 0,
    avgTricks: 0,
  };

  const matches = data?.matches || [];
  const hasMatches = stats.totalMatches > 0;

  return (
    <div
      id="modal-player-profile-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none"
    >
      <motion.div
        id="modal-player-profile-card"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92vh] text-stone-200 ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950/90 border-b border-stone-800/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {data?.profile?.display_name || 'Player Profile'}
                </h2>
                <span className="text-xs text-stone-400 font-mono">
                  · ID: {data?.profile?.anonymous_client_id ? data.profile.anonymous_client_id.slice(0, 8) + '...' : 'Guest'}
                </span>
              </div>
              <p className="text-xs text-stone-400">Persistent career statistics, match history & scorecard</p>
            </div>
          </div>

          <button
            type="button"
            id="btn-profile-close"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 bg-stone-900/80 border-b border-stone-800/80 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setActiveTab('overview');
            }}
            className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Profile Overview</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setActiveTab('history');
            }}
            className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Match History</span>
          </button>
          {selectedMatchId && (
            <button
              type="button"
              onClick={() => {
                soundManager.play('click');
                setActiveTab('scorecard');
              }}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'scorecard'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Match Scorecard</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <p className="text-xs text-stone-400 font-medium">Loading player profile...</p>
            </div>
          ) : activeTab === 'overview' ? (
            <>
              {!hasMatches ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700/80 flex items-center justify-center text-stone-500 shadow-inner">
                    <Trophy className="w-8 h-8 stroke-1" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-base font-bold text-white">You haven't completed a match yet</h3>
                    <p className="text-xs text-stone-400 leading-relaxed font-medium">
                      Lifetime statistics, win rates, and match scorecards will appear here once you finish your first game.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartNewGame();
                    }}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/35 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Start New Game</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                      <span className="text-xs text-stone-400 font-medium">Games Played</span>
                      <span className="text-2xl font-black font-mono text-white mt-1 tabular-nums">
                        {stats.totalMatches}
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                      <span className="text-xs text-stone-400 font-medium">Wins / Losses</span>
                      <span className="text-2xl font-black font-mono text-emerald-400 mt-1 tabular-nums">
                        {stats.wins} <span className="text-stone-500 text-lg">/</span> {stats.losses}
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                      <span className="text-xs text-stone-400 font-medium">Win Rate</span>
                      <span className="text-2xl font-black font-mono text-amber-400 mt-1 tabular-nums">
                        {stats.winRate}%
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col shadow-xs">
                      <span className="text-xs text-stone-400 font-medium">Best Score</span>
                      <span className="text-2xl font-black font-mono text-indigo-400 mt-1 tabular-nums">
                        {stats.bestScore}
                      </span>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-stone-950/50 border border-stone-800/80 flex items-center justify-between">
                      <span className="text-xs text-stone-400">Average Score</span>
                      <span className="text-lg font-bold font-mono text-white tabular-nums">{stats.avgScore}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-950/50 border border-stone-800/80 flex items-center justify-between">
                      <span className="text-xs text-stone-400">Total Tricks Won</span>
                      <span className="text-lg font-bold font-mono text-white tabular-nums">{stats.totalTricks}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-950/50 border border-stone-800/80 flex items-center justify-between">
                      <span className="text-xs text-stone-400">Average Tricks / Match</span>
                      <span className="text-lg font-bold font-mono text-white tabular-nums">{stats.avgTricks}</span>
                    </div>
                  </div>

                  {/* Recent Activity Quick Link */}
                  <div className="p-4 rounded-2xl bg-stone-950/40 border border-stone-800/70 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Recent Match History</h4>
                      <p className="text-xs text-stone-400 mt-0.5">Inspect round-by-round scorecards for past games.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>View All ({matches.length})</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'history' ? (
            <>
              {matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
                  <p className="text-xs text-stone-400">No completed matches found in history.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                    Completed Matches ({matches.length})
                  </div>
                  {matches.map((item, idx) => {
                    const isWin = item.playerRecord?.final_rank === 1;
                    const dateStr = item.match.finished_at
                      ? new Date(item.match.finished_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Completed';

                    return (
                      <div
                        key={item.match.match_id || idx}
                        onClick={() => handleSelectMatch(item.match.match_id)}
                        className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 hover:border-stone-700 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono text-sm shrink-0 ${
                              isWin
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-stone-800 text-stone-400 border border-stone-700'
                            }`}
                          >
                            #{item.playerRecord?.final_rank || '-'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                Room: {item.match.room_code}
                              </span>
                              <span aria-hidden="true" className="text-stone-600">·</span>
                              <span className="text-xs text-stone-400">{dateStr}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-stone-400 mt-1">
                              <span>Score: <strong className="text-stone-200 font-mono tabular-nums">{item.playerRecord?.final_score ?? 0}</strong></span>
                              <span aria-hidden="true">·</span>
                              <span>Tricks: <strong className="text-stone-200 font-mono tabular-nums">{item.playerRecord?.tricks_won ?? 0}</strong></span>
                              <span aria-hidden="true">·</span>
                              <span>Rounds: {item.match.total_rounds}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-emerald-400 group-hover:underline flex items-center gap-1">
                            <span>Scorecard</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {loadingScorecard ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-stone-400 font-medium">Loading match scorecard...</p>
                </div>
              ) : !matchScorecard ? (
                <div className="text-center py-12 text-stone-400 text-xs">Scorecard data unavailable.</div>
              ) : (
                <div className="space-y-6">
                  {/* Scorecard Header */}
                  <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800/90 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-stone-400">Match Details</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        Room: {matchScorecard.match.room_code}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-stone-400">Status</div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5 uppercase tracking-wider">
                        {matchScorecard.match.status}
                      </div>
                    </div>
                  </div>

                  {/* Players Final Summary */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Match Totals & Final Ranks</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {matchScorecard.players.map((p: any) => (
                        <div key={p.seat} className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-stone-800 text-stone-300 font-bold font-mono text-xs flex items-center justify-center">
                              #{p.final_rank || '-'}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">{p.seat} {p.is_bot ? '(Bot)' : ''}</div>
                              <div className="text-xs text-stone-400">Tricks won: {p.tricks_won}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold font-mono text-emerald-400 tabular-nums">{p.final_score ?? 0} pts</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Round-by-Round Breakdown */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Round-by-Round Performance</div>
                    {matchScorecard.rounds.map((r: any) => (
                      <div key={r.roundNumber} className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-stone-300 border-b border-stone-800 pb-2">
                          <span>Round {r.roundNumber} <span className="text-stone-500 font-normal">· Dealer: {r.dealerSeat}</span></span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          {r.scorecards.map((sc: any) => (
                            <div key={sc.seat} className="p-2.5 rounded-xl bg-stone-900/80 border border-stone-800/60 flex flex-col">
                              <span className="text-xs font-bold text-stone-300">{sc.seat}</span>
                              <div className="flex items-center justify-between text-xs text-stone-400 mt-1">
                                <span>Bid: {sc.bid ?? '-'}</span>
                                <span>Won: {sc.tricks_won}</span>
                              </div>
                              <div className="text-xs font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                                Score: {sc.round_score ?? 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
