/**
 * Master Admin Panel Component
 * Internal Operations and Runtime Inspection Dashboard for Call Break backend.
 * Provides live room inspection, WebSocket health metrics, and authoritative server debugging.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AdminStatsDTO,
  AdminRoomSummaryDTO,
  AdminRoomDebugDTO,
  AdminViewTab,
} from '../../types/admin';
import {
  getStoredAdminApiKey,
  clearStoredAdminApiKey,
  fetchAdminStats,
  fetchAdminRooms,
  fetchAdminRoomDebug,
  AdminApiError,
} from '../../services/admin/adminApiClient';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminHeader } from './AdminHeader';
import { AdminOverviewView } from './AdminOverviewView';
import { AdminRoomsView } from './AdminRoomsView';
import { AdminRoomInspectView } from './AdminRoomInspectView';
import { AdminRawJsonModal } from './AdminRawJsonModal';

interface AdminPanelProps {
  onNavigateToGame: () => void;
  initialRoomCode?: string | null;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onNavigateToGame,
  initialRoomCode = null,
}) => {
  const [apiKey, setApiKey] = useState<string>(() => getStoredAdminApiKey());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getStoredAdminApiKey()));
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<AdminViewTab>('overview');
  const [selectedRoomCode, setSelectedRoomCode] = useState<string | null>(initialRoomCode);

  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [rooms, setRooms] = useState<AdminRoomSummaryDTO[]>([]);
  const [roomDebug, setRoomDebug] = useState<AdminRoomDebugDTO | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5); // default 5 seconds

  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [rawModalTitle, setRawModalTitle] = useState('Raw Admin Payload');
  const [rawModalData, setRawModalData] = useState<any>(null);

  // Sync with browser URL search params (?tab=...&room=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as AdminViewTab | null;
      const roomParam = params.get('room');

      if (roomParam) {
        setSelectedRoomCode(roomParam.toUpperCase());
        setCurrentTab('inspect');
      } else if (tabParam && ['overview', 'rooms', 'inspect', 'raw'].includes(tabParam)) {
        setCurrentTab(tabParam);
      }
    }
  }, []);

  // Update browser URL query params without full page reload
  const updateUrlParams = useCallback((tab: AdminViewTab, room: string | null) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.pathname = '/admin';
      url.searchParams.set('tab', tab);
      if (room && tab === 'inspect') {
        url.searchParams.set('room', room);
      } else {
        url.searchParams.delete('room');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Central refresh data handler
  const loadAdminData = useCallback(async (isSilent = false) => {
    if (!getStoredAdminApiKey()) {
      setIsAuthenticated(false);
      return;
    }

    if (!isSilent) setIsRefreshing(true);

    try {
      const [newStats, newRooms] = await Promise.all([
        fetchAdminStats(),
        fetchAdminRooms(),
      ]);

      setStats(newStats);
      setRooms(newRooms);
      setIsAuthenticated(true);
      setAuthError(null);

      // If viewing room inspect, refresh the selected room
      if (selectedRoomCode) {
        try {
          const debugData = await fetchAdminRoomDebug(selectedRoomCode);
          setRoomDebug(debugData);
          setInspectError(null);
        } catch (err: any) {
          if (err instanceof AdminApiError && err.status === 404) {
            setInspectError(`Room ${selectedRoomCode} is no longer active in RAM.`);
          } else {
            setInspectError(err.message);
          }
        }
      }
    } catch (err: any) {
      if (err instanceof AdminApiError) {
        if (err.status === 401 || err.status === 403 || err.status === 503) {
          setIsAuthenticated(false);
          setAuthError(err.message);
        }
      }
    } finally {
      if (!isSilent) setIsRefreshing(false);
    }
  }, [selectedRoomCode]);

  // Initial load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAdminData();
    }
  }, [isAuthenticated, loadAdminData]);

  // Auto-refresh interval timer
  useEffect(() => {
    if (!isAuthenticated || autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      loadAdminData(true);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [isAuthenticated, autoRefreshInterval, loadAdminData]);

  // Handle switching to Room Inspect view
  const handleInspectRoom = useCallback(async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    setSelectedRoomCode(cleanCode);
    setCurrentTab('inspect');
    setInspectLoading(true);
    setInspectError(null);
    updateUrlParams('inspect', cleanCode);

    try {
      const debugData = await fetchAdminRoomDebug(cleanCode);
      setRoomDebug(debugData);
    } catch (err: any) {
      setInspectError(err.message || 'Failed to inspect room');
    } finally {
      setInspectLoading(false);
    }
  }, [updateUrlParams]);

  // Handle Tab Change
  const handleTabChange = useCallback((tab: AdminViewTab) => {
    setCurrentTab(tab);
    updateUrlParams(tab, selectedRoomCode);
  }, [selectedRoomCode, updateUrlParams]);

  // Handle Logout
  const handleLogout = useCallback(() => {
    clearStoredAdminApiKey();
    setApiKey('');
    setIsAuthenticated(false);
    setStats(null);
    setRooms([]);
    setRoomDebug(null);
    setSelectedRoomCode(null);
  }, []);

  // Show Raw JSON Inspector
  const handleViewRawJson = useCallback((title: string, data: any) => {
    setRawModalTitle(title);
    setRawModalData(data);
    setIsRawModalOpen(true);
  }, []);

  // If not authenticated, render Auth Gate
  if (!isAuthenticated) {
    return (
      <AdminAuthGate
        onAuthenticated={() => {
          setIsAuthenticated(true);
          setApiKey(getStoredAdminApiKey());
          loadAdminData();
        }}
        onExit={onNavigateToGame}
        initialError={authError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Header Bar */}
      <AdminHeader
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onRefresh={() => loadAdminData(false)}
        isRefreshing={isRefreshing}
        autoRefreshInterval={autoRefreshInterval}
        onAutoRefreshChange={setAutoRefreshInterval}
        onLogout={handleLogout}
        onExitToGame={onNavigateToGame}
        selectedRoomCode={selectedRoomCode}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto custom-scrollbar">
        {currentTab === 'overview' && (
          <AdminOverviewView
            stats={stats}
            rooms={rooms}
            onViewRooms={() => handleTabChange('rooms')}
            onInspectRoom={handleInspectRoom}
          />
        )}

        {currentTab === 'rooms' && (
          <AdminRoomsView
            rooms={rooms}
            onInspectRoom={handleInspectRoom}
            onRefresh={() => loadAdminData(false)}
            isRefreshing={isRefreshing}
          />
        )}

        {currentTab === 'inspect' && (
          <AdminRoomInspectView
            debugData={roomDebug}
            isLoading={inspectLoading}
            error={inspectError}
            onBack={() => handleTabChange('rooms')}
            onRefresh={() => {
              if (selectedRoomCode) handleInspectRoom(selectedRoomCode);
            }}
            onViewRawJson={() =>
              handleViewRawJson(`Room Debug: ${selectedRoomCode}`, roomDebug)
            }
          />
        )}

        {currentTab === 'raw' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Raw Server Payloads</h2>
                <p className="text-xs text-slate-400">Direct inspect of serialized REST responses</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => handleViewRawJson('GET /api/admin/stats', stats)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer space-y-2 group"
              >
                <div className="font-mono text-xs font-bold text-emerald-400">/api/admin/stats</div>
                <div className="text-xs text-slate-300">Server runtime metrics, uptime, sockets & memory</div>
                <div className="text-[11px] text-slate-500 font-mono">Click to view formatted JSON →</div>
              </button>

              <button
                type="button"
                onClick={() => handleViewRawJson('GET /api/admin/rooms', rooms)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer space-y-2 group"
              >
                <div className="font-mono text-xs font-bold text-sky-400">/api/admin/rooms</div>
                <div className="text-xs text-slate-300">Sanitized active room summaries (no private cards)</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {rooms.length} rooms currently loaded →
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleViewRawJson(
                    selectedRoomCode ? `GET /api/admin/rooms/${selectedRoomCode}` : 'Select a room first',
                    roomDebug || { error: 'No room currently selected for inspection' }
                  )
                }
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer space-y-2 group"
              >
                <div className="font-mono text-xs font-bold text-amber-400">
                  /api/admin/rooms/:code
                </div>
                <div className="text-xs text-slate-300">Authoritative debug snapshot with private cards</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {selectedRoomCode ? `Current: ${selectedRoomCode} →` : 'Select a room to view →'}
                </div>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Raw JSON Modal */}
      <AdminRawJsonModal
        isOpen={isRawModalOpen}
        onClose={() => setIsRawModalOpen(false)}
        title={rawModalTitle}
        data={rawModalData}
      />
    </div>
  );
};
