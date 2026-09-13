/**
 * Scoreboard Modal Component
 * Displays the 5-round Call Break score card architecture.
 * Phase 1 Architecture Foundation
 */

import React from 'react';
import { X, Trophy, CheckCircle2, ShieldAlert } from 'lucide-react';
import { GameState } from '../../models/gameState';
import { PlayerPosition } from '../../models/player';

interface ScoreBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: GameState;
}

export const ScoreBoardModal: React.FC<ScoreBoardModalProps> = ({
  isOpen,
  onClose,
  state,
}) => {
  if (!isOpen) return null;

  const positions = [
    PlayerPosition.SOUTH,
    PlayerPosition.WEST,
    PlayerPosition.NORTH,
    PlayerPosition.EAST,
  ];

  const rounds = [1, 2, 3, 4, 5];

  return (
    <div
      id="modal-scoreboard-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-scoreboard-dialog"
        className="w-full max-w-2xl bg-gradient-to-b from-stone-900/98 via-stone-900/95 to-stone-950/98 border border-stone-700/80 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] overflow-hidden text-stone-200 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800/90 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Call Break Scorecard</h2>
              <p className="text-xs text-stone-400">Standard 5-Round Match Scoring Model</p>
            </div>
          </div>
          <button
            id="btn-close-scoreboard"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400">
                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Round</th>
                {positions.map((pos) => {
                  const player = state.players[pos];
                  const isYou = pos === PlayerPosition.SOUTH;
                  return (
                    <th key={pos} className="py-2.5 px-3 font-semibold text-stone-200">
                      <div className="flex flex-col">
                        <span className={isYou ? 'text-emerald-400 font-bold' : 'text-stone-200'}>
                          {isYou ? 'You' : player.name}
                        </span>
                        <span className="text-[10px] text-stone-500 font-normal">
                          {isYou ? '(Player)' : '(Bot)'}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono text-xs">
              {rounds.map((roundNum) => {
                const isCurrent = roundNum === state.currentRound;
                return (
                  <tr
                    key={roundNum}
                    className={isCurrent ? 'bg-emerald-950/30 text-emerald-300 font-semibold' : 'text-stone-300 hover:bg-stone-800/20'}
                  >
                    <td className="py-3 px-3 font-sans font-medium text-stone-400">
                      Round {roundNum} {isCurrent && <span className="text-[10px] text-emerald-400 ml-1 font-mono font-bold">(active)</span>}
                    </td>
                    {positions.map((pos) => {
                      const record = state.roundScores.find((r) => r.roundNumber === roundNum);
                      const playerScore = record?.scores[pos];

                      return (
                        <td key={pos} className="py-3 px-3">
                          {playerScore ? (
                            <span className={playerScore.roundScore < 0 ? 'text-rose-400 font-bold' : ''}>
                              {playerScore.roundScore > 0 ? `+${playerScore.roundScore.toFixed(1)}` : playerScore.roundScore.toFixed(1)} <span className="text-stone-500 text-[11px]">({playerScore.tricksWon}/{playerScore.bid})</span>
                            </span>
                          ) : (
                            <span className="text-stone-600">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-700 bg-stone-950/80 font-bold text-stone-100">
                <td className="py-3.5 px-3 font-sans text-stone-300">Total Score</td>
                {positions.map((pos) => {
                  const isYou = pos === PlayerPosition.SOUTH;
                  const total = state.cumulativeScores[pos] ?? 0;
                  return (
                    <td key={pos} className={`py-3.5 px-3 font-mono font-bold text-sm ${isYou ? 'text-emerald-400 text-base' : total >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                      {total.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>

          {/* Rule Legend */}
          <div className="mt-5 p-3.5 rounded-2xl bg-stone-950/80 border border-stone-800/90 text-xs text-stone-400 flex flex-col gap-1.5 shadow-inner">
            <div className="flex items-center gap-1.5 font-semibold text-stone-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Standard Call Break Scoring Formula (Phase 4 Contract):</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-400 pl-1">
              <li>Achieved Bid: <code className="text-emerald-300 font-mono bg-stone-900 px-1 py-0.5 rounded border border-stone-800">Score = Bid + (Tricks Won - Bid) × 0.1</code></li>
              <li>Failed Bid (Under): <code className="text-rose-300 font-mono bg-stone-900 px-1 py-0.5 rounded border border-stone-800">Score = -Bid</code></li>
              <li>5 Rounds total per match; highest cumulative score wins.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-800/90 bg-stone-950/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-stone-800 hover:bg-stone-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
