/**
 * Call Break Rules Guide Modal
 * Accessible guide explaining game objective, trick-taking rules, trump rules, and scoring.
 * Connects to interactive tutorial.
 * Phase 10 Settings & Interactive Tutorial
 */

import React from 'react';
import { X, ShieldCheck, GraduationCap, BookOpen } from 'lucide-react';

export interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTutorial?: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, onOpenTutorial }) => {
  if (!isOpen) return null;

  return (
    <div
      id="modal-rules-guide-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 select-none"
    >
      <div
        id="modal-rules-guide-dialog"
        className="w-full max-w-xl max-h-[85vh] bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-col text-stone-200 overflow-hidden ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800/90 bg-stone-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Call Break (Lakdi) Rules
              </h2>
              <p className="text-xs text-stone-400">Authentic South Asian card rules</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-rules-close"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close rules guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed text-stone-300">
          {/* Interactive Tutorial Callout */}
          {onOpenTutorial && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-600/70 flex items-center justify-between gap-3 text-xs shadow-sm ring-1 ring-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">Prefer an interactive walkthrough?</div>
                  <div className="text-emerald-300/80 text-[11px]">Learn by doing with our 8-step rule coach</div>
                </div>
              </div>
              <button
                type="button"
                id="btn-rules-open-tutorial"
                onClick={() => {
                  onClose();
                  onOpenTutorial();
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0 cursor-pointer shadow-md shadow-emerald-600/30 transition-all text-xs"
              >
                Launch Tutorial
              </button>
            </div>
          )}

          <section className="space-y-1.5">
            <h3 className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Match Overview</span>
            </h3>
            <p className="text-stone-400">
              Call Break is a strategic trick-taking card game played with 4 players and a standard 52-card deck (13 cards each). A complete match consists of <strong className="text-stone-200">5 rounds</strong>. The player with the highest total score at the end of 5 rounds wins the match.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-emerald-400 text-sm">♠ The Trump Suit</h3>
            <p className="text-stone-400">
              In Call Break, <strong className="text-white">Spades (♠)</strong> is always the default and permanent Trump suit. A trump card beats any card of the non-trump suits, regardless of rank.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-emerald-400 text-sm">1. Bidding Phase (The Call)</h3>
            <p className="text-stone-400">
              Starting from the player clockwise to the dealer, each player bids between <strong className="text-stone-200">1 and 13 tricks</strong> that they estimate they can win in the round.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-emerald-400 text-sm">2. Playing Tricks & Mandatory Follow-Suit</h3>
            <ul className="list-disc list-inside space-y-1.5 text-stone-400 pl-1">
              <li>
                <strong className="text-stone-200">Must Follow Suit:</strong> You must play a card of the lead suit if you hold one.
              </li>
              <li>
                <strong className="text-stone-200">Must Trump if Void:</strong> If you have no cards of the lead suit, you must play a Spade (trump) if you have one.
              </li>
              <li>
                <strong className="text-stone-200">Over-Trumping:</strong> If someone has already played a Spade, you must play a higher Spade if you hold one.
              </li>
              <li>
                <strong className="text-stone-200">Discard:</strong> Only if you have no cards of the lead suit and no viable trump can you play any other card.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-bold text-emerald-400 text-sm">3. Scoring System</h3>
            <p className="text-stone-400">
              Scoring is calculated at the end of each 13-trick round:
            </p>
            <div className="p-3.5 rounded-2xl bg-stone-950/80 border border-stone-800/90 space-y-1.5 font-mono text-[11px] sm:text-xs shadow-inner">
              <div className="text-emerald-400 font-semibold">
                • Success (Tricks Won ≥ Bid): Score = Bid + (0.1 × Overtricks)
              </div>
              <div className="text-stone-400 pl-2">
                Example: Bid 3 and won 4 tricks = +3.1 points
              </div>
              <div className="text-rose-400 font-semibold mt-1">
                • Failure (Tricks Won &lt; Bid): Score = -Bid
              </div>
              <div className="text-stone-400 pl-2">
                Example: Bid 3 and won 2 tricks = -3.0 points
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-800/90 bg-stone-950/90 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
