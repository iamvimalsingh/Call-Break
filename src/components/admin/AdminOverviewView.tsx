/**
 * Admin Overview View
 * KPI summary of server metrics, active WebSocket clients, memory utilization,
 * and game room status distribution.
 */

import React from 'react';
import { Layers, Users, Activity, Clock, Cpu, ArrowRight } from 'lucide-react';
import { AdminStatsDTO, AdminRoomSummaryDTO } from '../../types/admin';
import { formatUptime, formatBytes } from '../../services/admin/adminApiClient';

interface AdminOverviewViewProps {
  stats: AdminStatsDTO | null;
  rooms: AdminRoomSummaryDTO[];
  onViewRooms: () => void;
  onInspectRoom: (roomCode: string) => void;
}

export const AdminOverviewView: React.FC<AdminOverviewViewProps> = ({
  stats,
  rooms,
  onViewRooms,
  onInspectRoom,
}) => {
  if (!stats) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Loading system metrics...
      </div>
    );
  }

  const memoryPercent = stats.processMemory.heapTotalBytes > 0
    ? Math.round((stats.processMemory.heapUsedBytes / stats.processMemory.heapTotalBytes) * 100)
    : 0;

  const totalSeats = stats.humanPlayerCount + stats.botSeatCount;
  const humanPercent = totalSeats > 0 ? Math.round((stats.humanPlayerCount / totalSeats) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">System & Engine Overview</h2>
          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
            <span>Authoritative WebSocket Backend</span>
            <span aria-hidden="true">·</span>
            <span>Version {stats.serverVersion}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">RAM Storage Only (Render Free Mode)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewRooms}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span>View All Rooms ({stats.activeRoomsCount})</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary KPI Metric Cards (Single-Elevation, Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Rooms */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Active Rooms</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-white">
              {stats.activeRoomsCount}
            </span>
            <span className="text-xs text-slate-400">tables live in RAM</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="text-emerald-400 font-mono font-medium">{stats.roomsByStatus.PLAYING} Playing</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400 font-mono font-medium">{stats.roomsByStatus.LOBBY} Lobby</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-500 font-mono font-medium">{stats.roomsByStatus.FINISHED} Finished</span>
          </div>
        </div>

        {/* Card 2: Connected Sockets */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">WebSocket Clients</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-white">
              {stats.activeWebSocketConnections}
            </span>
            <span className="text-xs text-slate-400">active sockets</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="text-sky-400 font-mono font-medium">{stats.humanPlayerCount} Humans</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400 font-mono font-medium">{stats.botSeatCount} Bots</span>
          </div>
        </div>

        {/* Card 3: Server Uptime */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Uptime</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-white truncate">
              {formatUptime(stats.serverUptimeSeconds)}
            </div>
            <div className="text-xs text-slate-400 mt-1">without restart</div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
            {stats.serverUptimeSeconds.toLocaleString()} seconds elapsed
          </div>
        </div>

        {/* Card 4: Memory Utilization */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Heap Memory</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {formatBytes(stats.processMemory.heapUsedBytes)}
            </span>
            <span className="text-xs text-slate-400">/ {formatBytes(stats.processMemory.heapTotalBytes)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  memoryPercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(memoryPercent, 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500 font-mono flex justify-between">
              <span>{memoryPercent}% used</span>
              <span>RSS: {formatBytes(stats.processMemory.rssBytes)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Detailed Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room Lifecycle Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Room Lifecycle Distribution</h3>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              Total: {stats.activeRoomsCount}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>PLAYING (Active Matches)</span>
                </span>
                <span className="font-mono tabular-nums font-medium text-emerald-400">
                  {stats.roomsByStatus.PLAYING}
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: stats.activeRoomsCount > 0
                      ? `${(stats.roomsByStatus.PLAYING / stats.activeRoomsCount) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <span>LOBBY (Waiting for Players / 5m Grace)</span>
                </span>
                <span className="font-mono tabular-nums font-medium text-amber-400">
                  {stats.roomsByStatus.LOBBY}
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{
                    width: stats.activeRoomsCount > 0
                      ? `${(stats.roomsByStatus.LOBBY / stats.activeRoomsCount) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
                  <span>FINISHED (Match Completed)</span>
                </span>
                <span className="font-mono tabular-nums font-medium text-slate-400">
                  {stats.roomsByStatus.FINISHED}
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-slate-600 h-full rounded-full transition-all"
                  style={{
                    width: stats.activeRoomsCount > 0
                      ? `${(stats.roomsByStatus.FINISHED / stats.activeRoomsCount) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Player Composition & Server Environment */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Player Composition & RAM Boundary</h3>
            <Users className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Human Players vs Bot Seats</span>
                <span className="font-mono tabular-nums">
                  {stats.humanPlayerCount} Humans / {stats.botSeatCount} Bots ({humanPercent}% Human)
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-sky-500 h-full transition-all"
                  style={{ width: `${humanPercent}%` }}
                />
                <div
                  className="bg-slate-700 h-full transition-all"
                  style={{ width: `${100 - humanPercent}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Process RSS Memory:</span>
                <span className="font-mono text-slate-200 tabular-nums">{formatBytes(stats.processMemory.rssBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>External Memory:</span>
                <span className="font-mono text-slate-200 tabular-nums">{formatBytes(stats.processMemory.externalBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Persistence State:</span>
                <span className={`font-mono ${stats.persistence?.enabled ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {stats.persistence?.enabled
                    ? stats.persistence.connected
                      ? 'PostgreSQL (Connected)'
                      : 'PostgreSQL (Configured)'
                    : 'In-Memory Only (Zero DB)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent / Active Rooms Quick Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Live Rooms in Memory</h3>
            <p className="text-xs text-slate-400">Snapshot of active game sessions</p>
          </div>
          <button
            type="button"
            onClick={onViewRooms}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({rooms.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No rooms currently created. Open the game in another tab and create a table to see it appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 font-medium">Room Code</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Host</th>
                  <th className="pb-2 font-medium">Round</th>
                  <th className="pb-2 font-medium">Humans / Bots</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rooms.slice(0, 5).map((r) => (
                  <tr key={r.roomCode} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 font-mono font-bold text-white">{r.roomCode}</td>
                    <td className="py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          r.status === 'PLAYING'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : r.status === 'LOBBY'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-300">{r.hostName} ({r.hostSeat})</td>
                    <td className="py-2.5 font-mono text-slate-300 tabular-nums">
                      R{r.currentRound}/{r.totalRounds}
                    </td>
                    <td className="py-2.5 text-slate-400 font-mono">
                      {r.humanCount}H · {r.botCount}B
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectRoom(r.roomCode)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Inspect
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
