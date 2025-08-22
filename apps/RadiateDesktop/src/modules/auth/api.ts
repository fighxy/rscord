import API_CONFIG from '../../config/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username?: string;
  display_name: string;
  password: string;
}

export interface TelegramAuthRequest {
  auth_code: string;
}

export interface TelegramCodeRequest {
  code: string;
}

export interface CreateTelegramAuthRequest {
  app_name?: string;
}

export interface CreateTelegramAuthResponse {
  auth_code: string;
  bot_url: string;
  expires_in: number;
}

export interface CheckTelegramAuthResponse {
  confirmed: boolean;
  user_data?: {
    telegram_id: number;
    telegram_username?: string;
    first_name: string;
    last_name?: string;
  };
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  user?: {
    id: string;
    email: string;
    username: string;
    display_name: string;
  };
}

export interface UserResponse {
  user: {
    id: string;
    email: string;
    username: string;
    display_name: string;
    created_at: string;
  };
}

export interface CurrentUserResponse {
  id: string;
  telegram_id?: number;
  telegram_username?: string;
  email?: string;
  username: string;
  display_name: string;
  avatar?: string;
  created_at: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
}

export const authAPI = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw { statusCode: response.status, response: { data: errorData } };
      }
      
      return await response.json();
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
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.REGISTER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw { statusCode: response.status, response: { data: errorData } };
      }
      
      return await response.json();
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
      await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGOUT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
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
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.VERIFY}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw { statusCode: response.status };
      }
      
      return await response.json();
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Не авторизован');
      }
      throw error;
    }
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.REFRESH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        }),
      });
      
      if (!response.ok) {
        throw new Error('Не удалось обновить токен');
      }
      
      return await response.json();
    } catch (error: any) {
      throw new Error('Не удалось обновить токен');
    }
  },

  async updateProfile(data: Partial<CurrentUserResponse>): Promise<CurrentUserResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER.UPDATE}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Не удалось обновить профиль');
      }
      
      return await response.json();
    } catch (error: any) {
      throw error;
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER.SETTINGS}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw { statusCode: response.status, response: { data: errorData } };
      }
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Неверный текущий пароль');
      }
      throw error;
    }
  },

  async checkUsername(username: string): Promise<{ available: boolean; suggested?: string; error?: string }> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.CHECK_USERNAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });
      
      if (!response.ok) {
        throw new Error('Не удалось проверить username');
      }
      
      return await response.json();
    } catch (error: any) {
      throw error;
    }
  },

  async suggestUsername(displayName: string): Promise<{ suggested: string }> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.SUGGEST_USERNAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ display_name: displayName }),
      });
      
      if (!response.ok) {
        throw new Error('Не удалось предложить username');
      }
      
      return await response.json();
    } catch (error: any) {
      throw error;
    }
  },

  // Telegram authentication methods
  async createTelegramAuth(data: CreateTelegramAuthRequest = {}): Promise<CreateTelegramAuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.TELEGRAM_CREATE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Не удалось создать код для Telegram аутентификации');
      }
      
      return await response.json();
    } catch (error: any) {
      throw error;
    }
  },

  async checkTelegramAuth(authCode: string): Promise<CheckTelegramAuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.TELEGRAM_CHECK}?auth_code=${authCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Не удалось проверить статус Telegram аутентификации');
      }
      
      return await response.json();
    } catch (error: any) {
      throw error;
    }
  },

  async telegramAuth(data: TelegramAuthRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.TELEGRAM_AUTH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw { statusCode: response.status, response: { data: errorData } };
      }
      
      return await response.json();
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Код аутентификации неверен или истек');
      }
      throw error;
    }
  },

  async verifyTelegramCode(data: TelegramCodeRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.TELEGRAM_VERIFY_CODE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw { statusCode: response.status, response: { data: errorData } };
      }
      
      return await response.json();
    } catch (error: any) {
      if (error.statusCode === 401) {
        throw new Error('Код неверен или истек');
      }
      throw error;
    }
  }
};
