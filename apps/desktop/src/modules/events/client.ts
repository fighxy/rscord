import { useAuth } from "../auth/store";

type Handler = (topic: string, data: any) => void;

class EventsClient {
  private ws?: WebSocket;
  private handlers: Set<Handler> = new Set();
  private backoff = 1000;

  connect() {
    const token = useAuth.getState().token;
    const url = `ws://127.0.0.1:14703/ws${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const topic = data.topic || "";
        this.handlers.forEach((h) => h(topic, data));
      } catch {
        // Maybe plain JSON event without wrapper
        this.handlers.forEach((h) => h("", ev.data));
      }
    };
    this.ws.onclose = () => {
      setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, 15000);
    };
  }

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const eventsClient = new EventsClient();


