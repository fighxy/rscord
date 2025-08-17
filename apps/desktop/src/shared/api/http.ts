import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { API_CONFIG } from '../../config/api';

// Create axios instance with default config
const httpClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
httpClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and retry logic
httpClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful responses in development
    if (import.meta.env.DEV) {
      console.log(`[API] Response:`, response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Try to refresh token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_CONFIG.BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token } = response.data;
          localStorage.setItem('auth_token', access_token);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return httpClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    
    // Handle network errors with retry
    if (!error.response && !originalRequest._retryCount) {
      originalRequest._retryCount = 0;
    }
    
    if (!error.response && originalRequest._retryCount < API_CONFIG.RETRY.MAX_ATTEMPTS) {
      originalRequest._retryCount++;
      
      // Calculate delay with exponential backoff
      const delay = API_CONFIG.RETRY.DELAY * Math.pow(
        API_CONFIG.RETRY.BACKOFF_MULTIPLIER,
        originalRequest._retryCount - 1
      );
      
      console.warn(`[API] Network error, retrying in ${delay}ms... (attempt ${originalRequest._retryCount})`);
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, delay));
      return httpClient(originalRequest);
    }
    
    // Log errors in development
    if (import.meta.env.DEV) {
      console.error('[API] Error:', error.response?.data || error.message);
    }
    
    // Format error message for UI
    let errorMessage = 'Произошла ошибка';
    
    if (error.response?.data) {
      const data = error.response.data as any;
      errorMessage = data.message || data.error || errorMessage;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Превышено время ожидания запроса';
    } else if (!error.response) {
      errorMessage = 'Ошибка сети. Проверьте подключение к интернету';
    }
    
    // Enhance error object with formatted message
    const enhancedError = {
      ...error,
      message: errorMessage,
      statusCode: error.response?.status,
      originalError: error,
    };
    
    return Promise.reject(enhancedError);
  }
);

// Helper functions for common HTTP methods
export const apiClient = {
  get: <T = any>(url: string, config = {}) => 
    httpClient.get<T>(url, config).then(res => res.data),
    
  post: <T = any>(url: string, data?: any, config = {}) =>
    httpClient.post<T>(url, data, config).then(res => res.data),
    
  put: <T = any>(url: string, data?: any, config = {}) =>
    httpClient.put<T>(url, data, config).then(res => res.data),
    
  patch: <T = any>(url: string, data?: any, config = {}) =>
    httpClient.patch<T>(url, data, config).then(res => res.data),
    
  delete: <T = any>(url: string, config = {}) =>
    httpClient.delete<T>(url, config).then(res => res.data),
};

export default httpClient;
