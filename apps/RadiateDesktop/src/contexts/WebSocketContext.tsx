import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_CONFIG } from '../config/api';
import toast from 'react-hot-toast';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  emit: () => {},
  on: () => {},
  off: () => {},
  reconnect: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(API_CONFIG.WS_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
      
      // Clear any existing reconnect timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      
      // Emit authentication event
      newSocket.emit(API_CONFIG.WS_EVENTS.AUTHENTICATED, { userId: user.id });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      
      // Handle reconnection based on disconnect reason
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        toast.error('Connection lost. Attempting to reconnect...');
        attemptReconnect(newSocket);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        toast.error('Failed to connect to server. Please check your connection.');
      }
    });

    // Handle authentication errors
    newSocket.on(API_CONFIG.WS_EVENTS.UNAUTHORIZED, () => {
      console.error('WebSocket authentication failed');
      toast.error('Authentication failed. Please login again.');
      // Trigger logout or refresh token
    });

    // Set up event listeners for app events
    setupEventListeners(newSocket);

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.off();
      newSocket.disconnect();
    };
  }, [user, token]);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback((socketInstance: Socket) => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      toast.error('Maximum reconnection attempts reached');
      return;
    }

    reconnectAttempts.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

    reconnectTimeout.current = setTimeout(() => {
      console.log(`Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
      socketInstance.connect();
    }, delay);
  }, []);

  // Set up global event listeners
  const setupEventListeners = (socketInstance: Socket) => {
    // Message events
    socketInstance.on(API_CONFIG.WS_EVENTS.MESSAGE_CREATE, (data) => {
      console.log('New message:', data);
      // Handle new message - will be consumed by components
    });

    socketInstance.on(API_CONFIG.WS_EVENTS.MESSAGE_UPDATE, (data) => {
      console.log('Message updated:', data);
    });

    socketInstance.on(API_CONFIG.WS_EVENTS.MESSAGE_DELETE, (data) => {
      console.log('Message deleted:', data);
    });

    // Presence events
    socketInstance.on(API_CONFIG.WS_EVENTS.PRESENCE_UPDATE, (data) => {
      console.log('Presence update:', data);
    });

    socketInstance.on(API_CONFIG.WS_EVENTS.TYPING_START, (data) => {
      console.log('User typing:', data);
    });

    socketInstance.on(API_CONFIG.WS_EVENTS.TYPING_STOP, (data) => {
      console.log('User stopped typing:', data);
    });

    // Voice events
    socketInstance.on(API_CONFIG.WS_EVENTS.VOICE_STATE_UPDATE, (data) => {
      console.log('Voice state update:', data);
    });

    // Server events
    socketInstance.on(API_CONFIG.WS_EVENTS.MEMBER_JOIN, (data) => {
      console.log('Member joined:', data);
      toast.success(`${data.username} joined the server`);
    });

    socketInstance.on(API_CONFIG.WS_EVENTS.MEMBER_LEAVE, (data) => {
      console.log('Member left:', data);
      toast(`${data.username} left the server`);
    });

    // Channel events
    socketInstance.on(API_CONFIG.WS_EVENTS.CHANNEL_CREATE, (data) => {
      console.log('Channel created:', data);
    });

    socketInstance.on(API_CONFIG.WS_EVENTS.CHANNEL_UPDATE, (data) => {
      console.log('Channel updated:', data);
    });

    socketInstance.on(API_CONFIG.WS_EVENTS.CHANNEL_DELETE, (data) => {
      console.log('Channel deleted:', data);
    });
  };

  // Emit event helper
  const emit = useCallback((event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  }, [socket, isConnected]);

  // Event listener helpers
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, handler);
    }
  }, [socket]);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (socket) {
      if (handler) {
        socket.off(event, handler);
      } else {
        socket.off(event);
      }
    }
  }, [socket]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (socket && !isConnected) {
      reconnectAttempts.current = 0;
      socket.connect();
    }
  }, [socket, isConnected]);

  const value = {
    socket,
    isConnected,
    emit,
    on,
    off,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
