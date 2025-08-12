export type ClientMessage =
  | { type: "join"; room: string; peer_id: string }
  | { type: "signal"; room: string; from: string; to: string; data: any }
  | { type: "broadcast"; room: string; from: string; data: any }
  | { type: "leave"; room: string; peer_id: string };

export type ServerMessage =
  | { type: "peer_joined"; peer_id: string }
  | { type: "peer_left"; peer_id: string }
  | { type: "signal"; from: string; to: string; data: any }
  | { type: "broadcast"; from: string; data: any }
  | { type: "joined"; room: string }
  | { type: "error"; message: string };

export class SignalingClient {
  private socket?: WebSocket;
  private readonly url: string;
  private messageHandlers: Array<(msg: ServerMessage) => void> = [];

  constructor(url = "ws://127.0.0.1:8787/ws") {
    this.url = url;
  }

  connect() {
    this.socket = new WebSocket(this.url);
    this.socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        this.messageHandlers.forEach((h) => h(msg));
      } catch {}
    };
  }

  onMessage(handler: (msg: ServerMessage) => void) {
    this.messageHandlers.push(handler);
  }

  send(msg: ClientMessage) {
    this.socket?.send(JSON.stringify(msg));
  }
}


