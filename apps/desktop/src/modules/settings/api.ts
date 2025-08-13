import httpClient from "../../shared/api/http";

export interface UpdateProfileRequest {
  display_name: string;
  email: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

// Обновление профиля пользователя
export async function updateUserProfile(userId: string, data: UpdateProfileRequest): Promise<UserProfile> {
  try {
    const response = await httpClient.put<UserProfile>(`/users/${userId}/profile`, data);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 409) {
      throw new Error('Пользователь с таким email уже существует');
    }
    if (error.response?.status === 400) {
      throw new Error('Неверные данные. Проверьте введенную информацию.');
    }
    throw new Error('Ошибка при обновлении профиля. Попробуйте снова.');
  }
}

// Смена пароля пользователя
export async function changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
  try {
    await httpClient.put(`/users/${userId}/password`, data);
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Неверный текущий пароль');
    }
    if (error.response?.status === 400) {
      throw new Error('Новый пароль должен содержать минимум 6 символов');
    }
    throw new Error('Ошибка при смене пароля. Попробуйте снова.');
  }
}

// Получение профиля пользователя
export async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    const response = await httpClient.get<UserProfile>(`/users/${userId}/profile`);
    return response.data;
  } catch (error: any) {
    throw new Error('Ошибка при получении профиля пользователя');
  }
}
