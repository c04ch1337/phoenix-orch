/**
 * Server-Sent Events (SSE) service for the Phoenix ORCH application
 * Handles real-time communication with the backend
 */

import { useEffect, useState, useCallback } from 'react';
// Store imports are moved to the hook implementation where they're needed

// Define SSE message types using discriminated union for type safety
export type SSEMessage =
  | SystemMessage
  | UserMessage
  | TelemetryMessage
  | EmberMessage
  | CipherMessage;

interface BaseSSEMessage {
  readonly id: string;
  readonly timestamp: number;
}

interface SystemMessage extends BaseSSEMessage {
  readonly type: 'system';
  readonly status: 'online' | 'offline' | 'error';
  readonly message: string;
}

interface UserMessage extends BaseSSEMessage {
  readonly type: 'user';
  readonly username: string;
  readonly message: string;
}

interface TelemetryMessage extends BaseSSEMessage {
  readonly type: 'telemetry';
  readonly metrics: Record<string, number>;
}

interface EmberMessage extends BaseSSEMessage {
  readonly type: 'ember';
  readonly unitId: string;
  readonly status: string;
  readonly data: any;
}

interface CipherMessage extends BaseSSEMessage {
  readonly type: 'cipher';
  readonly operation: string;
  readonly status: string;
  readonly data: any;
}

// Type guard for SSE messages
function isValidSSEMessage(message: unknown): message is SSEMessage {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as any;
  if (!msg.id || !msg.type || !msg.timestamp) return false;
  
  // Additional validation based on message type
  switch (msg.type) {
    case 'system':
      return typeof msg.status === 'string' && typeof msg.message === 'string';
    case 'user':
      return typeof msg.username === 'string' && typeof msg.message === 'string';
    case 'telemetry':
      return typeof msg.metrics === 'object';
    case 'ember':
      return typeof msg.unitId === 'string' && typeof msg.status === 'string';
    case 'cipher':
      return typeof msg.operation === 'string' && typeof msg.status === 'string';
    default:
      return false;
  }
}

/**
 * SSE Service for the Phoenix ORCH application
 * Handles connection management and message parsing
 */
class SSEService {
  private eventSources: Record<string, EventSource> = {};
  private reconnectTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};
  private reconnectAttempts: Record<string, number> = {};
  private eventCallbacks: Record<string, Array<(message: SSEMessage) => void>> = {};
  private endpoints: Record<string, string> = {}; // Store endpoints for reconnection
  
  constructor() {
    if (typeof window === 'undefined') return;
    
    // Handle page visibility change to reconnect when returning
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.reconnectAll();
      }
    });
    
    // Handle online status changes
    window.addEventListener('online', () => this.reconnectAll());
    window.addEventListener('offline', () => this.closeAll());
  }
  
  /**
   * Connect to an SSE endpoint
   * @param endpoint The SSE endpoint to connect to
   * @param streamId A unique identifier for this stream
   */
  connect(endpoint: string, streamId: string = 'default'): void {
    if (typeof window === 'undefined') return;
    
    // Close existing connection if any
    this.close(streamId);
    
    // Store endpoint for reconnection
    this.endpoints[streamId] = endpoint;
    
    try {
      // Create new EventSource
      const eventSource = new EventSource(endpoint);
      this.eventSources[streamId] = eventSource;
      
      // Initialize connection state
      this.reconnectAttempts[streamId] = 0;
      
      // Set up event handlers
      eventSource.onopen = () => {
        console.log(`🔥 Phoenix SSE (${streamId}): Connected`);
        this.reconnectAttempts[streamId] = 0;
        
        // Signal system message for connection established
        const systemMessage: SystemMessage = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          type: 'system',
          status: 'online',
          message: 'Connection established'
        };
        
        this.notifySubscribers(streamId, systemMessage);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (isValidSSEMessage(data)) {
            // Notify subscribers
            this.notifySubscribers(streamId, data);
          } else {
            console.warn(`🔥 Phoenix SSE (${streamId}): Invalid message format`, data);
          }
        } catch (error) {
          console.error(`🔥 Phoenix SSE (${streamId}): Failed to parse message`, error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error(`🔥 Phoenix SSE (${streamId}): Error`, error);
        eventSource.close();
        
        // Signal system message for connection error
        const systemMessage: SystemMessage = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          type: 'system',
          status: 'error',
          message: 'Connection error'
        };
        
        this.notifySubscribers(streamId, systemMessage);
        this.setupReconnect(endpoint, streamId);
      };
    } catch (error) {
      console.error(`🔥 Phoenix SSE (${streamId}): Failed to connect`, error);
      this.setupReconnect(endpoint, streamId);
    }
  }
  
  /**
   * Set up reconnection attempt
   */
  private setupReconnect(endpoint: string, streamId: string): void {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeouts[streamId]) {
      clearTimeout(this.reconnectTimeouts[streamId]);
    }
    
    // Exponential backoff for reconnection
    const attempts = this.reconnectAttempts[streamId] || 0;
    const delay = Math.min(1000 * Math.pow(1.5, attempts), 30000);
    
    this.reconnectAttempts[streamId] = attempts + 1;
    this.reconnectTimeouts[streamId] = setTimeout(() => {
      console.log(`🔥 Phoenix SSE (${streamId}): Attempting to reconnect...`);
      this.connect(endpoint, streamId);
    }, delay);
  }
  
  /**
   * Close an SSE connection
   */
  close(streamId: string = 'default'): void {
    const eventSource = this.eventSources[streamId];
    
    if (eventSource) {
      eventSource.close();
      delete this.eventSources[streamId];
      
      // Clear any reconnect timeout
      if (this.reconnectTimeouts[streamId]) {
        clearTimeout(this.reconnectTimeouts[streamId]);
        delete this.reconnectTimeouts[streamId];
      }
      
      // Note: Keep endpoint stored for potential reconnection
      // Only remove endpoint if explicitly disconnecting
      
      console.log(`🔥 Phoenix SSE (${streamId}): Connection closed`);
    }
  }
  
  /**
   * Disconnect and remove endpoint (prevents reconnection)
   */
  disconnect(streamId: string = 'default'): void {
    this.close(streamId);
    delete this.endpoints[streamId];
    delete this.reconnectAttempts[streamId];
  }
  
  /**
   * Close all SSE connections
   */
  closeAll(): void {
    Object.keys(this.eventSources).forEach(streamId => {
      this.close(streamId);
    });
  }
  
  /**
   * Disconnect all SSE connections (removes endpoints)
   */
  disconnectAll(): void {
    Object.keys(this.endpoints).forEach(streamId => {
      this.disconnect(streamId);
    });
  }
  
  /**
   * Reconnect all SSE connections
   */
  reconnectAll(): void {
    Object.keys(this.endpoints).forEach(streamId => {
      const eventSource = this.eventSources[streamId];
      const endpoint = this.endpoints[streamId];
      
      if (endpoint && (!eventSource || eventSource.readyState !== EventSource.OPEN)) {
        // Reconnect using stored endpoint
        this.connect(endpoint, streamId);
      }
    });
  }
  
  /**
   * Subscribe to SSE messages
   */
  subscribe(streamId: string, callback: (message: SSEMessage) => void): () => void {
    if (!this.eventCallbacks[streamId]) {
      this.eventCallbacks[streamId] = [];
    }
    
    this.eventCallbacks[streamId].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.eventCallbacks[streamId] = this.eventCallbacks[streamId]
        .filter(cb => cb !== callback);
    };
  }
  
  /**
   * Notify subscribers of a new message
   */
  private notifySubscribers(streamId: string, message: SSEMessage): void {
    if (!this.eventCallbacks[streamId]) return;
    
    this.eventCallbacks[streamId].forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error(`🔥 Phoenix SSE (${streamId}): Error in subscriber`, error);
      }
    });
  }
}

// Create a singleton instance
const sseService = new SSEService();
export default sseService;

/**
 * React hook to subscribe to SSE events from a specific stream
 *
 * @param streamId - The unique identifier of the SSE stream to subscribe to
 * @returns An object containing messages, connection status, and methods to connect/disconnect
 */
export function useSSE(streamId: string = 'default') {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  
  useEffect(() => {
    // Subscribe to messages
    const unsubscribe = sseService.subscribe(streamId, (message) => {
      if (message.type === 'system') {
        setConnected(message.status === 'online');
      }
      
      setMessages(prev => [message, ...prev].slice(0, 50));
    });
    
    return () => {
      unsubscribe();
    };
  }, [streamId]);
  
  const connect = useCallback((endpoint: string) => {
    sseService.connect(endpoint, streamId);
  }, [streamId]);
  
  const disconnect = useCallback(() => {
    sseService.close(streamId);
    setConnected(false);
  }, [streamId]);
  
  return {
    messages,
    connected,
    connect,
    disconnect
  };
}