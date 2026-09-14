import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import {initializeServiceWorker} from './services/pwaService';
import './index.css';

// Global unhandled rejection and error shield to prevent white screen crashes
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Suppressed unhandled promise rejection:', event.reason);
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.warn('Suppressed global window error:', event.error || event.message);
  });
}

// Initialize PWA Service Worker safely (only in production outside preview)
if (!import.meta.env.DEV && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.includes('run.app')) {
  initializeServiceWorker();
} else {
  // Ensure any stale dev service workers are purged
  initializeServiceWorker();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
