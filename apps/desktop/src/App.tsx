import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Context Providers
import { AuthProvider } from './modules/auth/store';
import { ThemeProvider } from './contexts/ThemeContext';

// Pages
import LoginPage from './modules/auth/pages/LoginPage';
import RegisterPage from './modules/auth/pages/RegisterPage';
import HomePage from './modules/home/HomePage';

// API Configuration
import { API_CONFIG } from './config/api';

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
  const [isInitialized, setIsInitialized] = useState(false);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

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

    // Check server connection
    const checkConnection = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/health`);
        if (response.ok) {
          setServerStatus('connected');
          console.log('Connected to server at', API_CONFIG.BASE_URL);
        } else {
          setServerStatus('error');
          console.warn('Server returned error status');
        }
      } catch (error) {
        console.error('Server not reachable:', error);
        setServerStatus('error');
        // Try to invoke Tauri command to check local server
        try {
          await invoke('check_server_status');
        } catch (e) {
          console.error('Failed to check server status via Tauri:', e);
        }
      } finally {
        setIsInitialized(true);
      }
    };

    setupTauriListeners();
    checkConnection();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-discord-blurple mx-auto mb-4"></div>
          <p className="text-white text-lg">Инициализация...</p>
          {serverStatus === 'error' && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg max-w-md">
              <p className="text-red-300 text-sm mb-2">Не удалось подключиться к серверу</p>
              <p className="text-gray-400 text-xs">
                Текущий сервер: {API_CONFIG.BASE_URL}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Проверьте, запущен ли сервер и доступен ли порт
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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