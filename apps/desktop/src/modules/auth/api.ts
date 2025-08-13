import httpClient from '../shared/api/http';

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
  expires_at: number;
}

export interface UserResponse {
  user: {
    id: string;
    email: string;
    display_name: string;
    created_at: string;
  };
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export const authAPI = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await httpClient.post<AuthResponse>('/auth/login', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Неверный email или пароль');
      }
      throw new Error('Ошибка при входе. Попробуйте снова.');
    }
  },

  async register(data: RegisterRequest): Promise<UserResponse> {
    try {
      const response = await httpClient.post<UserResponse>('/auth/register', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error('Пользователь с таким email уже существует');
      }
      if (error.response?.status === 400) {
        throw new Error('Неверные данные. Проверьте введенную информацию.');
      }
      throw new Error('Ошибка при регистрации. Попробуйте снова.');
    }
  },

  async logout(): Promise<void> {
    // В простом случае просто очищаем токен на клиенте
    // Можно добавить вызов API для инвалидации токена на сервере
  },

  async getCurrentUser(): Promise<CurrentUserResponse> {
    try {
      const response = await httpClient.get<CurrentUserResponse>('/auth/me');
      return response.data;
    } catch (error: any) {
      throw new Error('Ошибка при получении информации о пользователе');
    }
  }
};
