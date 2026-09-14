/**
 * Center Play Area / Trick Felt Component
 * Renders the 4-position trick resolution zone displaying played cards,
 * card play animations from seats to center, trick winner highlight,
 * and trick collection animations.
 * Phase 8 Animations & Sound
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CompletedTrick, TrickState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { SUIT_CONFIG } from '../../models/card';
import { CardView } from './CardView';
import { Trophy } from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface CenterPlayAreaProps {
  currentTrick: TrickState;
  lastCompletedTrick: CompletedTrick | null;
  actionMessage: string;
  playerNames: Record<PlayerPosition, string>;
  isBidding?: boolean;
  currentRound?: number;
  totalRounds?: number;
  leaderScoreText?: string;
}

export const CenterPlayArea: React.FC<CenterPlayAreaProps> = ({
  currentTrick,
  lastCompletedTrick,
  actionMessage,
  playerNames,
  isBidding = false,
  currentRound = 1,
  totalRounds = 5,
  leaderScoreText,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const prevTrickCountRef = useRef<number>(0);

  // If active trick has cards, display active trick; otherwise if a trick recently completed, display it
  const isShowingCompleted = currentTrick.cards.length === 0 && lastCompletedTrick !== null;
  const displayCards = isShowingCompleted ? lastCompletedTrick.cards : currentTrick.cards;
  const leadSuit = isShowingCompleted ? lastCompletedTrick.leadSuit : currentTrick.leadSuit;
  const trickNumber = isShowingCompleted ? lastCompletedTrick.trickNumber : currentTrick.trickNumber;
  const winnerPos = isShowingCompleted ? lastCompletedTrick.winner : null;

  const leadSuitInfo = leadSuit ? SUIT_CONFIG[leadSuit] : null;

  // Find cards played by each position
  const northPlayed = displayCards.find((c) => c.playerPosition === PlayerPosition.NORTH);
  const southPlayed = displayCards.find((c) => c.playerPosition === PlayerPosition.SOUTH);
  const westPlayed = displayCards.find((c) => c.playerPosition === PlayerPosition.WEST);
  const eastPlayed = displayCards.find((c) => c.playerPosition === PlayerPosition.EAST);

  // Play sound when trick is won
  useEffect(() => {
    if (isShowingCompleted && lastCompletedTrick) {
      if (lastCompletedTrick.trickNumber !== prevTrickCountRef.current) {
        prevTrickCountRef.current = lastCompletedTrick.trickNumber;
        soundManager.play('trickWon');
      }
    }
  }, [isShowingCompleted, lastCompletedTrick]);

  // Initial animation offsets based on player seat position
  const getEntryOffset = (pos: PlayerPosition) => {
    if (prefersReducedMotion) return { x: 0, y: 0 };
    switch (pos) {
      case PlayerPosition.NORTH:
        return { x: 0, y: -40 };
      case PlayerPosition.SOUTH:
        return { x: 0, y: 40 };
      case PlayerPosition.WEST:
        return { x: -40, y: 0 };
      case PlayerPosition.EAST:
        return { x: 40, y: 0 };
    }
  };

  return (
    <div className="flex flex-col items-center justify-center shrink-0 mx-auto select-none">
      {/* Table-Felt Status Badges: Gold Trump, Round/Trick, and Live Score Leader */}
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 mb-1 sm:mb-2 z-10">
        {/* 1. Gold Trump Indicator */}
        <div
          id="badge-trump-gold"
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-950/90 via-[#261705]/95 to-amber-950/90 border border-amber-400/80 text-amber-200 shadow-md shadow-amber-950/50 ring-1 ring-amber-400/30 text-[9px] xs:text-[10px] sm:text-xs font-bold"
          title="Trump Suit: Spades (Fixed)"
        >
          <span className="text-amber-400 text-xs sm:text-sm leading-none drop-shadow-xs">♠</span>
          <span className="tracking-wide">Trump: Spades</span>
        </div>

        {/* 2. Round & Trick Progress */}
        <div
          id="badge-round-trick"
          className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-stone-950/90 border border-emerald-500/50 text-emerald-300 shadow-md text-[9px] xs:text-[10px] sm:text-xs font-mono font-bold"
        >
          <span>R{currentRound}/{totalRounds}</span>
          <span className="text-stone-500 font-normal">•</span>
          <span>Trick {trickNumber}/13</span>
        </div>

        {/* 3. Live Score Leader Pill */}
        {leaderScoreText && (
          <div
            id="badge-score-leader"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-stone-900/90 border border-stone-700/80 text-stone-200 shadow-md text-[9px] xs:text-[10px] sm:text-xs font-medium"
          >
            <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">{leaderScoreText}</span>
          </div>
        )}
      </div>

      {/* Enlarged Central Trick Resolution Ring (+25-30% mobile footprint) */}
      <div
        id="center-trick-area"
        className={`relative ${
          isBidding
            ? 'w-32 h-32 xs:w-38 xs:h-38 sm:w-44 sm:h-44 md:w-48 md:h-48 max-w-[200px] max-h-[200px]'
            : 'w-48 h-48 xs:w-56 xs:h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 max-w-[330px] max-h-[330px]'
        } rounded-full bg-gradient-to-b from-[#08291a]/95 via-[#041d13]/90 to-[#02120b]/98 border-2 border-emerald-500/35 flex items-center justify-center shadow-[inset_0_0_40px_rgba(0,0,0,0.7),0_15px_35px_rgba(0,0,0,0.5)] ring-1 ring-emerald-400/25 transition-all duration-300 shrink-0`}
      >
        {/* Decorative Outer Felt Rings and Crosshairs */}
        <div className="absolute inset-1.5 sm:inset-3 rounded-full border border-emerald-400/15 pointer-events-none" />
        <div className="absolute inset-6 sm:inset-10 rounded-full border border-dashed border-emerald-500/10 pointer-events-none" />

        {/* --- North Slot --- */}
        <div className="absolute top-1 xs:top-1.5 sm:top-2.5 z-10 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {northPlayed ? (
              <motion.div
                key={`north-${northPlayed.card.id}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, ...getEntryOffset(PlayerPosition.NORTH), scale: 0.8 }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  scale: winnerPos === PlayerPosition.NORTH ? (prefersReducedMotion ? 1 : 1.08) : 1,
                }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }
                }
                transition={prefersReducedMotion ? transitions.instant : transitions.springSmooth}
              >
                <CardView
                  card={northPlayed.card}
                  size="sm"
                  badge={playerNames[PlayerPosition.NORTH]}
                  className={
                    winnerPos === PlayerPosition.NORTH
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-amber-300 shadow-2xl shadow-amber-400/50 brightness-105'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16 sm:w-14 sm:h-19 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[9px] xs:text-[10px] sm:text-[11px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.NORTH]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- South Slot --- */}
        <div className="absolute bottom-1 xs:bottom-1.5 sm:bottom-2.5 z-10 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {southPlayed ? (
              <motion.div
                key={`south-${southPlayed.card.id}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, ...getEntryOffset(PlayerPosition.SOUTH), scale: 0.8 }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  scale: winnerPos === PlayerPosition.SOUTH ? (prefersReducedMotion ? 1 : 1.08) : 1,
                }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }
                }
                transition={prefersReducedMotion ? transitions.instant : transitions.springSmooth}
              >
                <CardView
                  card={southPlayed.card}
                  size="sm"
                  badge={playerNames[PlayerPosition.SOUTH]}
                  className={
                    winnerPos === PlayerPosition.SOUTH
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-amber-300 shadow-2xl shadow-amber-400/50 brightness-105'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16 sm:w-14 sm:h-19 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[9px] xs:text-[10px] sm:text-[11px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.SOUTH]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- West Slot --- */}
        <div className="absolute left-1 xs:left-1.5 sm:left-2.5 z-10 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {westPlayed ? (
              <motion.div
                key={`west-${westPlayed.card.id}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, ...getEntryOffset(PlayerPosition.WEST), scale: 0.8 }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  scale: winnerPos === PlayerPosition.WEST ? (prefersReducedMotion ? 1 : 1.08) : 1,
                }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }
                }
                transition={prefersReducedMotion ? transitions.instant : transitions.springSmooth}
              >
                <CardView
                  card={westPlayed.card}
                  size="sm"
                  badge={playerNames[PlayerPosition.WEST]}
                  className={
                    winnerPos === PlayerPosition.WEST
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-amber-300 shadow-2xl shadow-amber-400/50 brightness-105'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16 sm:w-14 sm:h-19 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[9px] xs:text-[10px] sm:text-[11px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.WEST]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- East Slot --- */}
        <div className="absolute right-1 xs:right-1.5 sm:right-2.5 z-10 flex flex-col items-center">
          <AnimatePresence mode="wait">
            {eastPlayed ? (
              <motion.div
                key={`east-${eastPlayed.card.id}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, ...getEntryOffset(PlayerPosition.EAST), scale: 0.8 }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  scale: winnerPos === PlayerPosition.EAST ? (prefersReducedMotion ? 1 : 1.08) : 1,
                }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }
                }
                transition={prefersReducedMotion ? transitions.instant : transitions.springSmooth}
              >
                <CardView
                  card={eastPlayed.card}
                  size="sm"
                  badge={playerNames[PlayerPosition.EAST]}
                  className={
                    winnerPos === PlayerPosition.EAST
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-amber-300 shadow-2xl shadow-amber-400/50 brightness-105'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16 sm:w-14 sm:h-19 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[9px] xs:text-[10px] sm:text-[11px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.EAST]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- Center Info Disc --- */}
        <div className="z-0 flex flex-col items-center justify-center text-center p-1 sm:p-2 max-w-[130px] xs:max-w-[150px] sm:max-w-[180px] pointer-events-none">
          <AnimatePresence mode="wait">
            {isShowingCompleted && winnerPos ? (
              <motion.div
                key="trick-winner-disc"
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={transitions.springFast}
                className="flex flex-col items-center"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 text-[9px] xs:text-[10px] sm:text-xs font-bold text-amber-200 bg-stone-950/95 border border-amber-400/80 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-xl ring-1 sm:ring-2 ring-amber-400/40">
                  <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 animate-bounce shrink-0" />
                  <span className="truncate max-w-[110px] sm:max-w-[150px]">
                    {winnerPos === PlayerPosition.SOUTH
                      ? `You won Trick ${trickNumber}!`
                      : `${playerNames[winnerPos]} won Trick ${trickNumber}!`}
                  </span>
                </span>
                <span className="text-[8px] sm:text-[9px] font-mono text-stone-400 mt-0.5 sm:mt-1">
                  Trick {trickNumber} of 13
                </span>
              </motion.div>
            ) : (
              <div key="trick-active-disc" className="flex flex-col items-center">
                <div className="text-[8.5px] xs:text-[9.5px] sm:text-[11px] uppercase font-mono tracking-wider text-emerald-400 font-bold">
                  Trick {trickNumber}/13
                </div>

                {leadSuitInfo ? (
                  <div className="mt-0.5 sm:mt-1 flex items-center gap-1 text-[8.5px] xs:text-[9.5px] sm:text-[11px] font-semibold text-white bg-stone-950/90 px-2 sm:px-2.5 py-0.5 rounded-full border border-stone-700/80 shadow-md">
                    <span className="text-stone-400 hidden xs:inline">Lead:</span>
                    <span className="text-emerald-400 font-bold text-xs sm:text-sm leading-none">{leadSuitInfo.symbol}</span>
                    <span className="truncate max-w-[45px] sm:max-w-none">{leadSuitInfo.name}</span>
                    <span className="text-stone-500 font-normal hidden xs:inline">•</span>
                    <span className="text-amber-300 font-medium text-[8px] sm:text-[9.5px] hidden xs:inline truncate max-w-[55px] sm:max-w-none">
                      {currentTrick.leader === PlayerPosition.SOUTH ? 'You led' : `${playerNames[currentTrick.leader]} led`}
                    </span>
                  </div>
                ) : (
                  <div className="mt-0.5 text-[8px] sm:text-[10px] text-stone-300 font-medium bg-stone-950/80 px-2 py-0.5 rounded-full border border-stone-800">
                    <span>
                      {currentTrick.leader === PlayerPosition.SOUTH ? 'You lead' : `${playerNames[currentTrick.leader]} leads`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Notification Pill below the center disc */}
        <AnimatePresence>
          {actionMessage && (
            <motion.div
              key={actionMessage}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={transitions.springFast}
              className="absolute -bottom-4 sm:-bottom-5 md:-bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 sm:px-3.5 py-0.5 rounded-full bg-stone-950/95 border border-stone-700/90 text-[8px] xs:text-[9px] sm:text-[10px] text-stone-200 shadow-xl font-mono z-20 max-w-[85vw] truncate"
            >
              {actionMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
