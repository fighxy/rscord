import { apiClient } from '../../shared/api/http';
import { buildApiUrl } from '../../config/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  display_name: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  user?: {
    id: string;
    email: string;
    display_name: string;
  };
}

export interface UserResponse {
  user: {
    id: string;
    email: string;
    display_name: string;
    username?: string;
    created_at: string;
  };
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  display_name: string;
  username?: string;
  avatar?: string;
  created_at: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
}

export const authAPI = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      return await apiClient.post(buildApiUrl('AUTH', '/login'), data);
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Неверный email или пароль');
      }
      if (error.statusCode === 429) {
        throw new Error('Слишком много попыток. Попробуйте позже');
      }
      throw error;
    }
  },

  async register(data: RegisterRequest): Promise<UserResponse> {
    try {
      return await apiClient.post(buildApiUrl('AUTH', '/register'), data);
    } catch (error: any) {
      if (error.statusCode === 409) {
        throw new Error('Пользователь с таким email уже существует');
      }
      if (error.statusCode === 400) {
        const message = error.response?.data?.details || 'Неверные данные';
        throw new Error(message);
      }
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate token on server
      await apiClient.post(buildApiUrl('AUTH', '/logout'));
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
  },

  async getCurrentUser(): Promise<CurrentUserResponse> {
    try {
      return await apiClient.get(buildApiUrl('AUTH', '/me'));
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Не авторизован');
      }
      throw error;
    }
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      return await apiClient.post(buildApiUrl('AUTH', '/refresh'), {
        refresh_token: refreshToken
      });
    } catch (error: any) {
      throw new Error('Не удалось обновить токен');
    }
  },

  async updateProfile(data: Partial<CurrentUserResponse>): Promise<CurrentUserResponse> {
    try {
      return await apiClient.patch(buildApiUrl('AUTH', '/profile'), data);
    } catch (error: any) {
      throw error;
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post(buildApiUrl('AUTH', '/change-password'), {
        old_password: oldPassword,
        new_password: newPassword
      });
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Неверный текущий пароль');
      }
      throw error;
    }
  }
};
