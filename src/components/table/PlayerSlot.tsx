/**
 * Player Slot Component
 * Displays player avatar, dealer token, bid/tricks counter, turn indicator,
 * bot thinking visual feedback, and active player indicator animations.
 * Phase 8 Animations & Sound
 */

import React from 'react';
import { motion } from 'motion/react';
import { User, Bot, Sparkles, BrainCircuit } from 'lucide-react';
import { PlayerPosition, PlayerState, PlayerType } from '../../models/player';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface PlayerSlotProps {
  player: PlayerState;
  position: PlayerPosition;
  isCurrentTurn: boolean;
  statusText?: string;
}

export const PlayerSlot: React.FC<PlayerSlotProps> = ({
  player,
  position,
  isCurrentTurn,
  statusText,
}) => {
  const isHuman = player.type === PlayerType.HUMAN;
  const isSouth = position === PlayerPosition.SOUTH;
  const isSidePlayer = position === PlayerPosition.WEST || position === PlayerPosition.EAST;
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      id={`player-slot-${position.toLowerCase()}`}
      className={`flex flex-col items-center select-none transition-all duration-200 shrink-0 ${
        isSouth
          ? 'w-full max-w-[280px] sm:max-w-sm'
          : isSidePlayer
          ? 'w-auto max-w-[85px] xs:max-w-[100px] sm:max-w-[170px]'
          : 'max-w-[140px] xs:max-w-[170px] sm:max-w-[200px]'
      }`}
    >
      {/* Player Card Header with Active Turn Glow */}
      <motion.div
        animate={
          isCurrentTurn && !prefersReducedMotion
            ? {
                scale: [1, 1.02, 1],
                boxShadow: [
                  '0 0 0px rgba(16, 185, 129, 0)',
                  '0 0 20px rgba(16, 185, 129, 0.45)',
                  '0 0 0px rgba(16, 185, 129, 0)',
                ],
              }
            : {}
        }
        transition={
          isCurrentTurn && !prefersReducedMotion
            ? { repeat: Infinity, duration: 2, ease: 'easeInOut' }
            : transitions.instant
        }
        className={`relative border backdrop-blur-xl shadow-lg transition-all duration-200 ${
          isSidePlayer
            ? 'flex flex-col items-center sm:flex-row sm:items-center text-center sm:text-left gap-1 xs:gap-1.5 sm:gap-2.5 p-1.5 xs:p-2 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-2xl'
            : 'flex items-center gap-1.5 xs:gap-2 sm:gap-2.5 px-2 xs:px-2.5 sm:px-3.5 py-1 xs:py-1.5 sm:py-1.5 rounded-xl sm:rounded-2xl'
        } ${
          isCurrentTurn
            ? 'bg-gradient-to-r from-emerald-950/95 via-[#062417] to-stone-900/95 border-emerald-400 ring-1 sm:ring-2 ring-emerald-400/70 shadow-emerald-500/30'
            : 'bg-stone-900/90 border-stone-700/80 hover:border-stone-600'
        }`}
      >
        {/* Dealer Token */}
        {player.isDealer && (
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1 sm:-top-2 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-stone-950 text-[8px] sm:text-[10px] font-black flex items-center justify-center shadow-lg border border-amber-100 ring-1 ring-amber-500/50 z-10"
            title="Dealer"
          >
            D
          </motion.div>
        )}

        {/* Player Avatar */}
        <div
          className={`w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-bold border shrink-0 relative shadow-inner ${
            isHuman
              ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-emerald-400/60 shadow-emerald-900/40'
              : isCurrentTurn
              ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-200 border-amber-400/60 shadow-amber-950/50'
              : 'bg-stone-800 text-stone-300 border-stone-600/80'
          }`}
        >
          {isHuman ? (
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          ) : isCurrentTurn ? (
            <BrainCircuit className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 animate-pulse" />
          ) : (
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          )}
        </div>

        {/* Name & Stats */}
        <div className={`flex flex-col min-w-0 ${isSidePlayer ? 'items-center sm:items-start' : 'items-start'}`}>
          <div className="flex items-center justify-center sm:justify-start gap-1">
            <span
              className={`font-bold text-white leading-tight ${
                isSidePlayer
                  ? 'text-[10px] xs:text-[11px] sm:text-xs max-w-[76px] xs:max-w-[88px] sm:max-w-[100px] truncate'
                  : 'text-[11px] xs:text-xs sm:text-sm max-w-[90px] sm:max-w-[120px] truncate'
              }`}
            >
              {isHuman ? 'You' : player.name}
            </span>
            {isCurrentTurn && (
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-400" />
              </span>
            )}
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-1 text-[8px] xs:text-[9px] sm:text-[10px] text-stone-400 font-mono whitespace-nowrap mt-0.5 sm:mt-0">
            <span>
              C:<strong className="text-amber-300 font-semibold">{player.currentBid ?? '—'}</strong>
            </span>
            <span className="text-stone-600">•</span>
            <span>
              W:{' '}
              <strong
                className={
                  player.currentBid && player.tricksWon >= player.currentBid
                    ? 'text-emerald-400 font-bold'
                    : 'text-stone-300 font-bold'
                }
              >
                {player.tricksWon}
              </strong>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Cards Remaining / Status / Thinking Badge */}
      {!isSouth && (
        <div className="mt-0.5 sm:mt-1 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-stone-950/90 border border-stone-800/90 text-[7.5px] xs:text-[8.5px] sm:text-[9px] font-mono text-stone-400 flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm whitespace-nowrap max-w-full truncate">
          {isCurrentTurn ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <span className="inline-block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Thinking...</span>
            </span>
          ) : (
            <>
              <span>{player.hand.length} cards</span>
              {statusText && <span className="text-emerald-400 font-semibold hidden xs:inline">• {statusText}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
};
