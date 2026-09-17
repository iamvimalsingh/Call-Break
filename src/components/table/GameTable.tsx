/**
 * Game Table Component
 * The visual felt table layout hosting 4 player seats, trick arena,
 * bidding overlay, and human hand tray.
 * Responsive mobile-first design with dedicated non-overlapping zones.
 * North Player sits visibly above the table felt.
 * West and East player status blocks sit directly ABOVE their respective panels.
 * Phase 8 Animations & Sound
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameMode, GameState, GameStatus } from '../../models/gameState';
import { PlayerPosition, PlayerState } from '../../models/player';
import { Card, SUIT_CONFIG } from '../../models/card';
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

  const lastWinningCardObj = React.useMemo(() => {
    if (!lastCompletedTrick) return null;
    return lastCompletedTrick.cards.find((c) => c.playerPosition === lastCompletedTrick.winner) || null;
  }, [lastCompletedTrick]);

  const winningCardText = lastWinningCardObj
    ? `${lastWinningCardObj.card.rank}${SUIT_CONFIG[lastWinningCardObj.card.suit].symbol}`
    : '';

  const winnerDirMap: Record<PlayerPosition, string> = {
    [PlayerPosition.SOUTH]: 'S',
    [PlayerPosition.WEST]: 'W',
    [PlayerPosition.NORTH]: 'N',
    [PlayerPosition.EAST]: 'E',
  };
  const winnerDir = lastCompletedTrick ? winnerDirMap[lastCompletedTrick.winner] : '';

  // Compact Trick Winner Notification
  const winnerToastText = React.useMemo(() => {
    if (!isShowingCompleted || !winnerPos || !lastCompletedTrick) return null;
    const winnerName = playerNames[winnerPos] || winnerPos;
    if (winnerPos === PlayerPosition.SOUTH) {
      return `You won Trick ${lastCompletedTrick.trickNumber}!`;
    }
    return `${winnerName} won Trick ${lastCompletedTrick.trickNumber}!`;
  }, [isShowingCompleted, winnerPos, lastCompletedTrick, playerNames]);

  // Leader / Score summary
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
    return `${top.name}: ${scoreFormatted}`;
  }, [state.cumulativeScores, playerNames]);

  // Round / Turn status line
  const roundTurnStatusText = React.useMemo(() => {
    if (state.status === GameStatus.PLAYING) {
      const turnName =
        state.currentPlayer === PlayerPosition.SOUTH
          ? 'You'
          : playerNames[state.currentPlayer] || 'Turn';
      return `Trk ${trickNumber}/13 • ${turnName}`;
    }
    if (state.status === GameStatus.BIDDING) {
      const bidderName =
        state.currentPlayer === PlayerPosition.SOUTH
          ? 'You'
          : playerNames[state.currentPlayer] || 'Bid';
      return `Rd ${state.currentRound}/${state.config.totalRounds} • ${bidderName}`;
    }
    return `Rd ${state.currentRound}/${state.config.totalRounds} • Trk ${trickNumber}/13`;
  }, [state.currentRound, state.config.totalRounds, trickNumber, state.status, state.currentPlayer, playerNames]);

  return (
    <div
      id="callbreak-game-table-container"
      className="relative w-full h-full flex-1 flex flex-col items-center justify-between min-h-0 overflow-hidden select-none p-1 sm:p-1.5 gap-0.5"
    >
      {/* 1. NORTH PLAYER - Positioned visibly ABOVE the table felt with zero clipping (UNCHANGED) */}
      <div id="zone-north-player" className="w-full flex justify-center z-30 shrink-0">
        <PlayerSlot
          player={northPlayer}
          position={PlayerPosition.NORTH}
          isCurrentTurn={state.currentPlayer === PlayerPosition.NORTH}
          timer={turnTimer && turnTimer.position === PlayerPosition.NORTH ? turnTimer : null}
        />
      </div>

      {/* 2. TABLE FELT - Holds West (with status ABOVE), Center Trick Arena / Bidding, and East (with status ABOVE) */}
      <motion.div
        id="table-felt"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitions.springSmooth}
        className="relative w-full flex-1 min-h-0 sm:max-w-[94%] md:max-w-[92%] lg:max-w-[90%] xl:max-w-4xl flex items-center justify-between rounded-2xl sm:rounded-[2rem] bg-gradient-to-b from-[#062418]/95 via-[#041a11]/95 to-[#020e09]/98 border sm:border-2 md:border-[3px] border-[#1f382a] ring-1 ring-emerald-400/30 ring-offset-1 ring-offset-stone-950 shadow-[0_15px_45px_rgba(0,0,0,0.85)] p-1.5 sm:p-3 overflow-hidden my-0.5"
      >
        {/* Subtle Felt Texture & Outer Cushion Rail Accent */}
        <div className="absolute inset-1 sm:inset-2 rounded-xl sm:rounded-[1.75rem] border border-emerald-400/15 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/15 via-emerald-950/20 to-black/60 pointer-events-none rounded-2xl sm:rounded-[2rem]" />

        {/* West Player Column (Left side) with status block directly ABOVE player card */}
        <div id="column-west-player" className="w-auto flex flex-col items-center gap-1 z-10 shrink-0">
          {/* Last Win Badge (Above West Player area, hidden until first trick completed) */}
          {lastCompletedTrick && (
            <div id="last-win-badge" className="px-1.5 py-1 mb-0.5 rounded-lg bg-stone-950/95 border border-emerald-500/50 text-center shadow-md flex flex-col items-center justify-center w-[76px] xs:w-[86px] sm:w-[96px] md:w-[104px]">
              <div className="text-[6.5px] xs:text-[7px] sm:text-[7.5px] font-mono font-bold uppercase tracking-wider text-amber-400 leading-none mb-0.5">
                LAST WIN
              </div>
              <div className="text-[8px] xs:text-[8.5px] sm:text-[9.5px] font-mono font-bold text-white leading-none">
                {winnerDir} • {winningCardText}
              </div>
            </div>
          )}

          {/* Status block directly ABOVE West Player card */}
          <div id="west-status-block" className="flex flex-col items-center text-center gap-0.5 w-[76px] xs:w-[86px] sm:w-[96px] md:w-[104px] pointer-events-none mb-0.5">
            {/* Line 1: [Trick result / winner message] */}
            {winnerToastText ? (
              <div className="px-1 py-0.5 rounded bg-amber-950/90 border border-amber-500/70 text-amber-200 text-[7.5px] xs:text-[8px] sm:text-[9px] font-bold shadow-xs leading-tight line-clamp-2 text-center w-full">
                🏆 {winnerToastText}
              </div>
            ) : leaderScoreText ? (
              <div className="px-1 py-0.5 rounded bg-stone-950/80 border border-amber-500/30 text-amber-300 text-[7.5px] xs:text-[8px] sm:text-[9px] font-medium shadow-xs leading-tight line-clamp-2 text-center w-full">
                👑 {leaderScoreText}
              </div>
            ) : null}

            {/* Line 2: [Round/Trick/Turn status] */}
            <div className="px-1 py-0.5 rounded bg-stone-950/80 border border-emerald-500/30 text-emerald-300 text-[7.5px] xs:text-[8px] sm:text-[9px] font-mono font-bold shadow-xs leading-tight text-center w-full">
              📍 {roundTurnStatusText}
            </div>
          </div>

          {/* West Player Card */}
          <PlayerSlot
            player={westPlayer}
            position={PlayerPosition.WEST}
            isCurrentTurn={state.currentPlayer === PlayerPosition.WEST}
            timer={turnTimer && turnTimer.position === PlayerPosition.WEST ? turnTimer : null}
          />
        </div>

        {/* Center Trick Arena / Bidding Controls */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-1 z-10 relative">
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

        {/* East Player Column (Right side) with status block directly ABOVE player card */}
        <div id="column-east-player" className="w-auto flex flex-col items-center gap-1 z-10 shrink-0">
          {/* Status block directly ABOVE East Player card */}
          <div id="east-status-block" className="flex flex-col items-center text-center gap-0.5 w-[76px] xs:w-[86px] sm:w-[96px] md:w-[104px] pointer-events-none mb-0.5">
            {/* Line 1: [Trick result / winner message] */}
            {winnerToastText ? (
              <div className="px-1 py-0.5 rounded bg-amber-950/90 border border-amber-500/70 text-amber-200 text-[7.5px] xs:text-[8px] sm:text-[9px] font-bold shadow-xs leading-tight line-clamp-2 text-center w-full">
                🏆 {winnerToastText}
              </div>
            ) : leaderScoreText ? (
              <div className="px-1 py-0.5 rounded bg-stone-950/80 border border-amber-500/30 text-amber-300 text-[7.5px] xs:text-[8px] sm:text-[9px] font-medium shadow-xs leading-tight line-clamp-2 text-center w-full">
                👑 {leaderScoreText}
              </div>
            ) : null}

            {/* Line 2: [Round/Trick/Turn status] */}
            <div className="px-1 py-0.5 rounded bg-stone-950/80 border border-emerald-500/30 text-emerald-300 text-[7.5px] xs:text-[8px] sm:text-[9px] font-mono font-bold shadow-xs leading-tight text-center w-full">
              📍 {roundTurnStatusText}
            </div>
          </div>

          {/* East Player Card */}
          <PlayerSlot
            player={eastPlayer}
            position={PlayerPosition.EAST}
            isCurrentTurn={state.currentPlayer === PlayerPosition.EAST}
            timer={turnTimer && turnTimer.position === PlayerPosition.EAST ? turnTimer : null}
          />
        </div>
      </motion.div>

      {/* 3. YOU SECTION & CARD HAND (Dedicated clear area, zero overlay) (UNCHANGED) */}
      <div id="zone-south-container" className="w-full flex flex-col items-center z-20 shrink-0 overflow-visible">
        {/* South Player Badge with Turn state anchored */}
        <div className="mb-0.5 shrink-0">
          <PlayerSlot
            player={southPlayer}
            position={PlayerPosition.SOUTH}
            isCurrentTurn={state.currentPlayer === PlayerPosition.SOUTH}
            timer={turnTimer && turnTimer.position === PlayerPosition.SOUTH ? turnTimer : null}
            statusText={
              state.status === GameStatus.BIDDING && state.currentPlayer === PlayerPosition.SOUTH
                ? 'Select Bid'
                : undefined
            }
          />
        </div>

        {/* Dedicated Hand Zone - Full 13 cards rendered without any floating overlay */}
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
  );
};
