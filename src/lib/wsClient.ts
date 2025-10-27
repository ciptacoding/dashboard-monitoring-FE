// Enhanced WebSocket Client with auto-reconnect
export type WSEventType = 
  | 'connected'
  | 'camera_status'
  | 'stream_update'
  | 'pong'
  | 'error';

export interface WSEvent {
  type: WSEventType;
  data: any;
}

export interface CameraStatusEvent {
  id: string;
  status: string;
  last_seen?: string;
}

export interface StreamUpdateEvent {
  id: string;
  name: string;
  status: 'frozen' | 'offline' | 'online' | 'restarted' | 'restart_failed';
  message: string;
}

type WSEventHandler = (event: WSEvent) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<WSEventHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;
  private onConnectionChange?: (connected: boolean) => void;

  constructor(url: string) {
    // Add token from localStorage if available
    const token = localStorage.getItem('auth_token');
    this.url = token ? `${url}?token=${token}` : url;
  }

  connect(onConnectionChange?: (connected: boolean) => void) {
    this.onConnectionChange = onConnectionChange;
    this.isIntentionallyClosed = false;
    this.createConnection();
  }

  private createConnection() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log(`🔌 Connecting to WebSocket: ${this.url.replace(/token=.*/, 'token=***')}`);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.onConnectionChange?.(true);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSEvent = JSON.parse(event.data);
          console.log('📨 WebSocket message:', message.type, message.data);
          
          // Notify all handlers
          this.handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in WebSocket handler:', error);
            }
          });
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.onConnectionChange?.(false);
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        this.stopHeartbeat();
        this.onConnectionChange?.(false);

        // Attempt to reconnect unless intentionally closed
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`🔄 Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket not connected. Message not sent:', type);
    }
  }

  on(handler: WSEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  disconnect() {
    console.log('🔌 Disconnecting WebSocket...');
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.onConnectionChange?.(false);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}