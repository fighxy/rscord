import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/store';

// Pages
import LoginPage from '../modules/auth/pages/LoginPage';
import RegisterPage from '../modules/auth/pages/RegisterPage';
import TelegramAuthPage from '../modules/auth/pages/TelegramAuthPage';
import InitializationPage from '../modules/auth/pages/InitializationPage';
import HomePage from '../modules/home/HomePage';
import { ProtectedRoute } from './auth/ProtectedRoute';

export function AppRouter() {
  const { isAuthenticated, token, initialize } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Инициализируем auth store
    initialize();
    setIsInitializing(false);
  }, [initialize]);

  // Показываем загрузку пока проверяем авторизацию
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background-tertiary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--discord-blurple)' }}></div>
          <p className="text-white text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Публичные маршруты */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/telegram-auth" element={<TelegramAuthPage />} />
      
      {/* Защищенные маршруты */}
      <Route path="/initialization" element={
        <ProtectedRoute>
          <InitializationPage />
        </ProtectedRoute>
      } />
      <Route path="/app" element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      } />
      
      {/* Корневой маршрут - перенаправляет в зависимости от состояния авторизации */}
      <Route path="/" element={
        isAuthenticated && token ? 
          <Navigate to="/app" replace /> : 
          <Navigate to="/login" replace />
      } />
      
      {/* Все остальные маршруты перенаправляют на логин */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}