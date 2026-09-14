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
} from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';
import { sharedMultiplayerClient } from '../../services/multiplayer/MultiplayerClient';
import { ConnectionState, RoomParticipant, RoomState } from '../../models/multiplayer';
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
  const [roomCode, setRoomCode] = useState<string>(() => generateRoomCode());
  const [joinInputCode, setJoinInputCode] = useState<string>(initialRoomCode || prefilledRoomCode || '');
  const [copied, setCopied] = useState(false);
  const [autoFillBots, setAutoFillBots] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
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

  // Connect to WebSocket server on modal open
  useEffect(() => {
    if (!isOpen) {
      setHasJoinedRoom(false);
      setJoinError(null);
      return;
    }

    sharedMultiplayerClient.connect().catch((err) => {
      console.error('Failed to connect to multiplayer server:', err);
    });

    const unsubConn = sharedMultiplayerClient.onConnectionState((state, err) => {
      setConnectionState(state);
      setConnectionError(err);
      if (state === 'OPEN') {
        setJoinError(null);
      }
    });

    const unsubRoom = sharedMultiplayerClient.onRoomState((state) => {
      setRoomState(state);
      setRoomCode(state.roomCode);
      if (activeTab === 'join' && isJoining) {
        setIsJoining(false);
        setHasJoinedRoom(true);
        setJoinError(null);
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
        msg = 'Table not found. Please check the 6-digit code.';
      }
      setJoinError(msg);
      setIsJoining(false);
      setHasJoinedRoom(false);
      soundManager.play('warning');
    });

    return () => {
      unsubConn();
      unsubRoom();
      unsubGameStarted();
      unsubError();
    };
  }, [isOpen, activeTab]);

  // Handle Tab Switch & Host Room Creation
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'create' && !hasJoinedRoom) {
      sharedMultiplayerClient.createRoom('Host Player (You)', roomCode);
    }
  }, [isOpen, activeTab, roomCode, hasJoinedRoom, connectionState]);

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
  const inviteMessage = `Let's play Call Break together! Tap the link to join my table: ${joinLink} (Room Code: ${roomCode})`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`;

  const handleRetryConnection = () => {
    soundManager.play('click');
    setJoinError(null);
    sharedMultiplayerClient
      .connect()
      .then(() => {
        if (activeTab === 'create') {
          sharedMultiplayerClient.createRoom('Host Player (You)', roomCode);
        }
      })
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
          setJoinInputCode(clean.slice(0, 8));
          setJoinError(null);
          soundManager.play('click');
        }
      }
    } catch {
      // Clipboard fallback
    }
  };

  const handleRegenerateCode = () => {
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    soundManager.play('deal');
    sharedMultiplayerClient.createRoom('Host Player (You)', newCode);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinInputCode.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 4) {
      setJoinError('Please enter a valid 6-digit room code');
      soundManager.play('warning');
      return;
    }
    setJoinError(null);
    setIsJoining(true);
    soundManager.play('deal');
    sharedMultiplayerClient.joinRoom(clean, 'Friend (You)');
  };

  const handleStartCreatedRoom = () => {
    soundManager.play('deal');
    sharedMultiplayerClient.startMatch(autoFillBots);
  };

  const handleLeaveLobby = () => {
    sharedMultiplayerClient.leaveRoom();
    setHasJoinedRoom(false);
    setRoomState(null);
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
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none"
        onClick={onClose}
      >
        <motion.div
          id="modal-room-lobby-card"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 15 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={transitions.springFast}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] p-5 sm:p-7 flex flex-col text-left relative overflow-hidden ring-1 ring-white/10"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-20 -left-20 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Navigation Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-800/90 mb-4">
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
              <span>{hasJoinedRoom ? 'Leave Room' : 'Game Modes'}</span>
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
              className="mb-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-between gap-3 text-rose-200 text-xs shadow-lg shadow-rose-950/40"
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
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-950/90 border border-stone-800/90 mb-5">
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

          {/* Tab Content: CREATE ROOM OR JOINED ROOM WAITING LOBBY */}
          {(activeTab === 'create' || hasJoinedRoom) && (
            <div className="space-y-4">
              {/* Room Code Card */}
              <div className="p-4 rounded-2xl bg-stone-950/90 border border-amber-900/60 flex flex-col items-center text-center shadow-inner relative">
                <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 font-bold mb-1">
                  Private Table Code
                </span>
                <div className="flex items-center gap-2 my-1">
                  <span
                    id="display-room-code"
                    className="font-mono text-3xl sm:text-4xl font-black text-amber-300 tracking-wider select-all"
                  >
                    {roomCode}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    id="btn-copy-room-code"
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors"
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

                  {isHost && (
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className="px-2.5 py-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 text-xs font-mono cursor-pointer transition-colors"
                      title="Generate another code"
                    >
                      New Code
                    </button>
                  )}
                </div>
              </div>

              {/* WhatsApp Share Button */}
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

              {/* Table Seats Preview */}
              <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-400 font-medium px-1">
                  <span>Table Seats (4 Players)</span>
                  <span className="font-mono text-[11px] text-emerald-400">
                    {totalConnected}/4 Ready
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Slot 1: South (Host) */}
                  <div
                    id="lobby-seat-south"
                    className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-800 flex items-center justify-center text-amber-300 shrink-0">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate text-xs">
                        {southPlayer?.name ?? 'Host Player'}
                      </div>
                      <div className="text-[10px] text-emerald-300 font-mono">South • Host</div>
                    </div>
                  </div>

                  {/* Slot 2: West */}
                  <div
                    id="lobby-seat-west"
                    className={`p-2.5 rounded-xl flex items-center gap-2 transition-all ${
                      westPlayer
                        ? 'bg-emerald-950/60 border border-emerald-700/60'
                        : 'bg-stone-900/80 border border-stone-800'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        westPlayer ? 'bg-emerald-800 text-emerald-300' : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {westPlayer ? <UserCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className={`font-bold truncate text-xs ${westPlayer ? 'text-white' : 'text-stone-400'}`}>
                        {westPlayer ? westPlayer.name : 'Waiting for friend...'}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        West {westPlayer ? '• Ready' : '• Bot if unfilled'}
                      </div>
                    </div>
                  </div>

                  {/* Slot 3: North */}
                  <div
                    id="lobby-seat-north"
                    className={`p-2.5 rounded-xl flex items-center gap-2 transition-all ${
                      northPlayer
                        ? 'bg-emerald-950/60 border border-emerald-700/60'
                        : 'bg-stone-900/80 border border-stone-800'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        northPlayer ? 'bg-emerald-800 text-emerald-300' : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {northPlayer ? <UserCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className={`font-bold truncate text-xs ${northPlayer ? 'text-white' : 'text-stone-400'}`}>
                        {northPlayer ? northPlayer.name : 'Waiting for friend...'}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        North {northPlayer ? '• Ready' : '• Bot if unfilled'}
                      </div>
                    </div>
                  </div>

                  {/* Slot 4: East */}
                  <div
                    id="lobby-seat-east"
                    className={`p-2.5 rounded-xl flex items-center gap-2 transition-all ${
                      eastPlayer
                        ? 'bg-emerald-950/60 border border-emerald-700/60'
                        : 'bg-stone-900/80 border border-stone-800'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        eastPlayer ? 'bg-emerald-800 text-emerald-300' : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {eastPlayer ? <UserCheck className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className={`font-bold truncate text-xs ${eastPlayer ? 'text-white' : 'text-stone-400'}`}>
                        {eastPlayer ? eastPlayer.name : 'Waiting for friend...'}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        East {eastPlayer ? '• Ready' : '• Bot if unfilled'}
                      </div>
                    </div>
                  </div>
                </div>

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

              {/* Action Button: Start for Host or Waiting banner for Joined Guest */}
              {isHost ? (
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
                  <span>Waiting for host to start...</span>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: JOIN ROOM FORM */}
          {activeTab === 'join' && !hasJoinedRoom && (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                <label htmlFor="input-room-code" className="block text-xs font-semibold text-stone-300">
                  Enter 6-Digit Room Code:
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
                    placeholder="e.g. 742918"
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

                {joinError && (
                  <p id="join-error-message" className="text-xs text-rose-400 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{joinError}</span>
                  </p>
                )}

                <p className="text-[11px] text-stone-400 font-sans">
                  Ask your friend who created the room to share their 6-digit code or WhatsApp invite link.
                </p>
              </div>

              {/* Submit Join */}
              <button
                type="submit"
                id="btn-submit-join-room"
                disabled={isJoining}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:from-amber-700 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/60 transition-all cursor-pointer disabled:opacity-50"
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
            </form>
          )}

          {/* Footer note */}
          <div className="mt-4 pt-3 border-t border-stone-800/60 text-center">
            <span className="text-[11px] text-stone-400 font-mono">
              Online Private Rooms • Authoritative Call Break Multiplayer
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
