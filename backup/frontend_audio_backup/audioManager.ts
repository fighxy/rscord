import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { audioCoordinator, VoiceChannelOptions, AudioEffect } from './audioCoordinator';

// Audio configuration types
export interface AudioConfig {
  sample_rate: number;
  channels: number;
  bitrate: number;
  frame_duration: number;
  enable_dtx: boolean;
  enable_fec: boolean;
  application: 'Audio' | 'VoIP' | 'LowDelay';
  buffer_size: number;
}

// Audio statistics
export interface AudioStats {
  frames_encoded: number;
  frames_decoded: number;
  encoding_errors: number;
  decoding_errors: number;
  bytes_encoded: number;
  bytes_decoded: number;
  average_encoding_time_us: number;
  average_decoding_time_us: number;
}

// Voice session info
export interface VoiceSession {
  peer_id: string;
  channel_id: string;
  is_muted: boolean;
  is_deafened: boolean;
  connected_at: string;
}

// Audio devices list
export interface AudioDevicesList {
  input_devices: string[];
  output_devices: string[];
  current_input_device?: string;
  current_output_device?: string;
}

// Decoded audio event
export interface DecodedAudioEvent {
  peer_id: string;
  samples: number[];
  sample_rate: number;
  channels: number;
}

/**
 * RSCORD Audio Manager - Main interface that coordinates between LiveKit and native Opus
 * This is now a facade that delegates to the appropriate backend
 */
export class RSCORDAudioManager {
  private static instance: RSCORDAudioManager;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {}

  public static getInstance(): RSCORDAudioManager {
    if (!RSCORDAudioManager.instance) {
      RSCORDAudioManager.instance = new RSCORDAudioManager();
    }
    return RSCORDAudioManager.instance;
  }

  /**
   * Initialize the audio system with configuration
   */
  public async initialize(config?: Partial<AudioConfig>): Promise<void> {
    const defaultConfig: AudioConfig = {
      sample_rate: 48000,
      channels: 1, // Mono for voice chat
      bitrate: 32000,
      frame_duration: 20,
      enable_dtx: true,
      enable_fec: true,
      application: 'VoIP',
      buffer_size: 256,
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      const result = await invoke<string>('initialize_audio_system', { config: finalConfig });
      console.log('Audio system initialized:', result);

      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: finalConfig.sample_rate,
        latencyHint: 'interactive',
      });

      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      throw error;
    }
  }

  /**
   * Start voice capture
   */
  public async startVoiceCapture(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Audio system not initialized');
    }

    try {
      const result = await invoke<string>('start_voice_capture');
      console.log('Voice capture started:', result);
      this.emit('voice-capture-started');
    } catch (error) {
      console.error('Failed to start voice capture:', error);
      throw error;
    }
  }

  /**
   * Stop voice capture
   */
  public async stopVoiceCapture(): Promise<void> {
    try {
      const result = await invoke<string>('stop_voice_capture');
      console.log('Voice capture stopped:', result);
      this.emit('voice-capture-stopped');
    } catch (error) {
      console.error('Failed to stop voice capture:', error);
      throw error;
    }
  }

  /**
   * Process incoming encoded audio from remote peer
   */
  public async processIncomingAudio(encodedData: number[], peerId: string): Promise<void> {
    try {
      await invoke('process_incoming_audio', {
        encodedData,
        peerId,
      });
    } catch (error) {
      console.error('Failed to process incoming audio:', error);
      throw error;
    }
  }

  /**
   * Get current audio statistics
   */
  public async getAudioStats(): Promise<AudioStats> {
    try {
      return await invoke<AudioStats>('get_audio_stats');
    } catch (error) {
      console.error('Failed to get audio stats:', error);
      throw error;
    }
  }

  /**
   * Reset audio statistics
   */
  public async resetAudioStats(): Promise<void> {
    try {
      await invoke<string>('reset_audio_stats');
    } catch (error) {
      console.error('Failed to reset audio stats:', error);
      throw error;
    }
  }

  /**
   * List available audio devices
   */
  public async listAudioDevices(): Promise<AudioDevicesList> {
    try {
      return await invoke<AudioDevicesList>('list_audio_devices');
    } catch (error) {
      console.error('Failed to list audio devices:', error);
      throw error;
    }
  }

  /**
   * Set audio input device
   */
  public async setInputDevice(deviceName: string): Promise<void> {
    try {
      const result = await invoke<string>('set_audio_input_device', { deviceName });
      console.log('Input device set:', result);
      this.emit('input-device-changed', deviceName);
    } catch (error) {
      console.error('Failed to set input device:', error);
      throw error;
    }
  }

  /**
   * Set audio output device
   */
  public async setOutputDevice(deviceName: string): Promise<void> {
    try {
      const result = await invoke<string>('set_audio_output_device', { deviceName });
      console.log('Output device set:', result);
      this.emit('output-device-changed', deviceName);
    } catch (error) {
      console.error('Failed to set output device:', error);
      throw error;
    }
  }

  /**
   * Update audio configuration
   */
  public async updateConfig(config: Partial<AudioConfig>): Promise<void> {
    try {
      const currentConfig = await this.getConfig();
      const newConfig = { ...currentConfig, ...config };
      
      const result = await invoke<string>('update_audio_config', { newConfig });
      console.log('Audio config updated:', result);
      this.emit('config-updated', newConfig);
    } catch (error) {
      console.error('Failed to update audio config:', error);
      throw error;
    }
  }

  /**
   * Join voice channel with smart backend selection
   */
  public async joinVoiceChannel(
    channelId: string, 
    peerId: string, 
    options?: VoiceChannelOptions
  ): Promise<void> {
    try {
      // Use the coordinator to select appropriate backend
      await audioCoordinator.joinVoiceChannel(channelId, options);
      this.emit('voice-channel-joined', { channelId, peerId });
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      throw error;
    }
  }

  /**
   * Leave voice channel
   */
  public async leaveVoiceChannel(peerId: string): Promise<void> {
    try {
      await audioCoordinator.leaveVoiceChannel();
      this.emit('voice-channel-left', { peerId });
    } catch (error) {
      console.error('Failed to leave voice channel:', error);
      throw error;
    }
  }

  /**
   * Toggle mute status
   */
  public async toggleMute(peerId: string): Promise<boolean> {
    try {
      const isMuted = await invoke<boolean>('toggle_mute', { peerId });
      this.emit('mute-toggled', { peerId, isMuted });
      return isMuted;
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      throw error;
    }
  }

  /**
   * Toggle deafen status
   */
  public async toggleDeafen(peerId: string): Promise<boolean> {
    try {
      const isDeafened = await invoke<boolean>('toggle_deafen', { peerId });
      this.emit('deafen-toggled', { peerId, isDeafened });
      return isDeafened;
    } catch (error) {
      console.error('Failed to toggle deafen:', error);
      throw error;
    }
  }

  /**
   * Get current voice sessions
   */
  public async getVoiceSessions(): Promise<Record<string, VoiceSession>> {
    try {
      return await invoke<Record<string, VoiceSession>>('get_voice_sessions');
    } catch (error) {
      console.error('Failed to get voice sessions:', error);
      throw error;
    }
  }

  /**
   * Check if audio system is running
   */
  public async isRunning(): Promise<boolean> {
    try {
      return await invoke<boolean>('is_audio_system_running');
    } catch (error) {
      console.error('Failed to check audio system status:', error);
      return false;
    }
  }

  /**
   * Get current audio configuration
   */
  public async getConfig(): Promise<AudioConfig> {
    try {
      return await invoke<AudioConfig>('get_audio_config');
    } catch (error) {
      console.error('Failed to get audio config:', error);
      throw error;
    }
  }

  /**
   * Test audio system with sine wave
   */
  public async testAudioSystem(frequency: number = 440, durationMs: number = 1000): Promise<string> {
    try {
      return await invoke<string>('test_audio_system', {
        frequency,
        durationMs,
      });
    } catch (error) {
      console.error('Failed to test audio system:', error);
      throw error;
    }
  }

  /**
   * Enable audio effects (switches to native Opus backend)
   */
  public async enableAudioEffects(effects: AudioEffect[]): Promise<void> {
    try {
      await audioCoordinator.enableAudioEffects(effects);
      this.emit('audio-effects-enabled', { effects });
    } catch (error) {
      console.error('Failed to enable audio effects:', error);
      throw error;
    }
  }

  /**
   * Enable low-latency gaming mode
   */
  public async enableGamingMode(): Promise<void> {
    try {
      await audioCoordinator.enableGamingMode();
      this.emit('gaming-mode-enabled');
    } catch (error) {
      console.error('Failed to enable gaming mode:', error);
      throw error;
    }
  }

  /**
   * Join voice channel with LiveKit (standard mode)
   */
  public async joinLiveKitChannel(
    channelId: string, 
    token: string, 
    serverUrl: string
  ): Promise<void> {
    return this.joinVoiceChannel(channelId, 'user', {
      mode: 'livekit',
      token,
      serverUrl,
    });
  }

  /**
   * Join voice channel with native Opus (for effects/gaming)
   */
  public async joinOpusChannel(
    channelId: string,
    options: { lowLatency?: boolean; enableEffects?: boolean } = {}
  ): Promise<void> {
    return this.joinVoiceChannel(channelId, 'user', {
      mode: 'opus',
      lowLatency: options.lowLatency,
      enableEffects: options.enableEffects,
    });
  }

  /**
   * Get current audio backend mode
   */
  public getCurrentMode(): 'livekit' | 'opus' | 'hybrid' {
    return audioCoordinator.getCurrentMode();
  }

  /**
   * Check backend availability
   */
  public getBackendAvailability(): { livekit: boolean; opus: boolean } {
    return {
      livekit: audioCoordinator.isLiveKitAvailable(),
      opus: audioCoordinator.isOpusAvailable(),
    };
  }

  /**
   * Setup event listeners for Tauri events
   */
  private async setupEventListeners(): Promise<void> {
    // Listen for encoded audio packets
    await listen<number[]>('opus-audio-packet', (event) => {
      this.emit('audio-packet-encoded', event.payload);
    });

    // Listen for decoded audio samples
    await listen<DecodedAudioEvent>('decoded-audio-samples', (event) => {
      this.playDecodedAudio(event.payload);
      this.emit('audio-packet-decoded', event.payload);
    });
  }

  /**
   * Play decoded audio samples
   */
  private playDecodedAudio(audioEvent: DecodedAudioEvent): void {
    if (!this.audioContext) {
      console.warn('Audio context not available for playback');
      return;
    }

    try {
      const { samples, sample_rate, channels } = audioEvent;
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(
        channels,
        samples.length / channels,
        sample_rate
      );

      // Fill buffer with samples
      if (channels === 1) {
        // Mono
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
          channelData[i] = samples[i] / 32768.0; // Convert from i16 to f32
        }
      } else if (channels === 2) {
        // Stereo
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        
        for (let i = 0; i < samples.length; i += 2) {
          leftChannel[i / 2] = samples[i] / 32768.0;
          rightChannel[i / 2] = samples[i + 1] / 32768.0;
        }
      }

      // Create buffer source and play
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

    } catch (error) {
      console.error('Failed to play decoded audio:', error);
    }
  }

  /**
   * Add event listener
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.stopVoiceCapture();
      }
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      this.eventListeners.clear();
      this.isInitialized = false;
      
      console.log('Audio manager cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get initialization status
   */
  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Get audio context
   */
  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
}

// Export singleton instance
export const audioManager = RSCORDAudioManager.getInstance();

// Export utility functions for easier usage
export const AudioUtils = {
  /**
   * Create default voice chat configuration
   */
  createVoiceChatConfig(): AudioConfig {
    return {
      sample_rate: 48000,
      channels: 1,
      bitrate: 32000,
      frame_duration: 20,
      enable_dtx: true,
      enable_fec: true,
      application: 'VoIP',
      buffer_size: 256,
    };
  },

  /**
   * Create high quality audio configuration
   */
  createHighQualityConfig(): AudioConfig {
    return {
      sample_rate: 48000,
      channels: 2,
      bitrate: 64000,
      frame_duration: 20,
      enable_dtx: false,
      enable_fec: true,
      application: 'Audio',
      buffer_size: 256,
    };
  },

  /**
   * Create low latency configuration
   */
  createLowLatencyConfig(): AudioConfig {
    return {
      sample_rate: 48000,
      channels: 1,
      bitrate: 24000,
      frame_duration: 10,
      enable_dtx: true,
      enable_fec: false,
      application: 'LowDelay',
      buffer_size: 64,
    };
  },

  /**
   * Format audio statistics for display
   */
  formatStats(stats: AudioStats): Record<string, string> {
    return {
      'Frames Encoded': stats.frames_encoded.toLocaleString(),
      'Frames Decoded': stats.frames_decoded.toLocaleString(),
      'Encoding Errors': stats.encoding_errors.toLocaleString(),
      'Decoding Errors': stats.decoding_errors.toLocaleString(),
      'Bytes Encoded': `${(stats.bytes_encoded / 1024).toFixed(2)} KB`,
      'Bytes Decoded': `${(stats.bytes_decoded / 1024).toFixed(2)} KB`,
      'Avg Encoding Time': `${stats.average_encoding_time_us.toFixed(2)} µs`,
      'Avg Decoding Time': `${stats.average_decoding_time_us.toFixed(2)} µs`,
    };
  },

  /**
   * Calculate compression ratio
   */
  calculateCompressionRatio(stats: AudioStats): number {
    if (stats.bytes_encoded === 0) return 0;
    
    // Estimate PCM bytes (16-bit samples)
    const estimatedPcmBytes = stats.frames_decoded * 2 * 48000 * 0.02; // 20ms frames
    return estimatedPcmBytes / stats.bytes_encoded;
  },
};

export default audioManager;