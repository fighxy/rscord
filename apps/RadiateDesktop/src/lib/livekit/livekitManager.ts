/**
 * RSCORD LiveKit Audio Manager
 * Simplified audio system using only LiveKit for voice communication
 */

export interface LiveKitConfig {
  serverUrl: string;
  token: string;
}

export interface VoiceChannelState {
  channelId: string | null;
  isConnected: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  participants: VoiceParticipant[];
}

export interface VoiceParticipant {
  id: string;
  name: string;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
}

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

/**
 * Main LiveKit audio manager for RSCORD
 */
export class RSCORDLiveKitManager {
  private static instance: RSCORDLiveKitManager;
  private room: any = null; // LiveKit Room instance
  private state: VoiceChannelState = {
    channelId: null,
    isConnected: false,
    isMuted: false,
    isDeafened: false,
    participants: [],
  };
  private eventListeners: Map<string, Function[]> = new Map();
  private audioContext: AudioContext | null = null;

  private constructor() {}

  public static getInstance(): RSCORDLiveKitManager {
    if (!RSCORDLiveKitManager.instance) {
      RSCORDLiveKitManager.instance = new RSCORDLiveKitManager();
    }
    return RSCORDLiveKitManager.instance;
  }

  /**
   * Check if LiveKit is available
   */
  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'LiveKit' in window;
  }

  /**
   * Initialize the audio system
   */
  public async initialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LiveKit not loaded. Please ensure LiveKit SDK is included.');
    }

    // Initialize Web Audio API for additional audio processing
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 48000,
      });
    } catch (error) {
      console.warn('Web Audio API not available:', error);
    }

    console.log('RSCORD LiveKit Manager initialized');
  }

  /**
   * Join a voice channel
   */
  public async joinVoiceChannel(channelId: string, config: LiveKitConfig): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LiveKit not available');
    }

    try {
      const { Room } = (window as any).LiveKit;
      
      // Create room with optimized settings for voice chat
      this.room = new Room({
        // Adaptive stream for better performance
        adaptiveStream: true,
        
        // Dynamic broadcast for large rooms
        dynacast: true,
        
        // Publishing defaults optimized for voice
        publishDefaults: {
          audioPreset: 'speech', // Optimized for voice
          dtx: true,             // Discontinuous transmission
          red: true,             // Redundant encoding for reliability
        },

        // Connection settings
        reconnectPolicy: {
          nextRetryDelayInMs: (context) => {
            return Math.min(context.retryCount * 2000, 10000);
          },
          maxRetryCount: 5,
        },
      });

      // Setup event handlers
      this.setupRoomEventHandlers();

      // Connect to the room (voice channel)
      await this.room.connect(config.serverUrl, config.token, {
        autoSubscribe: true,
        maxRetries: 3,
      });

      // Update state
      this.state.channelId = channelId;
      this.state.isConnected = true;

      // Enable microphone by default
      await this.room.localParticipant.setMicrophoneEnabled(true);

      this.emit('voice-channel-joined', { channelId });
      console.log(`Joined voice channel: ${channelId}`);

    } catch (error) {
      console.error('Failed to join voice channel:', error);
      this.state.isConnected = false;
      throw error;
    }
  }

  /**
   * Leave the current voice channel
   */
  public async leaveVoiceChannel(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }

    // Reset state
    this.state = {
      channelId: null,
      isConnected: false,
      isMuted: false,
      isDeafened: false,
      participants: [],
    };

    this.emit('voice-channel-left');
    console.log('Left voice channel');
  }

  /**
   * Toggle microphone mute
   */
  public async toggleMute(): Promise<boolean> {
    if (!this.room) {
      throw new Error('Not connected to a voice channel');
    }

    const newMutedState = !this.state.isMuted;
    await this.room.localParticipant.setMicrophoneEnabled(!newMutedState);
    
    this.state.isMuted = newMutedState;
    this.emit('mute-changed', { isMuted: newMutedState });
    
    return newMutedState;
  }

  /**
   * Toggle deafen (mute output)
   */
  public async toggleDeafen(): Promise<boolean> {
    if (!this.room) {
      throw new Error('Not connected to a voice channel');
    }

    const newDeafenedState = !this.state.isDeafened;
    
    // Deafen means mute all remote audio
    this.room.participants.forEach((participant: any) => {
      participant.audioTracks.forEach((track: any) => {
        if (track.track) {
          track.track.enabled = !newDeafenedState;
        }
      });
    });

    // Also mute microphone when deafened
    if (newDeafenedState && !this.state.isMuted) {
      await this.toggleMute();
    }

    this.state.isDeafened = newDeafenedState;
    this.emit('deafen-changed', { isDeafened: newDeafenedState });
    
    return newDeafenedState;
  }

  /**
   * Get available audio devices
   */
  public async getAudioDevices(): Promise<{
    inputs: AudioDeviceInfo[];
    outputs: AudioDeviceInfo[];
  }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          kind: 'audioinput' as const,
        }));

      const outputs = devices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
          kind: 'audiooutput' as const,
        }));

      return { inputs, outputs };
    } catch (error) {
      console.error('Failed to get audio devices:', error);
      return { inputs: [], outputs: [] };
    }
  }

  /**
   * Set audio input device
   */
  public async setAudioInputDevice(deviceId: string): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to a voice channel');
    }

    try {
      await this.room.switchActiveDevice('audioinput', deviceId);
      this.emit('audio-device-changed', { type: 'input', deviceId });
    } catch (error) {
      console.error('Failed to set audio input device:', error);
      throw error;
    }
  }

  /**
   * Set audio output device
   */
  public async setAudioOutputDevice(deviceId: string): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to a voice channel');
    }

    try {
      await this.room.switchActiveDevice('audiooutput', deviceId);
      this.emit('audio-device-changed', { type: 'output', deviceId });
    } catch (error) {
      console.error('Failed to set audio output device:', error);
      throw error;
    }
  }

  /**
   * Get connection quality stats
   */
  public async getConnectionStats(): Promise<any> {
    if (!this.room) {
      return null;
    }

    try {
      return await this.room.getStats();
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      return null;
    }
  }

  /**
   * Enable audio effects using Web Audio API
   */
  public enableAudioEffects(effects: { type: string; intensity: number }[]): void {
    if (!this.audioContext) {
      console.warn('Web Audio API not available for effects');
      return;
    }

    // TODO: Implement audio effects using Web Audio API
    // This can include filters, reverb, pitch shifting, etc.
    console.log('Audio effects requested:', effects);
    this.emit('audio-effects-changed', { effects });
  }

  /**
   * Get current voice channel state
   */
  public getState(): VoiceChannelState {
    return { ...this.state };
  }

  /**
   * Setup room event handlers
   */
  private setupRoomEventHandlers(): void {
    if (!this.room) return;

    // Participant events
    this.room.on('participantConnected', (participant: any) => {
      console.log('Participant connected:', participant.identity);
      this.updateParticipants();
      this.emit('participant-joined', { participant });
    });

    this.room.on('participantDisconnected', (participant: any) => {
      console.log('Participant disconnected:', participant.identity);
      this.updateParticipants();
      this.emit('participant-left', { participant });
    });

    // Audio track events
    this.room.on('trackSubscribed', (track: any, publication: any, participant: any) => {
      if (track.kind === 'audio') {
        console.log('Audio track subscribed:', participant.identity);
        this.emit('audio-track-subscribed', { track, participant });
      }
    });

    // Speaking events
    this.room.on('activeSpeakersChanged', (speakers: any[]) => {
      this.emit('speaking-changed', { speakers });
    });

    // Connection events
    this.room.on('disconnected', (reason?: any) => {
      console.log('Disconnected from room:', reason);
      this.state.isConnected = false;
      this.emit('voice-channel-disconnected', { reason });
    });

    this.room.on('reconnecting', () => {
      console.log('Reconnecting to room...');
      this.emit('voice-channel-reconnecting');
    });

    this.room.on('reconnected', () => {
      console.log('Reconnected to room');
      this.state.isConnected = true;
      this.emit('voice-channel-reconnected');
    });

    // Connection quality
    this.room.on('connectionQualityChanged', (quality: any, participant: any) => {
      this.emit('connection-quality-changed', { quality, participant });
    });
  }

  /**
   * Update participants list
   */
  private updateParticipants(): void {
    if (!this.room) return;

    const participants = Array.from(this.room.participants.values()).map((p: any) => ({
      id: p.identity,
      name: p.name || p.identity,
      isMuted: p.isMuted,
      isSpeaking: p.isSpeaking,
      audioLevel: p.audioLevel || 0,
    }));

    this.state.participants = participants;
    this.emit('participants-updated', { participants });
  }

  // Event system
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in LiveKit event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.eventListeners.clear();
    this.state = {
      channelId: null,
      isConnected: false,
      isMuted: false,
      isDeafened: false,
      participants: [],
    };

    console.log('RSCORD LiveKit Manager cleaned up');
  }
}

// Export singleton instance
export const livekitManager = RSCORDLiveKitManager.getInstance();

// Export utility functions
export const LiveKitUtils = {
  /**
   * Fetch LiveKit token from API
   */
  async fetchToken(channelId: string, userId: string, apiUrl: string, authToken: string): Promise<string> {
    const response = await fetch(
      `${apiUrl}/voice/token?channel_id=${channelId}&user_id=${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch LiveKit token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  },

  /**
   * Format audio level for display
   */
  formatAudioLevel(level: number): string {
    return Math.round(level * 100) + '%';
  },

  /**
   * Get connection quality description
   */
  getConnectionQualityDescription(quality: number): string {
    if (quality >= 0.8) return 'Excellent';
    if (quality >= 0.6) return 'Good';
    if (quality >= 0.4) return 'Fair';
    if (quality >= 0.2) return 'Poor';
    return 'Very Poor';
  },
};

export default livekitManager;