/**
 * Table Menu Modal (☰)
 * Sleek, semi-transparent in-table drawer / modal providing fast access to:
 * - Resume Game
 * - Host Controls (Human → Bot, Transfer Host, Swap Seats, Rename Seat)
 * - Seat & Player Roster with Scores & Live Connection Status
 * - Sound & Haptic Toggle
 * - Call Break Rules Summary
 * - Scoreboard / Overview
 * - Leave Game (with exit guard)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Volume2,
  VolumeX,
  Vibrate,
  BookOpen,
  Trophy,
  LogOut,
  X,
  Share2,
  RotateCcw,
  Users,
  Settings,
  Crown,
  Bot,
  UserX,
  ArrowLeftRight,
  Edit2,
  Check,
} from 'lucide-react';
import { soundManager } from '../../core/sound/SoundManager';
import { useSound } from '../../core/sound/useSound';
import { useReducedMotion } from '../../core/animation/useReducedMotion';
import { transitions } from '../../core/animation/animationConfig';
import { GameState } from '../../models/gameState';
import { PlayerPosition, POSITION_ORDER } from '../../models/player';
import { SUIT_CONFIG } from '../../models/card';
import { ConnectionState } from '../../models/multiplayer';
import { sharedMultiplayerClient } from '../../services/multiplayer/MultiplayerClient';

export interface TableMenuModalProps {
  isOpen: boolean;
  gameState: GameState;
  roomCode?: string | null;
  isHost?: boolean;
  onClose: () => void;
  onOpenRules: () => void;
  onOpenScoreboard: () => void;
  onLeaveGame: () => void;
  onShareRoom?: () => void;
  onStartNewGame?: () => void;
  onOpenSettings?: () => void;
  isWaitingTable?: boolean;
  onResumeTable?: () => void;
  onStartGame?: () => void;
}

export const TableMenuModal: React.FC<TableMenuModalProps> = ({
  isOpen,
  gameState,
  roomCode,
  isHost = false,
  onClose,
  onOpenRules,
  onOpenScoreboard,
  onLeaveGame,
  onShareRoom,
  onStartNewGame,
  onOpenSettings,
  isWaitingTable = false,
  onResumeTable,
  onStartGame,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { isMuted, toggleMute } = useSound();

  const roomState = sharedMultiplayerClient.getRoomState();
  const [editingSeat, setEditingSeat] = useState<PlayerPosition | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [swapSourceSeat, setSwapSourceSeat] = useState<PlayerPosition | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    sharedMultiplayerClient.getConnectionState()
  );

  useEffect(() => {
    const unsubConn = sharedMultiplayerClient.onConnectionState((conn) => {
      setConnectionState(conn);
    });
    return unsubConn;
  }, []);

  // Haptic feedback state
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('callbreak_haptics_enabled');
      return stored !== 'false';
    }
    return true;
  });

  const toggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('callbreak_haptics_enabled', String(next));
      }
      if (next && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    } catch {
      // Ignore storage errors
    }
    soundManager.play('click');
  };

  const handleSaveRename = (seat: PlayerPosition) => {
    if (editingName.trim()) {
      sharedMultiplayerClient.renameSeat(seat, editingName.trim());
      soundManager.play('click');
    }
    setEditingSeat(null);
  };

  const handleSwapWith = (targetSeat: PlayerPosition) => {
    if (!swapSourceSeat || swapSourceSeat === targetSeat) {
      setSwapSourceSeat(null);
      return;
    }
    soundManager.play('cardPlay');
    sharedMultiplayerClient.swapSeats(swapSourceSeat, targetSeat);
    setSwapSourceSeat(null);
  };

  const trumpInfo = SUIT_CONFIG[gameState.config.trumpSuit];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="modal-table-menu-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto select-none"
        onClick={onClose}
      >
        <motion.div
          id="modal-table-menu-card"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 10 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={transitions.springFast}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] p-5 flex flex-col relative overflow-hidden ring-1 ring-white/10 max-h-[92vh] overflow-y-auto"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-800/80 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center text-amber-300 font-serif text-sm shadow-sm">
                ♠
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight">Table Menu</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-mono">
                  <span>Round {gameState.currentRound}/{gameState.config.totalRounds}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">{trumpInfo.symbol} Trump</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              id="btn-close-table-menu"
              onClick={() => {
                soundManager.play('click');
                onClose();
              }}
              className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Multiplayer Room Badge, Connection Status & Invite (if room code exists) */}
          {roomCode && (
            <div className="mb-3 p-3 rounded-2xl bg-stone-950/90 border border-stone-800 flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    connectionState === 'OPEN' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500 animate-ping'
                  }`}
                  title={connectionState === 'OPEN' ? 'Connected (WebSocket OPEN)' : `Connection state: ${connectionState}`}
                />
                <div className="text-left">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-bold block">
                    Room ID: <span className="text-amber-300 font-black">{roomCode}</span>
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">
                    {connectionState === 'OPEN' ? 'Online (Connected)' : 'Reconnecting...'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.play('click');
                    const currentUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://callbreak.app';
                    const joinLink = `${currentUrl}?room=${roomCode}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(joinLink).catch(() => {});
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Copy Room Link"
                >
                  Copy
                </button>
                {onShareRoom && (
                  <button
                    type="button"
                    id="btn-table-menu-share"
                    onClick={() => {
                      soundManager.play('click');
                      onShareRoom();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#25D366]/20 cursor-pointer transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Primary Action: Resume Game vs Resume Table / Start Game */}
          {isWaitingTable ? (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-menu-resume"
                  onClick={() => {
                    soundManager.play('click');
                    if (onResumeTable) {
                      onResumeTable();
                    } else {
                      onClose();
                    }
                  }}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/40 cursor-pointer transition-all"
                >
                  <Users className="w-4 h-4 text-stone-950" />
                  <span>Resume Table</span>
                </button>

                {isHost && onStartGame && (
                  <button
                    type="button"
                    id="btn-menu-start-game"
                    onClick={() => {
                      soundManager.play('deal');
                      onStartGame();
                    }}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start Game</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <button
                type="button"
                id="btn-menu-resume"
                onClick={() => {
                  soundManager.play('click');
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Resume Game</span>
              </button>
            </div>
          )}

          {/* Table Seats & Players Roster */}
          <div className="mb-3 p-3 rounded-2xl bg-stone-950/60 border border-stone-800/90 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold text-stone-300 uppercase font-mono tracking-wider">
                  Table Seats & Scores
                </span>
              </div>
              {isHost && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded-md">
                  Host Controls Active
                </span>
              )}
            </div>

            {swapSourceSeat && (
              <div className="mb-2 p-2 rounded-xl bg-amber-950/60 border border-amber-600 text-xs text-amber-200 flex items-center justify-between">
                <span>Select target seat to swap with <strong>{swapSourceSeat}</strong>:</span>
                <button
                  type="button"
                  onClick={() => setSwapSourceSeat(null)}
                  className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 hover:text-white text-[10px]"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="space-y-2">
              {POSITION_ORDER.map((pos) => {
                const participant = roomState?.players.find((p) => p.position === pos);
                const playerState = gameState.players[pos];
                const score = gameState.cumulativeScores[pos] ?? 0;
                const isMe = roomState ? participant?.id === roomState.myClientId : pos === PlayerPosition.SOUTH;
                const isSeatHost = participant?.isHost || (roomState && participant?.id === roomState.hostId);
                const isBot = participant ? participant.isBot : playerState?.type === 'BOT';
                const seatName = participant?.name || playerState?.name || `Player ${pos}`;
                const cleanName = seatName
                  .replace(/\s*\(You\)$/i, '')
                  .replace(/\s*\(Host\)$/i, '')
                  .replace(/\s*\(Bot\)$/i, '')
                  .trim();

                const isEditing = editingSeat === pos;

                return (
                  <div
                    key={pos}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      swapSourceSeat === pos
                        ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
                        : isMe
                        ? 'bg-emerald-950/30 border-emerald-800/80'
                        : 'bg-stone-900/80 border-stone-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-md bg-stone-800 border border-stone-700 text-[10px] font-mono font-bold flex items-center justify-center text-stone-300 shrink-0">
                          {pos.charAt(0)}
                        </span>

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1 sm:gap-1.5 w-full min-w-0">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="flex-1 min-w-0 px-2 py-0.5 rounded bg-stone-800 border border-stone-600 text-white text-xs sm:w-28 focus:outline-hidden focus:border-emerald-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(pos);
                                  if (e.key === 'Escape') setEditingSeat(null);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(pos)}
                                className="shrink-0 p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer flex items-center justify-center min-w-[24px] min-h-[24px]"
                                title="Save name"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-stone-200 truncate max-w-[120px]">
                                {cleanName}
                              </span>
                              {isSeatHost && (
                                <span className="text-[10px] font-extrabold text-amber-400 flex items-center gap-0.5 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/60">
                                  <Crown className="w-2.5 h-2.5" /> Host
                                </span>
                              )}
                              {isMe && (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800/60">
                                  You
                                </span>
                              )}
                              {isBot && (
                                <span className="text-[10px] font-bold text-stone-400 bg-stone-800 px-1 py-0.2 rounded flex items-center gap-0.5">
                                  <Bot className="w-2.5 h-2.5" /> Bot
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-[10px] text-stone-400 font-mono">
                            {pos} • Score: <strong className={score >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{score.toFixed(1)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Seat Action Buttons for Host */}
                      {isHost && (
                        <div className="flex items-center gap-1 shrink-0">
                          {swapSourceSeat ? (
                            swapSourceSeat !== pos && (
                              <button
                                type="button"
                                onClick={() => handleSwapWith(pos)}
                                className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[10px] cursor-pointer"
                              >
                                Swap Here
                              </button>
                            )
                          ) : (
                            <>
                              {/* Rename Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSeat(pos);
                                  setEditingName(cleanName);
                                }}
                                className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white"
                                title="Rename seat"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              {/* Swap Position Button */}
                              <button
                                type="button"
                                onClick={() => setSwapSourceSeat(pos)}
                                className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white"
                                title="Swap seat position"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                              </button>

                              {/* If connected human (not host), allow Host to convert to Bot or transfer Host */}
                              {!isBot && !isSeatHost && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      soundManager.play('click');
                                      sharedMultiplayerClient.transferHost(pos, participant?.id);
                                    }}
                                    className="p-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-300"
                                    title="Make Host"
                                  >
                                    <Crown className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      soundManager.play('warning');
                                      sharedMultiplayerClient.convertToBot(pos);
                                    }}
                                    className="p-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300"
                                    title="Convert Human to Bot"
                                  >
                                    <UserX className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Utility Options List */}
          <div className="space-y-2 mb-3">
            {/* Sound & Haptic Controls */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-menu-sound-toggle"
                onClick={toggleMute}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border-rose-800/80'
                    : 'bg-stone-800/90 hover:bg-stone-700 text-emerald-300 border-stone-700/80'
                }`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isMuted ? 'Sound: Off' : 'Sound: On'}</span>
              </button>

              <button
                type="button"
                id="btn-menu-haptic-toggle"
                onClick={toggleHaptics}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  hapticsEnabled
                    ? 'bg-stone-800/90 hover:bg-stone-700 text-emerald-300 border-stone-700/80'
                    : 'bg-stone-900/80 hover:bg-stone-800 text-stone-400 border-stone-800'
                }`}
              >
                <Vibrate className={`w-3.5 h-3.5 ${hapticsEnabled ? 'text-emerald-400' : 'text-stone-500'}`} />
                <span>{hapticsEnabled ? 'Haptics: On' : 'Haptics: Off'}</span>
              </button>
            </div>

            {/* Call Break Rules Summary */}
            <button
              type="button"
              id="btn-menu-rules"
              onClick={() => {
                soundManager.play('click');
                onClose();
                onOpenRules();
              }}
              className="w-full py-2 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Call Break Rules Summary</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">Guide</span>
            </button>

            {/* Scoreboard */}
            <button
              type="button"
              id="btn-menu-scoreboard"
              onClick={() => {
                soundManager.play('click');
                onClose();
                onOpenScoreboard();
              }}
              className="w-full py-2 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scoreboard & Round History</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">Scores</span>
            </button>

            {/* Settings */}
            {onOpenSettings && (
              <button
                type="button"
                id="btn-menu-settings"
                onClick={() => {
                  soundManager.play('click');
                  onClose();
                  onOpenSettings();
                }}
                className="w-full py-2 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-stone-300" />
                  <span>Settings & Preferences</span>
                </div>
                <span className="text-[10px] text-stone-400 font-mono">Config</span>
              </button>
            )}

            {/* Start New Match (Host Only in Multiplayer, or all in Local) */}
            {onStartNewGame && (!roomCode || isHost) && (
              <button
                type="button"
                id="btn-menu-new-game"
                onClick={() => {
                  soundManager.play('click');
                  onClose();
                  onStartNewGame();
                }}
                className="w-full py-2 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-emerald-300 font-bold text-xs border border-stone-700/80 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Start New Match</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono">Restart</span>
              </button>
            )}
          </div>

          {/* Leave Game Button */}
          <div className="border-t border-stone-800/80 pt-2">
            <button
              type="button"
              id="btn-menu-leave-game"
              onClick={() => {
                soundManager.play('warning');
                onClose();
                onLeaveGame();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 active:bg-rose-950 text-rose-200 hover:text-rose-100 font-bold text-xs border border-rose-700/80 flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Leave Game</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
