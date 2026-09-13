/**
 * Leave Match Modal
 * Professional exit confirmation guard preventing accidental loss of running matches.
 * Provides clear warning about seat forfeiture and abandoning progress.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, LogOut, Play } from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface LeaveMatchModalProps {
  isOpen: boolean;
  isHost?: boolean;
  isMultiplayer?: boolean;
  onCancel: () => void;
  onConfirmLeave: () => void;
}

export const LeaveMatchModal: React.FC<LeaveMatchModalProps> = ({
  isOpen,
  isHost = false,
  isMultiplayer = false,
  onCancel,
  onConfirmLeave,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="modal-leave-match-backdrop"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto select-none"
        onClick={onCancel}
      >
        <motion.div
          id="modal-leave-match-card"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 15 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={transitions.springFast}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] p-6 flex flex-col text-center relative overflow-hidden ring-1 ring-white/10"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-14 -left-14 w-36 h-36 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Warning Icon Badge */}
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-600/70 text-rose-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-950/50">
            <AlertTriangle className="w-7 h-7" />
          </div>

          {/* Title & Message */}
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2">
            Leave Game in Progress?
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 font-sans leading-relaxed mb-4 px-2">
            Leaving now will abandon the match.
          </p>

          {/* Host Notification for Private Room */}
          {isMultiplayer && isHost && (
            <div className="mb-5 p-3 rounded-2xl bg-amber-950/60 border border-amber-800/70 text-amber-200 text-xs text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Host Notice:</strong> As room host, leaving now will close this table for all participants or transfer room leadership to the next player.
              </span>
            </div>
          )}

          {/* Actions: Resume Match and Forfeit & Leave */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              id="btn-resume-match"
              onClick={() => {
                soundManager.play('click');
                onCancel();
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-800 text-stone-200 font-bold text-xs sm:text-sm border border-stone-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
              <span>Resume Match</span>
            </button>

            <button
              type="button"
              id="btn-forfeit-leave"
              onClick={() => {
                soundManager.play('warning');
                onConfirmLeave();
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 active:from-rose-800 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-950/60"
            >
              <LogOut className="w-4 h-4 text-white" />
              <span>Forfeit & Leave</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
