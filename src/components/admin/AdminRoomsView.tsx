/**
 * Admin Rooms Directory View
 * High-density data grid for exploring and filtering in-memory Call Break rooms.
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, Copy, Check, ExternalLink, RefreshCw, Eye } from 'lucide-react';
import { AdminRoomSummaryDTO } from '../../types/admin';

interface AdminRoomsViewProps {
  rooms: AdminRoomSummaryDTO[];
  onInspectRoom: (roomCode: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const AdminRoomsView: React.FC<AdminRoomsViewProps> = ({
  rooms,
  onInspectRoom,
  onRefresh,
  isRefreshing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PLAYING' | 'LOBBY' | 'FINISHED' | 'HUMANS'>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // Status filter
      if (statusFilter === 'PLAYING' && r.status !== 'PLAYING') return false;
      if (statusFilter === 'LOBBY' && r.status !== 'LOBBY') return false;
      if (statusFilter === 'FINISHED' && r.status !== 'FINISHED') return false;
      if (statusFilter === 'HUMANS' && r.humanCount === 0) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const codeMatch = r.roomCode.toLowerCase().includes(q);
      const hostMatch = r.hostName.toLowerCase().includes(q);
      const seatMatch = r.seats.some((s) => s.name.toLowerCase().includes(q));

      return codeMatch || hostMatch || seatMatch;
    });
  }, [rooms, searchQuery, statusFilter]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* View Header with Search & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">Active Rooms Directory</h2>
          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
            <span className="font-mono tabular-nums">{rooms.length} Total Rooms</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{filteredRooms.length} Displayed</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative min-w-56 flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code or player..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden font-mono"
            />
          </div>

          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'PLAYING', label: 'Playing' },
                { id: 'LOBBY', label: 'Lobby' },
                { id: 'FINISHED', label: 'Finished' },
                { id: 'HUMANS', label: 'With Humans' },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === filter.id
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Refresh Rooms"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* High-Density Data Grid / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {filteredRooms.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <p className="font-medium text-slate-300">No rooms match the selected criteria.</p>
            <p className="text-slate-500">
              {rooms.length === 0
                ? 'No rooms currently exist in server memory. Create a table from the game to populate this list.'
                : 'Try adjusting your search query or status filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                  <th className="py-3 px-4">Room Code</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Host</th>
                  <th className="py-3 px-3">Round</th>
                  <th className="py-3 px-3">Active Turn</th>
                  <th className="py-3 px-3">Seats (S · W · N · E)</th>
                  <th className="py-3 px-3">Players</th>
                  <th className="py-3 px-3">Joinable</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRooms.map((room) => (
                  <tr
                    key={room.roomCode}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => onInspectRoom(room.roomCode)}
                  >
                    {/* Room Code */}
                    <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-1.5">
                      <span>{room.roomCode}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyCode(room.roomCode);
                        }}
                        className="text-slate-500 hover:text-slate-200 transition-colors p-1"
                        title="Copy Room Code"
                      >
                        {copiedCode === room.roomCode ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          room.status === 'PLAYING'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : room.status === 'LOBBY'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {room.status}
                      </span>
                    </td>

                    {/* Host */}
                    <td className="py-3 px-3 text-slate-300">
                      <div className="font-medium text-slate-200">{room.hostName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{room.hostSeat}</div>
                    </td>

                    {/* Round */}
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-300">
                      R{room.currentRound} / {room.totalRounds}
                    </td>

                    {/* Active Turn */}
                    <td className="py-3 px-3">
                      {room.activeTurn ? (
                        <div className="font-mono text-emerald-400 text-xs">
                          {room.activeTurn.position} ({room.activeTurn.seat})
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Seats Breakdown (SOUTH, WEST, NORTH, EAST mini badges) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        {room.seats.map((seat) => {
                          const isOnlineHuman = !seat.isBot && seat.isConnected;
                          const isDisconnectedHuman = !seat.isBot && !seat.isConnected;
                          return (
                            <span
                              key={seat.seat}
                              title={`${seat.seat} (${seat.position}): ${seat.name} ${
                                seat.isBot ? '[Bot]' : seat.isConnected ? '[Human Online]' : '[Human Offline]'
                              }`}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                isOnlineHuman
                                  ? 'bg-sky-950 text-sky-300 border border-sky-700'
                                  : isDisconnectedHuman
                                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {seat.position[0]}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Players Count */}
                    <td className="py-3 px-3 font-mono text-xs">
                      <span className="text-sky-400">{room.humanCount}H</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-slate-400">{room.botCount}B</span>
                    </td>

                    {/* Joinable */}
                    <td className="py-3 px-3">
                      <span
                        className={`text-xs font-mono ${
                          room.isJoinable ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {room.isJoinable ? 'Yes' : 'No'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectRoom(room.roomCode);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
