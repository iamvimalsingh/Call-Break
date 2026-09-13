import { registerSW } from 'virtual:pwa-register';

/**
 * Safely registers the PWA service worker.
 * Any service worker registration errors are trapped so they never impede
 * application boot or local offline game execution.
 */
export function initializeServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New service worker version available. Updating cache...');
        updateSW(true);
      },
      onOfflineReady() {
        console.log('[PWA] Call Break is cached and ready for offline play.');
      },
      onRegisterError(error: unknown) {
        console.warn('[PWA] Service worker registration error:', error);
      },
    });
  } catch (err) {
    console.warn('[PWA] Service worker initialization failed gracefully:', err);
  }
}
