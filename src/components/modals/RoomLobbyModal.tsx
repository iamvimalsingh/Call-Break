/**
 * Room Lobby Modal
 * Live Multiplayer Room Lobby with WebSocket synchronization.
 * Supports creating private rooms (6-digit code, WhatsApp invite, live seat occupancy)
 * and joining rooms (code input, clipboard paste, real-time waiting lobby).
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PlusCircle,
  LogIn,
  Copy,
  Check,
  Share2,
  Users,
  Bot,
  UserCheck,
  Crown,
  ChevronLeft,
  X,
  Play,
  ClipboardPaste,
  Loader2,
  LogOut,
  RefreshCw,
  Edit3,
  Pencil,
} from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';
import {
  sharedMultiplayerClient,
  getPreferredRoomId,
  setPreferredRoomId,
} from '../../services/multiplayer/MultiplayerClient';
import { ActiveTableSummary, ConnectionState, RoomParticipant, RoomState } from '../../models/multiplayer';
import { PlayerPosition } from '../../models/player';

export interface RoomLobbyModalProps {
  isOpen: boolean;
  initialTab?: 'create' | 'join';
  initialRoomCode?: string;
  prefilledRoomCode?: string;
  onClose: () => void;
  onBackToModes?: () => void;
  onStartRoomMatch: (roomCode: string, isHost: boolean, autoFillBots: boolean) => void;
}

export function generateRoomCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${num}`;
}

export const RoomLobbyModal: React.FC<RoomLobbyModalProps> = ({
  isOpen,
  initialTab = 'create',
  initialRoomCode = '',
  prefilledRoomCode = '',
  onClose,
  onBackToModes,
  onStartRoomMatch,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialTab);
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('cb_player_name') || '';
    } catch {
      return '';
    }
  });
  const [roomCode, setRoomCode] = useState<string>(() => {
    const preferred = getPreferredRoomId();
    if (preferred && preferred.trim().length > 0) {
      return preferred.trim().toUpperCase();
    }
    return generateRoomCode();
  });
  const [joinInputCode, setJoinInputCode] = useState<string>(initialRoomCode || prefilledRoomCode || '');
  const [copied, setCopied] = useState(false);
  const [autoFillBots, setAutoFillBots] = useState(true);
  const [totalRounds, setTotalRounds] = useState<5 | 10>(5);
  const [editingSeat, setEditingSeat] = useState<PlayerPosition | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [pendingApprovalMsg, setPendingApprovalMsg] = useState<string | null>(null);
  const [showActiveTables, setShowActiveTables] = useState(true);
  const [activeTables, setActiveTables] = useState<ActiveTableSummary[]>([]);
  const [isLoadingActiveTables, setIsLoadingActiveTables] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(() =>
    sharedMultiplayerClient.getRoomState()
  );
  const [hasJoinedRoom, setHasJoinedRoom] = useState<boolean>(() => {
    const existing = sharedMultiplayerClient.getRoomState();
    return Boolean(existing && existing.roomCode);
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    sharedMultiplayerClient.getConnectionState()
  );
  const [connectionError, setConnectionError] = useState<string | null>(() =>
    sharedMultiplayerClient.getConnectionError()
  );

  const autoFillBotsRef = useRef(autoFillBots);
  autoFillBotsRef.current = autoFillBots;

  const onStartRoomMatchRef = useRef(onStartRoomMatch);
  onStartRoomMatchRef.current = onStartRoomMatch;

  const handlePlayerNameChange = (val: string) => {
    setPlayerName(val);
    try {
      localStorage.setItem('cb_player_name', val);
    } catch {
      // ignore
    }
  };

  const handleStartSeatRename = (pos: PlayerPosition, currentName: string) => {
    setEditingSeat(pos);
    setEditingName(currentName);
    soundManager.play('click');
  };

  const handleSaveSeatRename = (pos: PlayerPosition) => {
    const clean = editingName.trim();
    if (pos === PlayerPosition.SOUTH && clean) {
      handlePlayerNameChange(clean);
    }
    sharedMultiplayerClient.renameSeat(pos, clean);
    setEditingSeat(null);
    soundManager.play('click');
  };

  // Connect to WebSocket server on modal open
  useEffect(() => {
    if (!isOpen) {
      setHasJoinedRoom(false);
      setJoinError(null);
      return;
    }

    if (showActiveTables) {
      setIsLoadingActiveTables(true);
      sharedMultiplayerClient.requestActiveRooms();
    }

    const currentRoom = sharedMultiplayerClient.getRoomState();
    if (currentRoom && currentRoom.roomCode) {
      setRoomState(currentRoom);
      setRoomCode(currentRoom.roomCode);
      setHasJoinedRoom(true);
      if (currentRoom.totalRounds) {
        setTotalRounds(currentRoom.totalRounds === 10 ? 10 : 5);
      }
    }

    sharedMultiplayerClient.connect().catch((err) => {
      console.error('Failed to connect to multiplayer server:', err);
    });

    const unsubConn = sharedMultiplayerClient.onConnectionState((state, err) => {
      setConnectionState(state);
      setConnectionError(err);
      if (state === 'OPEN') {
        setJoinError(null);
        if (showActiveTables) {
          setIsLoadingActiveTables(true);
          sharedMultiplayerClient.requestActiveRooms();
        }
      }
    });

    const unsubRoom = sharedMultiplayerClient.onRoomState((state) => {
      setRoomState(state);
      setRoomCode(state.roomCode);
      if (state.totalRounds) {
        setTotalRounds(state.totalRounds === 10 ? 10 : 5);
      }
      setIsJoining(false);
      setHasJoinedRoom(true);
      setJoinError(null);
      setPendingApprovalMsg(null);
      if (state.hostId === state.myClientId || activeTab === 'create') {
        // Only after successful room creation: save the created custom Room ID
        setPreferredRoomId(state.roomCode);
      }
    });

    const unsubGameStarted = sharedMultiplayerClient.onGameStarted((code) => {
      soundManager.play('deal');
      const latestRoom = sharedMultiplayerClient.getRoomState();
      const isHostNow = latestRoom
        ? latestRoom.hostId === latestRoom.myClientId ||
          latestRoom.players.find((p) => p.id === latestRoom.myClientId)?.isHost === true
        : activeTab === 'create';
      onStartRoomMatchRef.current(code, isHostNow, autoFillBotsRef.current);
    });

    const unsubError = sharedMultiplayerClient.onError((err) => {
      let msg = err.message || 'Failed to join room';
      if (
        err.code === 'ROOM_NOT_FOUND' ||
        err.message?.toLowerCase().includes('not found') ||
        err.message?.toLowerCase().includes('no active table')
      ) {
        msg = 'Table not found. Please check the Room ID.';
      } else if (err.code === 'ROOM_ALREADY_EXISTS') {
        msg = err.message || 'Room ID already active. Please choose another Room ID.';
      }
      setJoinError(msg);
      setIsJoining(false);
      setPendingApprovalMsg(null);
      setHasJoinedRoom(false);
      soundManager.play('warning');
    });

    const unsubJoinStatus = sharedMultiplayerClient.onJoinRequestStatus((statusPayload) => {
      if (statusPayload.status === 'PENDING') {
        setIsJoining(true);
        setPendingApprovalMsg(statusPayload.message || 'Waiting for table host to accept your request...');
      } else if (statusPayload.status === 'ACCEPTED') {
        setIsJoining(false);
        setPendingApprovalMsg(null);
        setHasJoinedRoom(true);
      } else if (statusPayload.status === 'DECLINED') {
        setIsJoining(false);
        setPendingApprovalMsg(null);
        setJoinError(statusPayload.message || 'Host declined your join request.');
      }
    });

    const unsubActiveRooms = sharedMultiplayerClient.onActiveRoomsList((tables) => {
      setActiveTables(tables);
      setIsLoadingActiveTables(false);
    });

    return () => {
      unsubConn();
      unsubRoom();
      unsubGameStarted();
      unsubError();
      unsubJoinStatus();
      unsubActiveRooms();
    };
  }, [isOpen, activeTab]);

  // Sync initial props
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    const code = initialRoomCode || prefilledRoomCode;
    if (code) {
      const cleanCode = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      setJoinInputCode(cleanCode);
      setActiveTab('join');
    }
  }, [initialTab, initialRoomCode, prefilledRoomCode, isOpen]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://callbreak.app';
  const joinLink = `${currentUrl}?room=${roomCode}`;
  const inviteMessage = `Let's play Call Break together! Tap the link to join my table: ${joinLink} (Room ID: ${roomCode})`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`;

  const handleRetryConnection = () => {
    soundManager.play('click');
    setJoinError(null);
    sharedMultiplayerClient
      .connect()
      .catch((err) => {
        console.error('Retry connection error:', err);
      });
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(roomCode);
        setCopied(true);
        soundManager.play('click');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handlePasteCode = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        const clean = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (clean) {
          setJoinInputCode(clean.slice(0, 10));
          setJoinError(null);
          soundManager.play('click');
        }
      }
    } catch {
      // Clipboard fallback
    }
  };

  const handleApplyCustomRoomCode = (customCode?: string) => {
    if (connectionState !== 'OPEN') {
      setJoinError('Cannot create table: Server connection is offline or reconnecting.');
      soundManager.play('warning');
      return;
    }
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setJoinError('Please enter your name.');
      soundManager.play('warning');
      return;
    }
    const raw = customCode !== undefined ? customCode : roomCode;
    const clean = raw.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean && (clean.length < 3 || clean.length > 10)) {
      setJoinError('Room ID must be between 3 and 10 alphanumeric characters.');
      soundManager.play('warning');
      return;
    }
    setJoinError(null);
    if (clean) {
      setRoomCode(clean);
    }
    soundManager.play('click');
    sharedMultiplayerClient.createRoom(trimmedName, clean || undefined);
  };

  const handleRegenerateCode = () => {
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    setJoinError(null);
    soundManager.play('deal');
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (connectionState !== 'OPEN') {
      setJoinError('Cannot join table: Server connection is offline or reconnecting.');
      soundManager.play('warning');
      return;
    }
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setJoinError('Please enter your name.');
      soundManager.play('warning');
      return;
    }
    const clean = joinInputCode.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 3 || clean.length > 10) {
      setJoinError('Please enter a valid Room ID (3-10 characters).');
      soundManager.play('warning');
      return;
    }
    setJoinError(null);
    setIsJoining(true);
    soundManager.play('deal');
    sharedMultiplayerClient.joinRoom(clean, trimmedName);
  };

  const handleToggleActiveTables = () => {
    soundManager.play('click');
    const nextState = !showActiveTables;
    setShowActiveTables(nextState);
    if (nextState) {
      setIsLoadingActiveTables(true);
      sharedMultiplayerClient.requestActiveRooms();
    }
  };

  const handleRefreshActiveTables = () => {
    soundManager.play('click');
    setIsLoadingActiveTables(true);
    sharedMultiplayerClient.requestActiveRooms();
  };

  const handleSelectActiveTable = (code: string) => {
    soundManager.play('click');
    setJoinInputCode(code);
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setJoinError('Please enter your name.');
      soundManager.play('warning');
      return;
    }
    setJoinError(null);
    setIsJoining(true);
    soundManager.play('deal');
    sharedMultiplayerClient.joinRoom(code, trimmedName);
  };

  const handleStartCreatedRoom = () => {
    if (connectionState !== 'OPEN') return;
    soundManager.play('deal');
    sharedMultiplayerClient.startMatch(autoFillBots, totalRounds);
  };

  const handleLeaveLobby = () => {
    sharedMultiplayerClient.leaveRoom();
    setHasJoinedRoom(false);
    setRoomState(null);
    setIsJoining(false);
    setJoinError(null);
    setPendingApprovalMsg(null);
    soundManager.play('click');
  };

  // Helper to find player at given seat in roomState
  const getPlayerAtPosition = (pos: PlayerPosition): RoomParticipant | undefined => {
    if (!roomState?.players) return undefined;
    return roomState.players.find((p) => p.position === pos);
  };

  const southPlayer = getPlayerAtPosition(PlayerPosition.SOUTH);
  const westPlayer = getPlayerAtPosition(PlayerPosition.WEST);
  const northPlayer = getPlayerAtPosition(PlayerPosition.NORTH);
  const eastPlayer = getPlayerAtPosition(PlayerPosition.EAST);

  const totalConnected = roomState?.players.length ?? 1;
  const isHost =
    roomState
      ? roomState.hostId === roomState.myClientId ||
        roomState.players.find((p) => p.id === roomState.myClientId)?.isHost === true
      : activeTab === 'create';

  return (
    <AnimatePresence>
      <div
        id="modal-room-lobby-backdrop"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto select-none pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onClick={onClose}
      >
        <motion.div
          id="modal-room-lobby-card"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 15 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={transitions.springFast}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[min(90dvh,880px)] bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-2xl sm:rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-col text-left relative overflow-hidden ring-1 ring-white/10"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-20 -left-20 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Fixed/Sticky Header Area: Navigation Bar, Connection Status, and Tabs */}
          <div className="shrink-0 p-4 sm:p-6 pb-3 sm:pb-4 border-b border-stone-800/80 bg-stone-900/95 backdrop-blur-sm z-10 space-y-3 sm:space-y-4">
            {/* Navigation Bar */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                id="btn-back-to-mode-select"
                onClick={() => {
                  soundManager.play('click');
                  if (hasJoinedRoom) {
                    handleLeaveLobby();
                  } else if (onBackToModes) {
                    onBackToModes();
                  } else {
                    onClose();
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 border border-stone-700/60 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{hasJoinedRoom ? 'Leave Room' : 'Back to Lobby'}</span>
              </button>

              {/* Real Connection State Badge */}
              <div className="flex items-center gap-2">
                {connectionState === 'OPEN' && (
                  <span
                    id="status-badge-connected"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 font-mono text-[11px] font-bold"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Connected to Server</span>
                  </span>
                )}

                {connectionState === 'CONNECTING' && (
                  <span
                    id="status-badge-connecting"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 font-mono text-[11px] font-bold"
                  >
                    <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                    <span>Connecting to server...</span>
                  </span>
                )}

                {(connectionState === 'CLOSED' || connectionState === 'ERROR') && (
                  <button
                    type="button"
                    id="status-badge-disconnected"
                    onClick={handleRetryConnection}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 hover:bg-rose-900/80 border border-rose-700/60 text-rose-300 font-mono text-[11px] font-bold cursor-pointer transition-colors"
                    title="Click to reconnect"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Server Disconnected / Offline</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                id="btn-close-room-lobby"
                onClick={() => {
                  soundManager.play('click');
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Offline / Disconnected Notice Banner */}
            {(connectionState === 'CLOSED' || connectionState === 'ERROR') && (
              <div
                id="banner-server-offline"
                className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-between gap-3 text-rose-200 text-xs shadow-lg shadow-rose-950/40"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-rose-100">Server Disconnected / Offline</div>
                    <div className="text-[11px] text-rose-300 truncate">
                      {connectionError || 'Cannot connect to multiplayer WebSocket server.'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-retry-websocket"
                  onClick={handleRetryConnection}
                  className="px-3 py-1.5 rounded-xl bg-rose-800 hover:bg-rose-700 text-white font-bold text-xs shrink-0 cursor-pointer transition-colors shadow-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Tab Selection (only when not inside joined room) */}
            {!hasJoinedRoom && (
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-950/90 border border-stone-800/90">
                <button
                  type="button"
                  id="tab-btn-create-room"
                  onClick={() => {
                    soundManager.play('click');
                    setActiveTab('create');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'create'
                      ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/50'
                      : 'text-stone-400 hover:text-white hover:bg-stone-900/60'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Room</span>
                </button>

                <button
                  type="button"
                  id="tab-btn-join-room"
                  onClick={() => {
                    soundManager.play('click');
                    setActiveTab('join');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeTab === 'join'
                      ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950/50'
                      : 'text-stone-400 hover:text-white hover:bg-stone-900/60'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Join Room</span>
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 pt-3 sm:pt-4 space-y-4 touch-pan-y custom-scrollbar">

          {/* Tab Content: CREATE ROOM OR JOINED ROOM WAITING LOBBY */}
          {(activeTab === 'create' || hasJoinedRoom) && (
            <div className="space-y-4">
              {/* Player Name / Nickname Input for Host (if not joined yet) */}
              {!hasJoinedRoom && (
                <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-1.5">
                  <label htmlFor="input-host-name" className="block text-xs font-semibold text-stone-300">
                    Your Name / Nickname <span className="text-amber-400 font-semibold">*</span>:
                  </label>
                  <input
                    type="text"
                    id="input-host-name"
                    value={playerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      handlePlayerNameChange(val);
                    }}
                    placeholder="e.g. Rahul, Vimal"
                    maxLength={18}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-700 text-white text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 placeholder:text-stone-500"
                  />
                </div>
              )}

              {/* Room Code Card & Controls */}
              {!hasJoinedRoom ? (
                /* STATE 1: NEW TABLE DRAFT */
                <div className="p-4 rounded-2xl bg-stone-950/90 border border-amber-900/60 flex flex-col items-center text-center shadow-inner relative space-y-3">
                  <div className="w-full flex items-center justify-between px-1">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 font-bold">
                      Room ID / Code
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 font-medium">
                      New Table Draft
                    </span>
                  </div>

                  <div className="w-full space-y-2.5">
                    <input
                      type="text"
                      id="input-create-room-code"
                      value={roomCode}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                        setRoomCode(clean);
                        setJoinError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCustomRoomCode();
                        }
                      }}
                      placeholder="e.g. VIP888"
                      maxLength={10}
                      className="w-full px-3 py-2.5 rounded-xl bg-stone-900 border border-amber-700/60 text-amber-300 font-mono text-2xl sm:text-3xl font-black tracking-widest text-center focus:outline-hidden focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 uppercase placeholder:text-stone-600"
                    />

                    {/* Full-width Set Room ID Button below input for mobile ergonomic reliability */}
                    <button
                      type="button"
                      id="btn-apply-custom-room-code"
                      onClick={() => handleApplyCustomRoomCode()}
                      className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md shadow-amber-950/40"
                      title="Set Room ID & Create Table"
                    >
                      <PlusCircle className="w-4 h-4 text-stone-950 shrink-0" />
                      <span>Set Room ID</span>
                    </button>

                    {/* Secondary Generator */}
                    <div className="flex justify-center pt-0.5">
                      <button
                        type="button"
                        id="btn-regenerate-room-code"
                        onClick={handleRegenerateCode}
                        className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 text-xs font-mono cursor-pointer transition-colors flex items-center gap-1.5"
                        title="Generate a random candidate ID"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                        <span>Generate Random ID</span>
                      </button>
                    </div>
                  </div>

                  {joinError && activeTab === 'create' && (
                    <div
                      id="create-room-error"
                      className="w-full p-2.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 text-center"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{joinError}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* STATE 2: ACTIVE WAITING ROOM (IMMUTABLE ID, SHARE/COPY ACTIVE) */
                <>
                  <div className="p-4 rounded-2xl bg-stone-950/90 border border-amber-900/60 flex flex-col items-center text-center shadow-inner relative space-y-3">
                    <div className="w-full flex items-center justify-between px-1">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 font-bold">
                        Room ID / Code
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800/80 text-emerald-400 font-bold">
                        Active Table
                      </span>
                    </div>

                    <div className="w-full py-2.5 px-4 rounded-xl bg-stone-900/90 border border-amber-500/40 text-amber-300 font-mono text-2xl sm:text-3xl font-black tracking-widest text-center select-all">
                      {roomCode}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        id="btn-copy-room-code"
                        onClick={handleCopyCode}
                        className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-amber-400" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* WhatsApp Share Button - Only visible in Active Waiting Room */}
                  <a
                    id="btn-share-whatsapp"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => soundManager.play('click')}
                    className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-stone-950" />
                    <span>Invite Friends via WhatsApp</span>
                  </a>
                </>
              )}

              {/* Table Seats Preview */}
              <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-400 font-medium px-1">
                  <span>Table Seats (4 Players)</span>
                  <span className="font-mono text-[11px] text-emerald-400">
                    {totalConnected}/4 Ready {isHost && '• Click seat to rename'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Slot 1: South (Host) */}
                  <div
                    id="lobby-seat-south"
                    className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-300 shrink-0">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingSeat === PlayerPosition.SOUTH ? (
                          <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSeatRename(PlayerPosition.SOUTH);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-stone-900 border border-emerald-500 text-white text-xs sm:w-24 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSeatRename(PlayerPosition.SOUTH)}
                              className="shrink-0 p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer flex items-center justify-center min-w-[24px] min-h-[24px]"
                              title="Save name"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-white truncate text-xs">
                              {southPlayer?.name ?? (playerName.trim() || 'Host')}
                            </div>
                            <div className="text-[10px] text-emerald-300 font-mono">South • Host</div>
                          </>
                        )}
                      </div>
                    </div>
                    {isHost && editingSeat !== PlayerPosition.SOUTH && (
                      <button
                        type="button"
                        onClick={() => handleStartSeatRename(PlayerPosition.SOUTH, southPlayer?.name ?? (playerName.trim() || 'Host'))}
                        className="p-1 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white cursor-pointer transition-colors shrink-0"
                        title="Rename South"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Slot 2: West */}
                  <div
                    id="lobby-seat-west"
                    className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
                      westPlayer
                        ? 'bg-emerald-950/60 border border-emerald-700/60'
                        : 'bg-stone-900/80 border border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          westPlayer ? 'bg-emerald-800 text-emerald-300' : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {westPlayer ? <UserCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingSeat === PlayerPosition.WEST ? (
                          <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSeatRename(PlayerPosition.WEST);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-stone-900 border border-amber-500 text-white text-xs sm:w-24 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSeatRename(PlayerPosition.WEST)}
                              className="shrink-0 p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer flex items-center justify-center min-w-[24px] min-h-[24px]"
                              title="Save name"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className={`font-bold truncate text-xs ${westPlayer ? 'text-white' : 'text-stone-400'}`}>
                              {westPlayer ? westPlayer.name : 'Friend 1'}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono">
                              West {westPlayer ? '• Ready' : '• Bot if empty'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {isHost && editingSeat !== PlayerPosition.WEST && (
                      <div className="flex items-center gap-1 shrink-0">
                        {westPlayer && !westPlayer.isBot && westPlayer.id !== roomState?.myClientId && (
                          <button
                            type="button"
                            id="btn-transfer-host-west"
                            onClick={() => {
                              soundManager.play('click');
                              sharedMultiplayerClient.transferHost(PlayerPosition.WEST);
                            }}
                            className="p-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 cursor-pointer transition-colors"
                            title="👑 Transfer Host Role to West"
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartSeatRename(PlayerPosition.WEST, westPlayer?.name || 'Friend 1')}
                          className="p-1 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white cursor-pointer transition-colors"
                          title="Rename West"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Slot 3: North */}
                  <div
                    id="lobby-seat-north"
                    className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
                      northPlayer
                        ? 'bg-emerald-950/60 border border-emerald-700/60'
                        : 'bg-stone-900/80 border border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          northPlayer ? 'bg-emerald-800 text-emerald-300' : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {northPlayer ? <UserCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingSeat === PlayerPosition.NORTH ? (
                          <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSeatRename(PlayerPosition.NORTH);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-stone-900 border border-amber-500 text-white text-xs sm:w-24 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSeatRename(PlayerPosition.NORTH)}
                              className="shrink-0 p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer flex items-center justify-center min-w-[24px] min-h-[24px]"
                              title="Save name"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className={`font-bold truncate text-xs ${northPlayer ? 'text-white' : 'text-stone-400'}`}>
                              {northPlayer ? northPlayer.name : 'Friend 2'}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono">
                              North {northPlayer ? '• Ready' : '• Bot if empty'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {isHost && editingSeat !== PlayerPosition.NORTH && (
                      <div className="flex items-center gap-1 shrink-0">
                        {northPlayer && !northPlayer.isBot && northPlayer.id !== roomState?.myClientId && (
                          <button
                            type="button"
                            id="btn-transfer-host-north"
                            onClick={() => {
                              soundManager.play('click');
                              sharedMultiplayerClient.transferHost(PlayerPosition.NORTH);
                            }}
                            className="p-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 cursor-pointer transition-colors"
                            title="👑 Transfer Host Role to North"
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartSeatRename(PlayerPosition.NORTH, northPlayer?.name || 'Friend 2')}
                          className="p-1 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white cursor-pointer transition-colors"
                          title="Rename North"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Slot 4: East */}
                  <div
                    id="lobby-seat-east"
                    className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
                      eastPlayer
                        ? 'bg-emerald-950/60 border border-emerald-700/60'
                        : 'bg-stone-900/80 border border-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          eastPlayer ? 'bg-emerald-800 text-emerald-300' : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {eastPlayer ? <UserCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingSeat === PlayerPosition.EAST ? (
                          <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSeatRename(PlayerPosition.EAST);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-stone-900 border border-amber-500 text-white text-xs sm:w-24 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSeatRename(PlayerPosition.EAST)}
                              className="shrink-0 p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer flex items-center justify-center min-w-[24px] min-h-[24px]"
                              title="Save name"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className={`font-bold truncate text-xs ${eastPlayer ? 'text-white' : 'text-stone-400'}`}>
                              {eastPlayer ? eastPlayer.name : 'Friend 3'}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono">
                              East {eastPlayer ? '• Ready' : '• Bot if empty'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {isHost && editingSeat !== PlayerPosition.EAST && (
                      <div className="flex items-center gap-1 shrink-0">
                        {eastPlayer && !eastPlayer.isBot && eastPlayer.id !== roomState?.myClientId && (
                          <button
                            type="button"
                            id="btn-transfer-host-east"
                            onClick={() => {
                              soundManager.play('click');
                              sharedMultiplayerClient.transferHost(PlayerPosition.EAST);
                            }}
                            className="p-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 cursor-pointer transition-colors"
                            title="👑 Transfer Host Role to East"
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartSeatRename(PlayerPosition.EAST, eastPlayer?.name || 'Friend 3')}
                          className="p-1 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white cursor-pointer transition-colors"
                          title="Rename East"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Length Selector (Host only) */}
                {isHost && (
                  <div className="pt-2 border-t border-stone-800/80 px-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider font-semibold">
                        Match Length
                      </span>
                      <span className="text-[11px] text-amber-400 font-bold font-mono">
                        {totalRounds === 10 ? '10 Rounds' : '5 Rounds'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        id="btn-room-rounds-5"
                        onClick={() => {
                          soundManager.play('click');
                          setTotalRounds(5);
                        }}
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          totalRounds === 5
                            ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-sm ring-1 ring-emerald-500/40'
                            : 'bg-stone-900/70 border-stone-800 text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
                        }`}
                      >
                        <span>5 Rounds (Standard)</span>
                      </button>
                      <button
                        type="button"
                        id="btn-room-rounds-10"
                        onClick={() => {
                          soundManager.play('click');
                          setTotalRounds(10);
                        }}
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          totalRounds === 10
                            ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                            : 'bg-stone-900/70 border-stone-800 text-stone-400 hover:bg-stone-800/80 hover:text-stone-200'
                        }`}
                      >
                        <span>10 Rounds (Championship)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Auto-fill Toggle (Host only) */}
                {isHost && (
                  <label className="flex items-center justify-between pt-2 border-t border-stone-800/80 px-1 cursor-pointer">
                    <span className="text-xs text-stone-300 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Auto-fill missing seats with AI bots</span>
                    </span>
                    <input
                      type="checkbox"
                      id="chk-autofill-bots"
                      checked={autoFillBots}
                      onChange={(e) => setAutoFillBots(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 bg-stone-800 border-stone-700 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>
                )}
              </div>

              {/* Action Button: Start for Host or Waiting banner for Joined Guest (only after room creation) */}
              {hasJoinedRoom ? (
                isHost ? (
                  <button
                    type="button"
                    id="btn-start-created-table"
                    onClick={handleStartCreatedRoom}
                    disabled={connectionState !== 'OPEN'}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 fill-current text-white" />
                    <span>▶ Start Game (Fill with Bots)</span>
                  </button>
                ) : (
                  <div
                    id="banner-guest-waiting"
                    className="p-3.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center gap-2 text-stone-300 text-xs font-semibold"
                  >
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    <span>Waiting for host to start the game</span>
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* Tab Content: JOIN ROOM FORM */}
          {activeTab === 'join' && !hasJoinedRoom && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                {/* Player Name / Nickname Input for Joiner */}
                <div className="space-y-1.5 pb-2 border-b border-stone-800">
                  <label htmlFor="input-joiner-name" className="block text-xs font-semibold text-stone-300">
                    Your Name / Nickname <span className="text-amber-400 font-semibold">*</span>:
                  </label>
                  <input
                    type="text"
                    id="input-joiner-name"
                    value={playerName}
                    onChange={(e) => handlePlayerNameChange(e.target.value)}
                    placeholder="e.g. Priya, Rohit"
                    maxLength={18}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-white text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 placeholder:text-stone-500"
                  />
                </div>

                <label htmlFor="input-room-code" className="block text-xs font-semibold text-stone-300">
                  Enter Room ID:
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id="input-room-code"
                    value={joinInputCode}
                    onChange={(e) => {
                      setJoinInputCode(e.target.value.toUpperCase());
                      setJoinError(null);
                    }}
                    placeholder="e.g. VIMAL or 742918"
                    maxLength={10}
                    className="flex-1 px-4 py-3 rounded-xl bg-stone-900 border border-stone-700 text-white font-mono text-xl sm:text-2xl font-bold tracking-widest text-center focus:outline-hidden focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400 placeholder:text-stone-600 uppercase"
                    autoFocus
                  />

                  <button
                    type="button"
                    id="btn-paste-room-code"
                    onClick={handlePasteCode}
                    className="px-3.5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors shrink-0"
                    title="Paste from clipboard"
                  >
                    <ClipboardPaste className="w-4 h-4 text-amber-400" />
                    <span className="hidden xs:inline">Paste</span>
                  </button>
                </div>

                {pendingApprovalMsg && (
                  <div
                    id="join-pending-approval-banner"
                    className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2.5 text-xs text-amber-300 font-medium"
                  >
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                    <span>{pendingApprovalMsg}</span>
                  </div>
                )}

                {joinError && (
                  <p id="join-error-message" className="text-xs text-rose-400 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{joinError}</span>
                  </p>
                )}

                <p className="text-[11px] text-stone-400 font-sans">
                  Ask your friend who created the room to share their Room ID or WhatsApp invite link.
                </p>
              </div>

              {/* Submit Join */}
              <button
                type="submit"
                id="btn-submit-join-room"
                disabled={isJoining || connectionState !== 'OPEN'}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:from-amber-700 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/60 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 text-stone-950 animate-spin" />
                    <span>Connecting to Table...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-stone-950" />
                    <span>Join Friend's Table</span>
                  </>
                )}
              </button>

              {/* Active Tables Discovery Section */}
              <div className="pt-2 border-t border-stone-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    id="btn-see-active-tables"
                    onClick={handleToggleActiveTables}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors py-1"
                  >
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>{showActiveTables ? 'Hide Active Tables' : 'See Active Tables'}</span>
                  </button>

                  {showActiveTables && (
                    <button
                      type="button"
                      id="btn-refresh-active-tables"
                      onClick={handleRefreshActiveTables}
                      disabled={isLoadingActiveTables}
                      className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
                      title="Refresh active tables"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingActiveTables ? 'animate-spin text-amber-400' : ''}`} />
                    </button>
                  )}
                </div>

                {showActiveTables && (
                  <div id="active-tables-container" className="p-3 rounded-2xl bg-stone-950/90 border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-stone-400 font-semibold px-2 pb-1 border-b border-stone-800/80">
                      <span className="w-16">ID</span>
                      <span className="flex-1 text-left px-2">HOST</span>
                      <span className="w-16 text-center">HUMANS</span>
                      <span className="w-20 text-right">STATUS</span>
                    </div>

                    {isLoadingActiveTables && activeTables.length === 0 ? (
                      <div className="py-4 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        <span>Scanning active tables...</span>
                      </div>
                    ) : activeTables.length === 0 ? (
                      <div id="no-active-tables-msg" className="py-4 text-center text-xs text-stone-400">
                        No active tables available.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {activeTables.map((table) => (
                          <button
                            key={table.roomCode}
                            type="button"
                            id={`active-table-row-${table.roomCode}`}
                            onClick={() => handleSelectActiveTable(table.roomCode)}
                            className="w-full flex items-center justify-between px-2 py-2 rounded-xl bg-stone-900/80 hover:bg-amber-950/40 hover:border-amber-700/60 border border-stone-800 text-xs font-medium cursor-pointer transition-all text-left group"
                          >
                            <span className="w-16 font-mono font-bold text-amber-400 group-hover:text-amber-300">
                              {table.roomCode}
                            </span>
                            <span className="flex-1 text-left px-2 text-stone-200 truncate">
                              {table.hostName}
                            </span>
                            <span className="w-16 text-center font-mono text-stone-300">
                              {table.humanCount}/{table.totalSeats}
                            </span>
                            <span className="w-20 text-right">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  table.status === 'WAITING'
                                    ? 'bg-amber-950/80 border border-amber-600/60 text-amber-300'
                                    : 'bg-emerald-950/80 border border-emerald-600/60 text-emerald-300'
                                }`}
                              >
                                {table.status}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          )}

          {/* Footer note */}
          <div className="mt-4 pt-3 border-t border-stone-800/60 text-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <span className="text-[11px] text-stone-400 font-mono">
              Online Private Rooms • Authoritative Call Break Multiplayer
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  </AnimatePresence>
);
};
