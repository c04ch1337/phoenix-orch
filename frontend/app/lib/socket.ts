import { useEffect } from 'react';

export interface ConscienceUpdate {
  emberLevel: number;
  cipherLevel: number;
  isHandoverReady: boolean;
}

type MessageCallback = (data: any) => void;
type StatusCallback = (connected: boolean) => void;
type WebSocketCallback = (data: ConscienceUpdate) => void;

// Socket implementation for page.tsx
class Socket {
  private ws: WebSocket | null = null;
  private messageHandlers: MessageCallback[] = [];
  private statusHandlers: StatusCallback[] = [];
  private reconnectTimer: number | null = null;
  private url = 'ws://localhost:5001';
  private connected = false;

  connect() {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('🔥 WebSocket connected');
        this.connected = true;
        this.statusHandlers.forEach(handler => handler(true));
      };
      
      this.ws.onclose = () => {
        console.log('🔥 WebSocket disconnected');
        this.connected = false;
        this.statusHandlers.forEach(handler => handler(false));
        this.reconnect();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.messageHandlers.forEach(handler => handler(data));
        } catch (error) {
          console.error('🔥 Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('🔥 Error connecting to WebSocket:', error);
      this.reconnect();
    }
  }
  
  disconnect() {
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  reconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
  
  isConnected() {
    return this.connected;
  }
  
  send(data: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('🔥 WebSocket not connected, cannot send message');
      return false;
    }
    this.ws.send(JSON.stringify(data));
    return true;
  }
  
  onMessage(callback: MessageCallback) {
    this.messageHandlers.push(callback);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== callback);
    };
  }
  
  onStatusChange(callback: StatusCallback) {
    this.statusHandlers.push(callback);
    return () => {
      this.statusHandlers = this.statusHandlers.filter(h => h !== callback);
    };
  }
}

// Export the singleton socket instance
export const socket = new Socket();

// Keep original hook for backward compatibility
export const useWebSocket = (channel: string, callback: WebSocketCallback) => {
  useEffect(() => {
    // In a real implementation, this would connect to your WebSocket server
    const ws = new WebSocket('ws://localhost:5001');

    ws.onopen = () => {
      console.log(`Connected to ${channel} WebSocket channel`);
      ws.send(JSON.stringify({ subscribe: channel }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ConscienceUpdate;
        callback(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [channel, callback]);
};
