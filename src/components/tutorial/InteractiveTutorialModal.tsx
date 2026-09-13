/**
 * Interactive Tutorial Modal
 * 8-Step Interactive Rule Coach for Call Break (Lakdi).
 * Teaches game objective, bidding, follow-suit rules, trump mechanics, and live scoring.
 * Phase 10 Settings & Interactive Tutorial
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Play,
  Award,
} from 'lucide-react';
import { Card, Suit, Rank } from '../../models/card';
import { createCard } from '../../core/deck/cardUtils';
import { CardView } from '../table/CardView';
import { ScoringEngine } from '../../core/scoring/ScoringEngine';
import { soundManager } from '../../core/sound/SoundManager';
import { useSettings } from '../../core/settings/useSettings';
import { transitions } from '../../core/animation/animationConfig';

export interface InteractiveTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartNewGame?: () => void;
}

const TOTAL_STEPS = 8;
const scoringEngine = new ScoringEngine();

export const InteractiveTutorialModal: React.FC<InteractiveTutorialModalProps> = ({
  isOpen,
  onClose,
  onStartNewGame,
}) => {
  const { updateSettings, effectiveReducedMotion } = useSettings();
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Step 2 interactive state: Bid vs Tricks Won
  const [demoBid, setDemoBid] = useState<number>(3);
  const [demoTricksWon, setDemoTricksWon] = useState<number>(4);

  // Step 4 interactive puzzle state: Follow Suit Check
  const [selectedPuzzleCard, setSelectedPuzzleCard] = useState<string | null>(null);
  const [puzzleFeedback, setPuzzleFeedback] = useState<{ isLegal: boolean; message: string } | null>(null);

  // Step 7 interactive scoring calculator
  const [calcBid, setCalcBid] = useState<number>(3);
  const [calcTricks, setCalcTricks] = useState<number>(4);

  if (!isOpen) return null;

  const handleFinishTutorial = async (shouldStartGame: boolean = false) => {
    soundManager.play('click');
    await updateSettings({ tutorialCompleted: true });
    onClose();
    if (shouldStartGame && onStartNewGame) {
      onStartNewGame();
    }
  };

  const handleNext = () => {
    soundManager.play('click');
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinishTutorial(false);
    }
  };

  const handleBack = () => {
    soundManager.play('click');
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    soundManager.play('click');
    handleFinishTutorial(false);
  };

  // Step 4 cards: Trick led by Hearts (10 of Hearts)
  const puzzleLeadCard = createCard(Suit.HEARTS, Rank.TEN);
  const puzzleHandCards: Card[] = [
    createCard(Suit.HEARTS, Rank.ACE), // Legal: follows suit
    createCard(Suit.HEARTS, Rank.SIX), // Legal: follows suit
    createCard(Suit.DIAMONDS, Rank.KING), // Illegal: fails to follow suit while holding hearts
    createCard(Suit.SPADES, Rank.EIGHT), // Illegal: fails to follow suit while holding hearts
  ];

  const handlePuzzleCardClick = (card: Card) => {
    setSelectedPuzzleCard(card.id);
    if (card.suit === Suit.HEARTS) {
      soundManager.play('cardPlay');
      setPuzzleFeedback({
        isLegal: true,
        message: `Legal move! You held Hearts, so playing ${card.rank} of Hearts follows suit properly.`,
      });
    } else {
      soundManager.play('warning');
      setPuzzleFeedback({
        isLegal: false,
        message: `Illegal move! Because you hold Hearts in hand, Call Break rules require you to follow suit with Hearts.`,
      });
    }
  };

  // Step 5 cards demonstration: Spades Trump
  const trumpDemoCards = [
    { label: 'West (Lead)', card: createCard(Suit.HEARTS, Rank.ACE), isWinner: false },
    { label: 'North', card: createCard(Suit.HEARTS, Rank.KING), isWinner: false },
    { label: 'East (Void in ♥)', card: createCard(Suit.SPADES, Rank.TWO), isWinner: true },
    { label: 'South (You)', card: createCard(Suit.HEARTS, Rank.SEVEN), isWinner: false },
  ];

  // Calculate live score for Step 7 using real ScoringEngine
  const liveScoreResult = scoringEngine.calculatePlayerScore(calcBid, calcTricks);

  return (
    <div
      id="modal-tutorial-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none"
    >
      <motion.div
        id="modal-tutorial-card"
        initial={effectiveReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
        animate={effectiveReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={effectiveReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={transitions.springFast}
        className="w-full max-w-2xl bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-col text-stone-200 overflow-hidden max-h-[90vh] ring-1 ring-white/10"
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-stone-950/90 border-b border-stone-800/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm shadow-inner">
              ♠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Call Break Interactive Tutorial
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-800 border border-stone-700/70 text-stone-300 font-medium">
                  Step {currentStep + 1} of {TOTAL_STEPS}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="btn-tutorial-skip"
              onClick={handleSkip}
              className="px-3 py-1.5 text-xs text-stone-400 hover:text-white rounded-xl hover:bg-stone-800/80 transition-colors cursor-pointer font-medium"
            >
              Skip
            </button>
            <button
              type="button"
              id="btn-tutorial-close"
              onClick={() => handleFinishTutorial(false)}
              className="p-2 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title="Close Tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="px-6 py-2.5 bg-stone-950/60 border-b border-stone-800/60 flex items-center justify-between gap-1.5 shrink-0">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                soundManager.play('click');
                setCurrentStep(idx);
              }}
              className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                idx === currentStep
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/60 ring-1 ring-emerald-300/40'
                  : idx < currentStep
                  ? 'bg-emerald-700/70'
                  : 'bg-stone-800'
              }`}
              title={`Jump to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Step Content Arena */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-stone-300 text-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={effectiveReducedMotion ? false : { opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={transitions.springFast}
              className="space-y-4"
            >
              {/* STEP 1: OBJECTIVE */}
              {currentStep === 0 && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <Award className="w-5 h-5" />
                    <h3>Objective & Overview</h3>
                  </div>
                  <p className="leading-relaxed">
                    Call Break (also known as <em>Lakdi</em>) is a strategic trick-taking card game played
                    by <strong>four players</strong> using a standard 52-card deck with no jokers.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col gap-1 shadow-xs">
                      <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">Players</div>
                      <div className="text-white font-bold text-sm">4 Players (Individual)</div>
                      <div className="text-[11px] text-stone-400">South (You) vs. West, North, and East bots.</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col gap-1 shadow-xs">
                      <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">Cards Dealt</div>
                      <div className="text-white font-bold text-sm">13 Cards Each</div>
                      <div className="text-[11px] text-stone-400">52 cards distributed evenly in every round.</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex flex-col gap-1 shadow-xs">
                      <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">Permanent Trump</div>
                      <div className="text-white font-bold text-sm">Spades (♠) Trump</div>
                      <div className="text-[11px] text-stone-400">Spades beat any other non-trump suit card.</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2.5 shadow-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      A full match consists of <strong>5 rounds</strong>. The player with the highest total score after 5 rounds wins!
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 2: BIDDING */}
              {currentStep === 1 && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <Sparkles className="w-5 h-5" />
                    <h3>Bidding (The Call)</h3>
                  </div>
                  <p className="leading-relaxed">
                    Before playing any cards in a round, every player makes a <strong>Call (Bid)</strong> between <strong>1 and 13</strong>. Your bid represents the minimum number of tricks you predict you will win with your 13-card hand.
                  </p>

                  {/* Interactive Bid Tester */}
                  <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800/90 space-y-3 shadow-inner">
                    <div className="text-xs font-mono font-bold text-stone-400 uppercase tracking-wider">
                      Interactive Bidding Demo
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-300">Your Call:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setDemoBid((b) => Math.max(1, b - 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-black text-emerald-400 text-base">
                            {demoBid}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setDemoBid((b) => Math.min(13, b + 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-300">Tricks Won:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setDemoTricksWon((t) => Math.max(0, t - 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-black text-amber-300 text-base">
                            {demoTricksWon}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setDemoTricksWon((t) => Math.min(13, t + 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
                        demoTricksWon >= demoBid
                          ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200 ring-1 ring-emerald-500/20'
                          : 'bg-rose-950/80 border-rose-600 text-rose-200 ring-1 ring-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {demoTricksWon >= demoBid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="font-medium">
                          {demoTricksWon >= demoBid
                            ? `Contract Fulfilled! (${demoTricksWon} tricks won >= ${demoBid} bid)`
                            : `Contract Broken! (${demoTricksWon} tricks won < ${demoBid} bid)`}
                        </span>
                      </div>
                      <span className="font-mono font-black text-sm">
                        {demoTricksWon >= demoBid
                          ? `+${(demoBid + (demoTricksWon - demoBid) * 0.1).toFixed(1)} pts`
                          : `-${demoBid.toFixed(1)} pts`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: LEADING A TRICK */}
              {currentStep === 2 && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <Play className="w-5 h-5 fill-current" />
                    <h3>Leading a Trick</h3>
                  </div>
                  <p className="leading-relaxed">
                    A trick begins when the active player plays a single card to the center of the table.
                    The suit of this first card is called the <strong>Led Suit</strong>.
                  </p>

                  <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 space-y-2.5 shadow-xs">
                    <div className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">
                      Turn Order & Direction
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-stone-300 font-medium">
                      <li>
                        Play proceeds in a strict <strong>clockwise</strong> direction (South → West → North → East).
                      </li>
                      <li>
                        The player seated to the dealer’s right leads the very first trick of each round.
                      </li>
                      <li>
                        Every player must play exactly one card per trick.
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center justify-center gap-4 text-xs text-stone-400 font-mono shadow-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-200 font-semibold">Trick Leader</span>
                    <span>➔</span>
                    <span className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-200 font-semibold">Clockwise Follower 1</span>
                    <span>➔</span>
                    <span className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-200 font-semibold">Follower 2</span>
                    <span>➔</span>
                    <span className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-200 font-semibold">Follower 3</span>
                  </div>
                </div>
              )}

              {/* STEP 4: FOLLOW SUIT (INTERACTIVE CHECK) */}
              {currentStep === 3 && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <ShieldCheck className="w-5 h-5" />
                    <h3>Mandatory Rule: Follow Suit</h3>
                  </div>
                  <p className="leading-relaxed">
                    Call Break enforces the strict <strong>Follow Suit</strong> rule. If you hold any card
                    of the suit that was led, you <strong>MUST</strong> play that suit!
                  </p>

                  {/* Interactive Puzzle */}
                  <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800/90 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-300">
                        Interactive Puzzle: Tap a card from your hand to play:
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-800 text-rose-300 font-semibold">
                        Lead Suit: Hearts (♥)
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-1">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-stone-400 font-mono">West led:</span>
                        <CardView card={puzzleLeadCard} size="md" />
                      </div>
                    </div>

                    <div className="border-t border-stone-800/80 pt-2">
                      <div className="text-[11px] text-stone-400 mb-2 text-center font-medium">
                        Your Hand: (Tap any card to test legality)
                      </div>
                      <div className="flex flex-wrap justify-center gap-2.5">
                        {puzzleHandCards.map((card) => {
                          const isSelected = selectedPuzzleCard === card.id;
                          return (
                            <div key={card.id} className="cursor-pointer">
                              <CardView
                                card={card}
                                size="md"
                                isSelected={isSelected}
                                onClick={() => handlePuzzleCardClick(card)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {puzzleFeedback && (
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 shadow-sm ${
                          puzzleFeedback.isLegal
                            ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200 ring-1 ring-emerald-500/20'
                            : 'bg-rose-950/80 border-rose-600 text-rose-200 ring-1 ring-rose-500/20'
                        }`}
                      >
                        {puzzleFeedback.isLegal ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-medium">{puzzleFeedback.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: SPADES TRUMP */}
              {currentStep === 4 && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <h3>Spades (♠) Are Always Trump</h3>
                  </div>
                  <p className="leading-relaxed">
                    Spades are the permanent trump suit in Call Break. Any Spade will defeat non-trump cards of any rank, even an Ace!
                  </p>

                  <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800/90 space-y-3 shadow-inner">
                    <div className="text-xs font-semibold text-stone-300">
                      Trick Example: East is void in Hearts and trumps with 2♠:
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 justify-items-center">
                      {trumpDemoCards.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl flex flex-col items-center gap-2 w-full ${
                            item.isWinner
                              ? 'bg-emerald-950/80 border border-emerald-500/80 ring-2 ring-emerald-400/40 shadow-sm'
                              : 'bg-stone-900/60 border border-stone-800'
                          }`}
                        >
                          <span className="text-[10px] text-stone-400 text-center font-mono font-medium">
                            {item.label}
                          </span>
                          <CardView card={item.card} size="sm" />
                          <span
                            className={`text-[10px] font-bold ${
                              item.isWinner ? 'text-emerald-400 font-mono tracking-wider' : 'text-stone-500'
                            }`}
                          >
                            {item.isWinner ? '★ WINNER' : 'Beaten'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-stone-400 pt-1 leading-relaxed font-medium">
                      Notice: Even though West played the Ace of Hearts (rank 14), East’s <strong>2 of Spades (rank 2)</strong> wins the trick because Spades are trump!
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 6: WINNING TRICKS & FLOW */}
              {currentStep === 5 && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h3>Winning Tricks & Flow</h3>
                  </div>
                  <p className="leading-relaxed">
                    Once all four players have played their card, the trick winner is determined:
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/90 flex items-start gap-2.5 shadow-xs">
                      <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="font-medium">
                        <strong className="text-white">If any Spades were played:</strong> The player who played the <em>highest Spade</em> wins the trick.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/90 flex items-start gap-2.5 shadow-xs">
                      <div className="w-6 h-6 rounded-full bg-stone-800 border border-stone-700 text-stone-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="font-medium">
                        <strong className="text-white">If no Spades were played:</strong> The player who played the <em>highest card of the suit that was led</em> wins the trick.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/90 flex items-start gap-2.5 shadow-xs">
                      <div className="w-6 h-6 rounded-full bg-amber-950 border border-amber-600 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        3
                      </div>
                      <div className="font-medium">
                        <strong className="text-white">Next Lead:</strong> The winner collects the 4 cards and <em>leads the next trick</em>.
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-400 leading-relaxed font-medium">
                    This repeats for exactly <strong>13 tricks</strong> until all players’ hands are exhausted.
                  </p>
                </div>
              )}

              {/* STEP 7: SCORING (ENGINE LIVE FORMULA) */}
              {currentStep === 6 && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <Award className="w-5 h-5 text-emerald-400" />
                    <h3>Scoring Engine</h3>
                  </div>
                  <p className="leading-relaxed">
                    At the end of each round, points are calculated strictly based on your initial bid and tricks won:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-700/70 space-y-1 shadow-xs">
                      <div className="text-emerald-400 font-bold text-xs uppercase font-mono">Contract Won (Tricks ≥ Bid)</div>
                      <div className="font-mono text-sm font-black text-white">Bid + 0.1 × Overtricks</div>
                      <p className="text-[11px] text-emerald-200/80 font-medium">
                        Example: Bid 3, Won 4 tricks = <strong>+3.1 points</strong>.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-700/70 space-y-1 shadow-xs">
                      <div className="text-rose-400 font-bold text-xs uppercase font-mono">Contract Failed (Tricks &lt; Bid)</div>
                      <div className="font-mono text-sm font-black text-white">-Bid</div>
                      <p className="text-[11px] text-rose-200/80 font-medium">
                        Example: Bid 3, Won 2 tricks = <strong>-3.0 points</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Live Scoring Calculator Widget */}
                  <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800/90 space-y-3 shadow-inner">
                    <div className="text-xs font-mono font-bold text-stone-400 uppercase tracking-wider">
                      Live Scoring Engine Demo
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-300">Bid:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setCalcBid((b) => Math.max(1, b - 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-black text-emerald-400 text-base">
                            {calcBid}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setCalcBid((b) => Math.min(13, b + 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-300">Tricks:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setCalcTricks((t) => Math.max(0, t - 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-black text-amber-300 text-base">
                            {calcTricks}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.play('click');
                              setCalcTricks((t) => Math.min(13, t + 1));
                            }}
                            className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-white font-bold cursor-pointer transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 flex items-center justify-between text-xs font-mono shadow-xs">
                      <span className="text-stone-400 font-sans font-medium">Scoring Engine Output:</span>
                      <span
                        className={`text-sm font-black ${
                          liveScoreResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {liveScoreResult >= 0 ? `+${liveScoreResult.toFixed(1)}` : liveScoreResult.toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 8: READY TO PLAY */}
              {currentStep === 7 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base sm:text-lg">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <h3>You’re Ready to Play!</h3>
                  </div>
                  <p className="leading-relaxed">
                    You now know all core Call Break concepts. Here is a quick strategy recap:
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center gap-3 shadow-xs">
                      <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center font-bold">
                        ✓
                      </span>
                      <span className="font-medium">
                        <strong className="text-white">Bid Wisely:</strong> Count your sure winners (Aces, high Spades). Avoid over-bidding.
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center gap-3 shadow-xs">
                      <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center font-bold">
                        ✓
                      </span>
                      <span className="font-medium">
                        <strong>Follow Suit:</strong> Keep track of suits you or your opponents are void in.
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-stone-950/70 border border-stone-800/90 flex items-center gap-3 shadow-xs">
                      <span className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center font-bold">
                        ✓
                      </span>
                      <span className="font-medium">
                        <strong>Fulfill Your Contract:</strong> Penalties for failing bids are steep (-bid).
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                      type="button"
                      id="btn-tutorial-start-match"
                      onClick={() => handleFinishTutorial(true)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/35 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Start New Match</span>
                    </button>

                    <button
                      type="button"
                      id="btn-tutorial-back-home"
                      onClick={() => handleFinishTutorial(false)}
                      className="w-full sm:w-auto py-3 px-5 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 font-semibold text-xs transition-colors cursor-pointer border border-stone-700/60"
                    >
                      Back to Table
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Modal Bottom Footer Navigation */}
        <div className="px-6 py-4 bg-stone-950/90 border-t border-stone-800/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            id="btn-tutorial-prev"
            disabled={currentStep === 0}
            onClick={handleBack}
            className="px-4 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 disabled:opacity-40 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed border border-stone-700/60"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="text-xs text-stone-400 font-mono hidden sm:block font-medium">
            {currentStep + 1} / {TOTAL_STEPS}
          </div>

          <button
            type="button"
            id="btn-tutorial-next"
            onClick={handleNext}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <span>{currentStep === TOTAL_STEPS - 1 ? 'Finish' : 'Next'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
