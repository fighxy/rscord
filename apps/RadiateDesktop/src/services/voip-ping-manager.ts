// VoIP Ping Manager for Real-time Latency Monitoring

import { PingResult, ConnectionQuality, getConnectionQuality } from '../types/voice-stats';

export class VoipPingManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private sequence = 0;
  private pingHistory: PingResult[] = [];
  private callbacks: ((ping: PingResult) => void)[] = [];
  
  private readonly PING_INTERVAL = 2000; // 2 seconds
  private readonly HISTORY_LENGTH = 30; // Keep last 30 pings
  private readonly TIMEOUT = 5000; // 5 second timeout

  constructor(private signalingUrl: string) {}

  /**
   * Connect to signaling server and start ping monitoring
   */
  public async startPing(): Promise<void> {
    try {
      this.ws = new WebSocket(this.signalingUrl);
      
      this.ws.onopen = () => {
        console.log('🏓 VoIP Ping: Connected to signaling server');
        this.startPingLoop();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('🏓 VoIP Ping: Disconnected from signaling server');
        this.cleanup();
      };

      this.ws.onerror = (error) => {
        console.error('🏓 VoIP Ping: WebSocket error:', error);
        this.addDisconnectedPing();
      };

    } catch (error) {
      console.error('🏓 VoIP Ping: Failed to connect:', error);
      this.addDisconnectedPing();
    }
  }

  /**
   * Stop ping monitoring and disconnect
   */
  public stopPing(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get current ping (last measured)
   */
  public getCurrentPing(): number | null {
    const latest = this.pingHistory[this.pingHistory.length - 1];
    return latest ? latest.rtt : null;
  }

  /**
   * Get average ping from recent history
   */
  public getAveragePing(): number | null {
    if (this.pingHistory.length === 0) return null;
    
    // Calculate average from last 10 pings or all available
    const recentPings = this.pingHistory.slice(-10);
    const validPings = recentPings.filter(p => p.rtt > 0);
    
    if (validPings.length === 0) return null;
    
    const sum = validPings.reduce((acc, ping) => acc + ping.rtt, 0);
    return Math.round(sum / validPings.length);
  }

  /**
   * Get ping history for graphing
   */
  public getPingHistory(): PingResult[] {
    return [...this.pingHistory];
  }

  /**
   * Subscribe to ping updates
   */
  public onPingUpdate(callback: (ping: PingResult) => void): () => void {
    this.callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Start the ping loop
   */
  private startPingLoop(): void {
    this.sendPing();
    
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.PING_INTERVAL);
  }

  /**
   * Send a ping message
   */
  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.addDisconnectedPing();
      return;
    }

    const timestamp = Date.now();
    const pingMessage = {
      type: 'ping',
      timestamp,
      sequence: this.sequence++
    };

    try {
      this.ws.send(JSON.stringify(pingMessage));
      
      // Set timeout for this ping
      setTimeout(() => {
        this.handlePingTimeout(pingMessage.sequence);
      }, this.TIMEOUT);
      
    } catch (error) {
      console.error('🏓 VoIP Ping: Failed to send ping:', error);
      this.addDisconnectedPing();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'pong') {
        this.handlePong(message);
      }
    } catch (error) {
      console.error('🏓 VoIP Ping: Failed to parse message:', error);
    }
  }

  /**
   * Handle pong response
   */
  private handlePong(pong: any): void {
    const now = Date.now();
    const rtt = now - pong.timestamp;
    
    const pingResult: PingResult = {
      rtt,
      sequence: pong.sequence,
      timestamp: pong.timestamp,
      serverTimestamp: pong.serverTimestamp,
      quality: getConnectionQuality(rtt)
    };

    this.addPingResult(pingResult);
  }

  /**
   * Handle ping timeout
   */
  private handlePingTimeout(sequence: number): void {
    // Check if we already received a pong for this sequence
    const exists = this.pingHistory.some(p => p.sequence === sequence);
    if (!exists) {
      this.addDisconnectedPing(sequence);
    }
  }

  /**
   * Add a ping result to history
   */
  private addPingResult(ping: PingResult): void {
    this.pingHistory.push(ping);
    
    // Keep only recent history
    if (this.pingHistory.length > this.HISTORY_LENGTH) {
      this.pingHistory = this.pingHistory.slice(-this.HISTORY_LENGTH);
    }

    // Notify callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(ping);
      } catch (error) {
        console.error('🏓 VoIP Ping: Callback error:', error);
      }
    });
  }

  /**
   * Add a disconnected ping result
   */
  private addDisconnectedPing(sequence?: number): void {
    const pingResult: PingResult = {
      rtt: -1,
      sequence: sequence ?? this.sequence - 1,
      timestamp: Date.now(),
      serverTimestamp: 0,
      quality: 'disconnected'
    };

    this.addPingResult(pingResult);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    const recentPings = this.pingHistory.slice(-10);
    const validPings = recentPings.filter(p => p.rtt > 0);
    
    if (validPings.length === 0) {
      return {
        current: null,
        average: null,
        min: null,
        max: null,
        packetLoss: 100,
        quality: 'disconnected' as ConnectionQuality
      };
    }

    const rtts = validPings.map(p => p.rtt);
    const current = rtts[rtts.length - 1];
    const average = Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length);
    const min = Math.min(...rtts);
    const max = Math.max(...rtts);
    const packetLoss = ((recentPings.length - validPings.length) / recentPings.length) * 100;

    return {
      current,
      average,
      min,
      max,
      packetLoss: Math.round(packetLoss),
      quality: getConnectionQuality(average)
    };
  }
}