import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createContext, useContext, useEffect } from "react";

interface AuthState {
  token: string | null;
  user: {
    id: string;
    telegram_id?: number;
    telegram_username?: string;
    email?: string;
    username: string;
    displayName: string;
  } | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: { 
    id: string; 
    telegram_id?: number;
    telegram_username?: string;
    email?: string; 
    username: string; 
    displayName: string; 
  } | null) => void;
  logout: () => void;
  checkAuth: () => boolean;
  initialize: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setToken: (token) => {
        if (token) {
          localStorage.setItem('auth_token', token);
          set({ token, isAuthenticated: true });
        } else {
          localStorage.removeItem('auth_token');
          set({ token: null, isAuthenticated: false, user: null });
        }
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('app-initialized'); // Сбрасываем флаг инициализации
        set({ token: null, user: null, isAuthenticated: false });
      },
      checkAuth: () => {
        const token = localStorage.getItem('auth_token');
        const isAuth = !!token;
        set({ isAuthenticated: isAuth });
        return isAuth;
      },
      initialize: () => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          set({ token, isAuthenticated: true });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

// Context для провайдера
const AuthContext = createContext<AuthState | undefined>(undefined);

// Provider компонент
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthStore();
  
  useEffect(() => {
    auth.initialize();
  }, [auth]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook для использования аутентификации
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}


