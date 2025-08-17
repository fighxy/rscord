// API Configuration for RSCORD microservices
export const API_CONFIG = {
  // Base URLs - can be overridden with environment variables
  BASE_URL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:14702',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:14702',
  
  // Microservice endpoints
  SERVICES: {
    AUTH: '/auth',
    CHAT: '/chat', 
    VOICE: '/voice',
    PRESENCE: '/presence',
    GATEWAY: '/gateway',
    GUILDS: '/guilds',
    CHANNELS: '/channels',
    MESSAGES: '/messages',
    USERS: '/users',
  },
  
  // WebSocket events
  WS_EVENTS: {
    // Connection events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ERROR: 'error',
    
    // Auth events
    AUTH_SUCCESS: 'auth_success',
    AUTH_ERROR: 'auth_error',
    
    // Message events
    MESSAGE_CREATE: 'message_create',
    MESSAGE_UPDATE: 'message_update',
    MESSAGE_DELETE: 'message_delete',
    
    // Typing events
    TYPING_START: 'typing_start',
    TYPING_STOP: 'typing_stop',
    
    // Presence events
    PRESENCE_UPDATE: 'presence_update',
    USER_STATUS_UPDATE: 'user_status_update',
    
    // Voice events
    VOICE_STATE_UPDATE: 'voice_state_update',
    VOICE_SERVER_UPDATE: 'voice_server_update',
    
    // Guild events
    GUILD_CREATE: 'guild_create',
    GUILD_UPDATE: 'guild_update',
    GUILD_DELETE: 'guild_delete',
    
    // Channel events
    CHANNEL_CREATE: 'channel_create',
    CHANNEL_UPDATE: 'channel_update',
    CHANNEL_DELETE: 'channel_delete',
    
    // Member events
    MEMBER_JOIN: 'member_join',
    MEMBER_LEAVE: 'member_leave',
    MEMBER_UPDATE: 'member_update',
  },
  
  // Request timeout
  TIMEOUT: 10000,
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000,
    BACKOFF_MULTIPLIER: 2,
  },
  
  // File upload limits
  FILE_UPLOAD: {
    MAX_SIZE: 25 * 1024 * 1024, // 25MB
    ALLOWED_TYPES: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/ogg',
      'application/pdf',
    ],
  },
  
  // LiveKit configuration for voice/video
  LIVEKIT: {
    URL: import.meta.env.VITE_LIVEKIT_URL || 'ws://127.0.0.1:7880',
    API_KEY: import.meta.env.VITE_LIVEKIT_API_KEY || 'devkey',
    API_SECRET: import.meta.env.VITE_LIVEKIT_API_SECRET || 'secret',
  },
};

// Helper function to build full API URLs
export function buildApiUrl(service: keyof typeof API_CONFIG.SERVICES, path: string = ''): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.SERVICES[service]}${path}`;
}

// Helper function to build WebSocket URLs
export function buildWsUrl(path: string = ''): string {
  return `${API_CONFIG.WS_URL}${path}`;
}

export default API_CONFIG;
