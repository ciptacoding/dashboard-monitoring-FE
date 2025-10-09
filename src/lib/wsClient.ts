import { WsEvent } from '@/types/camera';

type EventCallback = (event: WsEvent) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private callbacks: EventCallback[] = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(onConnectionChange: (connected: boolean) => void) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(`${this.url}?token=${this.token}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        onConnectionChange(true);
        this.reconnectDelay = 1000;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WsEvent = JSON.parse(event.data);
          this.callbacks.forEach((cb) => cb(data));
        } catch (error) {
          console.error('Failed to parse WS message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        onConnectionChange(false);
        this.stopHeartbeat();
        this.scheduleReconnect(onConnectionChange);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      onConnectionChange(false);
      this.scheduleReconnect(onConnectionChange);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(onConnectionChange: (connected: boolean) => void) {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
      this.reconnectTimeout = null;
      this.connect(onConnectionChange);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  on(callback: EventCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  send(event: WsEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks = [];
  }
}

// Mock WebSocket for development
export const createMockWsClient = (
  onConnectionChange: (connected: boolean) => void,
  onEvent: (event: WsEvent) => void
) => {
  // Simulate connection
  setTimeout(() => onConnectionChange(true), 1000);

  // Simulate random status updates
  const interval = setInterval(() => {
    const mockEvents: WsEvent[] = [
      { type: 'camera_status', id: '3', status: 'ONLINE', lastSeen: new Date().toISOString() },
      { type: 'camera_status', id: '1', status: 'OFFLINE', lastSeen: new Date().toISOString() },
      { type: 'motion_detected', id: '2', ts: new Date().toISOString() },
    ];

    const randomEvent = mockEvents[Math.floor(Math.random() * mockEvents.length)];
    onEvent(randomEvent);
  }, 10000);

  return {
    disconnect: () => {
      clearInterval(interval);
      onConnectionChange(false);
    },
  };
};
