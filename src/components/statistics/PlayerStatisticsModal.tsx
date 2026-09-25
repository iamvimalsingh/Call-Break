/**
 * Player Statistics & Global Leaderboards Modal Component
 * Displays persistent player career profile, match history, detailed round scorecards,
 * public global rankings (all-time, monthly, weekly), top single-match victories, and achievements.
 * Fully server-authoritative and responsive.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  BarChart3,
  History,
  ChevronRight,
  ChevronLeft,
  X,
  RotateCcw,
  Layers,
  Award,
  Medal,
  Flame,
  Target,
  Zap,
  Globe,
  Calendar,
  Sparkles,
  Star,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  playerApiClient,
  PlayerProfileDashboard,
  LeaderboardCategory,
  LeaderboardTimeframe,
  LeaderboardResponse,
  TopWinItem,
  AchievementItem,
} from '../../services/playerApiClient';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { PlayerPosition } from '../../models/player';

export interface PlayerStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewGame: () => void;
  userPosition?: PlayerPosition;
}

type TabType = 'overview' | 'history' | 'scorecard' | 'leaderboard' | 'topWins' | 'achievements';

export const PlayerStatisticsModal: React.FC<PlayerStatisticsModalProps> = ({
  isOpen,
  onClose,
  onStartNewGame,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Profile & History State
  const [data, setData] = useState<PlayerProfileDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchScorecard, setMatchScorecard] = useState<any | null>(null);
  const [loadingScorecard, setLoadingScorecard] = useState<boolean>(false);

  // Leaderboard State
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>('overall');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<LeaderboardTimeframe>('all');
  const [leaderboardPage, setLeaderboardPage] = useState<number>(0);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Top Wins State
  const [topWinsTimeframe, setTopWinsTimeframe] = useState<LeaderboardTimeframe>('all');
  const [topWins, setTopWins] = useState<TopWinItem[]>([]);
  const [loadingTopWins, setLoadingTopWins] = useState<boolean>(false);

  // Achievements State
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState<boolean>(false);

  const prefersReducedMotion = useReducedMotion();
  const PAGE_SIZE = 15;

  // Load Profile Dashboard
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    const result = await playerApiClient.getProfile(20, 0);
    setData(result);
    setLoading(false);
  }, []);

  // Load Leaderboard
  const loadLeaderboardData = useCallback(async () => {
    setLoadingLeaderboard(true);
    const result = await playerApiClient.getLeaderboard(
      leaderboardCategory,
      leaderboardTimeframe,
      PAGE_SIZE,
      leaderboardPage * PAGE_SIZE
    );
    setLeaderboardData(result);
    setLoadingLeaderboard(false);
  }, [leaderboardCategory, leaderboardTimeframe, leaderboardPage]);

  // Load Top Wins
  const loadTopWinsData = useCallback(async () => {
    setLoadingTopWins(true);
    const result = await playerApiClient.getTopWins(topWinsTimeframe, 20, 0);
    setTopWins(result || []);
    setLoadingTopWins(false);
  }, [topWinsTimeframe]);

  // Load Achievements
  const loadAchievementsData = useCallback(async () => {
    setLoadingAchievements(true);
    const result = await playerApiClient.getAchievements();
    setAchievements(result || []);
    setLoadingAchievements(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadProfileData();
      soundManager.play('pop');
    }
  }, [isOpen, loadProfileData]);

  useEffect(() => {
    if (isOpen && activeTab === 'leaderboard') {
      loadLeaderboardData();
    }
  }, [isOpen, activeTab, loadLeaderboardData]);

  useEffect(() => {
    if (isOpen && activeTab === 'topWins') {
      loadTopWinsData();
    }
  }, [isOpen, activeTab, loadTopWinsData]);

  useEffect(() => {
    if (isOpen && activeTab === 'achievements') {
      loadAchievementsData();
    }
  }, [isOpen, activeTab, loadAchievementsData]);

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

  const categoryLabels: Record<LeaderboardCategory, { label: string; desc: string; unit: string }> = {
    overall: { label: 'Overall', desc: 'Composite rank (Wins×10 + Points + Tricks×0.5)', unit: 'pts' },
    wins: { label: 'Most Wins', desc: 'Total matches won (1st place)', unit: 'wins' },
    win_rate: { label: 'Win Rate', desc: 'Winning percentage (Min. 2 games for All-Time)', unit: '%' },
    score: { label: 'Highest Score', desc: 'Best single match score', unit: 'pts' },
    tricks: { label: 'Most Tricks', desc: 'Total tricks won across all games', unit: 'tricks' },
  };

  return (
    <div
      id="modal-player-stats-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 select-none"
    >
      <motion.div
        id="modal-player-stats-card"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[94vh] text-stone-200 ring-1 ring-white/10"
      >
        {/* Modal Top Header */}
        <div className="px-5 sm:px-6 py-3.5 bg-stone-950/90 border-b border-stone-800/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {data?.profile?.display_name || 'Call Break Rankings & Stats'}
                </h2>
                <span className="text-xs text-stone-400 font-mono hidden sm:inline">
                  · ID: {data?.profile?.anonymous_client_id ? data.profile.anonymous_client_id.slice(0, 8) + '...' : 'Guest'}
                </span>
              </div>
              <p className="text-xs text-stone-400">Authoritative persistent career stats, global leaderboards & achievements</p>
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

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 py-2 bg-stone-900/80 border-b border-stone-800/80 flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setActiveTab('overview');
            }}
            className={`px-3 sm:px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>My Stats</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setActiveTab('history');
            }}
            className={`px-3 sm:px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Match History</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setActiveTab('leaderboard');
            }}
            className={`px-3 sm:px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Global Leaderboard</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setActiveTab('topWins');
            }}
            className={`px-3 sm:px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'topWins'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Top Wins</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.play('click');
              setActiveTab('achievements');
            }}
            className={`px-3 sm:px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'achievements'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Achievements</span>
          </button>
          {selectedMatchId && (
            <button
              type="button"
              onClick={() => {
                soundManager.play('click');
                setActiveTab('scorecard');
              }}
              className={`px-3 sm:px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'scorecard'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Scorecard</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: PROFILE OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-stone-400 font-medium">Loading career statistics...</p>
                </div>
              ) : !hasMatches ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-stone-800/80 border border-stone-700/80 flex items-center justify-center text-stone-500 shadow-inner">
                    <Trophy className="w-8 h-8 stroke-1" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-base font-bold text-white">No completed matches recorded yet</h3>
                    <p className="text-xs text-stone-400 leading-relaxed font-medium">
                      Your career stats, win rates, global leaderboard rankings, and achievements unlock after completing your first game.
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

                  {/* Quick Action Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setActiveTab('leaderboard')}
                      className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-emerald-500/50 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">Global Leaderboard</h4>
                          <p className="text-xs text-stone-400">Compare your rank against players worldwide</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-emerald-400 transition-colors" />
                    </div>

                    <div
                      onClick={() => setActiveTab('achievements')}
                      className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-amber-500/50 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">Career Achievements</h4>
                          <p className="text-xs text-stone-400">View unlocked badges & progress</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: MATCH HISTORY */}
          {activeTab === 'history' && (
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
          )}

          {/* TAB 3: SCORECARD */}
          {activeTab === 'scorecard' && (
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

          {/* TAB 4: GLOBAL LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              {/* Category & Timeframe Selectors */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-950/80 p-3.5 rounded-2xl border border-stone-800">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                  {(['overall', 'wins', 'win_rate', 'score', 'tricks'] as LeaderboardCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setLeaderboardCategory(cat);
                        setLeaderboardPage(0);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                        leaderboardCategory === cat
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 border border-transparent'
                      }`}
                    >
                      {categoryLabels[cat].label}
                    </button>
                  ))}
                </div>

                {/* Timeframe Filter */}
                <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800 self-end sm:self-auto shrink-0">
                  {(['all', 'monthly', 'weekly'] as LeaderboardTimeframe[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setLeaderboardTimeframe(tf);
                        setLeaderboardPage(0);
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-colors ${
                        leaderboardTimeframe === tf
                          ? 'bg-stone-800 text-white font-bold shadow-xs'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {tf === 'all' ? 'All Time' : tf === 'monthly' ? 'Monthly' : 'Weekly'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Description Banner */}
              <div className="text-xs text-stone-400 px-1 flex items-center justify-between">
                <span>{categoryLabels[leaderboardCategory].desc}</span>
                <span className="font-mono text-stone-500">
                  {leaderboardData ? `Total Ranked: ${leaderboardData.totalCount}` : ''}
                </span>
              </div>

              {/* Authenticated Player Self Rank Card */}
              {leaderboardData?.self?.entry && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-stone-900 to-stone-950 border border-emerald-500/40 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-xs text-emerald-300">
                      #{leaderboardData.self.rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">Your Rank ({leaderboardData.self.entry.displayName})</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">YOU</span>
                      </div>
                      <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                        <span>Wins: <strong className="text-stone-200">{leaderboardData.self.entry.wins}</strong></span>
                        <span>·</span>
                        <span>Win Rate: <strong className="text-amber-400">{leaderboardData.self.entry.winRate}%</strong></span>
                        <span>·</span>
                        <span>Best: <strong className="text-indigo-300">{leaderboardData.self.entry.bestScore}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-400 text-sm">
                    {leaderboardCategory === 'overall' && `${leaderboardData.self.entry.overallScore} pts`}
                    {leaderboardCategory === 'wins' && `${leaderboardData.self.entry.wins} wins`}
                    {leaderboardCategory === 'win_rate' && `${leaderboardData.self.entry.winRate}%`}
                    {leaderboardCategory === 'score' && `${leaderboardData.self.entry.bestScore} pts`}
                    {leaderboardCategory === 'tricks' && `${leaderboardData.self.entry.totalTricks} tricks`}
                  </div>
                </div>
              )}

              {/* Leaderboard Table */}
              {loadingLeaderboard ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-stone-400 font-medium">Fetching global rankings...</p>
                </div>
              ) : !leaderboardData || leaderboardData.items.length === 0 ? (
                <div className="text-center py-14 text-stone-400 text-xs bg-stone-950/40 rounded-2xl border border-stone-800/80">
                  No ranked matches found for this category and time period.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 text-[11px] font-bold text-stone-500 uppercase px-4 py-1">
                    <span className="col-span-2 sm:col-span-1">Rank</span>
                    <span className="col-span-6 sm:col-span-5">Player</span>
                    <span className="hidden sm:inline sm:col-span-2 text-right">W / L</span>
                    <span className="hidden sm:inline sm:col-span-2 text-right">Win %</span>
                    <span className="col-span-4 sm:col-span-2 text-right">Score</span>
                  </div>

                  {leaderboardData.items.map((item) => {
                    const isTop1 = item.rank === 1;
                    const isTop2 = item.rank === 2;
                    const isTop3 = item.rank === 3;

                    return (
                      <div
                        key={item.rank + '_' + item.displayName}
                        className={`grid grid-cols-12 items-center px-4 py-3 rounded-2xl border transition-all ${
                          item.isCurrentPlayer
                            ? 'bg-emerald-950/30 border-emerald-500/40 ring-1 ring-emerald-500/20'
                            : 'bg-stone-950/60 border-stone-800/80 hover:border-stone-700'
                        }`}
                      >
                        {/* Rank Badge */}
                        <div className="col-span-2 sm:col-span-1 flex items-center">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                              isTop1
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : isTop2
                                ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                                : isTop3
                                ? 'bg-amber-700/20 text-amber-600 border border-amber-700/40'
                                : 'text-stone-400 font-medium'
                            }`}
                          >
                            {item.rank}
                          </span>
                        </div>

                        {/* Player Name */}
                        <div className="col-span-6 sm:col-span-5 flex items-center gap-2 truncate pr-2">
                          <span className={`text-xs font-bold truncate ${item.isCurrentPlayer ? 'text-emerald-300' : 'text-stone-200'}`}>
                            {item.displayName}
                          </span>
                          {item.isCurrentPlayer && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                              YOU
                            </span>
                          )}
                        </div>

                        {/* W / L */}
                        <div className="hidden sm:block sm:col-span-2 text-right text-xs font-mono text-stone-300 tabular-nums">
                          <span className="text-emerald-400 font-bold">{item.wins}</span>
                          <span className="text-stone-600"> / </span>
                          <span className="text-stone-400">{item.losses}</span>
                        </div>

                        {/* Win % */}
                        <div className="hidden sm:block sm:col-span-2 text-right text-xs font-mono text-amber-400 font-bold tabular-nums">
                          {item.winRate}%
                        </div>

                        {/* Metric Value */}
                        <div className="col-span-4 sm:col-span-2 text-right text-xs font-mono font-bold text-stone-100 tabular-nums">
                          {leaderboardCategory === 'overall' && `${item.overallScore}`}
                          {leaderboardCategory === 'wins' && `${item.wins} W`}
                          {leaderboardCategory === 'win_rate' && `${item.winRate}%`}
                          {leaderboardCategory === 'score' && `${item.bestScore} pts`}
                          {leaderboardCategory === 'tricks' && `${item.totalTricks}`}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination Controls */}
                  {leaderboardData.totalCount > PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 px-2">
                      <button
                        type="button"
                        disabled={leaderboardPage === 0}
                        onClick={() => {
                          soundManager.play('click');
                          setLeaderboardPage((p) => Math.max(0, p - 1));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-medium text-stone-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>

                      <span className="text-xs text-stone-400 font-mono">
                        Page {leaderboardPage + 1} of {Math.ceil(leaderboardData.totalCount / PAGE_SIZE)}
                      </span>

                      <button
                        type="button"
                        disabled={(leaderboardPage + 1) * PAGE_SIZE >= leaderboardData.totalCount}
                        onClick={() => {
                          soundManager.play('click');
                          setLeaderboardPage((p) => p + 1);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-medium text-stone-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TOP WINS */}
          {activeTab === 'topWins' && (
            <div className="space-y-4">
              {/* Timeframe Filter */}
              <div className="flex items-center justify-between bg-stone-950/80 p-3.5 rounded-2xl border border-stone-800">
                <div className="text-xs text-stone-300 font-medium flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Highest-scoring and widest-margin match victories</span>
                </div>
                <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800 shrink-0">
                  {(['all', 'monthly', 'weekly'] as LeaderboardTimeframe[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        soundManager.play('click');
                        setTopWinsTimeframe(tf);
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg cursor-pointer transition-colors ${
                        topWinsTimeframe === tf
                          ? 'bg-stone-800 text-white font-bold shadow-xs'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {tf === 'all' ? 'All Time' : tf === 'monthly' ? 'Monthly' : 'Weekly'}
                    </button>
                  ))}
                </div>
              </div>

              {loadingTopWins ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-stone-400 font-medium">Fetching top match records...</p>
                </div>
              ) : topWins.length === 0 ? (
                <div className="text-center py-14 text-stone-400 text-xs bg-stone-950/40 rounded-2xl border border-stone-800/80">
                  No completed match victories recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {topWins.map((win, idx) => {
                    const dateStr = win.finishedAt
                      ? new Date(win.finishedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Finished';

                    return (
                      <div
                        key={win.matchId || idx}
                        className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-mono font-bold text-xs">
                              #{idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{win.winnerName}</span>
                                <span className="text-xs text-amber-400 font-semibold">({win.winnerSeat})</span>
                                <span aria-hidden="true" className="text-stone-600">·</span>
                                <span className="text-xs text-stone-400 font-mono">Room {win.roomCode}</span>
                              </div>
                              <div className="text-xs text-stone-400 mt-0.5">
                                <span>{dateStr}</span>
                                <span className="mx-1.5">·</span>
                                <span>{win.totalRounds} Rounds</span>
                                <span className="mx-1.5">·</span>
                                <span>{win.tricksWon} Tricks</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-black font-mono text-emerald-400 tabular-nums">
                              {win.finalScore} pts
                            </div>
                            <div className="text-[11px] font-bold text-amber-400/90 mt-0.5">
                              +{win.winningMargin} pt margin
                            </div>
                          </div>
                        </div>

                        {/* Participants List */}
                        <div className="pt-2 border-t border-stone-800/60 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {win.participants.map((p) => (
                            <div
                              key={p.seat}
                              className={`p-2 rounded-xl text-xs flex items-center justify-between ${
                                p.finalRank === 1
                                  ? 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-200'
                                  : 'bg-stone-900/60 border border-stone-800/50 text-stone-400'
                              }`}
                            >
                              <span className="truncate pr-1">
                                #{p.finalRank} {p.displayName}
                              </span>
                              <span className="font-mono font-bold text-stone-200 tabular-nums">
                                {p.finalScore}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: ACHIEVEMENTS */}
          {activeTab === 'achievements' && (
            <div className="space-y-4">
              <div className="bg-stone-950/80 p-3.5 rounded-2xl border border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-stone-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Milestones unlocked deterministically from your persistent match history</span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {achievements.filter((a) => a.unlocked).length} / {achievements.length} Unlocked
                </span>
              </div>

              {loadingAchievements ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-stone-400 font-medium">Loading career achievements...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {achievements.map((ach) => {
                    const progressPercent = Math.min(100, Math.round((ach.progress / ach.maxProgress) * 100));

                    return (
                      <div
                        key={ach.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          ach.unlocked
                            ? 'bg-stone-950/80 border-amber-500/40 ring-1 ring-amber-500/10 shadow-xs'
                            : 'bg-stone-950/40 border-stone-800/70 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                ach.unlocked
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-stone-800 text-stone-500 border border-stone-700'
                              }`}
                            >
                              {ach.unlocked ? <Medal className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className={`text-sm font-bold ${ach.unlocked ? 'text-white' : 'text-stone-300'}`}>
                                  {ach.title}
                                </h4>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 px-1.5 py-0.5 rounded bg-stone-900">
                                  {ach.category}
                                </span>
                              </div>
                              <p className="text-xs text-stone-400 mt-0.5">{ach.description}</p>
                            </div>
                          </div>

                          {ach.unlocked && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3 pt-2 border-t border-stone-800/60">
                          <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1 font-mono">
                            <span>Progress</span>
                            <span className={ach.unlocked ? 'text-emerald-400 font-bold' : 'text-stone-400'}>
                              {ach.progress} / {ach.maxProgress} ({progressPercent}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                ach.unlocked
                                  ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                                  : 'bg-emerald-600/60'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
