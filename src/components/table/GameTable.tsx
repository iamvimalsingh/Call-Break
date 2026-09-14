/**
 * Game Table Component
 * The visual felt table layout hosting 4 player seats, trick arena,
 * bidding overlay, and human hand tray.
 * Responsive mobile-first design with sound coordination and smooth phase animations.
 * Phase 8 Animations & Sound
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, GameStatus } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { Card } from '../../models/card';
import { TurnTimerPayload } from '../../models/multiplayer';
import { PlayerSlot } from './PlayerSlot';
import { CenterPlayArea } from './CenterPlayArea';
import { HumanHand } from './HumanHand';
import { BiddingControls } from './BiddingControls';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';

export interface GameTableProps {
  state: GameState;
  legalMoves: readonly Card[];
  onPlayCard: (card: Card) => void;
  onSubmitBid: (bid: number) => void;
  ruleCoachEnabled?: boolean;
  turnTimer?: TurnTimerPayload | null;
}

export const GameTable: React.FC<GameTableProps> = ({
  state,
  legalMoves,
  onPlayCard,
  onSubmitBid,
  ruleCoachEnabled = true,
  turnTimer,
}) => {
  const southPlayer = state.players[PlayerPosition.SOUTH];
  const northPlayer = state.players[PlayerPosition.NORTH];
  const westPlayer = state.players[PlayerPosition.WEST];
  const eastPlayer = state.players[PlayerPosition.EAST];
  const prefersReducedMotion = useReducedMotion();
  const lastDealtRoundRef = useRef<number>(0);

  // Trigger dealing sound effect when a round begins
  useEffect(() => {
    if (
      (state.status === GameStatus.BIDDING || state.status === GameStatus.DEALING) &&
      state.currentRound !== lastDealtRoundRef.current
    ) {
      lastDealtRoundRef.current = state.currentRound;
      soundManager.play('deal');
    }
  }, [state.status, state.currentRound]);

  const lastCompletedTrick =
    state.completedTricks.length > 0
      ? state.completedTricks[state.completedTricks.length - 1]
      : null;

  const playerNames: Record<PlayerPosition, string> = {
    [PlayerPosition.SOUTH]: southPlayer?.name && southPlayer.name !== 'You' ? southPlayer.name : 'You',
    [PlayerPosition.WEST]: westPlayer?.name ?? 'West',
    [PlayerPosition.NORTH]: northPlayer?.name ?? 'North',
    [PlayerPosition.EAST]: eastPlayer?.name ?? 'East',
  };

  const isBiddingPhase = state.status === GameStatus.BIDDING;

  const leaderScoreText = React.useMemo(() => {
    const scores = state.cumulativeScores;
    const entries = (Object.keys(scores) as PlayerPosition[]).map((pos) => ({
      pos,
      name: playerNames[pos] ?? pos,
      score: scores[pos] ?? 0,
    }));
    entries.sort((a, b) => b.score - a.score);
    if (entries.length === 0) return '';
    const top = entries[0];
    const second = entries[1];
    if (second && top.score === second.score && top.score === 0) {
      return '';
    }
    if (second && top.score === second.score) {
      return `Tied: ${top.name} (${top.score > 0 ? '+' : ''}${top.score.toFixed(1)})`;
    }
    return `Leader: ${top.name} (${top.score > 0 ? '+' : ''}${top.score.toFixed(1)})`;
  }, [state.cumulativeScores, playerNames]);

  return (
    <div
      id="callbreak-game-table-container"
      className="relative w-full h-full flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden select-none"
    >
      {/* Table Felt Surface */}
      <motion.div
        id="table-felt"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitions.springSmooth}
        className="relative w-full max-w-5xl h-full flex flex-col items-center rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-b from-[#062418]/95 via-[#041a11]/95 to-[#020e09]/98 border sm:border-4 md:border-[6px] border-[#1f382a] ring-1 ring-emerald-400/30 ring-offset-1 sm:ring-offset-4 ring-offset-stone-950 shadow-[0_20px_70px_rgba(0,0,0,0.85)] p-0.5 xs:p-1 sm:p-2.5 md:p-3.5 min-h-0 overflow-hidden"
      >
        {/* Subtle Felt Texture & Outer Cushion Rail Accent */}
        <div className="absolute inset-1 sm:inset-3 rounded-xl sm:rounded-[2.75rem] border border-emerald-400/15 pointer-events-none" />
        <div className="absolute inset-2 sm:inset-6 rounded-lg sm:rounded-[2.5rem] border border-emerald-500/5 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/15 via-emerald-950/20 to-black/60 pointer-events-none rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem]" />

        {/* 1. North Player Zone */}
        <div id="zone-north-player" className="w-full flex justify-center z-10 pt-0.5 sm:pt-1 shrink-0">
          <PlayerSlot
            player={northPlayer}
            position={PlayerPosition.NORTH}
            isCurrentTurn={state.currentPlayer === PlayerPosition.NORTH}
            timer={turnTimer && turnTimer.position === PlayerPosition.NORTH ? turnTimer : null}
          />
        </div>

        {/* 2. Middle Zone (West Player, Center Trick Arena / Bidding Center, East Player) */}
        <div id="zone-middle-play" className="w-full flex-1 min-h-0 flex items-center justify-between z-10 px-0.5 xs:px-1.5 sm:px-6 md:px-10 lg:px-14 my-0 xs:my-0.5 sm:my-1">
          {/* West Player */}
          <div className="w-auto flex justify-start shrink-0">
            <PlayerSlot
              player={westPlayer}
              position={PlayerPosition.WEST}
              isCurrentTurn={state.currentPlayer === PlayerPosition.WEST}
              timer={turnTimer && turnTimer.position === PlayerPosition.WEST ? turnTimer : null}
            />
          </div>

          {/* Center Arena: Bidding Modal in Center Felt OR Trick Circle */}
          <div className="flex-1 flex items-center justify-center min-w-0 px-1 sm:px-2 relative">
            <AnimatePresence mode="wait">
              {isBiddingPhase ? (
                <motion.div
                  key="center-bidding-controls"
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -8 }}
                  transition={transitions.springFast}
                  className="w-full max-w-md mx-auto flex flex-col items-center"
                >
                  <BiddingControls
                    currentBidder={state.currentPlayer}
                    isHumanTurn={state.currentPlayer === PlayerPosition.SOUTH}
                    humanPlayer={southPlayer}
                    minBid={state.config.minBid}
                    maxBid={state.config.maxBid}
                    onSubmitBid={onSubmitBid}
                    expectedBidderName={playerNames[state.currentPlayer]}
                    ruleCoachEnabled={ruleCoachEnabled}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="center-play-area-wrapper"
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={transitions.springFast}
                  className="w-full flex items-center justify-center"
                >
                  <CenterPlayArea
                    currentTrick={state.currentTrick}
                    lastCompletedTrick={lastCompletedTrick}
                    actionMessage={state.lastActionMessage}
                    playerNames={playerNames}
                    isBidding={isBiddingPhase}
                    currentRound={state.currentRound}
                    totalRounds={state.config.totalRounds}
                    leaderScoreText={leaderScoreText}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* East Player */}
          <div className="w-auto flex justify-end shrink-0">
            <PlayerSlot
              player={eastPlayer}
              position={PlayerPosition.EAST}
              isCurrentTurn={state.currentPlayer === PlayerPosition.EAST}
              timer={turnTimer && turnTimer.position === PlayerPosition.EAST ? turnTimer : null}
            />
          </div>
        </div>

        {/* 3. South Zone: Player Badge & 13-Card Hand Tray */}
        <div id="zone-south-container" className="w-full flex flex-col items-center z-20 pb-0.5 sm:pb-1 shrink-0 mt-auto overflow-visible">
          {/* South Player Header Badge */}
          <div className="mb-0.5 sm:mb-1 shrink-0">
            <PlayerSlot
              player={southPlayer}
              position={PlayerPosition.SOUTH}
              isCurrentTurn={state.currentPlayer === PlayerPosition.SOUTH}
              timer={turnTimer && turnTimer.position === PlayerPosition.SOUTH ? turnTimer : null}
            />
          </div>

          {/* Human Hand Zone - 13 cards rendered crisply */}
          <HumanHand
            cards={southPlayer.hand}
            legalMoves={legalMoves}
            isTurn={state.status === GameStatus.PLAYING && state.currentPlayer === PlayerPosition.SOUTH}
            isBidding={isBiddingPhase}
            onPlayCard={onPlayCard}
            ruleCoachEnabled={ruleCoachEnabled}
          />
        </div>
      </motion.div>
    </div>
  );
};
