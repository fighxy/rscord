// Environment Configuration for RSCORD Desktop
export const ENV_CONFIG = {
  // Development (localhost)
  DEVELOPMENT: {
    API_URL: 'http://localhost:14700',
    WS_URL: 'ws://localhost:14700',
    AUTH_URL: 'http://localhost:14701',
    VOICE_URL: 'http://localhost:14705',
    PRESENCE_URL: 'http://localhost:14706',
  },
  
  // Production (remote server)
  PRODUCTION: {
    API_URL: 'http://5.35.83.143:14700',
    WS_URL: 'ws://5.35.83.143:14700',
    AUTH_URL: 'http://5.35.83.143:14701',
    VOICE_URL: 'http://5.35.83.143:14705',
    PRESENCE_URL: 'http://5.35.83.143:14706',
  },
  
  // Custom (for testing different servers)
  CUSTOM: {
    API_URL: process.env.VITE_API_URL || 'http://localhost:14700',
    WS_URL: process.env.VITE_WS_URL || 'ws://localhost:14700',
    AUTH_URL: process.env.VITE_AUTH_URL || 'http://localhost:14701',
    VOICE_URL: process.env.VITE_VOICE_URL || 'http://localhost:14705',
    PRESENCE_URL: process.env.VITE_PRESENCE_URL || 'http://localhost:14706',
  }
};

// Determine current environment
export const getCurrentEnvironment = (): 'development' | 'production' | 'custom' => {
  if (process.env.NODE_ENV === 'development') {
    return 'development';
  }
  
  if (process.env.VITE_API_URL && process.env.VITE_API_URL !== ENV_CONFIG.DEVELOPMENT.API_URL) {
    return 'custom';
  }
  
  return 'production';
};

// Get current configuration
export const getCurrentConfig = () => {
  const env = getCurrentEnvironment();
  return ENV_CONFIG[env.toUpperCase() as keyof typeof ENV_CONFIG];
};

export default ENV_CONFIG;
