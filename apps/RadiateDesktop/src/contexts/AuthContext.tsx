import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG, storage, STORAGE_KEYS, apiRequest } from '../config/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateUser: () => {},
  refreshToken: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await storage.get(STORAGE_KEYS.ACCESS_TOKEN);
        const storedUser = await storage.get(STORAGE_KEYS.USER_DATA);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Verify token with server
          await verifyToken(storedToken);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        await clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Verify token with server
  const verifyToken = async (authToken: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.VERIFY}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      setUser(data.user);
      await storage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
    } catch (error) {
      console.error('Token verification failed:', error);
      await clearAuth();
      throw error;
    }
  };

  // Clear auth data
  const clearAuth = async () => {
    setUser(null);
    setToken(null);
    await storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
    await storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    await storage.remove(STORAGE_KEYS.USER_DATA);
  };

  // Login
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();

      // Store auth data
      setUser(data.user);
      setToken(data.accessToken);
      
      await storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      await storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      await storage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));

      toast.success('Successfully logged in!');
      navigate('/app');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to login');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register
  const register = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.REGISTER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const data = await response.json();

      // Store auth data
      setUser(data.user);
      setToken(data.accessToken);
      
      await storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      await storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      await storage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));

      toast.success('Account created successfully!');
      navigate('/app');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Failed to create account');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Call logout endpoint
      if (token) {
        await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGOUT}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearAuth();
      navigate('/login');
      toast.success('Successfully logged out');
    }
  };

  // Update user
  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      storage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Refresh token
  const refreshToken = async () => {
    try {
      const refreshToken = await storage.get(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.REFRESH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      setToken(data.accessToken);
      await storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      
      if (data.refreshToken) {
        await storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await clearAuth();
      navigate('/login');
      throw error;
    }
  };

  // Set up token refresh interval
  useEffect(() => {
    if (!token) return;

    // Refresh token every 15 minutes
    const interval = setInterval(() => {
      refreshToken().catch(console.error);
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [token]);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    updateUser,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
