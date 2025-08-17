import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import MainApp from './pages/MainApp';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';

// API Configuration
import { setupAxiosInterceptors } from './services/api';
import { API_CONFIG } from './config/api';

// Glassmorphism styles
import './styles/glassmorphism.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

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

    // Setup API interceptors
    setupAxiosInterceptors();
    
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
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <WebSocketProvider>
              <div className="app-container glassmorphism">
                {/* Background orbs for glassmorphism effect */}
                <div className="bg-orb orb-1"></div>
                <div className="bg-orb orb-2"></div>
                <div className="bg-orb orb-3"></div>
                
                {/* Server status indicator */}
                {serverStatus === 'error' && (
                  <div className="server-status-banner">
                    <span className="status-icon">⚠️</span>
                    <span>Connecting to server...</span>
                  </div>
                )}

                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/app/*"
                    element={
                      <ProtectedRoute>
                        <MainApp />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/" element={<Navigate to="/app" replace />} />
                </Routes>

                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: 'rgba(148, 163, 184, 0.1)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: '#e6f1ff',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    },
                    success: {
                      iconTheme: {
                        primary: '#43b581',
                        secondary: '#e6f1ff',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#f04747',
                        secondary: '#e6f1ff',
                      },
                    },
                  }}
                />
              </div>
            </WebSocketProvider>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
