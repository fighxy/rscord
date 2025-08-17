import API_CONFIG from '../../config/api';

export interface Guild {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  created_at: string;
}

export const guildsAPI = {
  async getGuilds(): Promise<Guild[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SERVERS.LIST}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get guilds');
    }

    return await response.json();
  },

  async createGuild(name: string, ownerId?: string): Promise<Guild> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SERVERS.CREATE}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, owner_id: ownerId }),
    });

    if (!response.ok) {
      throw new Error('Failed to create guild');
    }

    return await response.json();
  },

  async updateGuild(id: string, name: string): Promise<Guild> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SERVERS.DELETE(id)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error('Failed to update guild');
    }

    return await response.json();
  },

  async deleteGuild(id: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SERVERS.DELETE(id)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete guild');
    }
  }
};

// Экспортируем функции для совместимости с компонентами
export const listGuilds = guildsAPI.getGuilds;
export const createGuild = guildsAPI.createGuild;
export const updateGuild = guildsAPI.updateGuild;
export const deleteGuild = guildsAPI.deleteGuild;


