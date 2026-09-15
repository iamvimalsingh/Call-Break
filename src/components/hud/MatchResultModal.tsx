/**
 * Match Result Modal Component
 * Displays definitive match completion outcomes, winner announcements,
 * tie states, player rankings, and multi-round scoring matrix.
 * Features match completion celebration animation and triumphant sound fanfare.
 * Phase 8 Animations & Sound
 */

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { GameMode, GameState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { Trophy, RotateCcw, Award, Sparkles, Home, History, Users } from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface MatchResultModalProps {
  isOpen: boolean;
  state: GameState;
  roomCode?: string | null;
  onStartNewMatch: () => void;
  onPlayAgain?: () => void;
  onReturnToRoom?: () => void;
  onOpenHistory?: () => void;
  onOpenHome?: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  isOpen,
  state,
  roomCode,
  onStartNewMatch,
  onPlayAgain,
  onReturnToRoom,
  onOpenHistory,
  onOpenHome,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Play match end celebration fanfare when opened
  useEffect(() => {
    if (isOpen) {
      soundManager.play('matchEnd');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const result = state.matchResult;
  const positions = [
    PlayerPosition.SOUTH,
    PlayerPosition.WEST,
    PlayerPosition.NORTH,
    PlayerPosition.EAST,
  ];

  const isTie = result?.isTie ?? false;
  const winners = result?.winnerPositions ?? (result ? [result.winnerPosition] : []);
  const humanWon = winners.includes(PlayerPosition.SOUTH);

  const getPlayerDisplayName = (pos: PlayerPosition): string => {
    return pos === PlayerPosition.SOUTH ? 'You' : state.players[pos]?.name ?? pos;
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-b from-amber-400 to-amber-500 text-stone-950 font-black border-amber-300 shadow-sm shadow-amber-500/30';
      case 2:
        return 'bg-gradient-to-b from-stone-300 to-stone-400 text-stone-950 font-black border-stone-200 shadow-sm';
      case 3:
        return 'bg-gradient-to-b from-amber-700 to-amber-800 text-amber-100 font-bold border-amber-600 shadow-sm';
      default:
        return 'bg-stone-800 text-stone-400 border-stone-700 font-medium';
    }
  };

  return (
    <div
      id="modal-match-result-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-6 select-none overflow-y-auto pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <motion.div
        id="modal-match-result-dialog"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={transitions.springSmooth}
        className="w-full max-w-xl max-h-[calc(100dvh-1rem)] sm:max-h-[min(90dvh,880px)] bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-emerald-500/50 rounded-2xl sm:rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-stone-200 ring-1 ring-emerald-500/25"
      >
        {/* Scrollable Result Content Container */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar">
          {/* Match Winner Hero Banner */}
          <div className="p-5 sm:p-8 bg-gradient-to-b from-emerald-950/90 via-stone-900/95 to-stone-900 text-center border-b border-stone-800/90 relative overflow-hidden">
            {/* Celebratory ambient glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-transparent pointer-events-none" />

            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={transitions.springSmooth}
              className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border border-amber-300 flex items-center justify-center shadow-xl shadow-amber-500/25 mb-2.5 sm:mb-3"
            >
              <Trophy className="w-8 h-8 sm:w-11 sm:h-11 text-stone-950 drop-shadow-sm" />
            </motion.div>

            <div className="text-[11px] sm:text-xs uppercase font-mono tracking-widest text-emerald-400 font-bold mb-1 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{state.config.totalRounds}-Round Match Complete</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>

            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              {isTie
                ? `Tie Match: ${winners.map(getPlayerDisplayName).join(' & ')}!`
                : humanWon
                ? '🏆 You Won the Match!'
                : `🏆 ${getPlayerDisplayName(winners[0])} Won the Match!`}
            </h2>

            <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-md mx-auto font-medium">
              {humanWon
                ? `Congratulations! You achieved the highest cumulative score across all ${state.config.totalRounds} rounds.`
                : `${getPlayerDisplayName(winners[0])} concluded with the highest cumulative score.`}
            </p>
          </div>

          {/* Final Standings Rankings */}
          <div className="p-4 sm:p-6 space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold">
            Final Standings
          </div>

          <div className="space-y-2">
            {result?.rankings.map((entry, index) => {
              const isSouth = entry.position === PlayerPosition.SOUTH;
              const isWinner = winners.includes(entry.position);

              return (
                <motion.div
                  key={entry.position}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={
                    prefersReducedMotion
                      ? transitions.instant
                      : { ...transitions.springFast, delay: index * 0.08 }
                  }
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    isSouth
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-white shadow-sm ring-1 ring-emerald-500/20'
                      : 'bg-stone-950/70 border-stone-800/80 text-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl text-xs font-mono flex items-center justify-center border ${getRankBadge(
                        entry.rank
                      )}`}
                    >
                      {entry.rank}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm sm:text-base">
                        {getPlayerDisplayName(entry.position)}
                      </span>
                      {isSouth && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700/80">
                          You
                        </span>
                      )}
                      {isWinner && <Award className="w-4 h-4 text-amber-400" />}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-mono text-base sm:text-lg font-black ${isWinner ? 'text-amber-300' : 'text-white'}`}>
                      {entry.score.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-stone-400 ml-1 font-mono">pts</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* 5-Round Scorecard Matrix */}
          <div className="mt-4 pt-4 border-t border-stone-800/90 overflow-x-auto">
            <div className="text-xs font-mono uppercase tracking-wider text-stone-400 font-bold mb-2">
              Round Breakdown
            </div>
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 text-[10px]">
                  <th className="py-1 px-1.5 font-semibold">Player</th>
                  {Array.from({ length: state.config.totalRounds }, (_, i) => (
                    <th key={i} className="py-1 px-1.5 text-center font-semibold">
                      R{i + 1}
                    </th>
                  ))}
                  <th className="py-1 px-1.5 text-right font-bold text-white">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/50">
                {positions.map((pos) => {
                  const isSouth = pos === PlayerPosition.SOUTH;
                  return (
                    <tr key={pos} className={isSouth ? 'text-emerald-300 font-bold bg-emerald-950/20' : 'text-stone-400'}>
                      <td className="py-2.5 px-1.5 font-sans font-medium text-stone-200">
                        {getPlayerDisplayName(pos)}
                      </td>
                      {Array.from({ length: state.config.totalRounds }, (_, i) => {
                        const roundRecord = state.roundScores.find((r) => r.roundNumber === i + 1);
                        const rScore = roundRecord?.scores[pos]?.roundScore;
                        return (
                          <td key={i} className="py-2.5 px-1.5 text-center">
                            {rScore !== undefined ? (
                              <span
                                className={
                                  rScore > 0
                                    ? 'text-emerald-400'
                                    : rScore < 0
                                    ? 'text-rose-400'
                                    : 'text-stone-400'
                                }
                              >
                                {rScore > 0 ? `+${rScore.toFixed(1)}` : rScore.toFixed(1)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-1.5 text-right font-bold text-white">
                        {state.cumulativeScores[pos]?.toFixed(1) ?? '0.0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fixed/Sticky Action Footer */}
      <div className="shrink-0 p-3 sm:p-5 border-t border-stone-800/90 bg-stone-950/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenHome && (
            <button
              type="button"
              id="btn-match-return-home"
              onClick={onOpenHome}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Return to Main Menu"
            >
              <Home className="w-4 h-4 text-stone-300" />
              <span>Main Menu</span>
            </button>
          )}
          {onOpenHistory && (
            <button
              type="button"
              id="btn-match-view-history"
              onClick={onOpenHistory}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span className="hidden xs:inline">Match History</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          {(roomCode || state.mode === GameMode.ONLINE_MULTIPLAYER) && onReturnToRoom && (
            <button
              type="button"
              id="btn-match-return-room"
              onClick={onReturnToRoom}
              className="px-4 py-2 sm:py-2.5 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Return to Multiplayer Room Lobby"
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>Return to Room</span>
            </button>
          )}

          <motion.button
            type="button"
            id="btn-match-play-again"
            onClick={onPlayAgain || onStartNewMatch}
            whileHover={!prefersReducedMotion ? { scale: 1.03 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.97 } : undefined}
            className="w-full sm:w-auto px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/35 transition-all cursor-pointer"
            title="Play again with same players"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  </div>
);
};
