/**
 * Animation Configuration & Motion Variants
 * Standardized easing, spring constants, deal delays, and reduced-motion fallbacks.
 * Phase 8 Animations & Sound
 */

import { Transition } from 'motion/react';

/**
 * Standard transition configurations
 */
export const transitions = {
  // Snappy spring for card hover and clicks
  springFast: {
    type: 'spring',
    stiffness: 400,
    damping: 25,
    mass: 0.5,
  } as Transition,

  // Gentle spring for dealing cards and layout moves
  springSmooth: {
    type: 'spring',
    stiffness: 260,
    damping: 24,
    mass: 0.8,
  } as Transition,

  // Smooth ease for overlays and modal backdrops
  easeOut: {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1],
  } as Transition,

  // Immediate cut for reduced-motion users
  instant: {
    duration: 0.001,
  } as Transition,
};

/**
 * Card dealing animation settings
 */
export const dealConfig = {
  dealStaggerMs: 45, // Stagger delay between dealt cards
  dealBaseDuration: 0.35, // Deal flight duration
};

/**
 * Helper to get a safe transition respecting reduced motion
 */
export function getMotionTransition(standard: Transition, prefersReducedMotion: boolean): Transition {
  if (prefersReducedMotion) {
    return transitions.instant;
  }
  return standard;
}
