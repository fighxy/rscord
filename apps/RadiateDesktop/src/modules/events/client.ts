import React from "react";
import { useAuth } from "../auth/store";

export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface TypingIndicator {
  user_id: string;
  channel_id: string;
  display_name: string;
  is_typing: boolean;
}

export interface MessageUpdate {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface ChannelUpdate {
  id: string;
  guild_id: string;
  name: string;
  channel_type: string;
  created_at: string;
}

export interface GuildUpdate {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface UserStatusUpdate {
  user_id: string;
  status: 'online' | 'offline' | 'idle' | 'dnd';
  custom_status?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting = false;

  constructor(private url: string = 'ws://127.0.0.1:14703') {}

  connect(token: string) {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(`${this.url}?token=${token}`);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(token);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
    }
  }

  private scheduleReconnect(token: string) {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(token);
      }
    }, delay);
  }

  private handleMessage(message: WebSocketMessage) {
    const { type, data } = message;
    
    // Эмитим событие для конкретного типа
    this.emit(type, data);
    
    // Эмитим общее событие для всех сообщений
    this.emit('message', message);
  }

  send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  // Методы для отправки конкретных типов сообщений
  sendTypingIndicator(channelId: string, isTyping: boolean) {
    this.send({
      type: 'typing_indicator',
      data: { channel_id: channelId, is_typing: isTyping }
    });
  }

  sendMessage(channelId: string, content: string) {
    this.send({
      type: 'send_message',
      data: { channel_id: channelId, content }
    });
  }

  joinChannel(channelId: string) {
    this.send({
      type: 'join_channel',
      data: { channel_id: channelId }
    });
  }

  leaveChannel(channelId: string) {
    this.send({
      type: 'leave_channel',
      data: { channel_id: channelId }
    });
  }

  // Система событий
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Хук для использования WebSocket клиента
export function useWebSocket() {
  const { token } = useAuth();
  
  if (!token) {
    return null;
  }

  // Создаем экземпляр клиента
  const client = new WebSocketClient();
  
  // Подключаемся при изменении токена
  React.useEffect(() => {
    if (token) {
      client.connect(token);
      
      return () => {
        client.disconnect();
      };
    }
  }, [token]);

  return client;
}


