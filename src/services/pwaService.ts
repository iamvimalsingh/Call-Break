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

  // Completely skip Service Worker registration during development/preview.
  // Service worker cache interception on dev servers causes Vite script imports to fail after 5–10 seconds, causing the blank white screen.
  const isDevOrPreview =
    import.meta.env.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('run.app') ||
    window.location.hostname.includes('webcontainer');

  if (isDevOrPreview) {
    try {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
          console.log('[PWA] Unregistered dev/preview service worker:', registration.scope);
        }
      }).catch(() => {});

      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[PWA] Service worker cleanup note:', e);
    }
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
