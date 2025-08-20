export interface VoiceChannel {
  id: string;
  name: string;
  guild_id: string;
  created_by: string;
  created_at: string;
  max_participants: number;
  current_participants: VoiceParticipant[];
}

export interface VoiceParticipant {
  user_id: string;
  username: string;
  is_muted: boolean;
  is_speaking: boolean;
  connection_quality: 'excellent' | 'good' | 'poor';
  joined_at: string;
}

export interface VoiceSession {
  session_id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
}

export interface VoiceJoinData {
  roomId: string;
  roomName: string;
  serverUrl: string;
  token: string;
  vadSettings?: VoiceActivationSettings;
}

export interface VoiceActivationSettings {
  enabled: boolean;
  threshold: number;
  gateThreshold: number;
  attackTime: number;
  releaseTime: number;
}

export interface VoiceMetrics {
  participantCount: number;
  speakingParticipants: number;
  connection_quality: 'excellent' | 'good' | 'poor';
  latency: number;
  packetLoss: number;
}

export const DEFAULT_VAD_SETTINGS: VoiceActivationSettings = {
  enabled: true,
  threshold: -45,
  gateThreshold: -60,
  attackTime: 10,
  releaseTime: 100,
};