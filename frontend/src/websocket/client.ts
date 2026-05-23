type Handler = (data: unknown) => void;

class EchoWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<Handler>> = new Map();
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.DEV ? "127.0.0.1:8000" : window.location.host;
    const url = `${protocol}//${host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        this.handlers.get(type)?.forEach((h) => h(data));
        this.handlers.get("*")?.forEach((h) => h({ type, data }));
      } catch {
        /* ignore malformed */
      }
    };

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
  }

  on(type: string, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

export const echoWs = new EchoWebSocket();
