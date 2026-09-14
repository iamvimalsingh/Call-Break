/**
 * Human Hand Tray Component
 * Displays the human player's hand (South) with legal card highlighting,
 * illegal card dimming, card dealing animation, and sound integration.
 * Delegates move legality directly to the Rules Engine.
 * Phase 8 Animations & Sound
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../../models/card';
import { CardView } from './CardView';
import { Sparkles, AlertCircle } from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions, dealConfig } from '../../core/animation/animationConfig';
import { sortHand } from '../../core/deck/cardUtils';

export interface HumanHandProps {
  cards: readonly Card[];
  legalMoves: readonly Card[];
  isTurn: boolean;
  isBidding?: boolean;
  onPlayCard: (card: Card) => void;
  statusMessage?: string;
  ruleCoachEnabled?: boolean;
}

export const HumanHand: React.FC<HumanHandProps> = ({
  cards,
  legalMoves,
  isTurn,
  isBidding = false,
  onPlayCard,
  statusMessage,
  ruleCoachEnabled = true,
}) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [illegalAttemptMessage, setIllegalAttemptMessage] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 400
  );

  // Auto-sort hand cards for all players (Spades trump first, then Hearts, Diamonds, Clubs; rank descending)
  const sortedCards = useMemo(() => sortHand(cards), [cards]);

  // Measure container width responsively to calculate exact pixel card overlap
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setContainerWidth(w);
      }
    };
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Reset selected card if the card is no longer in hand
  useEffect(() => {
    if (selectedCard && !cards.some((c) => c.id === selectedCard.id)) {
      setSelectedCard(null);
    }
  }, [cards, selectedCard]);

  const handleCardClick = (card: Card) => {
    if (isBidding) {
      soundManager.play('cardHover');
      setIllegalAttemptMessage("Cards are dealt for inspection. Place your call (1–13) above.");
      setTimeout(() => setIllegalAttemptMessage(null), 2500);
      return;
    }

    if (!isTurn) {
      soundManager.play('warning');
      setIllegalAttemptMessage("It is not your turn yet.");
      setTimeout(() => setIllegalAttemptMessage(null), 2500);
      return;
    }

    const isLegal = legalMoves.some((legal) => legal.id === card.id);
    if (!isLegal) {
      soundManager.play('warning');
      const msg = ruleCoachEnabled
        ? "Rule Coach: Follow the suit that was led when possible. Spades are trump."
        : "Illegal move: You must follow Call Break suit rules.";
      setIllegalAttemptMessage(msg);
      setTimeout(() => setIllegalAttemptMessage(null), 3000);
      return;
    }

    // Move is legal -> play sound and dispatch play action to controller
    soundManager.play('cardPlay');
    setSelectedCard(card);
    setIllegalAttemptMessage(null);
    onPlayCard(card);
  };

  if (sortedCards.length === 0) {
    return (
      <div className="w-full py-2 sm:py-4 text-center text-xs font-mono text-stone-500">
        No cards remaining in hand.
      </div>
    );
  }

  // Calculate dynamic card overlap based on available container width & remaining cards
  const n = sortedCards.length;
  const isMobile = containerWidth < 768;
  const isSmallScreen = containerWidth < 640;
  const isTablet = containerWidth >= 640 && containerWidth < 1024;

  // Card dimensions: generous width on mobile so ranks and suits (A, K, Q, J, 10...) are crisp, bold, and easily readable
  const cardWidth =
    containerWidth < 360
      ? 54
      : containerWidth < 414
      ? 58
      : isSmallScreen
      ? 62
      : isTablet
      ? 68
      : 74;

  // Horizontal breathing room on mobile to ensure fanned edge cards utilize maximum available screen width
  const sideSafety = isMobile ? 6 : (isSmallScreen ? 10 : 16);
  const availWidth = Math.max(300, containerWidth - sideSafety * 2);

  // Minimum exposed width on the left of each card so the rank number (especially "10", "Q", "K", "A") and suit are 100% visible
  const minVisibleStep = isMobile ? (containerWidth < 380 ? 21 : 23) : 24;

  let overlapPx = 18;
  if (n > 1) {
    const maxStep = cardWidth - minVisibleStep;
    const targetStep = (availWidth - cardWidth) / (n - 1);
    const step = Math.min(maxStep, targetStep);
    overlapPx = Math.max(4, cardWidth - step);
  } else {
    overlapPx = 0;
  }

  // Radial fan calculations on mobile (< 768px): exactly -13deg on leftmost to +13deg on rightmost
  const M = n > 0 ? (n - 1) / 2 : 0;
  const maxRotation = 13;

  return (
    <div className="w-full flex flex-col items-center select-none overflow-visible">
      {/* Hand Status & Feedback Banner (Hidden during bidding unless illegal move clicked) */}
      {(!isBidding || illegalAttemptMessage) && (
        <div className="h-5 sm:h-6 flex items-center justify-center mb-0.5 text-center">
          <AnimatePresence mode="wait">
            {illegalAttemptMessage ? (
              <motion.span
                key="illegal-msg"
                initial={prefersReducedMotion ? false : { opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={transitions.springFast}
                className="flex items-center gap-1 text-[10px] xs:text-[11px] sm:text-xs text-rose-200 font-medium bg-rose-950/95 border border-rose-600/80 px-2.5 sm:px-3.5 py-0.5 rounded-full shadow-lg shadow-rose-950/50 backdrop-blur-xs max-w-[90vw] truncate"
              >
                <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{illegalAttemptMessage}</span>
              </motion.span>
            ) : isTurn ? (
              <motion.span
                key="turn-msg"
                initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={transitions.springFast}
                className="flex items-center gap-1 text-[10px] xs:text-[11px] sm:text-xs text-emerald-200 font-semibold bg-emerald-950/95 border border-emerald-500/70 px-3 sm:px-4 py-0.5 rounded-full shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40 backdrop-blur-xs max-w-[90vw] truncate"
              >
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 animate-spin shrink-0" />
                <span className="truncate">Your Turn — Select a card to play</span>
              </motion.span>
            ) : statusMessage ? (
              <span key="status-msg" className="text-[10px] sm:text-[11px] text-stone-400 font-mono truncate max-w-[90vw]">
                {statusMessage}
              </span>
            ) : null}
          </AnimatePresence>
        </div>
      )}

      {/* Responsive Hand Container with Exact Card Sizing & Zero Overflow */}
      <div
        id="zone-hand"
        ref={containerRef}
        className="w-full max-w-4xl px-0.5 sm:px-1.5 pt-4 pb-1.5 flex justify-center items-end overflow-visible"
      >
        <div className="flex items-end justify-center py-0.5 overflow-visible">
          <AnimatePresence mode="popLayout">
            {sortedCards.map((card, index) => {
              const isLegal = isTurn && !isBidding && legalMoves.some((legal) => legal.id === card.id);
              const isSelected = selectedCard ? selectedCard.id === card.id : false;

              // Compute mathematical radial fan arc (-13deg on left to +13deg on right)
              const diff = index - M;
              const normalizedDiff = M > 0 ? diff / M : 0;
              let rotation = 0;
              let arcY = 0;

              if (isMobile && n > 1) {
                rotation = normalizedDiff * maxRotation;

                // Parabolic vertical offset: center cards sit elevated, edge cards sit 4-8px lower
                const curve = normalizedDiff * normalizedDiff;
                const maxArcDrop = n > 8 ? 7 : n > 4 ? 5 : 3;
                arcY = curve * maxArcDrop;
              }

              // Selected card: lifts straight up by -22px cleanly without clipping or rotation jitter
              const targetY = isSelected ? arcY - 22 : arcY;

              return (
                <motion.div
                  key={card.id}
                  layout={!prefersReducedMotion}
                  initial={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : { opacity: 0, y: 35, scale: 0.85 }
                  }
                  animate={{
                    opacity: 1,
                    y: targetY,
                    rotate: rotation,
                    scale: isSelected ? 1.06 : 1,
                  }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -45, scale: 0.9, transition: { duration: 0.15 } }
                  }
                  transition={
                    prefersReducedMotion
                      ? transitions.instant
                      : {
                          ...transitions.springSmooth,
                          delay: index < 13 ? (index * dealConfig.dealStaggerMs) / 1000 : 0,
                        }
                  }
                  className="relative transition-transform duration-150 shrink-0"
                  style={{
                    marginLeft: index === 0 ? 0 : -Math.round(overlapPx),
                    zIndex: isSelected ? 50 : index + 1,
                    transformOrigin: 'bottom center',
                  }}
                >
                  <CardView
                    card={card}
                    isPlayable={isLegal}
                    isSelected={isSelected}
                    isInspectable={isBidding || !isTurn}
                    disabled={isTurn && !isLegal}
                    size="md"
                    disableAnimation={isMobile}
                    onClick={() => handleCardClick(card)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
