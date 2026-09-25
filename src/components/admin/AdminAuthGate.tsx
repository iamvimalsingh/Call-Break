/**
 * Admin Authentication Gate
 * Operator sign-in modal/card for entering the Bearer ADMIN_API_KEY.
 * Validates the key against /api/admin/stats before allowing access.
 */

import React, { useState } from 'react';
import { KeyRound, ShieldAlert, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { fetchAdminStats, setStoredAdminApiKey, AdminApiError } from '../../services/admin/adminApiClient';

interface AdminAuthGateProps {
  onAuthenticated: () => void;
  onExit: () => void;
  initialError?: string | null;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  onAuthenticated,
  onExit,
  initialError,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();

    if (!cleanKey) {
      setErrorMessage('Please enter an Admin API Key.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Validate key against the stats endpoint
      await fetchAdminStats(cleanKey);
      setStoredAdminApiKey(cleanKey);
      onAuthenticated();
    } catch (err: any) {
      if (err instanceof AdminApiError) {
        if (err.status === 503) {
          setErrorMessage(
            'Server Error (503): ADMIN_API_KEY is not configured on this server process. Please set the ADMIN_API_KEY environment variable and restart the server.'
          );
        } else if (err.status === 401 || err.status === 403) {
          setErrorMessage('Access Denied (403): The provided API key does not match the server configuration.');
        } else {
          setErrorMessage(`Authentication error: ${err.message}`);
        }
      } else {
        setErrorMessage(`Network or server connection failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Top Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <button
              type="button"
              onClick={onExit}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Game</span>
            </button>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Call Break Engine Admin
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Restricted operations console for live room inspection, active table state, and runtime metrics.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="adminKey" className="block text-xs font-medium text-slate-300">
              Admin API Key (Bearer Token)
            </label>
            <div className="relative">
              <input
                id="adminKey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter ADMIN_API_KEY..."
                autoComplete="current-password"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden font-mono pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Matches the <code className="font-mono text-slate-400">ADMIN_API_KEY</code> variable configured on the backend.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Admin Console</span>
              )}
            </button>
          </div>
        </form>

        {/* Diagnostic Footer Notice */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed space-y-1">
          <div className="font-medium text-slate-400">Security Invariant</div>
          <div>
            Tokens are passed directly via <code className="font-mono text-slate-400">Authorization: Bearer</code> headers.
            No persistent database or external auth servers are queried.
          </div>
        </div>
      </div>
    </div>
  );
};
