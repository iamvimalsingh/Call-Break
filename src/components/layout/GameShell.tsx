/**
 * Application Game Shell Component
 * Master coordinator for Live Server-Authoritative Call Break (Lakdi).
 * Connects to server, subscribes to shared state, coordinates authoritative
 * actions (Create Table, Join Table, Play Card, Submit Bid, Reconnect),
 * and controls HUD/Modal interactions.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameMode, GameState, GameStatus } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { Card } from '../../models/card';
import { TurnTimerPayload, ToastPayload, JoinRequestPayload } from '../../models/multiplayer';
import { sharedGameStore } from '../../core/state/gameStore';
import { createInitialGameState } from '../../core/state/initialState';
import { CallBreakRulesEngine } from '../../core/rules/CallBreakRulesEngine';
import { sharedMultiplayerClient, getActiveTableId } from '../../services/multiplayer/MultiplayerClient';
import { TableTopBar } from '../hud/TableTopBar';
import { GameTable } from '../table/GameTable';
import { ScoreBoardModal } from '../hud/ScoreBoardModal';
import { ArchitectureInspector } from '../hud/ArchitectureInspector';
import { RoundSummaryModal } from '../hud/RoundSummaryModal';
import { MatchResultModal } from '../hud/MatchResultModal';
import { HomeLobbyModal } from '../hud/HomeLobbyModal';
import { RulesModal } from '../hud/RulesModal';
import { MatchHistoryModal } from '../history/MatchHistoryModal';
import { PlayerStatisticsModal } from '../statistics/PlayerStatisticsModal';
import { SettingsModal } from '../settings/SettingsModal';
import { InteractiveTutorialModal } from '../tutorial/InteractiveTutorialModal';
import { RoomLobbyModal } from '../modals/RoomLobbyModal';
import { LeaveMatchModal } from '../modals/LeaveMatchModal';
import { TableMenuModal } from '../modals/TableMenuModal';
import { JoinRequestModal } from '../modals/JoinRequestModal';
import { useSettings } from '../../core/settings/useSettings';
import { sharedHistoryService } from '../../core/history/HistoryService';
import { soundManager } from '../../core/sound/SoundManager';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { Layers, Trophy, BookOpen, RotateCcw, ShieldCheck, Volume2, VolumeX, Settings, HelpCircle, BarChart2, History, Sparkles, PlusCircle, LogIn } from 'lucide-react';
import { useSound } from '../../core/sound/useSound';

export const GameShell: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => sharedGameStore.getState());
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isHomeOpen, setIsHomeOpen] = useState(() => !getActiveTableId() && sharedGameStore.getState().status === GameStatus.IDLE);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isFinalResultOpen, setIsFinalResultOpen] = useState(false);
  const [isRoomLobbyOpen, setIsRoomLobbyOpen] = useState(false);
  const [roomLobbyTab, setRoomLobbyTab] = useState<'create' | 'join'>('create');
  const [prefilledRoomCode, setPrefilledRoomCode] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>(() => sharedMultiplayerClient.getConnectionState());
  const [isLeaveMatchModalOpen, setIsLeaveMatchModalOpen] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(() => sharedMultiplayerClient.getRoomState()?.roomCode ?? null);
  const [isHost, setIsHost] = useState<boolean>(() => {
    const r = sharedMultiplayerClient.getRoomState();
    return r ? r.hostId === r.myClientId : false;
  });
  const [turnTimer, setTurnTimer] = useState<TurnTimerPayload | null>(null);
  const [toast, setToast] = useState<{ id: string; message: string; type?: string } | null>(null);
  const [joinRequest, setJoinRequest] = useState<JoinRequestPayload | null>(null);

  const { settings } = useSettings();
  const { isMuted, toggleMute } = useSound();

  // Rules Engine for human player client-side legal move highlighting
  const [rulesEngine] = useState(() => new CallBreakRulesEngine());

  // Subscribe to centralized state store
  useEffect(() => {
    const unsubscribe = sharedGameStore.subscribe((nextState) => {
      setGameState(nextState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Browser Autoplay Policy Safe Audio Unlocking on first user gesture
  useEffect(() => {
    const handleFirstGesture = () => {
      soundManager.unlockAudio();
    };

    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // Deep-linking URL parameter detection (?room=CODE or ?r=CODE)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room') || urlParams.get('r');
      if (roomParam) {
        const cleanCode = roomParam.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        setPrefilledRoomCode(cleanCode);
        setRoomLobbyTab('join');
        setIsRoomLobbyOpen(true);
        setIsHomeOpen(false);
      }
    }
  }, []);

  // Subscribe to real-time multiplayer server events
  useEffect(() => {
    sharedMultiplayerClient.connect().catch(() => {});

    const unsubConn = sharedMultiplayerClient.onConnectionState((state) => {
      setConnectionState(state);
    });

    const unsubState = sharedMultiplayerClient.onGameState(({ state }) => {
      sharedGameStore.setState(() => state);
    });

    const unsubStarted = sharedMultiplayerClient.onGameStarted((_roomCode) => {
      setIsFinalResultOpen(false);
      setIsHomeOpen(false);
      setIsRoomLobbyOpen(false);
      setIsScoreboardOpen(false);
      soundManager.play('deal');
      sharedMultiplayerClient.sendClientReady(_roomCode);
    });

    const unsubEvent = sharedMultiplayerClient.onGameEvent((event) => {
      if (event.type === 'CARD_PLAYED') {
        soundManager.play('cardPlay');
      } else if (event.type === 'TRICK_COMPLETED') {
        soundManager.play('trickWon');
      } else if (event.type === 'ROUND_COMPLETED') {
        soundManager.play('roundEnd');
      } else if (event.type === 'MATCH_COMPLETED') {
        soundManager.play('matchEnd');
      } else if (event.type === 'CARDS_DEALT') {
        soundManager.play('deal');
      }
    });

    const unsubRoom = sharedMultiplayerClient.onRoomState((room) => {
      setRoomCode(room.roomCode);
      setIsHost(room.hostId === room.myClientId);
      if (room.status === 'PLAYING') {
        setIsHomeOpen(false);
        setIsRoomLobbyOpen(false);
      } else if (room.status === 'LOBBY') {
        setIsHomeOpen(false);
        setIsRoomLobbyOpen(true);
      }
    });

    const unsubError = sharedMultiplayerClient.onError((err) => {
      if (
        err.code === 'ROOM_NOT_FOUND' ||
        err.code === 'TABLE_NOT_ACTIVE' ||
        err.message?.toLowerCase().includes('no active table')
      ) {
        setIsHomeOpen(true);
        setIsRoomLobbyOpen(false);
        setToast({
          id: Date.now().toString(),
          message: 'Active table was closed or not found. Back to lobby.',
          type: 'info',
        });
      }
    });

    const unsubTimer = sharedMultiplayerClient.onTurnTimer((payload) => {
      if (payload.remainingSec <= 0) {
        setTurnTimer(null);
      } else {
        setTurnTimer(payload);
        if (payload.isExtraTime && payload.remainingSec <= 5 && !isMuted) {
          soundManager.play('tick');
        }
      }
    });

    const unsubToast = sharedMultiplayerClient.onToast((payload) => {
      setToast({
        id: Date.now().toString(),
        message: payload.message,
        type: payload.type || 'info',
      });
    });

    const unsubJoinReq = sharedMultiplayerClient.onJoinRequest((req) => {
      setJoinRequest(req);
    });

    return () => {
      unsubConn();
      unsubState();
      unsubStarted();
      unsubEvent();
      unsubRoom();
      unsubError();
      unsubTimer();
      unsubToast();
      unsubJoinReq();
    };
  }, [isMuted]);

  // Auto-dismiss in-table toast notification
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timeout);
  }, [toast]);

  // 800ms trick pause so the player clearly sees who won before cards sweep away
  const [isTrickPauseActive, setIsTrickPauseActive] = useState<boolean>(false);
  const prevCompletedCountRef = useRef<number>(gameState.completedTricks.length);

  useEffect(() => {
    const currentCompleted = gameState.completedTricks.length;
    if (currentCompleted > prevCompletedCountRef.current) {
      setIsTrickPauseActive(true);
      const timer = setTimeout(() => {
        setIsTrickPauseActive(false);
      }, 800);
      prevCompletedCountRef.current = currentCompleted;
      return () => clearTimeout(timer);
    }
    prevCompletedCountRef.current = currentCompleted;
  }, [gameState.completedTricks.length]);

  // Compute legal moves for human player (South) using RulesEngine
  const legalMoves = useMemo(() => {
    if (
      isTrickPauseActive ||
      gameState.status !== GameStatus.PLAYING ||
      gameState.currentPlayer !== PlayerPosition.SOUTH
    ) {
      return [];
    }
    const southHand = gameState.players[PlayerPosition.SOUTH]?.hand || [];
    return rulesEngine.getLegalMoves(
      southHand,
      gameState.currentTrick,
      gameState.config.trumpSuit
    );
  }, [gameState, rulesEngine, isTrickPauseActive]);

  // Record finished match in local stats history
  useEffect(() => {
    if (gameState.status === GameStatus.MATCH_FINISHED && gameState.matchResult) {
      sharedHistoryService.recordMatchFinished(gameState, PlayerPosition.SOUTH);
    }
  }, [gameState]);

  // Guard browser refresh/close when match is actively in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isMatchActive =
        gameState.status !== GameStatus.IDLE && gameState.status !== GameStatus.MATCH_FINISHED;
      if (isMatchActive) {
        e.preventDefault();
        e.returnValue = 'A Call Break match is currently in progress. Do you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameState.status]);

  // State guard: if a match is actively in progress, require explicit exit confirmation
  const guardActiveMatch = useCallback(
    (action: () => void) => {
      const currentStatus = sharedGameStore.getState().status;
      const isMatchActive =
        currentStatus !== GameStatus.IDLE && currentStatus !== GameStatus.MATCH_FINISHED;

      if (isMatchActive) {
        soundManager.play('warning');
        setPendingExitAction(() => action);
        setIsLeaveMatchModalOpen(true);
      } else {
        action();
      }
    },
    []
  );

  const handleConfirmLeaveMatch = useCallback(() => {
    soundManager.play('click');
    setIsLeaveMatchModalOpen(false);

    // Disconnect/leave room if multiplayer table is active
    if (sharedMultiplayerClient.isConnected() || roomCode) {
      sharedMultiplayerClient.leaveRoom();
    }

    // Reset shared store state to fresh IDLE state
    sharedGameStore.setState(() => ({
      ...createInitialGameState(GameMode.ONLINE_MULTIPLAYER),
      status: GameStatus.IDLE,
      mode: GameMode.ONLINE_MULTIPLAYER,
    }));

    setRoomCode(null);
    setIsHost(false);
    setTurnTimer(null);

    // Close all game-related modals
    setIsRulesOpen(false);
    setIsScoreboardOpen(false);
    setIsHistoryOpen(false);
    setIsStatisticsOpen(false);
    setIsSettingsOpen(false);
    setIsInspectorOpen(false);
    setIsTutorialOpen(false);
    setIsTableMenuOpen(false);
    setIsFinalResultOpen(false);

    // Execute pending action, or default to returning to Home
    if (pendingExitAction) {
      const nextAction = pendingExitAction;
      setPendingExitAction(null);
      nextAction();
    } else {
      setIsRoomLobbyOpen(false);
      setIsHomeOpen(true);
    }
  }, [roomCode, pendingExitAction]);

  const handleCancelLeaveMatch = useCallback(() => {
    soundManager.play('click');
    setIsLeaveMatchModalOpen(false);
    setPendingExitAction(null);
  }, []);

  // Online Table Entry Actions (Always Server Authoritative)
  const handleCreateNewTable = useCallback(() => {
    if (sharedMultiplayerClient.getConnectionState() !== 'OPEN') {
      soundManager.play('warning');
      setToast({
        id: Date.now().toString(),
        message: 'Cannot create table: Server connection is offline or reconnecting.',
        type: 'warning',
      });
      return;
    }
    setIsHomeOpen(false);
    setRoomLobbyTab('create');
    setIsRoomLobbyOpen(true);
  }, []);

  const handleJoinExistingTable = useCallback(() => {
    if (sharedMultiplayerClient.getConnectionState() !== 'OPEN') {
      soundManager.play('warning');
      setToast({
        id: Date.now().toString(),
        message: 'Cannot join table: Server connection is offline or reconnecting.',
        type: 'warning',
      });
      return;
    }
    setIsHomeOpen(false);
    setRoomLobbyTab('join');
    setIsRoomLobbyOpen(true);
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (isHost) {
      sharedMultiplayerClient.rematch();
    } else {
      setToast({
        id: Date.now().toString(),
        message: 'Waiting for room host to start the rematch...',
        type: 'info',
      });
    }
  }, [isHost]);

  const handleStartRoomMatch = useCallback(
    (_roomCode: string, _isHost: boolean, _autoFillBots: boolean) => {
      setIsRoomLobbyOpen(false);
      setIsHomeOpen(false);
      setIsFinalResultOpen(false);
    },
    []
  );

  const handleNextRound = useCallback(() => {
    sharedMultiplayerClient.nextRound();
  }, []);

  const handlePlayCard = useCallback(
    (card: Card) => {
      if (isTrickPauseActive) {
        return;
      }
      sharedMultiplayerClient.playCard(card);
    },
    [isTrickPauseActive]
  );

  const handleSubmitBid = useCallback((bid: number) => {
    sharedMultiplayerClient.submitBid(bid);
  }, []);

  const isRoundSummaryOpen =
    gameState.status === GameStatus.ROUND_ENDED &&
    gameState.roundScores.some((r) => r.roundNumber === gameState.currentRound) &&
    !isFinalResultOpen;

  const isMatchFinished = gameState.status === GameStatus.MATCH_FINISHED || isFinalResultOpen;

  return (
    <div className="min-h-screen h-[100dvh] w-full max-w-full overflow-hidden bg-stone-950 text-stone-100 flex flex-col justify-between select-none antialiased">
      {/* Top HUD Bar */}
      <TableTopBar
        state={gameState}
        onOpenScoreboard={() => setIsScoreboardOpen(true)}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenHome={() => guardActiveMatch(() => setIsHomeOpen(true))}
        onStartNewGame={() => guardActiveMatch(handleCreateNewTable)}
        onOpenTableMenu={() => setIsTableMenuOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onShareRoom={() => {
          if (!roomCode) return;
          const currentUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://callbreak.app';
          const joinLink = `${currentUrl}?room=${roomCode}`;
          const inviteMessage = `Join my live Call Break table! Code: ${roomCode} - ${joinLink}`;
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(joinLink).catch(() => {});
          }
          if (typeof window !== 'undefined') {
            window.open(whatsappUrl, '_blank');
          }
        }}
        onLeaveRoom={() => guardActiveMatch(() => {
          if (roomCode) {
            sharedMultiplayerClient.leaveRoom();
          }
          setIsHomeOpen(true);
        })}
      />

      {/* Main Game Shell Body (Flex Row with Desktop Side Rails + Center Table) */}
      <div className="flex-1 w-full max-w-7xl mx-auto min-h-0 flex items-stretch justify-center p-0.5 sm:p-2 lg:p-3 overflow-hidden gap-2 lg:gap-3">
        {/* Left Side Rail (Desktop only: Quick Info & Knowledge) */}
        <aside className="hidden lg:flex flex-col justify-between w-44 xl:w-52 shrink-0 py-1 select-none">
          {/* Top Panel: Game Navigation & Stats */}
          <div className="space-y-2">
            <div className="p-3 rounded-2xl bg-stone-900/90 border border-stone-800/90 shadow-md backdrop-blur-md">
              <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Overview</span>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setIsScoreboardOpen(true)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/70 transition-all flex items-center justify-between text-xs font-medium cursor-pointer shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Scorecard</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    R{gameState.currentRound}/{gameState.config.totalRounds}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => guardActiveMatch(handleCreateNewTable)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 border border-emerald-800/70 transition-all flex items-center gap-2 text-xs font-bold cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Create Table</span>
                </button>

                <button
                  type="button"
                  onClick={() => guardActiveMatch(handleJoinExistingTable)}
                  className="w-full px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-800/70 transition-all flex items-center gap-2 text-xs font-bold cursor-pointer shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-400" />
                  <span>Join Table</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRulesOpen(true)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/70 transition-all flex items-center gap-2 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-stone-300" />
                  <span>Call Break Rules</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/70 transition-all flex items-center gap-2 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <History className="w-3.5 h-3.5 text-blue-400" />
                  <span>Match History</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsStatisticsOpen(true)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/70 transition-all flex items-center gap-2 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Player Stats</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Panel: Live Server Status */}
          <div className="p-3 rounded-2xl bg-stone-900/90 border border-stone-800/90 shadow-md backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs text-stone-300 font-semibold mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Authoritative Live</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed font-sans">
              State, tricks, and bot turns are calculated live on the server.
            </p>
          </div>
        </aside>

        {/* Center: The Interactive Card Table Stage */}
        <main className="flex-1 min-w-0 h-full flex flex-col items-center justify-center relative overflow-hidden">
          <GameTable
            state={gameState}
            onPlayCard={handlePlayCard}
            onSubmitBid={handleSubmitBid}
            legalMoves={legalMoves}
            turnTimer={turnTimer}
          />

          {/* In-Table Toast Notification Banner */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className={`absolute top-3 z-40 px-4 py-2 rounded-2xl shadow-xl border text-xs font-bold font-mono flex items-center gap-2 backdrop-blur-md ${
                  toast.type === 'warning'
                    ? 'bg-amber-950/90 border-amber-600 text-amber-200'
                    : toast.type === 'success'
                    ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
                    : 'bg-stone-900/90 border-stone-600 text-stone-200'
                }`}
              >
                <span>{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Side Rail (Desktop only: Round Log & Scoring Guide) */}
        <aside className="hidden lg:flex flex-col justify-between w-44 xl:w-52 shrink-0 py-1 select-none">
          {/* Top Panel: Scoring Rule Pill Reminder */}
          <div className="space-y-2">
            <div className="p-3 rounded-2xl bg-stone-900/90 border border-stone-800/90 shadow-md backdrop-blur-md">
              <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Scoring Rules</span>
              </div>
              <div className="space-y-2 text-[11px] text-stone-300 font-sans leading-snug">
                <div className="p-2 rounded-xl bg-stone-800/60 border border-stone-700/60">
                  <span className="font-bold text-emerald-400 block mb-0.5">Bid Made:</span>
                  <span>Full points for bid + 0.1 per extra trick won.</span>
                </div>
                <div className="p-2 rounded-xl bg-stone-800/60 border border-stone-700/60">
                  <span className="font-bold text-rose-400 block mb-0.5">Bid Failed:</span>
                  <span>Negative points equal to original bid.</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-full p-2.5 rounded-2xl bg-stone-900/90 hover:bg-stone-800/90 border border-stone-800/90 text-stone-300 hover:text-white transition-all flex items-center justify-between text-xs font-semibold cursor-pointer shadow-xs"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-stone-400" />
                <span>Preferences</span>
              </span>
              <span className="text-[10px] text-stone-500 font-mono">Speed & Theme</span>
            </button>
          </div>

          {/* Engine Footer Tag */}
          <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800/60 text-[10px] font-mono text-stone-400 flex items-center justify-between">
            <span>Call Break Engine</span>
            <span className="text-emerald-400">Live Online</span>
          </div>
        </aside>
      </div>

      {/* Home / Lobby Screen Modal */}
      <HomeLobbyModal
        isOpen={isHomeOpen}
        onCreateTable={() => guardActiveMatch(handleCreateNewTable)}
        onJoinTable={() => guardActiveMatch(handleJoinExistingTable)}
        onOpenRules={() => {
          setIsHomeOpen(false);
          setIsRulesOpen(true);
        }}
        onOpenScorecard={() => {
          setIsHomeOpen(false);
          setIsScoreboardOpen(true);
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenStatistics={() => setIsStatisticsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        hasActiveGame={gameState.status !== GameStatus.IDLE}
        activeGameRound={gameState.status !== GameStatus.IDLE ? gameState.currentRound : undefined}
        onResumeGame={() => setIsHomeOpen(false)}
        isConnected={connectionState === 'OPEN'}
      />

      {/* Live Table Room Lobby Modal (Create / Join & WhatsApp Sharing) */}
      <RoomLobbyModal
        isOpen={isRoomLobbyOpen}
        onClose={() => setIsRoomLobbyOpen(false)}
        onStartRoomMatch={handleStartRoomMatch}
        initialTab={roomLobbyTab}
        prefilledRoomCode={prefilledRoomCode}
      />

      {/* Match History Modal */}
      <MatchHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onStartNewGame={() => guardActiveMatch(handleCreateNewTable)}
      />

      {/* Player Statistics Modal */}
      <PlayerStatisticsModal
        isOpen={isStatisticsOpen}
        onClose={() => setIsStatisticsOpen(false)}
        onStartNewGame={() => guardActiveMatch(handleCreateNewTable)}
        userPosition={PlayerPosition.SOUTH}
      />

      {/* Game Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onReplayTutorial={() => setIsTutorialOpen(true)}
      />

      {/* Rules Guide Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        onOpenTutorial={() => setIsTutorialOpen(true)}
      />

      {/* Interactive Tutorial Modal */}
      <InteractiveTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onStartNewGame={() => guardActiveMatch(handleCreateNewTable)}
      />

      {/* Round Complete Summary Modal */}
      <RoundSummaryModal
        isOpen={isRoundSummaryOpen}
        state={gameState}
        onNextRound={handleNextRound}
        onOpenScorecard={() => setIsScoreboardOpen(true)}
        onViewFinalResult={() => setIsFinalResultOpen(true)}
      />

      {/* Final Match Finished Screen Modal with Rematch Flow */}
      <MatchResultModal
        isOpen={isMatchFinished}
        state={gameState}
        roomCode={roomCode}
        onStartNewMatch={() => guardActiveMatch(handleCreateNewTable)}
        onPlayAgain={handlePlayAgain}
        onReturnToRoom={() => {
          setIsFinalResultOpen(false);
          setRoomLobbyTab('create');
          setIsRoomLobbyOpen(true);
        }}
        onOpenHome={() => {
          setIsFinalResultOpen(false);
          setIsHomeOpen(true);
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Scoreboard Matrix Modal */}
      <ScoreBoardModal
        isOpen={isScoreboardOpen}
        onClose={() => setIsScoreboardOpen(false)}
        state={gameState}
      />

      {/* Architecture & Contracts Inspector Drawer */}
      <ArchitectureInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      {/* In-Table Game Menu Modal (☰) */}
      <TableMenuModal
        isOpen={isTableMenuOpen}
        gameState={gameState}
        roomCode={roomCode}
        isHost={isHost}
        onClose={() => setIsTableMenuOpen(false)}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenScoreboard={() => setIsScoreboardOpen(true)}
        onOpenSettings={() => {
          setIsTableMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        onStartNewGame={() => {
          setIsTableMenuOpen(false);
          guardActiveMatch(handleCreateNewTable);
        }}
        onLeaveGame={() => {
          setIsTableMenuOpen(false);
          guardActiveMatch(() => {
            if (roomCode) {
              sharedMultiplayerClient.leaveRoom();
            }
            setIsHomeOpen(true);
          });
        }}
        onShareRoom={() => {
          if (!roomCode) return;
          const currentUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://callbreak.app';
          const joinLink = `${currentUrl}?room=${roomCode}`;
          const inviteMessage = `Join my live Call Break table! Code: ${roomCode} - ${joinLink}`;
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(joinLink).catch(() => {});
          }
          if (typeof window !== 'undefined') {
            window.open(whatsappUrl, '_blank');
          }
        }}
      />

      {/* Leave Active Match Confirmation Guard Modal */}
      <LeaveMatchModal
        isOpen={isLeaveMatchModalOpen}
        isHost={isHost}
        isMultiplayer={gameState.mode === GameMode.ONLINE_MULTIPLAYER || Boolean(roomCode)}
        onCancel={handleCancelLeaveMatch}
        onConfirmLeave={handleConfirmLeaveMatch}
      />

      {/* Host Join Request Approval Modal for Mid-Game Joins */}
      <JoinRequestModal
        request={joinRequest}
        onRespond={(reqId, accept, targetSeat) => {
          sharedMultiplayerClient.respondJoinRequest(reqId, accept, targetSeat);
          setJoinRequest(null);
        }}
      />

      {/* Offline Status Indicator */}
      <OfflineIndicator />
    </div>
  );
};
