import API_CONFIG from '../../config/api';

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  channel_type: 'text' | 'voice'; // Для совместимости с компонентами
  server_id: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelRequest {
  name: string;
  type: 'text' | 'voice';
  server_id: string;
}

export const channelsAPI = {
  async getChannels(serverId: string): Promise<Channel[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS.LIST(serverId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get channels');
    }

    return await response.json();
  },

  async createChannel(data: CreateChannelRequest): Promise<Channel> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS.CREATE(data.server_id)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create channel');
    }

    return await response.json();
  },

  async updateChannel(serverId: string, channelId: string, data: Partial<Channel>): Promise<Channel> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS.UPDATE(serverId, channelId)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update channel');
    }

    return await response.json();
  },

  async deleteChannel(serverId: string, channelId: string): Promise<void> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS.DELETE(serverId, channelId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete channel');
    }
  }
};

// Экспортируем функции для совместимости с компонентами
export const listChannels = channelsAPI.getChannels;
export const createChannel = channelsAPI.createChannel;
export const updateChannel = channelsAPI.updateChannel;
export const deleteChannel = channelsAPI.deleteChannel;


