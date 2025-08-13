import httpClient from "../../shared/api/http";

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface AddReactionRequest {
  user_id: string;
  emoji: string;
}

// Получение реакций для сообщения
export async function getReactions(messageId: string): Promise<Reaction[]> {
  try {
    const response = await httpClient.get<Reaction[]>(`/messages/${messageId}/reactions`);
    return response.data;
  } catch (error) {
    console.error('Failed to get reactions:', error);
    return [];
  }
}

// Добавление реакции
export async function addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  try {
    await httpClient.post(`/messages/${messageId}/reactions`, {
      user_id: userId,
      emoji
    });
  } catch (error: any) {
    if (error.response?.status === 409) {
      throw new Error('Реакция уже существует');
    }
    throw new Error('Ошибка при добавлении реакции');
  }
}

// Удаление реакции
export async function removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  try {
    await httpClient.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
      data: { user_id: userId }
    });
  } catch (error: any) {
    throw new Error('Ошибка при удалении реакции');
  }
}

// Получение статистики реакций
export async function getReactionStats(messageId: string): Promise<{ total: number; top_emojis: string[] }> {
  try {
    const response = await httpClient.get<{ total: number; top_emojis: string[] }>(`/messages/${messageId}/reactions/stats`);
    return response.data;
  } catch (error) {
    console.error('Failed to get reaction stats:', error);
    return { total: 0, top_emojis: [] };
  }
}
