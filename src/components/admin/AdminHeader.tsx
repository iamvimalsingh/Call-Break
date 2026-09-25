/**
 * Admin Top Bar / Header
 * Follows the 3-Zone Top Bar Contract from the Universal Frontend Design Constitution:
 * Zone 1: Single text element wordmark
 * Zone 2: Navigation tab items
 * Zone 3: Operational controls (Auto-refresh, manual refresh, logout, exit to game)
 */

import React from 'react';
import { RefreshCw, ArrowLeft, LogOut } from 'lucide-react';
import { AdminViewTab } from '../../types/admin';

interface AdminHeaderProps {
  currentTab: AdminViewTab;
  onTabChange: (tab: AdminViewTab) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  autoRefreshInterval: number; // in seconds, 0 = off
  onAutoRefreshChange: (seconds: number) => void;
  onLogout: () => void;
  onExitToGame: () => void;
  selectedRoomCode: string | null;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentTab,
  onTabChange,
  onRefresh,
  isRefreshing,
  autoRefreshInterval,
  onAutoRefreshChange,
  onLogout,
  onExitToGame,
  selectedRoomCode,
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-30">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onTabChange('overview')}
          className="text-base font-semibold tracking-tight text-white hover:text-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          Call Break Operations
        </button>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden md:flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onTabChange('overview')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            currentTab === 'overview'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => onTabChange('rooms')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            currentTab === 'rooms'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Active Rooms
        </button>

        <button
          type="button"
          onClick={() => onTabChange('inspect')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            currentTab === 'inspect'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Deep Inspector {selectedRoomCode ? `(${selectedRoomCode})` : ''}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('raw')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            currentTab === 'raw'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Raw Payloads
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Auto Refresh Segmented Selector */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-500 px-1 font-mono">Sync:</span>
          {[0, 3, 5, 10].map((interval) => (
            <button
              key={interval}
              type="button"
              onClick={() => onAutoRefreshChange(interval)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-colors ${
                autoRefreshInterval === interval
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {interval === 0 ? 'Off' : `${interval}s`}
            </button>
          ))}
        </div>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
          title="Refresh Data Now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span className="hidden lg:inline text-[11px]">Refresh</span>
        </button>

        {/* Disconnect / Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer"
          title="Sign out of Admin Session"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>

        {/* Return to Card Table */}
        <button
          type="button"
          onClick={onExitToGame}
          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Game</span>
        </button>
      </div>
    </header>
  );
};
