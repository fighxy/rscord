import { audioManager } from './audioManager';

/**
 * WebRTC Peer Connection wrapper with Opus codec support
 */
export class RSCORDWebRTCPeer {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private peerId: string;
  private isConnected = false;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(peerId: string, configuration?: RTCConfiguration) {
    this.peerId = peerId;
    
    // Default WebRTC configuration optimized for RSCORD
    const defaultConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    this.peerConnection = new RTCPeerConnection({ ...defaultConfig, ...configuration });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // ICE candidate events
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('ice-candidate', {
          peerId: this.peerId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log(`WebRTC connection state: ${state} for peer ${this.peerId}`);
      
      this.isConnected = state === 'connected';
      this.emit('connection-state-change', { peerId: this.peerId, state });
    };

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log(`ICE connection state: ${state} for peer ${this.peerId}`);
      this.emit('ice-connection-state-change', { peerId: this.peerId, state });
    };

    // Data channel events
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel);
    };
  }

  /**
   * Create data channel for Opus audio transmission
   */
  public createDataChannel(label = 'opus-audio'): RTCDataChannel {
    const channel = this.peerConnection.createDataChannel(label, {
      ordered: false, // Allow out-of-order delivery for lower latency
      maxRetransmits: 0, // No retransmissions for real-time audio
      protocol: 'opus-rscord-v1',
    });

    this.setupDataChannel(channel);
    return channel;
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log(`Data channel opened: ${channel.label} for peer ${this.peerId}`);
      this.emit('data-channel-open', { peerId: this.peerId, channel });
    };

    channel.onclose = () => {
      console.log(`Data channel closed: ${channel.label} for peer ${this.peerId}`);
      this.emit('data-channel-close', { peerId: this.peerId });
    };

    channel.onerror = (error) => {
      console.error(`Data channel error: ${error} for peer ${this.peerId}`);
      this.emit('data-channel-error', { peerId: this.peerId, error });
    };

    // Handle incoming Opus audio packets
    channel.onmessage = async (event) => {
      try {
        const data = new Uint8Array(event.data);
        await audioManager.processIncomingAudio(Array.from(data), this.peerId);
      } catch (error) {
        console.error('Failed to process incoming audio:', error);
      }
    };
  }

  /**
   * Send Opus-encoded audio packet
   */
  public sendAudioPacket(opusData: number[]): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    try {
      const buffer = new Uint8Array(opusData);
      this.dataChannel.send(buffer);
      return true;
    } catch (error) {
      console.error('Failed to send audio packet:', error);
      return false;
    }
  }

  /**
   * Create WebRTC offer
   */
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    // Create data channel before offer
    this.createDataChannel();

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: false, // We use data channels for audio
      offerToReceiveVideo: false,
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Create WebRTC answer
   */
  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set remote description
   */
  public async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(description);
  }

  /**
   * Add ICE candidate
   */
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Close connection
   */
  public close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    this.peerConnection.close();
    this.isConnected = false;
    this.emit('connection-closed', { peerId: this.peerId });
  }

  /**
   * Get connection stats
   */
  public async getStats(): Promise<RTCStatsReport> {
    return await this.peerConnection.getStats();
  }

  /**
   * Check if peer is connected
   */
  public getConnectionState(): RTCPeerConnectionState {
    return this.peerConnection.connectionState;
  }

  /**
   * Get peer ID
   */
  public getPeerId(): string {
    return this.peerId;
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
          console.error(`Error in WebRTC event listener for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * WebRTC Manager for handling multiple peer connections
 */
export class RSCORDWebRTCManager {
  private peers: Map<string, RSCORDWebRTCPeer> = new Map();
  private currentChannelId: string | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    // Setup audio manager events
    audioManager.on('audio-packet-encoded', (data: number[]) => {
      this.broadcastAudioPacket(data);
    });
  }

  /**
   * Join voice channel and setup WebRTC connections
   */
  public async joinVoiceChannel(channelId: string, peerId: string): Promise<void> {
    this.currentChannelId = channelId;
    
    // Join voice channel in audio manager
    await audioManager.joinVoiceChannel(channelId, peerId);
    
    this.emit('voice-channel-joined', { channelId, peerId });
  }

  /**
   * Leave voice channel and cleanup connections
   */
  public async leaveVoiceChannel(peerId: string): Promise<void> {
    // Close all peer connections
    for (const [peerIdKey, peer] of this.peers) {
      peer.close();
    }
    this.peers.clear();

    // Leave voice channel in audio manager
    await audioManager.leaveVoiceChannel(peerId);
    
    this.currentChannelId = null;
    this.emit('voice-channel-left', { peerId });
  }

  /**
   * Add new peer to voice channel
   */
  public async addPeer(peerId: string, isInitiator = false): Promise<RSCORDWebRTCPeer> {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId)!;
    }

    const peer = new RSCORDWebRTCPeer(peerId);
    this.setupPeerEventHandlers(peer);
    this.peers.set(peerId, peer);

    if (isInitiator) {
      // Create offer for outgoing connection
      const offer = await peer.createOffer();
      this.emit('webrtc-offer', { peerId, offer });
    }

    this.emit('peer-added', { peerId });
    return peer;
  }

  /**
   * Remove peer from voice channel
   */
  public removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
      this.emit('peer-removed', { peerId });
    }
  }

  /**
   * Handle WebRTC offer from remote peer
   */
  public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = await this.addPeer(peerId, false);
    }

    await peer.setRemoteDescription(offer);
    const answer = await peer.createAnswer();
    
    this.emit('webrtc-answer', { peerId, answer });
    return answer;
  }

  /**
   * Handle WebRTC answer from remote peer
   */
  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer) {
      await peer.setRemoteDescription(answer);
    }
  }

  /**
   * Handle ICE candidate from remote peer
   */
  public async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer) {
      await peer.addIceCandidate(candidate);
    }
  }

  /**
   * Broadcast audio packet to all connected peers
   */
  private broadcastAudioPacket(opusData: number[]): void {
    for (const [peerId, peer] of this.peers) {
      if (peer.getConnectionState() === 'connected') {
        peer.sendAudioPacket(opusData);
      }
    }
  }

  /**
   * Setup event handlers for a peer
   */
  private setupPeerEventHandlers(peer: RSCORDWebRTCPeer): void {
    peer.on('ice-candidate', (data) => {
      this.emit('ice-candidate', data);
    });

    peer.on('connection-state-change', (data) => {
      this.emit('peer-connection-state-change', data);
    });

    peer.on('data-channel-open', (data) => {
      console.log(`Data channel opened for peer: ${data.peerId}`);
      this.emit('peer-data-channel-open', data);
    });

    peer.on('data-channel-error', (data) => {
      console.error(`Data channel error for peer: ${data.peerId}`, data.error);
      this.emit('peer-data-channel-error', data);
    });
  }

  /**
   * Get all connected peers
   */
  public getConnectedPeers(): string[] {
    const connected = [];
    for (const [peerId, peer] of this.peers) {
      if (peer.getConnectionState() === 'connected') {
        connected.push(peerId);
      }
    }
    return connected;
  }

  /**
   * Get peer connection stats
   */
  public async getPeerStats(peerId: string): Promise<RTCStatsReport | null> {
    const peer = this.peers.get(peerId);
    return peer ? await peer.getStats() : null;
  }

  /**
   * Get current channel ID
   */
  public getCurrentChannelId(): string | null {
    return this.currentChannelId;
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
          console.error(`Error in WebRTC manager event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup all resources
   */
  public cleanup(): void {
    for (const [peerId, peer] of this.peers) {
      peer.close();
    }
    this.peers.clear();
    this.eventListeners.clear();
    this.currentChannelId = null;
  }
}

// Export singleton instance
export const webrtcManager = new RSCORDWebRTCManager();

export default webrtcManager;