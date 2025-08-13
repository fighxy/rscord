import httpClient from "../../shared/api/http";

export interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  mentionable: boolean;
  hoist: boolean;
  created_at: string;
}

export interface CreateRoleRequest {
  name: string;
  color: string;
  permissions: string[];
  mentionable: boolean;
  hoist: boolean;
}

export interface UpdateRoleRequest {
  name?: string;
  color?: string;
  permissions?: string[];
  mentionable?: boolean;
  hoist?: boolean;
}

export interface Member {
  id: string;
  display_name: string;
  email: string;
  joined_at: string;
  roles: Role[];
}

export interface RoleAssignment {
  user_id: string;
  role_id: string;
}

// Получение ролей сервера
export async function getGuildRoles(guildId: string): Promise<Role[]> {
  try {
    const response = await httpClient.get<Role[]>(`/guilds/${guildId}/roles`);
    return response.data;
  } catch (error) {
    console.error('Failed to get guild roles:', error);
    return [];
  }
}

// Создание новой роли
export async function createRole(guildId: string, data: CreateRoleRequest): Promise<Role> {
  try {
    const response = await httpClient.post<Role>(`/guilds/${guildId}/roles`, data);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('У вас нет прав для создания ролей');
    }
    if (error.response?.status === 400) {
      throw new Error('Неверные данные для создания роли');
    }
    throw new Error('Ошибка при создании роли');
  }
}

// Обновление роли
export async function updateRole(guildId: string, roleId: string, data: UpdateRoleRequest): Promise<Role> {
  try {
    const response = await httpClient.put<Role>(`/guilds/${guildId}/roles/${roleId}`, data);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('У вас нет прав для редактирования этой роли');
    }
    if (error.response?.status === 404) {
      throw new Error('Роль не найдена');
    }
    throw new Error('Ошибка при обновлении роли');
  }
}

// Удаление роли
export async function deleteRole(guildId: string, roleId: string): Promise<void> {
  try {
    await httpClient.delete(`/guilds/${guildId}/roles/${roleId}`);
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('У вас нет прав для удаления этой роли');
    }
    if (error.response?.status === 400) {
      throw new Error('Нельзя удалить роль с более высоким приоритетом');
    }
    throw new Error('Ошибка при удалении роли');
  }
}

// Назначение роли пользователю
export async function assignRole(guildId: string, userId: string, roleId: string): Promise<void> {
  try {
    await httpClient.post(`/guilds/${guildId}/members/${userId}/roles`, {
      role_id: roleId
    });
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('У вас нет прав для назначения этой роли');
    }
    if (error.response?.status === 409) {
      throw new Error('Пользователь уже имеет эту роль');
    }
    throw new Error('Ошибка при назначении роли');
  }
}

// Удаление роли у пользователя
export async function removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
  try {
    await httpClient.delete(`/guilds/${guildId}/members/${userId}/roles/${roleId}`);
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('У вас нет прав для удаления этой роли');
    }
    throw new Error('Ошибка при удалении роли');
  }
}

// Получение участников сервера
export async function getGuildMembers(guildId: string): Promise<Member[]> {
  try {
    const response = await httpClient.get<Member[]>(`/guilds/${guildId}/members`);
    return response.data;
  } catch (error) {
    console.error('Failed to get guild members:', error);
    return [];
  }
}

// Получение ролей пользователя
export async function getUserRoles(guildId: string, userId: string): Promise<Role[]> {
  try {
    const response = await httpClient.get<Role[]>(`/guilds/${guildId}/members/${userId}/roles`);
    return response.data;
  } catch (error) {
    console.error('Failed to get user roles:', error);
    return [];
  }
}

// Изменение позиции ролей
export async function reorderRoles(guildId: string, roleIds: string[]): Promise<void> {
  try {
    await httpClient.put(`/guilds/${guildId}/roles/reorder`, {
      role_ids: roleIds
    });
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('У вас нет прав для изменения порядка ролей');
    }
    throw new Error('Ошибка при изменении порядка ролей');
  }
}

// Проверка прав пользователя
export async function checkUserPermission(guildId: string, userId: string, permission: string): Promise<boolean> {
  try {
    const response = await httpClient.get<{ has_permission: boolean }>(`/guilds/${guildId}/members/${userId}/permissions/${permission}`);
    return response.data.has_permission;
  } catch (error) {
    console.error('Failed to check user permission:', error);
    return false;
  }
}

// Получение всех прав пользователя
export async function getUserPermissions(guildId: string, userId: string): Promise<string[]> {
  try {
    const response = await httpClient.get<{ permissions: string[] }>(`/guilds/${guildId}/members/${userId}/permissions`);
    return response.data.permissions;
  } catch (error) {
    console.error('Failed to get user permissions:', error);
    return [];
  }
}
