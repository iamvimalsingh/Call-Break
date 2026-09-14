/**
 * Game Table Component
 * The visual felt table layout hosting 4 player seats, trick arena,
 * bidding overlay, and human hand tray.
 * Responsive mobile-first design with sound coordination and smooth phase animations.
 * Clean vertical 2-line center HUD stacks above and below the trick arena.
 * Phase 8 Animations & Sound
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameMode, GameState, GameStatus } from '../../models/gameState';
import { PlayerPosition, PlayerState } from '../../models/player';
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

  const getPlayerDisplayName = (pos: PlayerPosition, p?: PlayerState): string => {
    if (state.mode === GameMode.OFFLINE_BOTS) {
      switch (pos) {
        case PlayerPosition.SOUTH:
          return 'You';
        case PlayerPosition.WEST:
          return 'West Player';
        case PlayerPosition.NORTH:
          return 'North Player';
        case PlayerPosition.EAST:
          return 'East Player';
      }
    }
    if (!p) {
      switch (pos) {
        case PlayerPosition.SOUTH:
          return 'You';
        case PlayerPosition.WEST:
          return 'West Player';
        case PlayerPosition.NORTH:
          return 'North Player';
        case PlayerPosition.EAST:
          return 'East Player';
      }
    }
    const isSouth = pos === PlayerPosition.SOUTH;
    const raw = (p.name || '')
      .replace(/\s*\((You|Host|West|North|East|South|Friend\s*\d+)\)/gi, '')
      .trim();

    if (isSouth) {
      return raw && raw !== 'Player' && raw !== 'You' && raw !== 'Host' && raw !== 'Host (Player 1)'
        ? `${raw} (You)`
        : 'You';
    }

    let base = raw;
    if (!base || /^(friend|player|opponent)$/i.test(base)) {
      if (pos === PlayerPosition.WEST) base = 'West Player';
      else if (pos === PlayerPosition.NORTH) base = 'North Player';
      else if (pos === PlayerPosition.EAST) base = 'East Player';
    }
    return base;
  };

  const playerNames: Record<PlayerPosition, string> = {
    [PlayerPosition.SOUTH]: getPlayerDisplayName(PlayerPosition.SOUTH, southPlayer),
    [PlayerPosition.WEST]: getPlayerDisplayName(PlayerPosition.WEST, westPlayer),
    [PlayerPosition.NORTH]: getPlayerDisplayName(PlayerPosition.NORTH, northPlayer),
    [PlayerPosition.EAST]: getPlayerDisplayName(PlayerPosition.EAST, eastPlayer),
  };

  const isBiddingPhase = state.status === GameStatus.BIDDING;

  const isShowingCompleted =
    state.currentTrick.cards.length === 0 && lastCompletedTrick !== null;
  const trickNumber = isShowingCompleted
    ? lastCompletedTrick.trickNumber
    : state.currentTrick.trickNumber;

  const winnerPos = isShowingCompleted && lastCompletedTrick ? lastCompletedTrick.winner : null;

  const winnerToastText = React.useMemo(() => {
    if (!isShowingCompleted || !winnerPos || !lastCompletedTrick) return null;
    const winnerName = playerNames[winnerPos] || winnerPos;
    if (winnerPos === PlayerPosition.SOUTH) {
      return `You won Trick ${lastCompletedTrick.trickNumber}!`;
    }
    return `${winnerName} won Trick ${lastCompletedTrick.trickNumber}!`;
  }, [isShowingCompleted, winnerPos, lastCompletedTrick, playerNames]);

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
    const scoreFormatted = `${top.score > 0 ? '+' : ''}${top.score.toFixed(1)} pts`;
    if (second && top.score === second.score) {
      return `Tied: ${top.name} (${scoreFormatted})`;
    }
    return `Leader: ${top.name} (${scoreFormatted})`;
  }, [state.cumulativeScores, playerNames]);

  const actionLine1Text = React.useMemo(() => {
    if (state.lastActionMessage) {
      const msg = state.lastActionMessage.trim();
      const currentTurnName = playerNames[state.currentPlayer] || 'Opponent';
      if (
        state.status === GameStatus.PLAYING &&
        !msg.toLowerCase().includes('turn') &&
        !msg.toLowerCase().includes('wins') &&
        !msg.toLowerCase().includes('won')
      ) {
        return `${msg}. Turn: ${currentTurnName}`;
      }
      return msg;
    }
    if (state.status === GameStatus.PLAYING) {
      const currentTurnName = playerNames[state.currentPlayer] || 'Opponent';
      return `Turn: ${currentTurnName}`;
    }
    return null;
  }, [state.lastActionMessage, state.status, state.currentPlayer, playerNames]);

  const turnInstruction = React.useMemo(() => {
    if (state.status === GameStatus.BIDDING) {
      if (state.currentPlayer === PlayerPosition.SOUTH) {
        return { text: 'Your Turn — Select your bid', isHuman: true, icon: '🎯' };
      }
      const bidderName = playerNames[state.currentPlayer] || 'Opponent';
      return { text: `${bidderName} is bidding...`, isHuman: false, icon: '⏳' };
    }
    if (state.status === GameStatus.PLAYING) {
      if (state.currentPlayer === PlayerPosition.SOUTH) {
        return { text: 'Your Turn — Select a card to play', isHuman: true, icon: '🎯' };
      }
      const turnName = playerNames[state.currentPlayer] || 'Opponent';
      return { text: `${turnName}'s turn`, isHuman: false, icon: '⏳' };
    }
    if (state.status === GameStatus.ROUND_ENDED) {
      return { text: 'Round Complete', isHuman: false, icon: '🏁' };
    }
    if (state.status === GameStatus.MATCH_FINISHED) {
      return { text: 'Match Complete', isHuman: false, icon: '🏆' };
    }
    return null;
  }, [state.status, state.currentPlayer, playerNames]);

  return (
    <div
      id="callbreak-game-table-container"
      className="relative w-full h-full flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden select-none"
    >
      {/* Table Felt Surface - Scaled down for breathing room */}
      <motion.div
        id="table-felt"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitions.springSmooth}
        className="relative w-full h-full sm:max-w-[92%] md:max-w-[90%] lg:max-w-[88%] xl:max-w-4xl sm:max-h-[92%] md:max-h-[90%] flex flex-col items-center rounded-2xl sm:rounded-[2.25rem] md:rounded-[2.5rem] bg-gradient-to-b from-[#062418]/95 via-[#041a11]/95 to-[#020e09]/98 border sm:border-4 md:border-[5px] border-[#1f382a] ring-1 ring-emerald-400/30 ring-offset-1 sm:ring-offset-2 ring-offset-stone-950 shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-1 sm:p-2 min-h-0 overflow-hidden"
      >
        {/* Subtle Felt Texture & Outer Cushion Rail Accent */}
        <div className="absolute inset-1 sm:inset-3 rounded-xl sm:rounded-[2.25rem] border border-emerald-400/15 pointer-events-none" />
        <div className="absolute inset-2 sm:inset-5 rounded-lg sm:rounded-[2rem] border border-emerald-500/5 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/15 via-emerald-950/20 to-black/60 pointer-events-none rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem]" />

        {/* Gameplay & Player Seats Layer (Clean Vertical Flow with Zero Corner Collisions) */}
        <div
          id="gameplay-seats-layer"
          className="relative w-full h-full flex flex-col items-center justify-between z-10 min-h-0"
        >
          {/* 1. North Player Zone - Anchored inside top felt area */}
          <div id="zone-north-player" className="w-full flex justify-center z-10 pt-1 sm:pt-2 shrink-0">
            <PlayerSlot
              player={northPlayer}
              position={PlayerPosition.NORTH}
              isCurrentTurn={state.currentPlayer === PlayerPosition.NORTH}
              timer={turnTimer && turnTimer.position === PlayerPosition.NORTH ? turnTimer : null}
            />
          </div>

          {/* 2. Upper 2-Line HUD Stack (Between North Player & Trick Circle) */}
          <div
            id="hud-upper-stack"
            className="flex flex-col items-center gap-0.5 sm:gap-1 my-0.5 z-10 shrink-0 pointer-events-none"
          >
            {/* Line 1: Round X/5 • Trick Y/13 */}
            <div
              id="badge-round-trick"
              className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-stone-950/80 backdrop-blur-sm border border-emerald-500/35 text-emerald-300 shadow-md text-[11px] sm:text-xs font-mono font-bold tracking-tight"
            >
              <span className="text-emerald-400 text-xs sm:text-sm">📍</span>
              <span>Round {state.currentRound}/{state.config.totalRounds}</span>
              <span className="text-stone-500 font-normal">•</span>
              <span>Trick {trickNumber}/13</span>
            </div>

            {/* Line 2: Leader: [PlayerName] ([Score] pts) */}
            {leaderScoreText ? (
              <div
                id="badge-score-leader"
                className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-stone-950/80 backdrop-blur-sm border border-amber-500/35 text-stone-200 shadow-md text-[11px] sm:text-xs font-medium"
              >
                <span className="text-amber-400 text-xs sm:text-sm shrink-0">👑</span>
                <span className="truncate max-w-[240px] xs:max-w-[280px] sm:max-w-[320px] font-semibold">
                  {leaderScoreText}
                </span>
              </div>
            ) : null}
          </div>

          {/* 3. Middle Zone (West Player, Center Trick Arena / Bidding Center, East Player) */}
          <div id="zone-middle-play" className="w-full flex-1 min-h-0 flex items-center justify-between z-10 px-0.5 xs:px-1.5 sm:px-4 md:px-6 my-0">
            {/* West Player */}
            <div className="w-auto flex justify-start shrink-0">
              <PlayerSlot
                player={westPlayer}
                position={PlayerPosition.WEST}
                isCurrentTurn={state.currentPlayer === PlayerPosition.WEST}
                timer={turnTimer && turnTimer.position === PlayerPosition.WEST ? turnTimer : null}
              />
            </div>

            {/* Center Arena */}
            <div className="flex-1 flex items-center justify-center min-w-0 px-1 relative">
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
                      playerNames={playerNames}
                      isBidding={isBiddingPhase}
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

          {/* 4. Lower 2-Line HUD Stack (Between Trick Circle & South Player) */}
          <div
            id="hud-lower-stack"
            className="flex flex-col items-center gap-0.5 sm:gap-1 my-0.5 z-10 shrink-0 pointer-events-none"
          >
            {/* Line 1: [PlayerName] played [Card]. Turn: [TurnPlayer] (or trick winner celebration) */}
            {winnerToastText ? (
              <motion.div
                key={`winner-toast-${lastCompletedTrick?.trickNumber}-${winnerPos}`}
                id="trick-winner-toast"
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92, y: 2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-stone-950 via-[#261c06] to-stone-950 border border-amber-400 text-amber-200 shadow-md text-[11px] sm:text-xs font-bold"
              >
                <span className="text-amber-400 text-xs sm:text-sm shrink-0">🏆</span>
                <span className="truncate max-w-[260px] xs:max-w-[300px] sm:max-w-[360px]">
                  {winnerToastText}
                </span>
              </motion.div>
            ) : actionLine1Text ? (
              <div
                id="trick-action-message"
                className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-stone-950/80 backdrop-blur-sm border border-stone-700/80 text-[11px] sm:text-xs text-stone-200 shadow-md"
              >
                <span className="text-amber-400 text-xs shrink-0">💬</span>
                <span className="truncate font-mono max-w-[260px] xs:max-w-[300px] sm:max-w-[360px]">
                  {actionLine1Text}
                </span>
              </div>
            ) : null}

            {/* Line 2: Turn Instruction */}
            {turnInstruction && (
              <div
                id="badge-turn-instruction"
                className={`flex items-center gap-1.5 px-3 py-0.5 rounded-full backdrop-blur-sm shadow-md text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                  turnInstruction.isHuman
                    ? 'bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-400/30'
                    : 'bg-stone-950/80 border border-stone-700/80 text-stone-300'
                }`}
              >
                <span className="text-xs shrink-0">{turnInstruction.icon}</span>
                <span className="truncate max-w-[260px] xs:max-w-[300px] sm:max-w-[360px]">{turnInstruction.text}</span>
              </div>
            )}
          </div>

          {/* 5. South Zone: Player Badge & 13-Card Hand Tray */}
          <div id="zone-south-container" className="w-full flex flex-col items-center z-20 pb-0.5 shrink-0 overflow-visible">
            {/* South Player Header Badge */}
            <div className="mb-0.5 shrink-0">
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
        </div>
      </motion.div>
    </div>
  );
};
