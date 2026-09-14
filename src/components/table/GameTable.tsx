/**
 * Game Table Component
 * The visual felt table layout hosting 4 player seats, trick arena,
 * bidding overlay, and human hand tray.
 * Responsive mobile-first design with sound coordination and smooth phase animations.
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
import { sharedMultiplayerClient } from '../../services/multiplayer/MultiplayerClient';
import { Copy, Check, Users } from 'lucide-react';

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
  const [copiedRoomCode, setCopiedRoomCode] = React.useState(false);
  const [roomCode, setRoomCode] = React.useState<string | null>(() => {
    const r = sharedMultiplayerClient.getRoomState();
    return r ? r.roomCode : null;
  });

  useEffect(() => {
    const unsubRoom = sharedMultiplayerClient.onRoomState((r) => {
      setRoomCode(r ? r.roomCode : null);
    });
    return () => {
      unsubRoom();
    };
  }, []);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!roomCode) return;
    soundManager.play('click');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomCode).catch(() => {});
    }
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

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

  const totalBids = React.useMemo(() => {
    const players = [
      state.players[PlayerPosition.SOUTH],
      state.players[PlayerPosition.WEST],
      state.players[PlayerPosition.NORTH],
      state.players[PlayerPosition.EAST],
    ];
    const allBidded = players.every((p) => p && p.currentBid !== null && p.currentBid >= 1);
    if (!allBidded && state.status !== GameStatus.PLAYING) return null;
    return players.reduce((sum, p) => sum + (p?.currentBid ?? 0), 0);
  }, [state.players, state.status]);

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
      {/* Table Felt Surface */}
      <motion.div
        id="table-felt"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitions.springSmooth}
        className="relative w-full max-w-5xl h-full flex flex-col items-center rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-b from-[#062418]/95 via-[#041a11]/95 to-[#020e09]/98 border sm:border-4 md:border-[6px] border-[#1f382a] ring-1 ring-emerald-400/30 ring-offset-1 sm:ring-offset-4 ring-offset-stone-950 shadow-[0_20px_70px_rgba(0,0,0,0.85)] p-0.5 sm:p-2 md:p-3 min-h-0 overflow-hidden"
      >
        {/* Subtle Felt Texture & Outer Cushion Rail Accent */}
        <div className="absolute inset-1 sm:inset-3 rounded-xl sm:rounded-[2.75rem] border border-emerald-400/15 pointer-events-none" />
        <div className="absolute inset-2 sm:inset-6 rounded-lg sm:rounded-[2.5rem] border border-emerald-500/5 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/15 via-emerald-950/20 to-black/60 pointer-events-none rounded-2xl sm:rounded-[2.5rem] md:rounded-[3rem]" />

        {/* ==================================================================== */}
        {/* 1. DEDICATED DESKTOP HUD OVERLAY LAYER (4 FIXED CORNER SLOTS)        */}
        {/* ==================================================================== */}
        <div
          id="desktop-hud-overlay"
          className="absolute inset-0 pointer-events-none z-30 overflow-hidden"
          aria-label="Table HUD Overlay"
        >
          {/* Corner 1: Top-Left (Match & Trick Progress) */}
          <div
            id="hud-zone-top-left"
            className="absolute top-2.5 left-3 sm:top-3.5 sm:left-4 md:top-4 md:left-5 lg:top-5 lg:left-6 pointer-events-auto"
          >
            <div
              id="badge-round-trick"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-stone-950/85 backdrop-blur-sm border border-emerald-500/40 text-emerald-300 shadow-lg text-[10px] sm:text-xs font-mono font-bold tracking-tight"
            >
              <span className="text-emerald-400 text-xs sm:text-sm">📍</span>
              <span>Round {state.currentRound}/{state.config.totalRounds}</span>
              <span className="text-stone-500 font-normal">•</span>
              <span>Trick {trickNumber}/13</span>
            </div>
          </div>

          {/* Corner 2: Top-Right (Leaderboard & Telemetry: Leader + Total Bids) */}
          <div
            id="hud-zone-top-right"
            className="absolute top-2.5 right-3 sm:top-3.5 sm:right-4 md:top-4 md:right-5 lg:top-5 lg:right-6 pointer-events-auto"
          >
            {leaderScoreText && (
              <div
                id="badge-score-leader"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-stone-950/85 backdrop-blur-sm border border-amber-500/40 text-stone-200 shadow-lg text-[10px] sm:text-xs font-medium"
              >
                <span className="text-amber-400 text-xs sm:text-sm shrink-0">👑</span>
                <span className="truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[180px] md:max-w-[220px] font-semibold">
                  {leaderScoreText}
                </span>
                {totalBids !== null && (
                  <>
                    <span className="text-stone-500 font-normal hidden xs:inline">•</span>
                    <span className="text-amber-300/90 font-mono text-[9.5px] sm:text-xs hidden xs:inline whitespace-nowrap">
                      Bids: <strong className="text-amber-300 font-bold">{totalBids}</strong>/13
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Corner 3: Bottom-Left (Last Action / Live Game Event) */}
          <div
            id="hud-zone-bottom-left"
            className="absolute bottom-20 xs:bottom-22 sm:bottom-24 md:bottom-28 lg:bottom-32 left-3 sm:left-4 md:left-5 lg:left-6 pointer-events-auto max-w-[180px] xs:max-w-[220px] sm:max-w-[260px] md:max-w-[300px]"
          >
            <AnimatePresence>
              {state.lastActionMessage && (
                <motion.div
                  key={state.lastActionMessage}
                  id="trick-action-message"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -10, y: 4 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: -6, y: 2 }}
                  transition={transitions.springFast}
                  className="flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-xl bg-stone-950/90 backdrop-blur-sm border border-stone-700/80 text-[9px] xs:text-[10px] sm:text-xs text-stone-200 shadow-xl"
                >
                  <span className="text-amber-400 text-xs shrink-0">💬</span>
                  <span className="truncate font-mono">{state.lastActionMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Corner 4: Bottom-Right (Current Action / Turn Instruction & Room Status) */}
          <div
            id="hud-zone-bottom-right"
            className="absolute bottom-20 xs:bottom-22 sm:bottom-24 md:bottom-28 lg:bottom-32 right-3 sm:right-4 md:right-5 lg:right-6 pointer-events-auto flex flex-col items-end gap-1.5 max-w-[220px] xs:max-w-[260px] sm:max-w-[300px] md:max-w-[340px]"
          >
            {/* Turn Instruction HUD */}
            <AnimatePresence mode="wait">
              {turnInstruction && (
                <motion.div
                  key={turnInstruction.text}
                  id="badge-turn-instruction"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 10, y: 4 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 6, y: 2 }}
                  transition={transitions.springFast}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl backdrop-blur-sm shadow-xl text-[9px] xs:text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                    turnInstruction.isHuman
                      ? 'bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-400/30'
                      : 'bg-stone-950/90 border border-stone-700/80 text-stone-300'
                  }`}
                >
                  <span className="text-xs shrink-0">{turnInstruction.icon}</span>
                  <span className="truncate">{turnInstruction.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Multiplayer Room Code Badge */}
            <AnimatePresence>
              {(roomCode || state.mode === GameMode.ONLINE_MULTIPLAYER) && (
                <motion.div
                  id="badge-room-status"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 10, y: 4 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 6, y: 2 }}
                  transition={transitions.springFast}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1 rounded-xl bg-stone-950/90 backdrop-blur-sm border border-emerald-500/40 text-[9px] xs:text-[10px] sm:text-xs text-emerald-300 shadow-xl pointer-events-auto"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <Users className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="font-mono font-bold tracking-tight">
                    {roomCode ? `Room ${roomCode}` : 'Live Match'}
                  </span>
                  {roomCode && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="ml-0.5 p-0.5 hover:bg-emerald-950/80 rounded text-emerald-300 hover:text-emerald-100 transition-colors cursor-pointer"
                      title="Copy room code"
                    >
                      {copiedRoomCode ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 2. GAMEPLAY & PLAYER SEATS LAYER (CROSS + LAYOUT)                   */}
        {/* ==================================================================== */}
        <div
          id="gameplay-seats-layer"
          className="relative w-full h-full flex flex-col items-center justify-between z-10 min-h-0"
        >
          {/* 1. North Player Zone */}
          <div id="zone-north-player" className="w-full flex justify-center z-10 pt-1 sm:pt-2 shrink-0">
            <PlayerSlot
              player={northPlayer}
              position={PlayerPosition.NORTH}
              isCurrentTurn={state.currentPlayer === PlayerPosition.NORTH}
              timer={turnTimer && turnTimer.position === PlayerPosition.NORTH ? turnTimer : null}
            />
          </div>

          {/* 2. Middle Zone (West Player, Center Trick Arena / Bidding Center, East Player) */}
          <div id="zone-middle-play" className="w-full flex-1 min-h-0 flex items-center justify-between z-10 px-0.5 xs:px-1.5 sm:px-4 md:px-8 lg:px-12 my-0 xs:my-0.5 sm:my-1">
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
          <div id="zone-south-container" className="w-full flex flex-col items-center z-20 pb-0.5 sm:pb-1 shrink-0 mt-2 sm:mt-4 md:mt-5 overflow-visible">
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
        </div>
      </motion.div>
    </div>
  );
};
