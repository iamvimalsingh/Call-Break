/**
 * Center Play Area / Trick Felt Component
 * Renders the 4-position trick resolution zone displaying played cards,
 * card play animations from seats to center, trick winner highlight,
 * and trick collection animations.
 * Scaled down 10-12% for generous vertical table clearance.
 * Phase 8 Animations & Sound
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CompletedTrick, TrickState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { SUIT_CONFIG } from '../../models/card';
import { CardView } from './CardView';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface CenterPlayAreaProps {
  currentTrick: TrickState;
  lastCompletedTrick: CompletedTrick | null;
  playerNames: Record<PlayerPosition, string>;
  isBidding?: boolean;
}

export const CenterPlayArea: React.FC<CenterPlayAreaProps> = ({
  currentTrick,
  lastCompletedTrick,
  playerNames,
  isBidding = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const prevTrickCountRef = useRef<number>(0);

  // If active trick has cards, display active trick; otherwise if a trick recently completed, display it
  const isShowingCompleted = currentTrick.cards.length === 0 && lastCompletedTrick !== null;
  const displayCards = isShowingCompleted ? lastCompletedTrick.cards : currentTrick.cards;
  const leadSuit = isShowingCompleted ? lastCompletedTrick.leadSuit : currentTrick.leadSuit;
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
        return { x: 0, y: -30 };
      case PlayerPosition.SOUTH:
        return { x: 0, y: 30 };
      case PlayerPosition.WEST:
        return { x: -30, y: 0 };
      case PlayerPosition.EAST:
        return { x: 30, y: 0 };
    }
  };

  return (
    <div className="flex flex-col items-center justify-center shrink-0 mx-auto select-none relative">
      {/* Central Trick Resolution Ring - Scaled down 10-12% for breathing room */}
      <div
        id="center-trick-area"
        className={`relative ${
          isBidding
            ? 'w-28 h-28 xs:w-32 xs:h-32 sm:w-36 sm:h-36 max-w-[160px] max-h-[160px]'
            : 'w-[190px] h-[190px] xs:w-[220px] xs:h-[220px] sm:w-[250px] sm:h-[250px] md:w-[280px] md:h-[280px] lg:w-[310px] lg:h-[310px] max-w-[340px] sm:max-w-[360px] md:max-w-[380px] max-h-[380px]'
        } rounded-full bg-gradient-to-b from-[#08291a]/95 via-[#041d13]/90 to-[#02120b]/98 border-2 border-emerald-500/35 flex items-center justify-center shadow-[inset_0_0_35px_rgba(0,0,0,0.7),0_10px_25px_rgba(0,0,0,0.5)] ring-1 ring-emerald-400/25 transition-all duration-300 shrink-0`}
      >
        {/* Decorative Outer Felt Rings and Crosshairs */}
        <div className="absolute inset-1 sm:inset-2.5 rounded-full border border-emerald-400/15 pointer-events-none" />
        <div className="absolute inset-5 sm:inset-8 rounded-full border border-dashed border-emerald-500/10 pointer-events-none" />

        {/* --- North Slot --- */}
        <div className="absolute top-1 sm:top-2 z-10 flex flex-col items-center">
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
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-2 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)] brightness-110 z-30 transition-all'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16.5 sm:w-13 sm:h-18 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[8.5px] xs:text-[9.5px] sm:text-[10px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.NORTH]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- South Slot --- */}
        <div className="absolute bottom-1 sm:bottom-2 z-10 flex flex-col items-center">
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
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-2 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)] brightness-110 z-30 transition-all'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16.5 sm:w-13 sm:h-18 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[8.5px] xs:text-[9.5px] sm:text-[10px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.SOUTH]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- West Slot --- */}
        <div className="absolute left-1 sm:left-2 z-10 flex flex-col items-center">
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
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-2 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)] brightness-110 z-30 transition-all'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16.5 sm:w-13 sm:h-18 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[8.5px] xs:text-[9.5px] sm:text-[10px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.WEST]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- East Slot --- */}
        <div className="absolute right-1 sm:right-2 z-10 flex flex-col items-center">
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
                      ? 'ring-2 sm:ring-4 ring-amber-400 border-2 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)] brightness-110 z-30 transition-all'
                      : ''
                  }
                />
              </motion.div>
            ) : (
              <div className="w-11 h-15 xs:w-12 xs:h-16.5 sm:w-13 sm:h-18 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-950/20 flex items-center justify-center text-[8.5px] xs:text-[9.5px] sm:text-[10px] font-mono text-emerald-400/30">
                {playerNames[PlayerPosition.EAST]}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* --- Center Info Disc --- */}
        <div className="z-0 flex flex-col items-center justify-center text-center p-0.5 sm:p-1 max-w-[90px] xs:max-w-[110px] sm:max-w-[130px] pointer-events-none">
          <div key="trick-active-disc" className="flex flex-col items-center">
            {leadSuitInfo ? (
              <div className="flex items-center gap-1 text-[8px] xs:text-[9px] sm:text-[10px] font-semibold text-white bg-stone-950/90 px-2 py-0.5 rounded-full border border-stone-700/80 shadow-md">
                <span className="text-stone-400 hidden xs:inline">Lead:</span>
                <span className="text-emerald-400 font-bold text-xs sm:text-sm leading-none">{leadSuitInfo.symbol}</span>
                <span className="truncate max-w-[35px] sm:max-w-none">{leadSuitInfo.name}</span>
              </div>
            ) : (
              <div className="text-[7.5px] xs:text-[8.5px] sm:text-[9.5px] text-stone-300 font-medium bg-stone-950/80 px-2 py-0.5 rounded-full border border-stone-800">
                <span>
                  {currentTrick.leader === PlayerPosition.SOUTH ? 'You lead' : `${playerNames[currentTrick.leader]} leads`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
