/**
 * Game Mode Selection Modal
 * Allows players to choose between:
 * 1. Play Solo (Offline against AI Bots with difficulty picker)
 * 2. Play with Friends (Private Room / WhatsApp invite)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Users,
  Sparkles,
  ShieldCheck,
  Share2,
  ChevronRight,
  X,
  Zap,
  Flame,
  Award,
} from 'lucide-react';
import { BotDifficulty } from '../../core/contracts/IBotStrategy';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface GameModeModalProps {
  isOpen: boolean;
  currentDifficulty?: BotDifficulty;
  onClose: () => void;
  onSelectSolo: (difficulty: BotDifficulty) => void;
  onSelectFriends: () => void;
}

export const GameModeModal: React.FC<GameModeModalProps> = ({
  isOpen,
  currentDifficulty = BotDifficulty.MEDIUM,
  onClose,
  onSelectSolo,
  onSelectFriends,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedDifficulty, setSelectedDifficulty] = useState<BotDifficulty>(currentDifficulty);

  if (!isOpen) return null;

  const difficultyOptions: Array<{
    id: BotDifficulty;
    label: string;
    desc: string;
    icon: typeof Zap;
    color: string;
  }> = [
    {
      id: BotDifficulty.EASY,
      label: 'Easy',
      desc: 'Relaxed & casual play',
      icon: Zap,
      color: 'text-emerald-400 border-emerald-700/60 bg-emerald-950/40',
    },
    {
      id: BotDifficulty.MEDIUM,
      label: 'Medium',
      desc: 'Balanced tactical AI',
      icon: Flame,
      color: 'text-amber-400 border-amber-700/60 bg-amber-950/40',
    },
    {
      id: BotDifficulty.HARD,
      label: 'Hard',
      desc: 'Aggressive & strict trumping',
      icon: Award,
      color: 'text-rose-400 border-rose-700/60 bg-rose-950/40',
    },
  ];

  return (
    <AnimatePresence>
      <div
        id="modal-game-mode-backdrop"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none"
        onClick={onClose}
      >
        <motion.div
          id="modal-game-mode-card"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 15 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={transitions.springFast}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] p-5 sm:p-7 flex flex-col text-left relative overflow-hidden ring-1 ring-white/10"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-20 -left-20 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-800/90 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-md">
                <span className="font-serif text-xl font-bold">♠</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Choose Game Mode
                </h2>
                <p className="text-xs text-stone-400">
                  Select how you want to play Call Break / Lakdi
                </p>
              </div>
            </div>
            <button
              type="button"
              id="btn-close-game-mode"
              onClick={() => {
                soundManager.play('click');
                onClose();
              }}
              className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer border border-stone-700/60"
              title="Close"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Options */}
          <div className="space-y-4">
            {/* Option 1: Play Solo */}
            <div className="p-4 rounded-2xl bg-stone-950/70 border border-emerald-900/60 hover:border-emerald-600/80 transition-all shadow-md group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700/70 flex items-center justify-center text-emerald-300 shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Play Solo (Offline)</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold">
                        Instant
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Play immediately against AI bots. No internet or login required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bot Difficulty Selector */}
              <div className="mb-3.5 pt-2 border-t border-stone-800/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                    Bot Difficulty
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    {selectedDifficulty === BotDifficulty.EASY
                      ? 'Beginner'
                      : selectedDifficulty === BotDifficulty.HARD
                      ? 'Challenging'
                      : 'Standard'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {difficultyOptions.map((opt) => {
                    const isSelected = selectedDifficulty === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        id={`btn-diff-${opt.id.toLowerCase()}`}
                        onClick={() => {
                          soundManager.play('click');
                          setSelectedDifficulty(opt.id);
                        }}
                        className={`px-2.5 py-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `${opt.color} ring-1 ring-white/20 shadow-md font-bold`
                            : 'bg-stone-900/70 border-stone-800 text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <Icon className="w-3.5 h-3.5 opacity-80" />
                        </div>
                        <span className="text-[9px] line-clamp-1 opacity-75">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start Solo Button */}
              <button
                type="button"
                id="btn-start-solo-mode"
                onClick={() => {
                  soundManager.play('deal');
                  onSelectSolo(selectedDifficulty);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <span>Start Solo Match</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Option 2: Play with Friends */}
            <div className="p-4 rounded-2xl bg-stone-950/70 border border-amber-900/50 hover:border-amber-500/80 transition-all shadow-md group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-700/70 flex items-center justify-center text-amber-300 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Play with Friends</h3>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold">
                        Private Room
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Create a private table and invite friends via 6-digit WhatsApp link.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Badges */}
              <div className="flex flex-wrap gap-2 mb-3.5 pt-2 border-t border-stone-800/60 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 flex items-center gap-1.5 font-medium">
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp Code Invite</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-fill seats with bots</span>
                </span>
              </div>

              {/* Enter Friends Lobby Button */}
              <button
                type="button"
                id="btn-open-friends-lobby"
                onClick={() => {
                  soundManager.play('click');
                  onSelectFriends();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:from-amber-700 text-stone-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-950/50 transition-all cursor-pointer"
              >
                <span>Create or Join Private Table</span>
                <ChevronRight className="w-4 h-4 text-stone-950" />
              </button>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-4 pt-3 border-t border-stone-800/60 text-center">
            <span className="text-[11px] text-stone-400 font-mono">
              Call Break / Lakdi • Standard 5-Round Match & Must-Beat Rules
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
