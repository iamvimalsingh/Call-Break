/**
 * Player Slot Component
 * Displays player avatar, dealer token, bid/tricks counter, turn indicator,
 * bot thinking visual feedback, and active player indicator animations.
 * Phase 8 Animations & Sound
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { User, Bot, BrainCircuit, Clock } from 'lucide-react';
import { PlayerPosition, PlayerState, PlayerType } from '../../models/player';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';
import { sharedMultiplayerClient } from '../../services/multiplayer/MultiplayerClient';
import { soundManager } from '../../core/sound/SoundManager';

export interface PlayerTurnTimer {
  remainingSec: number;
  totalSec: number;
  isExtraTime: boolean;
}

export interface PlayerSlotProps {
  player: PlayerState;
  position: PlayerPosition;
  isCurrentTurn: boolean;
  statusText?: string;
  timer?: PlayerTurnTimer | null;
}

export const PlayerSlot: React.FC<PlayerSlotProps> = ({
  player,
  position,
  isCurrentTurn,
  statusText,
  timer,
}) => {
  const isHuman = player.type === PlayerType.HUMAN;
  const isSouth = position === PlayerPosition.SOUTH;
  const prefersReducedMotion = useReducedMotion();

  // Clean, permanent, non-compounding display name
  const displayName = useMemo((): string => {
    // Single-Player mode defaults
    if (
      !player.name ||
      player.name === 'You' ||
      player.name === 'West Player' ||
      player.name === 'North Player' ||
      player.name === 'East Player'
    ) {
      switch (position) {
        case PlayerPosition.SOUTH:
          return 'You';
        case PlayerPosition.WEST:
          return 'West Player';
        case PlayerPosition.NORTH:
          return 'North Player';
        case PlayerPosition.EAST:
          return 'East Player';
      }
    }

    if (isSouth) {
      const raw = player.name
        .replace(/\s*\((You|Host|West|North|East|South|Friend\s*\d+)\)/gi, '')
        .trim();
      return raw && raw !== 'Player' && raw !== 'You' && raw !== 'Host' ? `${raw} (You)` : 'You';
    }

    // Strip any previously appended or recursive seat tags
    const cleaned = player.name
      .replace(/\s*\((You|Host|West|North|East|South|Friend\s*\d+)\)/gi, '')
      .trim();

    if (!cleaned || /^(friend|player|opponent|bot)$/i.test(cleaned)) {
      switch (position) {
        case PlayerPosition.WEST:
          return 'West Player';
        case PlayerPosition.NORTH:
          return 'North Player';
        case PlayerPosition.EAST:
          return 'East Player';
      }
    }

    return cleaned;
  }, [player.name, position, isSouth]);

  // Timer calculations
  const total = timer?.totalSec || (timer?.isExtraTime ? 15 : 45);
  const remaining = timer ? Math.max(0, timer.remainingSec) : 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  const isExtra = !!timer?.isExtraTime;

  // Ring stroke color: Green -> Amber for 45s main time, Red pulsating for 15s extra time
  let ringColor = '#10b981'; // emerald-500
  if (isExtra) {
    ringColor = '#ef4444'; // red-500
  } else if (remaining <= 15) {
    ringColor = '#f59e0b'; // amber-500
  } else if (remaining <= 25) {
    ringColor = '#eab308'; // yellow-500
  }

  return (
    <div
      id={`player-slot-${position.toLowerCase()}`}
      className="flex flex-col items-center select-none transition-all duration-200 shrink-0 w-auto min-w-[100px] xs:min-w-[115px] sm:min-w-[135px]"
    >
      {/* Player Card Container with Active Turn Glow */}
      <motion.div
        animate={
          isCurrentTurn && !prefersReducedMotion
            ? {
                scale: isExtra ? [1, 1.025, 1] : [1, 1.015, 1],
                boxShadow: isExtra
                  ? [
                      '0 0 0px rgba(239, 68, 68, 0)',
                      '0 0 20px rgba(239, 68, 68, 0.55)',
                      '0 0 0px rgba(239, 68, 68, 0)',
                    ]
                  : [
                      '0 0 0px rgba(16, 185, 129, 0)',
                      '0 0 18px rgba(16, 185, 129, 0.45)',
                      '0 0 0px rgba(16, 185, 129, 0)',
                    ],
              }
            : {}
        }
        transition={
          isCurrentTurn && !prefersReducedMotion
            ? { repeat: Infinity, duration: isExtra ? 1 : 2, ease: 'easeInOut' }
            : transitions.instant
        }
        className={`relative border backdrop-blur-xl shadow-md transition-all duration-200 flex flex-col items-start px-2 xs:px-2.5 sm:px-3 py-1 xs:py-1.5 sm:py-2 rounded-xl sm:rounded-2xl w-full ${
          isCurrentTurn
            ? isExtra
              ? 'bg-gradient-to-r from-red-950/95 via-[#2b0c0c] to-stone-900/95 border-red-500 ring-1 sm:ring-2 ring-red-500/70 shadow-red-500/30'
              : 'bg-gradient-to-r from-emerald-950/95 via-[#062417] to-stone-900/95 border-emerald-400 ring-1 sm:ring-2 ring-emerald-400/70 shadow-emerald-500/30'
            : 'bg-stone-900/90 border-stone-700/80 hover:border-stone-600'
        }`}
      >
        {/* Row 1: Avatar Icon + Full Name + Turn Timer/Pulse */}
        <div className="flex items-center gap-1.5 xs:gap-2 w-full">
          {/* Avatar Circle with strictly anchored Dealer Badge */}
          <div className="relative flex items-center justify-center shrink-0">
            {isCurrentTurn && timer && (
              <svg
                className="absolute -inset-1 sm:-inset-1.5 w-[calc(100%+8px)] sm:w-[calc(100%+12px)] h-[calc(100%+8px)] sm:h-[calc(100%+12px)] -rotate-90 pointer-events-none z-10"
                viewBox="0 0 36 36"
              >
                {/* Background ring track */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={isExtra ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.15)'}
                  strokeWidth="2.5"
                />
                {/* Animated countdown ring */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="2.5"
                  strokeDasharray={97.4}
                  strokeDashoffset={97.4 * (1 - progress)}
                  strokeLinecap="round"
                  className={`transition-all duration-300 ease-linear ${
                    isExtra ? 'animate-pulse' : ''
                  }`}
                />
              </svg>
            )}

            {/* Avatar Circle */}
            <div
              className={`w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold border shrink-0 relative shadow-inner ${
                isSouth
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-emerald-400/60 shadow-emerald-900/40'
                  : isHuman
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-800 text-white border-blue-400/60 shadow-blue-900/40'
                  : isCurrentTurn
                  ? isExtra
                    ? 'bg-gradient-to-br from-rose-900 to-red-950 text-red-200 border-red-500/80 shadow-red-950/60'
                    : 'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-200 border-amber-400/60 shadow-amber-950/50'
                  : 'bg-stone-800 text-stone-300 border-stone-600/80'
              }`}
            >
              {isSouth ? (
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-100" />
              ) : isHuman ? (
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-200" />
              ) : isCurrentTurn ? (
                <BrainCircuit
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                    isExtra ? 'text-red-400' : 'text-amber-300'
                  } animate-pulse`}
                />
              ) : (
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
              )}
            </div>

            {/* Dealer Badge strictly anchored to top-right of avatar circle */}
            {player.isDealer && (
              <motion.div
                id={`dealer-coin-${position.toLowerCase()}`}
                initial={prefersReducedMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-stone-950 text-[7.5px] xs:text-[8px] sm:text-[9.5px] font-black flex items-center justify-center shadow-md border border-amber-100 ring-1 ring-amber-500/60 z-30 select-none pointer-events-none"
                title="Dealer"
              >
                D
              </motion.div>
            )}
          </div>

          {/* Full Name without truncation */}
          <span
            className="font-bold text-white text-[11px] xs:text-xs sm:text-sm whitespace-nowrap leading-tight"
            title={displayName}
          >
            {displayName}
          </span>

          {/* Turn Timer Badge or Turn Pulse Dot */}
          {isCurrentTurn && timer ? (
            <motion.span
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`ml-auto px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-black border flex items-center gap-0.5 leading-none shrink-0 ${
                isExtra
                  ? 'bg-red-950/90 border-red-500/80 text-red-300 animate-pulse ring-1 ring-red-500/50'
                  : remaining <= 15
                  ? 'bg-amber-950/90 border-amber-500/70 text-amber-300'
                  : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
              }`}
              title={isExtra ? `Extra time: ${remaining}s left` : `Turn time: ${remaining}s left`}
            >
              <Clock className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
              <span>{isExtra ? `+${remaining}s` : `${remaining}s`}</span>
            </motion.span>
          ) : isCurrentTurn ? (
            <span className="ml-auto relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-400" />
            </span>
          ) : null}
        </div>

        {/* Row 2: Trick count (Bid: X • Won: Y) */}
        <div className="flex items-center gap-1 text-[8.5px] xs:text-[9.5px] sm:text-[10px] text-stone-300 font-mono whitespace-nowrap mt-1">
          <span>
            Bid: <strong className="text-amber-300 font-bold">{player.currentBid ?? '—'}</strong>
          </span>
          <span className="text-stone-500 font-bold">•</span>
          <span>
            Won:{' '}
            <strong
              className={
                player.currentBid !== null && player.tricksWon >= player.currentBid
                  ? 'text-emerald-400 font-extrabold'
                  : 'text-stone-200 font-bold'
              }
            >
              {player.tricksWon}
            </strong>
          </span>
        </div>

        {/* Row 3: Status indicator (e.g. Turn, Dealer, or Cards Remaining) */}
        <div className="flex items-center gap-1 text-[8px] xs:text-[8.5px] sm:text-[9px] font-mono mt-0.5 whitespace-nowrap">
          {isCurrentTurn ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>{isSouth ? 'Your Turn' : 'Turn'}</span>
            </span>
          ) : player.isDealer ? (
            <span className="text-amber-300 font-medium flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/80" />
              <span>Dealer</span>
            </span>
          ) : (
            <span className="text-stone-400 font-medium">
              {!isSouth ? `${player.hand.length} cards` : statusText || 'Ready'}
            </span>
          )}
        </div>
      </motion.div>

      {/* Host Option: Permanently Convert Auto-Play Seat to Bot (Multiplayer) */}
      {!isSouth && player.name.toLowerCase().includes('auto-play') && sharedMultiplayerClient.isHost() && (
        <button
          type="button"
          id={`btn-convert-to-bot-${position.toLowerCase()}`}
          onClick={(e) => {
            e.stopPropagation();
            soundManager.play('click');
            sharedMultiplayerClient.convertToBot(position);
          }}
          className="mt-1 px-2 py-0.5 rounded-lg bg-stone-900/95 hover:bg-red-950/90 border border-amber-500/50 hover:border-red-500 text-[8px] sm:text-[9px] font-bold text-amber-300 hover:text-red-200 transition-colors flex items-center gap-1 cursor-pointer shadow-xs z-30"
          title="Permanently Convert to Bot"
        >
          <Bot className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
          <span>Permanently Convert to Bot</span>
        </button>
      )}
    </div>
  );
};
