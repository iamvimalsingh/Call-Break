/**
 * Host Join Request Modal
 * Displayed to the room Host when a human player requests to join an active match mid-game.
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Check, X, Bot, RotateCcw } from 'lucide-react';
import { JoinRequestPayload } from '../../models/multiplayer';
import { PlayerPosition } from '../../models/player';
import { soundManager } from '../../core/sound/SoundManager';

export interface JoinRequestModalProps {
  request: JoinRequestPayload | null;
  onRespond: (requestId: string, accept: boolean, targetSeat?: PlayerPosition) => void;
}

const POSITION_TO_SEAT_LABEL: Record<PlayerPosition, string> = {
  [PlayerPosition.SOUTH]: 'P1',
  [PlayerPosition.WEST]: 'P2',
  [PlayerPosition.NORTH]: 'P3',
  [PlayerPosition.EAST]: 'P4',
};

export const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  request,
  onRespond,
}) => {
  if (!request) return null;

  const seats = request.availableSeats || [];

  const handleSelectSeat = (seat?: PlayerPosition) => {
    soundManager.play('click');
    onRespond(request.requestId, true, seat || request.position);
  };

  const handleDecline = () => {
    soundManager.play('warning');
    onRespond(request.requestId, false);
  };

  return (
    <AnimatePresence>
      <div
        id="join-request-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      >
        <motion.div
          id="join-request-modal"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-md bg-stone-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-stone-100"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-950/70 via-stone-900 to-amber-950/70 border-b border-amber-500/30 px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="join-request-title" className="text-base font-extrabold text-white leading-tight">
                Player Join Request
              </h3>
              <p className="text-xs text-amber-300 font-medium">Table Host Seat Replacement</p>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-stone-800/90 border border-stone-700/80 text-sm font-semibold text-stone-200">
              <strong className="text-emerald-400 font-extrabold">{request.playerName}</strong> wants to join this active match.
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-amber-300/90">
              Select Bot Seat to Replace:
            </p>

            {/* Dynamic Choice Actions */}
            <div className="space-y-2">
              {seats.length > 0 ? (
                seats.map((opt) => {
                  const seatCode = opt.seatId || POSITION_TO_SEAT_LABEL[opt.seat] || opt.seat;
                  const label = opt.label || `Replace Bot on Seat ${seatCode}`;
                  return (
                    <button
                      key={opt.seat}
                      id={`join-request-seat-btn-${opt.seat.toLowerCase()}`}
                      type="button"
                      onClick={() => handleSelectSeat(opt.seat)}
                      className="w-full p-3.5 rounded-xl bg-stone-800 hover:bg-emerald-950/80 border border-stone-700 hover:border-emerald-500 text-stone-100 hover:text-emerald-200 transition-all flex items-center justify-between cursor-pointer group shadow-sm text-left font-bold"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.type === 'auto_play' ? (
                          <RotateCcw className="w-4 h-4 text-amber-400 group-hover:text-emerald-400 shrink-0" />
                        ) : (
                          <Bot className="w-4 h-4 text-blue-400 group-hover:text-emerald-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold truncate">{label}</span>
                      </div>
                      <Check className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                    </button>
                  );
                })
              ) : (
                <button
                  id="join-request-accept-btn"
                  type="button"
                  onClick={() => handleSelectSeat(request.position)}
                  className="w-full p-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  Accept & Replace Bot
                </button>
              )}
            </div>
          </div>

          {/* Actions / Decline */}
          <div className="bg-stone-950/90 px-6 py-4 border-t border-stone-800/80 flex items-center justify-between">
            <span className="text-[11px] text-stone-400">Host controls active table seats</span>
            <button
              id="join-request-decline-btn"
              type="button"
              onClick={handleDecline}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-300 hover:text-red-400 hover:bg-red-950/50 border border-stone-700 hover:border-red-500/50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Decline
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
