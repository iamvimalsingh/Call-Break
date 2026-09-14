/**
 * Application Game Shell Component
 * Master coordinator for Phase 6 Interactive Game Table & Playable Offline Game.
 * Subscribes to shared state, coordinates LocalGameController,
 * manages bot turn presentation timing, and controls HUD/Modal interactions.
 * Phase 6 Game Table & Playable Offline Game
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameMode, GameState, GameStatus } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';
import { Card } from '../../models/card';
import { TurnTimerPayload, ToastPayload, JoinRequestPayload } from '../../models/multiplayer';
import { sharedGameStore } from '../../core/state/gameStore';
import { LocalGameController } from '../../core/controller/LocalGameController';
import { CardEngine } from '../../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../../core/scoring/ScoringEngine';
import { sharedMultiplayerClient } from '../../services/multiplayer/MultiplayerClient';
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
import { GameModeModal } from '../modals/GameModeModal';
import { RoomLobbyModal } from '../modals/RoomLobbyModal';
import { LeaveMatchModal } from '../modals/LeaveMatchModal';
import { TableMenuModal } from '../modals/TableMenuModal';
import { JoinRequestModal } from '../modals/JoinRequestModal';
import { BotDifficulty } from '../../core/contracts/IBotStrategy';
import { useSettings } from '../../core/settings/useSettings';
import { sharedHistoryService } from '../../core/history/HistoryService';
import { sharedActiveGameService } from '../../core/persistence/ActiveGameService';
import { soundManager } from '../../core/sound/SoundManager';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { Layers, Trophy, BookOpen, RotateCcw, ShieldCheck, Volume2, VolumeX, Settings, HelpCircle, BarChart2, History, Sparkles, Users } from 'lucide-react';
import { useSound } from '../../core/sound/useSound';

export const GameShell: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => sharedGameStore.getState());
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isHomeOpen, setIsHomeOpen] = useState(() => sharedGameStore.getState().status === GameStatus.IDLE);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isFinalResultOpen, setIsFinalResultOpen] = useState(false);
  const [isGameModeOpen, setIsGameModeOpen] = useState(false);
  const [isRoomLobbyOpen, setIsRoomLobbyOpen] = useState(false);
  const [roomLobbyTab, setRoomLobbyTab] = useState<'create' | 'join'>('create');
  const [prefilledRoomCode, setPrefilledRoomCode] = useState<string>('');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>(BotDifficulty.MEDIUM);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [savedGameRound, setSavedGameRound] = useState<number | undefined>(undefined);
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

  // Initialize Controller with Card Engine, Rules Engine, and Scoring Engine
  const [controller] = useState(
    () =>
      new LocalGameController(sharedGameStore, {
        cardEngine: new CardEngine(),
        rulesEngine: new CallBreakRulesEngine(),
        scoringEngine: new ScoringEngine(),
      })
  );

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
    const unsubState = sharedMultiplayerClient.onGameState(({ state }) => {
      sharedGameStore.setState(() => state);
    });

    const unsubStarted = sharedMultiplayerClient.onGameStarted((_roomCode) => {
      setIsFinalResultOpen(false);
      setIsHomeOpen(false);
      setIsRoomLobbyOpen(false);
      setIsGameModeOpen(false);
      setIsScoreboardOpen(false);
      soundManager.play('deal');
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
      unsubState();
      unsubStarted();
      unsubEvent();
      unsubRoom();
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

  // Offline Turn Countdown Timer for Human (South) (45s Main + 15s Extra Time)
  useEffect(() => {
    if (gameState.mode !== GameMode.OFFLINE_BOTS) {
      return;
    }

    if (
      (gameState.status !== GameStatus.BIDDING && gameState.status !== GameStatus.PLAYING) ||
      gameState.currentPlayer !== PlayerPosition.SOUTH
    ) {
      setTurnTimer(null);
      return;
    }

    let isExtra = false;
    let remaining = 45;
    let total = 45;

    setTurnTimer({
      position: PlayerPosition.SOUTH,
      rawPosition: PlayerPosition.SOUTH,
      remainingSec: remaining,
      totalSec: total,
      isExtraTime: false,
    });

    const intervalId = setInterval(() => {
      remaining -= 1;

      if (!isExtra && remaining <= 0) {
        // Activate 15s Extra Time
        isExtra = true;
        total = 15;
        remaining = 15;
      } else if (isExtra && remaining <= 0) {
        // Total 60s AFK timeout expired
        clearInterval(intervalId);
        setTurnTimer(null);

        // Auto move for South
        if (gameState.status === GameStatus.BIDDING) {
          handleSubmitBid(1);
        } else if (gameState.status === GameStatus.PLAYING) {
          const currentLegal = controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
          if (currentLegal.length > 0) {
            handlePlayCard(currentLegal[0]);
          }
        }
        return;
      }

      if (isExtra && remaining <= 5 && remaining > 0 && !isMuted) {
        soundManager.play('tick');
      }

      setTurnTimer({
        position: PlayerPosition.SOUTH,
        rawPosition: PlayerPosition.SOUTH,
        remainingSec: remaining,
        totalSec: total,
        isExtraTime: isExtra,
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
      setTurnTimer(null);
    };
  }, [gameState.mode, gameState.status, gameState.currentPlayer, isMuted, controller]);

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
    return controller.getLegalMovesForPlayer(PlayerPosition.SOUTH);
  }, [gameState, controller, isTrickPauseActive]);

  // Bot Turn Automation Loop with Natural Presentation Delay (Only for OFFLINE_BOTS)
  useEffect(() => {
    if (gameState.mode !== GameMode.OFFLINE_BOTS) {
      return;
    }

    let timerId: NodeJS.Timeout | null = null;
    const botBidDelay = settings.gameSpeed === 'fast' ? 200 : 550;
    const botPlayDelay = settings.gameSpeed === 'fast' ? 250 : 650;

    // 1. Bot Bidding Turn
    if (gameState.status === GameStatus.BIDDING) {
      if (controller.isBotPlayer(gameState.currentPlayer)) {
        timerId = setTimeout(() => {
          controller.stepBotTurn();
        }, botBidDelay);
      }
    }

    // 2. Bot Card Play Turn
    else if (gameState.status === GameStatus.PLAYING) {
      if (controller.isBotPlayer(gameState.currentPlayer)) {
        const isNewTrickLead =
          gameState.currentTrick.cards.length === 0 && gameState.completedTricks.length > 0;
        const delay = isNewTrickLead ? Math.max(botPlayDelay, 800) : botPlayDelay;

        timerId = setTimeout(() => {
          controller.stepBotTurn();
        }, delay);
      }
    }

    // 3. Round Ended Scoring Completion
    else if (gameState.status === GameStatus.ROUND_ENDED) {
      const alreadyScored = gameState.roundScores.some(
        (r) => r.roundNumber === gameState.currentRound
      );
      if (!alreadyScored) {
        timerId = setTimeout(() => {
          controller.completeRound();
        }, 800);
      }
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [
    gameState.mode,
    gameState.status,
    gameState.currentPlayer,
    gameState.currentRound,
    gameState.currentTrick.cards.length,
    gameState.roundScores.length,
    controller,
    settings.gameSpeed,
  ]);

  // Persistence & Active Match Synchronization
  useEffect(() => {
    if (gameState.status === GameStatus.MATCH_FINISHED && gameState.matchResult) {
      sharedHistoryService.recordMatchFinished(gameState, PlayerPosition.SOUTH);
      sharedActiveGameService.clearActiveGame();
    } else if (gameState.status !== GameStatus.IDLE && gameState.mode === GameMode.OFFLINE_BOTS) {
      sharedActiveGameService.saveActiveGame(gameState);
    }
  }, [gameState]);

  // Check for saved in-progress match in storage
  const checkSavedGame = useCallback(async () => {
    const saved = await sharedActiveGameService.loadActiveGame();
    if (saved) {
      setHasSavedGame(true);
      setSavedGameRound(saved.currentRound);
    } else {
      setHasSavedGame(false);
      setSavedGameRound(undefined);
    }
  }, []);

  useEffect(() => {
    checkSavedGame();
  }, [checkSavedGame, gameState.status]);

  // Listen for re-bid events from offline game controller
  useEffect(() => {
    const unsubRebid = controller.onRebid((_totalBids, message) => {
      soundManager.play('warning');
      setToast({
        id: Date.now().toString(),
        message,
        type: 'warning',
      });
    });
    return () => {
      unsubRebid();
    };
  }, [controller]);

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

    // Disconnect socket and leave room if multiplayer is active
    if (gameState.mode === GameMode.ONLINE_MULTIPLAYER || sharedMultiplayerClient.isConnected() || roomCode) {
      sharedMultiplayerClient.leaveRoom();
      sharedMultiplayerClient.disconnect();
    }

    // Clean up active saved game caches so no match persists in memory/storage
    sharedActiveGameService.clearActiveGame();
    controller.clearSavedGame();

    // Reset local game controller and shared store state to fresh IDLE state immediately
    controller.initMatch(GameMode.OFFLINE_BOTS, false);
    sharedGameStore.setState((prev) => ({
      ...prev,
      status: GameStatus.IDLE,
      mode: GameMode.OFFLINE_BOTS,
    }));

    setHasSavedGame(false);
    setSavedGameRound(undefined);
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
      setIsGameModeOpen(false);
      setIsRoomLobbyOpen(false);
      setIsHomeOpen(true);
    }
  }, [gameState.mode, roomCode, controller, pendingExitAction]);

  const handleCancelLeaveMatch = useCallback(() => {
    soundManager.play('click');
    setIsLeaveMatchModalOpen(false);
    setPendingExitAction(null);
  }, []);

  // User Actions
  const handleStartNewMatch = useCallback((totalRounds: number = 5) => {
    if (gameState.mode === GameMode.ONLINE_MULTIPLAYER) {
      sharedMultiplayerClient.leaveRoom();
    }
    controller.startNewMatch(GameMode.OFFLINE_BOTS, false, totalRounds);
    sharedActiveGameService.clearActiveGame();
    setIsHomeOpen(false);
    setIsFinalResultOpen(false);
    setIsHistoryOpen(false);
    setIsStatisticsOpen(false);
    setIsGameModeOpen(false);
    setIsRoomLobbyOpen(false);
  }, [controller, gameState.mode]);

  const handlePlayAgain = useCallback(() => {
    if (gameState.mode === GameMode.ONLINE_MULTIPLAYER) {
      if (isHost) {
        sharedMultiplayerClient.rematch();
      } else {
        setToast({
          id: Date.now().toString(),
          message: 'Waiting for room host to start the rematch...',
          type: 'info',
        });
      }
    } else {
      handleStartNewMatch(gameState.config?.totalRounds || 5);
    }
  }, [gameState.mode, gameState.config?.totalRounds, isHost, handleStartNewMatch]);

  const handleSelectSolo = useCallback(
    (difficulty: BotDifficulty, totalRounds: 5 | 10) => {
      guardActiveMatch(() => {
        setBotDifficulty(difficulty);
        setIsGameModeOpen(false);
        handleStartNewMatch(totalRounds);
      });
    },
    [guardActiveMatch, handleStartNewMatch]
  );

  const handleSelectFriends = useCallback(() => {
    guardActiveMatch(() => {
      setIsGameModeOpen(false);
      setRoomLobbyTab('create');
      setIsRoomLobbyOpen(true);
    });
  }, [guardActiveMatch]);

  const handleStartRoomMatch = useCallback(
    (_roomCode: string, _isHost: boolean, _autoFillBots: boolean) => {
      setIsRoomLobbyOpen(false);
      setIsHomeOpen(false);
      setIsFinalResultOpen(false);
      setIsGameModeOpen(false);
    },
    []
  );

  const handleResumeGame = useCallback(async () => {
    if (gameState.status !== GameStatus.IDLE) {
      setIsHomeOpen(false);
      return;
    }
    const saved = await sharedActiveGameService.loadActiveGame();
    if (saved) {
      if (typeof sharedGameStore.restore === 'function') {
        sharedGameStore.restore(saved);
      } else {
        sharedGameStore.setState(() => saved);
      }
      setIsHomeOpen(false);
    }
  }, [gameState.status]);

  const handleNextRound = useCallback(() => {
    if (gameState.mode === GameMode.ONLINE_MULTIPLAYER) {
      sharedMultiplayerClient.nextRound();
    } else {
      controller.nextRound();
    }
  }, [controller, gameState.mode]);

  const handlePlayCard = useCallback(
    (card: Card) => {
      if (isTrickPauseActive) {
        return;
      }
      if (gameState.mode === GameMode.ONLINE_MULTIPLAYER) {
        sharedMultiplayerClient.playCard(card);
      } else {
        controller.playCard(PlayerPosition.SOUTH, card);
      }
    },
    [controller, gameState.mode, isTrickPauseActive]
  );

  const handleSubmitBid = useCallback(
    (bid: number) => {
      if (gameState.mode === GameMode.ONLINE_MULTIPLAYER) {
        sharedMultiplayerClient.submitBid(bid);
      } else {
        controller.submitBid(PlayerPosition.SOUTH, bid);
      }
    },
    [controller, gameState.mode]
  );

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
        onStartNewGame={() => guardActiveMatch(handleStartNewMatch)}
        onOpenTableMenu={() => setIsTableMenuOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenModeSelect={() => guardActiveMatch(() => setIsGameModeOpen(true))}
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
                  onClick={() => guardActiveMatch(() => setIsGameModeOpen(true))}
                  className="w-full px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border border-amber-800/70 transition-all flex items-center gap-2 text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Game Modes</span>
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
                  <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Career Stats</span>
                </button>
              </div>
            </div>

            {/* Quick Match Info Badge */}
            <div className="p-3 rounded-2xl bg-stone-900/70 border border-stone-800/80 shadow-xs backdrop-blur-md">
              <div className="text-[10px] font-mono uppercase text-stone-400 tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Call Break Rules</span>
              </div>
              <ul className="text-[11px] text-stone-400 space-y-1 font-sans">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>Spades ♠ are fixed trump</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>Must follow lead suit</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>Must play higher if able</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Card: Round Summary */}
          <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800/60 text-[11px] text-stone-400 flex items-center justify-between">
            <span className="font-mono">Match Status</span>
            <span className="font-bold text-emerald-400 font-mono">
              {gameState.status === GameStatus.BIDDING
                ? 'Bidding'
                : gameState.status === GameStatus.PLAYING
                ? 'Playing'
                : 'In Progress'}
            </span>
          </div>
        </aside>

        {/* Center Main Playing Table */}
        <main className="relative flex-1 w-full max-w-4xl min-h-0 flex flex-col items-center justify-center overflow-hidden">
          {/* Toast Notification Banner */}
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-50 px-3.5 sm:px-4 py-1.5 rounded-full bg-stone-900/95 border border-emerald-400/60 text-stone-100 text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md ring-1 ring-emerald-400/30 max-w-[90vw] text-center"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <GameTable
            state={gameState}
            legalMoves={legalMoves}
            onPlayCard={handlePlayCard}
            onSubmitBid={handleSubmitBid}
            ruleCoachEnabled={settings.ruleCoachEnabled}
            turnTimer={turnTimer}
          />
        </main>

        {/* Right Side Rail (Desktop only: Match Controls & System) */}
        <aside className="hidden lg:flex flex-col justify-between w-44 xl:w-52 shrink-0 py-1 select-none">
          <div className="space-y-2">
            <div className="p-3 rounded-2xl bg-stone-900/90 border border-stone-800/90 shadow-md backdrop-blur-md">
              <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-stone-400" />
                <span>Controls</span>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  id="btn-side-new-game"
                  onClick={() => guardActiveMatch(handleStartNewMatch)}
                  className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold transition-all flex items-center gap-2 text-xs cursor-pointer shadow-md shadow-emerald-950/40"
                  title="Start Fresh Match"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New Match</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    guardActiveMatch(() => {
                      setRoomLobbyTab('create');
                      setIsRoomLobbyOpen(true);
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-stone-950 font-extrabold transition-all flex items-center gap-2 text-xs cursor-pointer shadow-sm"
                  title="Create or Join Private Table"
                >
                  <Users className="w-3.5 h-3.5 text-stone-950" />
                  <span>Play with Friends</span>
                </button>

                <button
                  type="button"
                  id="btn-side-sound"
                  onClick={toggleMute}
                  className={`w-full px-3 py-2 rounded-xl border transition-all flex items-center justify-between text-xs font-medium cursor-pointer shadow-xs ${
                    isMuted
                      ? 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border-rose-800/70'
                      : 'bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border-stone-700/70'
                  }`}
                  title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                >
                  <span className="flex items-center gap-2">
                    {isMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Sound Effects</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase font-bold text-stone-400">
                    {isMuted ? 'Off' : 'On'}
                  </span>
                </button>

                <button
                  type="button"
                  id="btn-side-settings"
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/70 transition-all flex items-center gap-2 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <Settings className="w-3.5 h-3.5 text-stone-300" />
                  <span>Preferences</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTutorialOpen(true)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 text-stone-200 border border-stone-700/70 transition-all flex items-center gap-2 text-xs font-medium cursor-pointer shadow-xs"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span>How to Play</span>
                </button>
              </div>
            </div>

            {/* Diagnostics Quick Access */}
            <button
              type="button"
              id="btn-side-inspector"
              onClick={() => setIsInspectorOpen(true)}
              className="w-full p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/70 transition-colors flex items-center justify-between text-xs font-semibold cursor-pointer shadow-xs"
              title="System Diagnostics & Architecture Inspector"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Diagnostics</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400/80">150 Tests</span>
            </button>
          </div>

          {/* Engine Footer Tag */}
          <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800/60 text-[10px] font-mono text-stone-400 flex items-center justify-between">
            <span>Call Break Engine</span>
            <span className="text-emerald-400">Offline PWA</span>
          </div>
        </aside>
      </div>

      {/* Home / Lobby Screen Modal */}
      <HomeLobbyModal
        isOpen={isHomeOpen}
        onStartNewGame={() => guardActiveMatch(handleStartNewMatch)}
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
        onOpenGameMode={() => {
          setIsHomeOpen(false);
          guardActiveMatch(() => setIsGameModeOpen(true));
        }}
        hasActiveGame={gameState.status !== GameStatus.IDLE || hasSavedGame}
        activeGameRound={gameState.status !== GameStatus.IDLE ? gameState.currentRound : savedGameRound}
        onResumeGame={handleResumeGame}
      />

      {/* Game Mode Selection Modal (Solo vs Play with Friends) */}
      <GameModeModal
        isOpen={isGameModeOpen}
        onClose={() => setIsGameModeOpen(false)}
        onSelectSolo={handleSelectSolo}
        onSelectFriends={handleSelectFriends}
        currentDifficulty={botDifficulty}
      />

      {/* Play with Friends / Private Room Lobby Modal (Create / Join & WhatsApp Sharing) */}
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
        onStartNewGame={() => guardActiveMatch(handleStartNewMatch)}
      />

      {/* Player Statistics Modal */}
      <PlayerStatisticsModal
        isOpen={isStatisticsOpen}
        onClose={() => setIsStatisticsOpen(false)}
        onStartNewGame={() => guardActiveMatch(handleStartNewMatch)}
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
        onStartNewGame={() => guardActiveMatch(handleStartNewMatch)}
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
        onStartNewMatch={handleStartNewMatch}
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
        onOpenModes={() => {
          setIsTableMenuOpen(false);
          guardActiveMatch(() => setIsGameModeOpen(true));
        }}
        onOpenSettings={() => {
          setIsTableMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        onStartNewGame={() => {
          setIsTableMenuOpen(false);
          guardActiveMatch(handleStartNewMatch);
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
