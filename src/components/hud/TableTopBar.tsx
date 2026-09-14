/**
 * Table Top Bar Component
 * Displays match context, trump badge, round counter, turn indicator,
 * and quick access to Rules, Scores, and Diagnostics.
 * Phase 6 Game Table & Playable Offline Game
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Trophy,
  BookOpen,
  RotateCcw,
  Home,
  Volume2,
  VolumeX,
  Settings,
  Users,
  Share2,
  Menu,
} from 'lucide-react';
import { GameMode, GameState, GameStatus } from '../../models/gameState';
import { SUIT_CONFIG } from '../../models/card';
import { PlayerPosition } from '../../models/player';
import { useSound } from '../../core/sound/useSound';
import { soundManager } from '../../core/sound/SoundManager';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { ConnectionState, RoomState } from '../../models/multiplayer';
import { sharedMultiplayerClient } from '../../services/multiplayer/MultiplayerClient';

interface TableTopBarProps {
  state: GameState;
  onOpenScoreboard: () => void;
  onOpenInspector: () => void;
  onOpenRules: () => void;
  onOpenHome: () => void;
  onStartNewGame: () => void;
  onOpenTableMenu?: () => void;
  onOpenSettings?: () => void;
  onOpenModeSelect?: () => void;
  onShareRoom?: () => void;
  onLeaveRoom?: () => void;
}

export const TableTopBar: React.FC<TableTopBarProps> = ({
  state,
  onOpenScoreboard,
  onOpenInspector,
  onOpenRules,
  onOpenHome,
  onStartNewGame,
  onOpenTableMenu,
  onOpenSettings,
  onOpenModeSelect,
  onShareRoom,
  onLeaveRoom,
}) => {
  const { isMuted, toggleMute } = useSound();
  const trumpInfo = SUIT_CONFIG[state.config.trumpSuit];
  const dealerPlayer = state.players[state.dealer];
  const currentPlayer = state.players[state.currentPlayer];

  const [connectionState, setConnectionState] = useState<ConnectionState>(() =>
    sharedMultiplayerClient.getConnectionState()
  );
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    const r = sharedMultiplayerClient.getRoomState();
    return r ? r.roomCode : null;
  });
  const [roomState, setRoomState] = useState<RoomState | null>(() =>
    sharedMultiplayerClient.getRoomState()
  );

  useEffect(() => {
    const unsubConn = sharedMultiplayerClient.onConnectionState((conn) => {
      setConnectionState(conn);
    });
    const unsubRoom = sharedMultiplayerClient.onRoomState((r) => {
      setRoomCode(r.roomCode);
      setRoomState(r);
    });
    return () => {
      unsubConn();
      unsubRoom();
    };
  }, []);

  const isMultiplayer = state.mode === GameMode.ONLINE_MULTIPLAYER || Boolean(roomCode);

  const handleShareRoom = () => {
    soundManager.play('click');
    if (onShareRoom) {
      onShareRoom();
      return;
    }
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
  };

  const getPhaseBadge = (status: GameStatus) => {
    switch (status) {
      case GameStatus.BIDDING:
        return { label: 'Bidding', color: 'bg-amber-950/80 text-amber-300 border-amber-800/80' };
      case GameStatus.PLAYING:
        return { label: 'Playing', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80' };
      case GameStatus.ROUND_ENDED:
        return { label: 'Round Ended', color: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80' };
      case GameStatus.MATCH_FINISHED:
        return { label: 'Match Complete', color: 'bg-purple-950/80 text-purple-300 border-purple-800/80' };
      case GameStatus.DEALING:
        return { label: 'Dealing', color: 'bg-blue-950/80 text-blue-300 border-blue-800/80' };
      default:
        return { label: 'Idle', color: 'bg-stone-800 text-stone-400 border-stone-700' };
    }
  };

  const phaseBadge = getPhaseBadge(state.status);

  const allBidsSubmitted = Object.values(state.players).every(
    (p) => p.currentBid !== null && p.currentBid !== undefined
  );
  const totalBids = allBidsSubmitted
    ? Object.values(state.players).reduce((sum, p) => sum + (p.currentBid ?? 0), 0)
    : null;

  return (
    <header className="w-full bg-stone-950/90 backdrop-blur-xl border-b border-stone-800/90 text-stone-200 px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 flex items-center justify-between z-20 select-none shadow-lg shrink-0 gap-2">
      {/* Brand & Home Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenHome}
          className="flex items-center gap-1.5 sm:gap-2 group cursor-pointer hover:opacity-95 transition-opacity"
          title="Game Menu / Home"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 border border-emerald-400/50 flex items-center justify-center font-serif text-sm sm:text-base text-emerald-200 shadow-md shadow-emerald-950/50 group-hover:scale-105 transition-transform">
            <span className="text-amber-300 drop-shadow-xs">♠</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white">Call Break</span>
              <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-stone-900 border border-stone-700/90 text-stone-300 font-bold hidden xs:inline">
                Lakdi
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.2">
              <span className={`text-[8px] sm:text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded-full border shadow-xs ${phaseBadge.color}`}>
                {phaseBadge.label}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Match Context Indicators */}
      <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs overflow-x-auto no-scrollbar py-0.5">
        {/* Round Badge */}
        <div className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-stone-900/90 border border-stone-700/80 flex items-center gap-1 shadow-xs shrink-0">
          <span className="text-stone-400 font-medium">R:</span>
          <span className="font-mono font-bold text-emerald-400">
            {state.currentRound}
            <span className="text-stone-500 font-normal">/{state.config.totalRounds}</span>
          </span>
        </div>

        {/* Trump Badge */}
        <div className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-stone-900/90 border border-stone-700/80 flex items-center gap-1 shadow-xs shrink-0">
          <span className="text-stone-400 font-medium hidden xs:inline">Trump:</span>
          <span className="font-bold text-white flex items-center gap-0.5">
            <span className="text-emerald-400 font-serif text-sm leading-none drop-shadow-xs">{trumpInfo.symbol}</span>
            <span className="hidden md:inline font-semibold">{trumpInfo.name}</span>
          </span>
        </div>

        {/* Total Bids Badge (Active once all 4 players submit bids) */}
        {totalBids !== null && (
          <div
            id="badge-total-bids"
            className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-amber-950/90 border border-amber-600/80 flex items-center gap-1 shadow-xs shrink-0"
            title={`Total round bids: ${totalBids} out of 13 tricks`}
          >
            <span className="text-amber-200/90 font-medium text-[9px] sm:text-xs">Total Bids:</span>
            <span className="font-mono font-black text-amber-300">
              {totalBids}
              <span className="text-stone-400 font-normal text-[9px] sm:text-[10px]">/13</span>
            </span>
          </div>
        )}

        {/* In-Game Table Live Status (Multiplayer) */}
        {isMultiplayer && (
          <div className="flex items-center shrink-0">
            {connectionState === 'OPEN' ? (
              <div
                id="badge-table-online"
                className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-emerald-950/80 border border-emerald-600/70 flex items-center gap-1.5 shadow-xs text-emerald-300 font-mono text-[9px] sm:text-xs"
                title={`Connected to online table: ${roomCode || 'Active'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-semibold whitespace-nowrap hidden sm:inline">Online Room: </span>
                <span className="font-bold">{roomCode || 'Live'}</span>
              </div>
            ) : (
              <div
                id="badge-table-reconnecting"
                className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-rose-950/80 border border-rose-600/70 flex items-center gap-1.5 shadow-xs text-rose-300 font-mono text-[9px] sm:text-xs"
                title="Multiplayer server connection interrupted. Attempting to reconnect..."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <span className="font-semibold whitespace-nowrap">Reconnecting...</span>
              </div>
            )}
          </div>
        )}

        {/* Dealer Indicator */}
        <div className="hidden sm:flex px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-stone-900/90 border border-stone-700/80 items-center gap-1 shadow-xs shrink-0">
          <span className="text-stone-400">Dealer:</span>
          <span className="font-semibold text-amber-300 font-mono">
            {dealerPlayer?.position === PlayerPosition.SOUTH ? 'You' : dealerPlayer?.name ?? state.dealer}
          </span>
        </div>

        {/* Fair Play Transparency Indicator */}
        <div
          id="badge-fair-play-transparency"
          className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-emerald-950/90 border border-emerald-600/70 flex items-center gap-1 shadow-xs shrink-0"
          title="🛡️ Fair Play: 100% Server Shuffled (Zero Host Influence)"
        >
          <span className="text-[10px] sm:text-xs">🛡️</span>
          <span className="text-[9px] sm:text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
            Fair Play: <span className="font-bold text-white">100% Server Shuffled</span>{' '}
            <span className="text-emerald-400/80 font-normal hidden xl:inline">(Zero Host Influence)</span>
          </span>
        </div>

        {/* Active Turn Indicator (Playing phase) */}
        {state.status === GameStatus.PLAYING && (
          <div className="hidden lg:flex px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-600/70 items-center gap-1.5 shadow-sm shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-stone-300 text-[11px]">Turn:</span>
            <span className="font-bold text-emerald-300 text-[11px]">
              {currentPlayer?.position === PlayerPosition.SOUTH ? 'You' : currentPlayer?.name ?? state.currentPlayer}
            </span>
          </div>
        )}
      </div>

      {/* Utility Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 z-50">
        {/* Aux Action Buttons */}
        <div className="hidden md:flex items-center gap-1 sm:gap-1.5">
          {/* PWA Install Button (auto-hides when installed or unavailable) */}
          <PWAInstallButton variant="compact" />

          {/* Sound Toggle */}
          <button
            type="button"
            id="btn-nav-sound"
            onClick={toggleMute}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 text-xs rounded-lg sm:rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              isMuted
                ? 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border-rose-800/80 shadow-xs'
                : 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800/80 shadow-xs'
            }`}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            )}
            <span className="hidden lg:inline font-medium">{isMuted ? 'Muted' : 'Sound'}</span>
          </button>

          {/* Mode / Lobby Trigger */}
          {onOpenModeSelect && (
            <button
              type="button"
              id="btn-nav-mode"
              onClick={onOpenModeSelect}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs rounded-lg sm:rounded-xl bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border border-amber-800/80 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Choose Game Mode & Play with Friends"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span className="font-bold">Modes</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              id="btn-nav-settings"
              onClick={onOpenSettings}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs rounded-lg sm:rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-200 border border-stone-700/80 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-300" />
              <span className="hidden lg:inline font-medium">Settings</span>
            </button>
          )}

          <button
            type="button"
            id="btn-open-scoreboard"
            onClick={onOpenScoreboard}
            className="p-2 sm:px-3 sm:py-1.5 text-xs rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-200 border border-stone-700/80 transition-colors flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs"
            title="View Scoreboard"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Scores</span>
          </button>

          <button
            type="button"
            id="btn-nav-rules"
            onClick={onOpenRules}
            className="p-2 sm:px-2.5 sm:py-1.5 text-xs rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-200 border border-stone-700/80 transition-colors hidden lg:flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Rules Guide"
          >
            <BookOpen className="w-4 h-4 text-stone-300" />
            <span className="font-medium">Rules</span>
          </button>

          <button
            type="button"
            id="btn-nav-new-game"
            onClick={onStartNewGame}
            className="p-2 sm:px-2.5 sm:py-1.5 text-xs rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-200 border border-stone-700/80 transition-colors hidden xl:flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Start Fresh Match"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">New Game</span>
          </button>

          <button
            type="button"
            id="btn-open-inspector"
            onClick={onOpenInspector}
            className="p-2 sm:px-3 sm:py-1.5 text-xs rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 transition-colors hidden 2xl:flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs"
            title="Architecture Inspector & Diagnostics"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Live Friend WhatsApp Invite Button (Distinct flex item to the left of Menu) */}
        {roomCode && (
          <button
            type="button"
            id="btn-table-invite-whatsapp"
            onClick={handleShareRoom}
            className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] xs:text-[11px] sm:text-xs rounded-lg sm:rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1da850] text-stone-950 font-black flex items-center gap-1 sm:gap-1.5 shadow-md shadow-[#25D366]/25 transition-all cursor-pointer select-none shrink-0"
            title={`Invite friends to this table via WhatsApp (Code: ${roomCode})`}
          >
            <Share2 className="w-3.5 h-3.5 text-stone-950 shrink-0" />
            <span className="font-mono font-black tracking-tight whitespace-nowrap hidden xs:inline">+ Invite ({roomCode})</span>
            <span className="font-mono font-black tracking-tight whitespace-nowrap xs:hidden">{roomCode}</span>
          </button>
        )}

        {/* Clean In-Table Game Menu (☰) in Top-Right Corner with dedicated z-50 click target */}
        {onOpenTableMenu && (
          <button
            type="button"
            id="btn-nav-table-menu"
            onClick={onOpenTableMenu}
            className="p-1.5 sm:px-3 sm:py-1.5 text-xs rounded-lg sm:rounded-xl bg-stone-900/95 hover:bg-stone-800 active:bg-stone-950 text-stone-200 border border-stone-700/90 transition-all flex items-center gap-1.5 font-bold cursor-pointer shadow-sm shrink-0 z-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            title="In-Table Game Menu (☰)"
            aria-label="In-Table Game Menu"
          >
            <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline font-bold">Menu</span>
          </button>
        )}
      </div>
    </header>
  );
};
