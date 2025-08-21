// Search API - placeholder implementation
export const searchAPI = {
  async search(query: string): Promise<any[]> {
    // Placeholder implementation
    console.log('Searching for:', query);
    return [];
  }
};

// Экспортируем функции для совместимости с компонентами
export const searchMessages = async (query: string): Promise<any[]> => {
  console.log('Searching messages for:', query);
  return [];
};

export const searchChannels = async (query: string): Promise<any[]> => {
  console.log('Searching channels for:', query);
  return [];
};
