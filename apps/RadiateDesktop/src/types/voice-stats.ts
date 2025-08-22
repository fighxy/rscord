// VoIP Stats Types for Radiate Desktop App

export interface VoiceStats {
  roomId: string;
  participants: ParticipantStats[];
  serverStats: ServerStats;
}

export interface ParticipantStats {
  peerId: string;
  networkRtt: number;      // Network RTT in ms
  webrtcRtt: number;       // WebRTC RTT in ms  
  audioLatency: number;    // Audio processing latency in ms
  jitter: number;          // Jitter in ms
  packetLoss: number;      // Packet loss percentage (0-100)
  connectionQuality: ConnectionQuality;
  audioLevel: number;      // Audio level 0.0-1.0
  isSpeaking: boolean;     // Currently speaking
}

export interface ServerStats {
  serverRtt: number;       // Server processing time
  serverLoad: number;      // Server CPU load 0.0-1.0
  activeRooms: number;     // Number of active voice rooms
  totalParticipants: number; // Total participants across all rooms
}

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

export interface PingResult {
  rtt: number;             // Round trip time in ms
  sequence: number;        // Ping sequence number
  timestamp: number;       // Client timestamp
  serverTimestamp: number; // Server timestamp
  quality: ConnectionQuality;
}

export interface VoipPingManager {
  startPing(): void;
  stopPing(): void;
  getCurrentPing(): number | null;
  getAveragePing(): number | null;
  getPingHistory(): PingResult[];
  onPingUpdate: (callback: (ping: PingResult) => void) => void;
}

// WebSocket message types for signaling
export interface SignalMessage {
  type: 'ping' | 'pong' | 'stats_request' | 'stats';
  timestamp?: number;
  sequence?: number;
  serverTimestamp?: number;
  roomId?: string;
  peerId?: string;
  data?: any;
}

// Visual indicators for ping display
export interface PingDisplayConfig {
  showNumeric: boolean;    // Show numeric ping value
  showIcon: boolean;       // Show connection quality icon
  showGraph: boolean;      // Show ping history graph
  updateInterval: number;  // Update frequency in ms
  historyLength: number;   // Number of ping samples to keep
}

// Color coding for ping ranges
export const PING_COLORS = {
  excellent: '#00ff00',  // < 30ms
  good: '#ffff00',       // 30-60ms
  fair: '#ff8800',       // 60-120ms
  poor: '#ff4400',       // 120-200ms
  disconnected: '#ff0000' // > 200ms or no connection
} as const;

export const PING_THRESHOLDS = {
  excellent: 30,
  good: 60,
  fair: 120,
  poor: 200
} as const;

// Utility function to determine connection quality from ping
export function getConnectionQuality(rtt: number): ConnectionQuality {
  if (rtt < 0) return 'disconnected';
  if (rtt <= PING_THRESHOLDS.excellent) return 'excellent';
  if (rtt <= PING_THRESHOLDS.good) return 'good';
  if (rtt <= PING_THRESHOLDS.fair) return 'fair';
  if (rtt <= PING_THRESHOLDS.poor) return 'poor';
  return 'disconnected';
}

// React component props for ping display
export interface PingDisplayProps {
  currentPing: number | null;
  averagePing: number | null;
  connectionQuality: ConnectionQuality;
  config: PingDisplayConfig;
  className?: string;
}