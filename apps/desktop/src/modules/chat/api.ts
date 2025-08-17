import API_CONFIG from '../../config/api';

export interface Message {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  author_id: string; // Для совместимости с компонентами
  created_at: string;
  updated_at: string;
}

export const chatAPI = {
  async getMessages(channelId: string): Promise<Message[]> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MESSAGES.LIST(channelId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get messages');
    }

    return await response.json();
  },

  async sendMessage(channelId: string, content: string): Promise<Message> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MESSAGES.SEND(channelId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return await response.json();
  }
};

// Экспортируем функции для совместимости с компонентами
export const listMessages = chatAPI.getMessages;
export const sendMessage = async (channelId: string, userId: string, content: string): Promise<Message> => {
  return await chatAPI.sendMessage(channelId, content);
};


