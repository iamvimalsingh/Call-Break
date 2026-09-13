import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from './useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="pwa-offline-indicator"
      className="fixed bottom-3 left-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/90 border border-amber-600/80 text-amber-200 text-xs shadow-lg backdrop-blur-md animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      <WifiOff className="w-3.5 h-3.5 text-amber-300" />
      <span className="font-medium text-[11px]">Offline Mode — Local state & cached assets active</span>
    </div>
  );
};
