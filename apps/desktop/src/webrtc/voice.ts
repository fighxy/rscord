export type Peer = {
  id: string;
  connection: RTCPeerConnection;
  audioEl: HTMLAudioElement;
};

export class VoiceMesh {
  private readonly constraints: MediaStreamConstraints = { audio: true, video: false };
  private localStream?: MediaStream;
  private peers: Map<string, Peer> = new Map();
  private isMuted: boolean = false;
  private isDeafened: boolean = false;

  constructor() {}

  async getLocalStream(): Promise<MediaStream> {
    if (!this.localStream) {
      this.localStream = await navigator.mediaDevices.getUserMedia(this.constraints);
    }
    return this.localStream;
  }

  async createPeer(remoteId: string, onIceCandidate: (candidate: RTCIceCandidateInit) => void, onTrack?: (audio: HTMLAudioElement) => void): Promise<Peer> {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });
    const local = await this.getLocalStream();
    local.getTracks().forEach((t) => pc.addTrack(t, local));

    const audio = document.createElement("audio");
    audio.autoplay = true;
    pc.ontrack = (ev) => {
      audio.srcObject = ev.streams[0];
      onTrack?.(audio);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) onIceCandidate(ev.candidate.toJSON());
    };

    const peer: Peer = { id: remoteId, connection: pc, audioEl: audio };
    this.peers.set(remoteId, peer);
    return peer;
  }

  getPeer(id: string) {
    return this.peers.get(id);
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.peers.forEach(peer => {
      peer.audioEl.muted = deafened;
    });
  }

  getMutedState() {
    return { isMuted: this.isMuted, isDeafened: this.isDeafened };
  }

  async makeOffer(remoteId: string, onIceCandidate: (candidate: RTCIceCandidateInit) => void, onTrack?: (audio: HTMLAudioElement) => void) {
    const peer = await this.createPeer(remoteId, onIceCandidate, onTrack);
    const offer = await peer.connection.createOffer();
    await peer.connection.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(remoteId: string, offer: RTCSessionDescriptionInit, onIceCandidate: (candidate: RTCIceCandidateInit) => void, onTrack?: (audio: HTMLAudioElement) => void) {
    const peer = await this.createPeer(remoteId, onIceCandidate, onTrack);
    await peer.connection.setRemoteDescription(offer);
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(remoteId: string, answer: RTCSessionDescriptionInit) {
    const peer = this.getPeer(remoteId);
    if (!peer) return;
    await peer.connection.setRemoteDescription(answer);
  }

  async handleIce(remoteId: string, candidate: RTCIceCandidateInit) {
    const peer = this.getPeer(remoteId);
    if (!peer) return;
    try {
      await peer.connection.addIceCandidate(candidate);
    } catch {}
  }

  async leave() {
    this.peers.forEach((p) => {
      p.connection.close();
      p.audioEl.srcObject = null;
    });
    this.peers.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = undefined;
    }
  }
}


