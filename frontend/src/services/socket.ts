import { EventEmitter } from 'events';

export type MessageHandler = (data: any) => void;

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  signature?: string;
}

class SocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventEmitter: EventEmitter;
  private messageHandlers: Map<string, Array<MessageHandler>>;

  constructor(url: string = 'ws://localhost:8080/cipher-guard/ws', reconnectInterval: number = 5000) {
    this.url = url;
    this.reconnectInterval = reconnectInterval;
    this.eventEmitter = new EventEmitter();
    this.messageHandlers = new Map();
  }

  public connect(): void {
    if (this.socket) {
      this.socket.close();
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.eventEmitter.emit('connected');
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.eventEmitter.emit('disconnected');
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.eventEmitter.emit('error', error);
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('WebSocket message received:', message);
          
          // Emit the specific message type event
          this.eventEmitter.emit(message.type, message.data);
          
          // Call all registered handlers for this message type
          if (this.messageHandlers.has(message.type)) {
            const handlers = this.messageHandlers.get(message.type);
            if (handlers) {
              handlers.forEach(handler => handler(message.data));
            }
          }
          
          // Also emit a general 'message' event
          this.eventEmitter.emit('message', message);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts += 1;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('Maximum reconnect attempts reached. WebSocket connection failed.');
      this.eventEmitter.emit('reconnect_failed');
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public send(type: string, data: any = {}): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }

    try {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: Date.now(),
      };

      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  public on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  public off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  public registerMessageHandler(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.push(handler);
    }
  }

  public unregisterMessageHandler(messageType: string, handler: MessageHandler): void {
    if (this.messageHandlers.has(messageType)) {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService;