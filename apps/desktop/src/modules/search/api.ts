import httpClient from "../../shared/api/http";

export interface SearchMessageResult {
  id: string;
  content: string;
  channel_name: string;
  guild_name: string;
  timestamp: string;
  author_name: string;
}

export interface SearchChannelResult {
  id: string;
  name: string;
  type: string;
  guild_name: string;
}

export interface SearchResponse {
  messages: SearchMessageResult[];
  channels: SearchChannelResult[];
}

// Поиск по сообщениям
export async function searchMessages(query: string): Promise<SearchMessageResult[]> {
  try {
    const response = await httpClient.get<SearchMessageResult[]>(`/search/messages?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Search messages error:', error);
    return [];
  }
}

// Поиск по каналам
export async function searchChannels(query: string): Promise<SearchChannelResult[]> {
  try {
    const response = await httpClient.get<SearchChannelResult[]>(`/search/channels?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Search channels error:', error);
    return [];
  }
}

// Общий поиск
export async function searchAll(query: string): Promise<SearchResponse> {
  try {
    const response = await httpClient.get<SearchResponse>(`/search?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    console.error('Search all error:', error);
    return { messages: [], channels: [] };
  }
}
