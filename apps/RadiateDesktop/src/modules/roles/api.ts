import API_CONFIG from '../../config/api';

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

export interface Member {
  id: string;
  username: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
}

export interface CreateRoleRequest {
  name: string;
  color: string;
  permissions: string[];
}

export const rolesAPI = {
  async getRoles(serverId: string): Promise<Role[]> {
    // Placeholder implementation
    console.log('Getting roles for server:', serverId);
    return [];
  },

  async createRole(guildId: string, data: CreateRoleRequest): Promise<Role> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/roles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create role');
    }

    return await response.json();
  },

  async updateRole(guildId: string, roleId: string, data: Partial<Role>): Promise<Role> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/roles/${roleId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update role');
    }

    return await response.json();
  },

  async deleteRole(guildId: string, roleId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete role');
    }
  },

  async assignRoleToMember(guildId: string, userId: string, roleId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/members/${userId}/roles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role_id: roleId }),
    });

    if (!response.ok) {
      throw new Error('Failed to assign role');
    }
  },

  async removeRoleFromMember(guildId: string, userId: string, roleId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to remove role');
    }
  },

  async getGuildMembers(guildId: string): Promise<Member[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/members`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get guild members');
    }

    return await response.json();
  },

  async getMemberRoles(guildId: string, userId: string): Promise<Role[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/members/${userId}/roles`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get member roles');
    }

    return await response.json();
  },

  async reorderRoles(guildId: string, roleIds: string[]): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/roles/reorder`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role_ids: roleIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to reorder roles');
    }
  },

  async checkPermission(guildId: string, userId: string, permission: string): Promise<boolean> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/members/${userId}/permissions/${permission}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.has_permission;
  },

  async getUserPermissions(guildId: string, userId: string): Promise<string[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/guilds/${guildId}/members/${userId}/permissions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.permissions;
  }
};

// Экспортируем функции для совместимости с компонентами
export const getGuildRoles = rolesAPI.getRoles;
export const createRole = rolesAPI.createRole;
export const updateRole = rolesAPI.updateRole;
export const deleteRole = rolesAPI.deleteRole;
export const assignRole = rolesAPI.assignRoleToMember;
export const removeRole = rolesAPI.removeRoleFromMember;
