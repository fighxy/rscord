// API Configuration for RSCORD Desktop (Tauri)
import { invoke } from '@tauri-apps/api/core';

// Server configuration
export const API_CONFIG = {
  // Server URLs - always use production server
  BASE_URL: 'http://5.35.83.143:14710',
  AUTH_URL: 'http://5.35.83.143:14701',
  WS_URL: 'ws://5.35.83.143:14710',
  
  // API endpoints
  ENDPOINTS: {
    // Auth
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      REFRESH: '/api/auth/refresh',
      LOGOUT: '/api/auth/logout',
      VERIFY: '/api/auth/verify',
      CHECK_USERNAME: '/api/auth/check-username',
      SUGGEST_USERNAME: '/api/auth/suggest-username',
      // Telegram Auth
      TELEGRAM_AUTH: '/api/auth/telegram',
      TELEGRAM_REQUEST_CODE: '/api/auth/telegram/request-code',
      TELEGRAM_VERIFY_CODE: '/api/auth/telegram/verify-code',
      TELEGRAM_REGISTER: '/api/auth/telegram/register',
      TELEGRAM_LOGIN: '/api/auth/telegram/login',
    },
    // User
    USER: {
      PROFILE: '/api/users/profile',
      UPDATE: '/api/users/update',
      AVATAR: '/api/users/avatar',
      STATUS: '/api/users/status',
      SETTINGS: '/api/users/settings',
    },
    // Servers
    SERVERS: {
      LIST: '/api/servers',
      CREATE: '/api/servers/create',
      JOIN: '/api/servers/join',
      LEAVE: (id: string) => `/api/servers/${id}/leave`,
      DELETE: (id: string) => `/api/servers/${id}`,
      MEMBERS: (id: string) => `/api/servers/${id}/members`,
    },
    // Channels
    CHANNELS: {
      LIST: (serverId: string) => `/api/servers/${serverId}/channels`,
      CREATE: (serverId: string) => `/api/servers/${serverId}/channels`,
      UPDATE: (serverId: string, channelId: string) => `/api/servers/${serverId}/channels/${channelId}`,
      DELETE: (serverId: string, channelId: string) => `/api/servers/${serverId}/channels/${channelId}`,
    },
    // Messages
    MESSAGES: {
      LIST: (channelId: string) => `/api/channels/${channelId}/messages`,
      SEND: (channelId: string) => `/api/channels/${channelId}/messages`,
      UPDATE: (channelId: string, messageId: string) => `/api/channels/${channelId}/messages/${messageId}`,
      DELETE: (channelId: string, messageId: string) => `/api/channels/${channelId}/messages/${messageId}`,
      REACT: (channelId: string, messageId: string) => `/api/channels/${channelId}/messages/${messageId}/react`,
    },
    // Voice
    VOICE: {
      JOIN: (channelId: string) => `/api/voice/channels/${channelId}/join`,
      LEAVE: (channelId: string) => `/api/voice/channels/${channelId}/leave`,
      MUTE: '/api/voice/mute',
      DEAFEN: '/api/voice/deafen',
      ICE_SERVERS: '/api/voice/ice-servers',
    },
    // Files
    FILES: {
      UPLOAD: '/api/files/upload',
      DOWNLOAD: (fileId: string) => `/api/files/${fileId}`,
      DELETE: (fileId: string) => `/api/files/${fileId}`,
    },
  },
  
  // WebSocket events
  WS_EVENTS: {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ERROR: 'error',
    
    // Auth
    AUTHENTICATED: 'authenticated',
    UNAUTHORIZED: 'unauthorized',
    
    // Messages
    MESSAGE_CREATE: 'message:create',
    MESSAGE_UPDATE: 'message:update',
    MESSAGE_DELETE: 'message:delete',
    MESSAGE_REACTION: 'message:reaction',
    
    // Presence
    PRESENCE_UPDATE: 'presence:update',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    
    // Voice
    VOICE_STATE_UPDATE: 'voice:state:update',
    VOICE_SPEAKING: 'voice:speaking',
    
    // Server events
    SERVER_UPDATE: 'server:update',
    CHANNEL_CREATE: 'channel:create',
    CHANNEL_UPDATE: 'channel:update',
    CHANNEL_DELETE: 'channel:delete',
    MEMBER_JOIN: 'member:join',
    MEMBER_LEAVE: 'member:leave',
    MEMBER_UPDATE: 'member:update',
  },
  
  // Request configuration
  REQUEST: {
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  },
};

// Storage keys for Tauri
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  SETTINGS: 'settings',
  THEME: 'theme',
  LAST_SERVER: 'last_server',
  LAST_CHANNEL: 'last_channel',
};

// Tauri-specific storage functions
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return await invoke('get_storage', { key });
    } catch (error) {
      console.error(`Failed to get ${key} from storage:`, error);
      return null;
    }
  },
  
  async set(key: string, value: string): Promise<void> {
    try {
      await invoke('set_storage', { key, value });
    } catch (error) {
      console.error(`Failed to set ${key} in storage:`, error);
    }
  },
  
  async remove(key: string): Promise<void> {
    try {
      await invoke('remove_storage', { key });
    } catch (error) {
      console.error(`Failed to remove ${key} from storage:`, error);
    }
  },
  
  async clear(): Promise<void> {
    try {
      await invoke('clear_storage');
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },
};



// Check server connection
export async function checkServerConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
      method: 'GET',
      mode: 'cors',
    });
    return response.ok;
  } catch (error) {
    console.error('Server connection check failed:', error);
    return false;
  }
}

// Get stored auth token
export async function getAuthToken(): Promise<string | null> {
  return await storage.get(STORAGE_KEYS.ACCESS_TOKEN);
}

// Set auth token
export async function setAuthToken(token: string): Promise<void> {
  await storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
}

// Clear auth data
export async function clearAuthData(): Promise<void> {
  await storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
  await storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
  await storage.remove(STORAGE_KEYS.USER_DATA);
}

// API request helper with Tauri support
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

export default API_CONFIG;
