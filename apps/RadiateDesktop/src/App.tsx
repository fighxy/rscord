import React, { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { listen } from '@tauri-apps/api/event';

// Context Providers
import { AuthProvider } from './modules/auth/store';
import { ThemeProvider } from './contexts/ThemeContext';

// Router
import { AppRouter } from './components/AppRouter';

// Hooks
import { useContextMenuDisable } from './hooks/useContextMenuDisable';

// Anthropic Design System
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, // Исправлено: cacheTime -> gcTime
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  // Enable comprehensive context menu disable
  useContextMenuDisable({
    disableContextMenu: true,
    disableSelection: true,
    disableDragDrop: true,
    disableDevTools: true,
    allowSelectionInInputs: true,
  });

  useEffect(() => {
    // Setup Tauri listeners
    const setupTauriListeners = async () => {
      // Listen for deep links
      const unlisten = await listen('tauri://deep-link', (event) => {
        console.log('Deep link received:', event);
      });

      // Listen for window events
      const unlistenBlur = await listen('tauri://blur', () => {
        document.body.classList.add('window-blur');
      });

      const unlistenFocus = await listen('tauri://focus', () => {
        document.body.classList.remove('window-blur');
      });

      return () => {
        unlisten();
        unlistenBlur();
        unlistenFocus();
      };
    };

    setupTauriListeners();
  }, []);

  return (
    <div 
      className="App no-context-menu"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      style={{ 
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
    >
      <AppRouter />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--background-floating)',
            color: 'var(--text-normal)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;