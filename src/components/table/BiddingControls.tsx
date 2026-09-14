/**
 * Bidding Controls Component
 * Allows the human player to select and submit their call (1 - 13 tricks).
 * Features smooth spring animations, bid selection sound, and bid confirmation feedback.
 * Phase 8 Animations & Sound
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerPosition, PlayerState } from '../../models/player';
import { Check, Clock, Sparkles } from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface BiddingControlsProps {
  currentBidder: PlayerPosition;
  isHumanTurn: boolean;
  humanPlayer: PlayerState;
  minBid?: number;
  maxBid?: number;
  onSubmitBid: (bid: number) => void;
  expectedBidderName: string;
  ruleCoachEnabled?: boolean;
}

export const BiddingControls: React.FC<BiddingControlsProps> = ({
  isHumanTurn,
  humanPlayer,
  minBid = 1,
  maxBid = 13,
  onSubmitBid,
  expectedBidderName,
  ruleCoachEnabled = true,
}) => {
  const [selectedBid, setSelectedBid] = useState<number>(() => {
    return humanPlayer.currentBid ?? 2;
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const prefersReducedMotion = useReducedMotion();

  const bidOptions = Array.from({ length: maxBid - minBid + 1 }, (_, i) => minBid + i);

  if (!isHumanTurn) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={transitions.springFast}
        className="w-full max-w-sm mx-auto py-2 px-4 rounded-xl bg-stone-900/95 border border-stone-700/80 shadow-lg backdrop-blur-md flex items-center justify-center gap-2.5 text-stone-300 ring-1 ring-white/5 text-xs"
      >
        <Clock className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
        <span className="truncate">
          Waiting for <strong className="text-emerald-400 font-semibold">{expectedBidderName}</strong> to call...
        </span>
      </motion.div>
    );
  }

  const handleSelectBid = (bid: number) => {
    soundManager.play('bidSelect');
    setSelectedBid(bid);
  };

  const handleConfirm = () => {
    if (selectedBid >= minBid && selectedBid <= maxBid) {
      setIsSubmitting(true);
      soundManager.play('bidConfirm');
      onSubmitBid(selectedBid);
    }
  };

  return (
    <motion.div
      id="human-bidding-panel"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={transitions.springSmooth}
      className="w-full max-w-xl mx-auto p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-emerald-500/40 shadow-xl backdrop-blur-xl flex flex-col items-center gap-1 sm:gap-2 select-none ring-1 ring-emerald-500/20"
    >
      {/* Clean Header: Title and Subtitle separated onto distinct lines */}
      <div className="w-full flex flex-col items-center sm:items-start px-1 text-center sm:text-left gap-0.5">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="whitespace-nowrap">PLACE YOUR CALL (1–13 TRICKS)</span>
        </div>
        {ruleCoachEnabled && (
          <p className="text-[10px] sm:text-xs text-stone-400 font-normal leading-tight">
            Estimate tricks based on high cards &amp; Spades
          </p>
        )}
      </div>

      {/* Fair Play Transparency Badge */}
      <div
        id="badge-bidding-fair-play"
        className="w-full py-0.5 px-2 rounded-lg bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-center gap-1.5 text-[9px] xs:text-[10px] sm:text-[11px] font-medium text-emerald-300 shadow-xs"
      >
        <span>🛡️</span>
        <span>Fair Play: <strong className="font-bold text-white">100% Server Shuffled</strong> (Zero Host Influence)</span>
      </div>

      {/* Bid Selection Numbers: 1 to 13 */}
      <div className="w-full flex flex-wrap justify-center gap-0.5 xs:gap-1 sm:gap-1.5 my-0.5">
        {bidOptions.map((bid) => {
          const isSelected = selectedBid === bid;
          return (
            <motion.button
              key={bid}
              type="button"
              id={`btn-bid-${bid}`}
              onClick={() => handleSelectBid(bid)}
              whileHover={!prefersReducedMotion ? { scale: 1.06 } : undefined}
              whileTap={!prefersReducedMotion ? { scale: 0.95 } : undefined}
              animate={{
                scale: isSelected ? 1.08 : 1,
              }}
              transition={prefersReducedMotion ? transitions.instant : transitions.springFast}
              className={`h-6 xs:h-7 sm:h-8 min-w-[22px] xs:min-w-[26px] sm:min-w-[34px] px-1 sm:px-1.5 rounded-md sm:rounded-lg font-bold font-mono text-[10px] xs:text-xs sm:text-sm flex items-center justify-center transition-all duration-100 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-stone-950 ring-2 ring-emerald-300 shadow-md shadow-emerald-500/40 font-black'
                  : 'bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/80 shadow-xs'
              }`}
            >
              {bid}
            </motion.button>
          );
        })}
      </div>

      {/* Selected Value & Action Button */}
      <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2 pt-1 sm:pt-1.5 border-t border-stone-800 px-0.5 sm:px-1">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <span className="text-[10px] sm:text-[11px] text-stone-400">Selected:</span>
          <motion.span
            key={selectedBid}
            initial={prefersReducedMotion ? false : { scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={transitions.springFast}
            className="px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg bg-emerald-950/90 border border-emerald-600/70 font-mono font-bold text-[11px] sm:text-sm text-emerald-300 shadow-inner"
          >
            {selectedBid} {selectedBid === 1 ? 'Trick' : 'Tricks'}
          </motion.span>
        </div>

        <motion.button
          type="button"
          id="btn-confirm-bid"
          disabled={isSubmitting}
          onClick={handleConfirm}
          whileHover={!prefersReducedMotion ? { scale: 1.02 } : undefined}
          whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
          transition={transitions.springFast}
          className="px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 disabled:opacity-50 text-white font-bold text-[11px] sm:text-sm flex items-center gap-1 sm:gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
        >
          <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Confirm Call ({selectedBid})</span>
        </motion.button>
      </div>
    </motion.div>
  );
};
