import React, { useState } from 'react';
import { Download, Share, X, CheckCircle, Smartphone } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running in standalone PWA mode, show installed status in 'card'/'full' variant, or hide in 'compact'
  if (isInstalled) {
    if (variant === 'compact') return null;
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs ${className}`}>
        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="font-medium">App installed & running standalone</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    setInstalling(true);
    await install();
    setInstalling(false);
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'compact') {
      return (
        <button
          type="button"
          id="btn-pwa-install-compact"
          onClick={handleInstallClick}
          disabled={installing}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:from-emerald-700 active:to-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-950/50 border border-emerald-400/30 transition-all cursor-pointer ${className}`}
          title="Install Call Break as desktop or mobile app"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      );
    }

    return (
      <div className={`p-4 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Install Call Break App</div>
            <div className="text-xs text-stone-400">Play fullscreen with offline support and zero browser bars</div>
          </div>
        </div>
        <button
          type="button"
          id="btn-pwa-install-full"
          onClick={handleInstallClick}
          disabled={installing}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-md shadow-emerald-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>{installing ? 'Installing...' : 'Install Now'}</span>
        </button>
      </div>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        {variant === 'compact' ? (
          <button
            type="button"
            id="btn-pwa-install-ios-compact"
            onClick={() => setShowIOSGuide(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-medium border border-stone-700/70 transition-colors cursor-pointer ${className}`}
            title="Install on iPhone / iPad"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Install on iOS</span>
          </button>
        ) : (
          <div className={`p-4 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-emerald-400 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Install on iPhone / iPad</div>
                <div className="text-xs text-stone-400">Add Call Break to Home Screen for fullscreen offline play</div>
              </div>
            </div>
            <button
              type="button"
              id="btn-pwa-install-ios-guide"
              onClick={() => setShowIOSGuide(true)}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold border border-stone-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Share className="w-3.5 h-3.5 text-emerald-400" />
              <span>How to Install</span>
            </button>
          </div>
        )}

        {showIOSGuide && (
          <div
            id="modal-ios-pwa-guide"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-700/80 p-6 shadow-2xl space-y-4 text-stone-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-600/40 flex items-center justify-center text-emerald-400">
                    <Share className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">Install on iOS Safari</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-950/70 border border-stone-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    Tap the <strong>Share</strong> button <Share className="inline w-3.5 h-3.5 text-emerald-400" /> in Safari's bottom toolbar.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-950/70 border border-stone-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-stone-950/70 border border-stone-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    Confirm by tapping <strong>Add</strong> at top right. The game will appear as an app icon on your home screen!
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for browsers without beforeinstallprompt or desktop Safari
  if (variant === 'card' || variant === 'full') {
    return (
      <div className={`p-4 rounded-2xl bg-stone-900/80 border border-stone-800 flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-emerald-400 shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Progressive Web App</div>
            <div className="text-xs text-stone-400">Offline-ready. To install, use your browser's install or bookmark option.</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
