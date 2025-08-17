// Reactions API - placeholder implementation
export const reactionsAPI = {
  async addReaction(messageId: string, emoji: string, userId?: string): Promise<void> {
    // Placeholder implementation
    console.log('Adding reaction:', emoji, 'to message:', messageId, 'by user:', userId);
  },

  async removeReaction(messageId: string, emoji: string, userId?: string): Promise<void> {
    // Placeholder implementation
    console.log('Removing reaction:', emoji, 'from message:', messageId, 'by user:', userId);
  },

  async getReactions(messageId: string): Promise<any[]> {
    // Placeholder implementation
    console.log('Getting reactions for message:', messageId);
    return [];
  }
};

// Экспортируем функции для совместимости с компонентами
export const addReaction = (messageId: string, emoji: string, userId?: string) => 
  reactionsAPI.addReaction(messageId, emoji, userId);
export const removeReaction = (messageId: string, emoji: string, userId?: string) => 
  reactionsAPI.removeReaction(messageId, emoji, userId);
export const getReactions = reactionsAPI.getReactions;
