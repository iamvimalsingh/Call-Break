/**
 * Card View Component
 * Renders an authentic, crisp playing card using standard rank and suit representations.
 * Supports playable, selected, disabled, and face-down presentation states.
 * Integrated with motion animations (hover, selection, entrance) and sound feedback.
 * Fully accessible with ARIA labels and prefers-reduced-motion support.
 * Phase 8 Animations & Sound
 */

import React from 'react';
import { motion } from 'motion/react';
import { Card, Suit, SUIT_CONFIG } from '../../models/card';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { soundManager } from '../../core/sound/SoundManager';
import { transitions } from '../../core/animation/animationConfig';

export interface CardViewProps {
  card?: Card;
  isPlayable?: boolean;
  isSelected?: boolean;
  disabled?: boolean;
  isInspectable?: boolean;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  badge?: string;
  disableAnimation?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isPlayable = false,
  isSelected = false,
  disabled = false,
  isInspectable = false,
  faceDown = false,
  size = 'md',
  onClick,
  className = '',
  badge,
  disableAnimation = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Face-down card back rendering (for opponents / deck)
  if (faceDown || !card) {
    const sizeClasses =
      size === 'sm'
        ? 'w-10 h-14 text-[9px]'
        : size === 'lg'
        ? 'w-16 h-24 sm:w-20 sm:h-28 text-xs'
        : 'w-12 h-18 sm:w-14 sm:h-20 text-[10px]';

    return (
      <motion.div
        layout={!prefersReducedMotion && !disableAnimation}
        initial={prefersReducedMotion || disableAnimation ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? transitions.instant : transitions.springFast}
        className={`relative select-none rounded-xl border-2 border-emerald-700/80 bg-gradient-to-br from-emerald-950 via-[#062015] to-stone-950 shadow-lg shadow-black/40 flex items-center justify-center overflow-hidden ring-1 ring-emerald-500/20 ${sizeClasses} ${className}`}
        aria-label="Card face down"
      >
        {/* Intricate decorative pattern */}
        <div className="absolute inset-1 rounded-lg border border-emerald-500/30 bg-[radial-gradient(#10b981_1.5px,transparent_1.5px)] [background-size:8px_8px] opacity-35" />
        <div className="absolute inset-2 rounded-md border border-amber-400/20 pointer-events-none" />
        <div className="w-6 h-8 rounded-lg border border-emerald-400/40 bg-emerald-900/60 backdrop-blur-xs flex items-center justify-center font-serif text-emerald-300 font-bold shadow-inner">
          <span className="text-amber-300/80 drop-shadow-xs">♠</span>
        </div>
      </motion.div>
    );
  }

  const suitConfig = SUIT_CONFIG[card.suit];
  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;

  // Sizing definitions: authentic playing-card aspect ratio with legible mobile width
  const sizeClasses =
    size === 'sm'
      ? 'w-10 h-14 xs:w-11 xs:h-15 sm:w-13 sm:h-18 text-[10px] xs:text-[11px] sm:text-xs rounded-lg sm:rounded-xl p-1'
      : size === 'lg'
      ? 'w-20 h-28 sm:w-24 sm:h-34 md:w-28 md:h-40 text-base sm:text-lg rounded-2xl p-2 sm:p-2.5'
      : 'w-[54px] h-[86px] xs:w-[58px] xs:h-[92px] sm:w-[64px] sm:h-[100px] md:w-[72px] md:h-[112px] text-xs sm:text-sm rounded-xl sm:rounded-2xl p-1 xs:p-1.5 sm:p-2';

  // Playable, selected, inspectable, and disabled styling
  let interactiveClasses =
    'bg-gradient-to-b from-white via-[#fcfbf9] to-[#f4f1eb] text-stone-900 shadow-md border border-stone-300/90';

  if (isInspectable) {
    // Crisp, 100% visible presentation during bidding or idle inspection
    interactiveClasses =
      'bg-gradient-to-b from-white via-[#fcfbf9] to-[#f4f1eb] text-stone-900 shadow-md border border-stone-300/90 ring-1 ring-stone-900/5 cursor-default opacity-100 hover:shadow-lg';
  } else if (disabled || (!isPlayable && onClick)) {
    // Distinguishable as non-playable during active trick play, but with 100% crystal-clear rank legibility
    interactiveClasses =
      'bg-gradient-to-b from-[#ebe7de] to-[#ded9ce] text-stone-800 border border-stone-400/80 opacity-80 cursor-not-allowed shadow-inner';
  } else if (isPlayable) {
    interactiveClasses =
      'bg-gradient-to-b from-white via-stone-50 to-[#faf7f2] text-stone-950 border-2 border-emerald-500 ring-1 sm:ring-2 ring-emerald-400/80 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/50 cursor-pointer';
  }

  if (isSelected) {
    interactiveClasses +=
      ' ring-2 ring-amber-400 border-amber-400 shadow-xl shadow-amber-400/40 brightness-105';
  }

  const textColor = isRed
    ? (disabled ? 'text-red-700' : 'text-red-600')
    : (disabled ? 'text-stone-900' : 'text-stone-950');
  const ariaLabel = `${card.rank} of ${suitConfig.name}`;

  const handleMouseEnter = () => {
    if (isPlayable && !disabled) {
      soundManager.play('cardHover');
    }
  };

  const handleClick = () => {
    if (!disabled && isPlayable && onClick) {
      soundManager.play('cardSelect');
      onClick();
    }
  };

  return (
    <motion.div
      role={onClick && isPlayable ? 'button' : undefined}
      tabIndex={onClick && isPlayable ? 0 : undefined}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onKeyDown={(e) => {
        if (!disabled && isPlayable && onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={ariaLabel}
      aria-disabled={disabled || !isPlayable}
      whileHover={
        !disableAnimation && !prefersReducedMotion && isPlayable && !disabled
          ? { y: isSelected ? -16 : -8, scale: 1.05, transition: transitions.springFast }
          : undefined
      }
      whileTap={
        !disableAnimation && !prefersReducedMotion && isPlayable && !disabled
          ? { scale: 0.95, transition: transitions.springFast }
          : undefined
      }
      animate={
        disableAnimation
          ? undefined
          : {
              y: isSelected ? (prefersReducedMotion ? -6 : -12) : 0,
              scale: isSelected ? 1.04 : 1,
            }
      }
      transition={prefersReducedMotion ? transitions.instant : transitions.springFast}
      className={`relative select-none flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 transition-shadow duration-150 shrink-0 ${sizeClasses} ${interactiveClasses} ${className}`}
    >
      {/* Top Corner: Rank & Suit (Strictly Right-Side Up) */}
      <div className={`flex flex-col items-start leading-none font-bold font-sans select-none z-10 ${textColor}`}>
        <span className="tracking-tighter font-black text-[1.1em] leading-none">{card.rank}</span>
        <span className="text-[1.1em] leading-none mt-0.5 drop-shadow-2xs">{suitConfig.symbol}</span>
      </div>

      {/* Center Motif / Suit pip */}
      <div
        className={`flex-1 flex items-center justify-center font-bold text-[1.3em] xs:text-[1.4em] sm:text-[1.7em] leading-none opacity-90 drop-shadow-2xs ${textColor}`}
      >
        {suitConfig.symbol}
      </div>

      {/* Bottom Corner: Rank & Suit (Strictly Right-Side Up, visible on sm+) */}
      {size !== 'sm' && (
        <div className={`hidden sm:flex flex-col items-end leading-none font-bold font-sans ${textColor}`}>
          <span className="tracking-tight font-black text-[1.05em]">{card.rank}</span>
          <span className="text-[1.1em] leading-none mt-0.5">{suitConfig.symbol}</span>
        </div>
      )}

      {/* Optional Badge (e.g. Player label when in trick area) */}
      {badge && (
        <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-stone-950 text-emerald-300 border border-emerald-500/70 text-[8px] xs:text-[9px] sm:text-[10px] font-bold font-mono whitespace-nowrap shadow-lg ring-1 ring-emerald-400/40 z-20">
          {badge}
        </div>
      )}
    </motion.div>
  );
};
