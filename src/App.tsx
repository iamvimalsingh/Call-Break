/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameShell } from './components/layout/GameShell';
import { AdminPanel } from './components/admin/AdminPanel';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    return path.startsWith('/admin') || params.get('view') === 'admin';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      setIsAdminRoute(path.startsWith('/admin') || params.get('view') === 'admin');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateToAdmin = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/admin');
    }
    setIsAdminRoute(true);
  };

  const handleNavigateToGame = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    setIsAdminRoute(false);
  };

  return (
    <ErrorBoundary>
      {isAdminRoute ? (
        <AdminPanel onNavigateToGame={handleNavigateToGame} />
      ) : (
        <GameShell onNavigateToAdmin={handleNavigateToAdmin} />
      )}
    </ErrorBoundary>
  );
}

