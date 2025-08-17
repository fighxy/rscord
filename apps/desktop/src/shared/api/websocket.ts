import { API_CONFIG, buildWsUrl } from '../../config/api';

export type WebSocketEventHandler = (data: any) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval = 30000; // 30 seconds
  private isIntentionalClose = false;

  constructor() {
    // Bind methods to preserve context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
  }

  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = buildWsUrl('/gateway');
      const url = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;
      
      console.log('[WebSocket] Connecting to:', wsUrl);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        
        // Send authentication if token provided
        if (token) {
          this.send('auth', { token });
        }
        
        this.emit(API_CONFIG.WS_EVENTS.CONNECT, {});
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message);
          
          // Handle different message types
          if (message.type === 'pong') {
            // Heartbeat response
            return;
          }
          
          if (message.type === 'error') {
            console.error('[WebSocket] Server error:', message.data);
            this.emit(API_CONFIG.WS_EVENTS.ERROR, message.data);
            return;
          }
          
          // Emit event to handlers
          if (message.type) {
            this.emit(message.type, message.data || message);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.emit(API_CONFIG.WS_EVENTS.ERROR, error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        this.stopHeartbeat();
        this.emit(API_CONFIG.WS_EVENTS.DISCONNECT, { code: event.code, reason: event.reason });
        
        // Attempt to reconnect if not intentional close
        if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    });
  }

  disconnect() {
    console.log('[WebSocket] Disconnecting...');
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(type: string, data?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message, not connected');
      return;
    }

    const message = JSON.stringify({ type, data });
    console.log('[WebSocket] Sending:', { type, data });
    this.ws.send(message);
  }

  on(event: string, handler: WebSocketEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  off(event: string, handler: WebSocketEventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.isIntentionalClose = false;
      
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.connect(token).catch(error => {
          console.error('[WebSocket] Reconnection failed:', error);
        });
      }
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping');
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Helper methods for common events
  onMessage(handler: (message: any) => void) {
    return this.on(API_CONFIG.WS_EVENTS.MESSAGE_CREATE, handler);
  }

  onPresenceUpdate(handler: (presence: any) => void) {
    return this.on(API_CONFIG.WS_EVENTS.PRESENCE_UPDATE, handler);
  }

  onTyping(handler: (data: any) => void) {
    return this.on(API_CONFIG.WS_EVENTS.TYPING_START, handler);
  }

  sendMessage(channelId: string, content: string) {
    this.send('message_send', { channel_id: channelId, content });
  }

  sendTyping(channelId: string) {
    this.send('typing_start', { channel_id: channelId });
  }

  updatePresence(status: 'online' | 'idle' | 'dnd' | 'offline') {
    this.send('presence_update', { status });
  }

  joinVoiceChannel(channelId: string) {
    this.send('voice_state_update', { channel_id: channelId, join: true });
  }

  leaveVoiceChannel(channelId: string) {
    this.send('voice_state_update', { channel_id: channelId, join: false });
  }

  // Singleton instance
  private static instance: WebSocketService;

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
}

// Export singleton instance
export const wsService = WebSocketService.getInstance();
