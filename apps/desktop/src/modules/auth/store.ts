import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
  token: string | null;
  user: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: { id: string; email: string; displayName: string } | null) => void;
  logout: () => void;
  checkAuth: () => boolean;
};

export const useAuth = create<AuthState>()(
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
        set({ token: null, user: null, isAuthenticated: false });
      },
      checkAuth: () => {
        const token = localStorage.getItem('auth_token');
        const isAuth = !!token;
        set({ isAuthenticated: isAuth });
        return isAuth;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);


