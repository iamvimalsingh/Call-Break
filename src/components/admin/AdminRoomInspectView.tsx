/**
 * Deep Room Inspector View
 * Detailed authoritative debug snapshot for an individual room.
 * Displays private dealt cards, seat reservations, turn timers, live tricks, and cumulative scores.
 */

import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Copy, Check, Clock, ShieldCheck, User, Bot, AlertTriangle, Layers } from 'lucide-react';
import { AdminRoomDebugDTO, SanitizedCardDTO } from '../../types/admin';
import { getSuitDisplay } from '../../services/admin/adminApiClient';

interface AdminRoomInspectViewProps {
  debugData: AdminRoomDebugDTO | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onViewRawJson: () => void;
}

export const AdminRoomInspectView: React.FC<AdminRoomInspectViewProps> = ({
  debugData,
  isLoading,
  error,
  onBack,
  onRefresh,
  onViewRawJson,
}) => {
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);

  const handleCopyClientId = (id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {});
      setCopiedClientId(id);
      setTimeout(() => setCopiedClientId(null), 2000);
    }
  };

  if (isLoading && !debugData) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400 mb-2" />
        <span>Loading authoritative room debug snapshot...</span>
      </div>
    );
  }

  if (error || !debugData) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs space-y-2">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
          <div className="font-semibold text-sm">Failed to Load Room Debug Snapshot</div>
          <p className="text-slate-400">{error || 'Room not found or no longer active in RAM.'}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Rooms Directory</span>
        </button>
      </div>
    );
  }

  const { room, seats, gameState, timers } = debugData;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Back to Active Rooms"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
              <span>{room.roomCode}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  room.status === 'PLAYING'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : room.status === 'LOBBY'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {room.status}
              </span>
            </h2>
          </div>

          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 pl-7 font-mono">
            <span>Round {room.currentRound} / {room.totalRounds}</span>
            <span aria-hidden="true">·</span>
            <span>Phase: <span className="text-slate-200 font-semibold">{room.phase}</span></span>
            <span aria-hidden="true">·</span>
            <span>Host: <span className="text-slate-200">{room.hostName} ({room.hostSeat})</span></span>
            {room.activeTurnSeat && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">
                  Turn: {room.activeTurnSeat.position} ({room.activeTurnSeat.seat})
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onViewRawJson}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Raw JSON</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Active Turn Timer Banner (if active) */}
      {timers.activeTimer && (
        <div className="bg-slate-900 border border-emerald-800/80 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">
                Active Turn Timer: {timers.activeTimer.position}
                {timers.activeTimer.isExtraTime && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
                    EXTRA TIME
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {timers.activeTimer.remainingSec}s remaining of {timers.activeTimer.totalSec}s total
              </div>
            </div>
          </div>

          <div className="w-32 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (timers.activeTimer.remainingSec / timers.activeTimer.totalSec) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 4 Seats Deep Dive Grid (SOUTH, WEST, NORTH, EAST) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white tracking-tight">Seats & Private Hands</h3>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Authenticated Server Authority (Private Cards Revealed)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {seats.map((seat) => {
            const isSouth = seat.position === 'SOUTH';
            return (
              <div
                key={seat.seat}
                className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between space-y-3 ${
                  isSouth ? 'border-emerald-700/80' : 'border-slate-800'
                }`}
              >
                {/* Seat Header */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">
                      {seat.seat} · {seat.position}
                    </span>
                    <div className="flex items-center gap-1">
                      {seat.isHost && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          HOST
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          seat.isBot
                            ? 'bg-slate-800 text-slate-400'
                            : seat.isConnected
                            ? 'bg-sky-950 text-sky-300 border border-sky-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {seat.isBot ? 'BOT' : seat.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-200 mt-1 flex items-center gap-1.5">
                    {seat.isBot ? <Bot className="w-3.5 h-3.5 text-slate-400" /> : <User className="w-3.5 h-3.5 text-sky-400" />}
                    <span>{seat.name}</span>
                  </div>

                  {/* Seat Reservation indicator */}
                  {seat.hasReservation && seat.reservationRemainingMs !== null && (
                    <div className="mt-1 text-[11px] text-amber-400 font-mono">
                      Reconnect reservation: {Math.ceil(seat.reservationRemainingMs / 1000)}s left
                    </div>
                  )}

                  {/* Client ID */}
                  {seat.clientId && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <span>ID: {seat.clientId.slice(0, 14)}...</span>
                      <button
                        type="button"
                        onClick={() => handleCopyClientId(seat.clientId!)}
                        className="text-slate-400 hover:text-white"
                        title="Copy Client ID"
                      >
                        {copiedClientId === seat.clientId ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Score & Trick Metric */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-500">Bid: </span>
                    <span className="font-bold text-white tabular-nums">
                      {seat.currentBid !== null ? seat.currentBid : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tricks: </span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {seat.tricksWon}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cards: </span>
                    <span className="font-bold text-slate-300 tabular-nums">
                      {seat.privateCards.cardsRemaining}
                    </span>
                  </div>
                </div>

                {/* Private Hand Cards (Admin Debug Feature) */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                    <span>Remaining Hand ({seat.privateCards.cardsRemaining})</span>
                  </div>

                  {seat.privateCards.hand.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic py-2">
                      {room.status === 'LOBBY' ? 'Cards not dealt yet (in lobby)' : 'No cards remaining in hand'}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                      {seat.privateCards.hand.map((card) => {
                        const suitInfo = getSuitDisplay(card.suit);
                        return (
                          <div
                            key={card.id}
                            className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700/80 font-mono text-[11px] font-bold flex items-center gap-0.5 shadow-xs"
                          >
                            <span className={suitInfo.color}>{suitInfo.symbol}</span>
                            <span className="text-white">{card.rank}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Played Cards List */}
                  {seat.privateCards.playedCards.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/40 text-[10px] text-slate-500">
                      <span className="text-slate-400 font-medium">Played: </span>
                      <span className="font-mono text-slate-400">
                        {seat.privateCards.playedCards.map((c) => `${getSuitDisplay(c.suit).symbol}${c.rank}`).join(' ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Authoritative Live Game State (Current Trick & Completed Tricks) */}
      {gameState && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Trick State */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Current Trick #{gameState.currentTrick.trickNumber}</h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Leader: <span className="text-slate-200 font-mono">{gameState.currentTrick.leader}</span> ·
                  Lead Suit: <span className="text-slate-200 font-mono">{gameState.currentTrick.leadSuit || 'None yet'}</span>
                </div>
              </div>
              {gameState.currentTrick.winner && (
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                  Winner: {gameState.currentTrick.winner}
                </span>
              )}
            </div>

            {gameState.currentTrick.cards.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 italic">
                Awaiting first card lead for this trick.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {gameState.currentTrick.cards.map((c) => {
                  const suitInfo = getSuitDisplay(c.card.suit);
                  return (
                    <div
                      key={c.position}
                      className={`p-2.5 rounded-lg bg-slate-950 border text-center space-y-1 ${
                        c.isLeading ? 'border-amber-700/80' : 'border-slate-800'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 font-mono">
                        {c.position} {c.isLeading && '(Lead)'}
                      </div>
                      <div className="text-lg font-bold font-mono flex items-center justify-center gap-1">
                        <span className={suitInfo.color}>{suitInfo.symbol}</span>
                        <span className="text-white">{c.card.rank}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cumulative Scores & Round Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Cumulative Scores</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2">Seat</th>
                    <th className="pb-2">Bid</th>
                    <th className="pb-2">Tricks</th>
                    <th className="pb-2 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(['SOUTH', 'WEST', 'NORTH', 'EAST'] as const).map((pos) => {
                    const score = gameState.scores[pos] ?? 0;
                    const bid = gameState.currentBids[pos];
                    const tricks = gameState.tricksWon[pos] ?? 0;
                    return (
                      <tr key={pos} className="hover:bg-slate-800/30">
                        <td className="py-2 font-medium text-slate-200">{pos}</td>
                        <td className="py-2 text-slate-400 tabular-nums">{bid !== null ? bid : '—'}</td>
                        <td className="py-2 text-emerald-400 tabular-nums">{tricks}</td>
                        <td className={`py-2 text-right font-bold tabular-nums ${
                          score >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {score.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Completed Tricks Count */}
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
              <span>Completed Tricks in Round:</span>
              <span className="font-mono text-white tabular-nums">
                {gameState.completedTricksCount} / 13
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
