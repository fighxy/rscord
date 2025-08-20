import { audioManager as opusAudioManager } from './audioManager';
import { webrtcManager } from './webrtc';

/**
 * LiveKit Manager - Primary voice communication system
 */
export class LiveKitManager {
  private room: any = null; // LiveKit Room instance
  private isConnected = false;
  private eventListeners: Map<string, Function[]> = new Map();

  /**
   * Check if LiveKit is available
   */
  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'LiveKit' in window;
  }

  /**
   * Join LiveKit voice channel
   */
  public async joinChannel(channelId: string, token: string, serverUrl: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LiveKit not available');
    }

    try {
      const { Room } = (window as any).LiveKit;
      
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          audioPreset: 'speech',
          dtx: true, // Discontinuous transmission for voice
        },
      });

      // Setup event handlers
      this.setupRoomEventHandlers();

      // Connect to room
      await this.room.connect(serverUrl, token);
      
      this.isConnected = true;
      this.emit('channel-joined', { channelId });

    } catch (error) {
      console.error('Failed to join LiveKit channel:', error);
      throw error;
    }
  }

  /**
   * Leave current channel
   */
  public async leaveChannel(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
      this.isConnected = false;
      this.emit('channel-left');
    }
  }

  /**
   * Enable/disable microphone
   */
  public async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (this.room) {
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
      this.emit('microphone-changed', { enabled });
    }
  }

  /**
   * Enable/disable camera
   */
  public async setCameraEnabled(enabled: boolean): Promise<void> {
    if (this.room) {
      await this.room.localParticipant.setCameraEnabled(enabled);
      this.emit('camera-changed', { enabled });
    }
  }

  /**
   * Start screen sharing
   */
  public async startScreenShare(): Promise<void> {
    if (this.room) {
      await this.room.localParticipant.setScreenShareEnabled(true);
      this.emit('screen-share-started');
    }
  }

  /**
   * Stop screen sharing
   */
  public async stopScreenShare(): Promise<void> {
    if (this.room) {
      await this.room.localParticipant.setScreenShareEnabled(false);
      this.emit('screen-share-stopped');
    }
  }

  /**
   * Get connection quality stats
   */
  public async getConnectionStats(): Promise<any> {
    if (this.room) {
      return await this.room.getStats();
    }
    return null;
  }

  /**
   * Get participants in the room
   */
  public getParticipants(): any[] {
    if (this.room) {
      return Array.from(this.room.participants.values());
    }
    return [];
  }

  private setupRoomEventHandlers(): void {
    if (!this.room) return;

    this.room.on('participantConnected', (participant: any) => {
      console.log('Participant connected:', participant.identity);
      this.emit('participant-joined', { participant });
    });

    this.room.on('participantDisconnected', (participant: any) => {
      console.log('Participant disconnected:', participant.identity);
      this.emit('participant-left', { participant });
    });

    this.room.on('trackSubscribed', (track: any, publication: any, participant: any) => {
      console.log('Track subscribed:', track.kind, participant.identity);
      this.emit('track-subscribed', { track, publication, participant });
    });

    this.room.on('trackUnsubscribed', (track: any, publication: any, participant: any) => {
      console.log('Track unsubscribed:', track.kind, participant.identity);
      this.emit('track-unsubscribed', { track, publication, participant });
    });

    this.room.on('connectionQualityChanged', (quality: any, participant: any) => {
      this.emit('connection-quality-changed', { quality, participant });
    });

    this.room.on('disconnected', (reason?: any) => {
      console.log('Disconnected from room:', reason);
      this.isConnected = false;
      this.emit('disconnected', { reason });
    });
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

  public isChannelConnected(): boolean {
    return this.isConnected;
  }
}

/**
 * Audio Coordinator - Main interface that chooses between LiveKit and Opus
 */
export class RSCORDAudioCoordinator {
  private livekitManager: LiveKitManager;
  private currentMode: 'livekit' | 'opus' | 'hybrid' = 'livekit';
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.livekitManager = new LiveKitManager();
    this.setupEventForwarding();
  }

  /**
   * Join voice channel with automatic backend selection
   */
  public async joinVoiceChannel(
    channelId: string, 
    options: VoiceChannelOptions = {}
  ): Promise<void> {
    const { mode, token, serverUrl, enableEffects, lowLatency } = options;

    // Determine which backend to use
    let selectedMode = mode || this.determineOptimalMode(options);
    
    this.currentMode = selectedMode;

    switch (selectedMode) {
      case 'livekit':
        if (!token || !serverUrl) {
          throw new Error('LiveKit token and serverUrl required');
        }
        await this.livekitManager.joinChannel(channelId, token, serverUrl);
        break;

      case 'opus':
        // Initialize native Opus system for special features
        if (!opusAudioManager.getInitializationStatus()) {
          await opusAudioManager.initialize({
            application: lowLatency ? 'LowDelay' : 'VoIP',
            frame_duration: lowLatency ? 10 : 20,
            enable_fec: !lowLatency, // Disable FEC for ultra-low latency
          });
        }
        
        await opusAudioManager.joinVoiceChannel(channelId, 'user_id'); // TODO: get real user ID
        await opusAudioManager.startVoiceCapture();
        
        if (enableEffects) {
          // TODO: Enable audio effects
        }
        break;

      case 'hybrid':
        // Use both systems simultaneously
        // LiveKit for main communication, Opus for effects
        throw new Error('Hybrid mode not yet implemented');

      default:
        throw new Error(`Unknown mode: ${selectedMode}`);
    }

    this.emit('voice-channel-joined', { channelId, mode: selectedMode });
  }

  /**
   * Leave current voice channel
   */
  public async leaveVoiceChannel(): Promise<void> {
    switch (this.currentMode) {
      case 'livekit':
        await this.livekitManager.leaveChannel();
        break;
      
      case 'opus':
        await opusAudioManager.stopVoiceCapture();
        await opusAudioManager.leaveVoiceChannel('user_id'); // TODO: get real user ID
        break;
      
      case 'hybrid':
        await this.livekitManager.leaveChannel();
        await opusAudioManager.stopVoiceCapture();
        break;
    }

    this.emit('voice-channel-left', { mode: this.currentMode });
    this.currentMode = 'livekit'; // Reset to default
  }

  /**
   * Toggle microphone mute
   */
  public async toggleMicrophone(): Promise<boolean> {
    switch (this.currentMode) {
      case 'livekit':
        // Get current state and toggle
        const isMuted = false; // TODO: get actual state from LiveKit
        await this.livekitManager.setMicrophoneEnabled(!isMuted);
        return !isMuted;
      
      case 'opus':
        return await opusAudioManager.toggleMute('user_id'); // TODO: get real user ID
      
      default:
        throw new Error(`Microphone toggle not supported in ${this.currentMode} mode`);
    }
  }

  /**
   * Enable audio effects (switches to Opus mode if needed)
   */
  public async enableAudioEffects(effects: AudioEffect[]): Promise<void> {
    if (this.currentMode === 'livekit') {
      // TODO: Implement switching from LiveKit to Opus while maintaining connection
      throw new Error('Audio effects require switching to Opus mode (not yet implemented)');
    }

    // Apply effects through native Opus system
    // TODO: Implement audio effects
  }

  /**
   * Enable low-latency gaming mode
   */
  public async enableGamingMode(): Promise<void> {
    if (this.currentMode !== 'opus') {
      // TODO: Switch to Opus mode for gaming
      throw new Error('Gaming mode requires Opus backend (not yet implemented)');
    }

    // Configure for ultra-low latency
    await opusAudioManager.updateConfig({
      frame_duration: 10, // 10ms frames
      enable_fec: false,  // Disable FEC for speed
      enable_dtx: false,  // Disable DTX for consistency
      application: 'LowDelay',
      buffer_size: 64,    // Smaller buffer
    });
  }

  /**
   * Get current audio statistics
   */
  public async getAudioStats(): Promise<any> {
    switch (this.currentMode) {
      case 'livekit':
        return await this.livekitManager.getConnectionStats();
      
      case 'opus':
        return await opusAudioManager.getAudioStats();
      
      default:
        return null;
    }
  }

  /**
   * Determine optimal mode based on options
   */
  private determineOptimalMode(options: VoiceChannelOptions): 'livekit' | 'opus' {
    // Use Opus for special features
    if (options.enableEffects || options.lowLatency || options.customProcessing) {
      return 'opus';
    }

    // Use LiveKit for standard voice communication (default)
    return 'livekit';
  }

  /**
   * Setup event forwarding from backends
   */
  private setupEventForwarding(): void {
    // Forward LiveKit events
    this.livekitManager.on('participant-joined', (data) => {
      this.emit('participant-joined', { ...data, backend: 'livekit' });
    });

    this.livekitManager.on('participant-left', (data) => {
      this.emit('participant-left', { ...data, backend: 'livekit' });
    });

    // Forward Opus events
    opusAudioManager.on('voice-capture-started', () => {
      this.emit('voice-capture-started', { backend: 'opus' });
    });

    opusAudioManager.on('voice-capture-stopped', () => {
      this.emit('voice-capture-stopped', { backend: 'opus' });
    });
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
          console.error(`Error in audio coordinator event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current mode
   */
  public getCurrentMode(): 'livekit' | 'opus' | 'hybrid' {
    return this.currentMode;
  }

  /**
   * Check if LiveKit is available
   */
  public isLiveKitAvailable(): boolean {
    return this.livekitManager.isAvailable();
  }

  /**
   * Check if Opus is available
   */
  public isOpusAvailable(): boolean {
    return typeof window !== 'undefined' && 'window.__TAURI__' in window;
  }
}

// Types
export interface VoiceChannelOptions {
  mode?: 'livekit' | 'opus' | 'hybrid';
  token?: string;           // Required for LiveKit
  serverUrl?: string;       // Required for LiveKit
  enableEffects?: boolean;  // Forces Opus mode
  lowLatency?: boolean;     // Forces Opus mode
  customProcessing?: boolean; // Forces Opus mode
}

export interface AudioEffect {
  type: 'pitch' | 'echo' | 'reverb' | 'noise_reduction' | 'voice_changer';
  intensity: number; // 0-1
  parameters?: Record<string, any>;
}

// Export singleton
export const audioCoordinator = new RSCORDAudioCoordinator();
export const livekitManager = new LiveKitManager();

export default audioCoordinator;