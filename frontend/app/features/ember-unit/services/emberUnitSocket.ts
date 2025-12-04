/**
 * EmberUnit WebSocket Service
 * 
 * Provides real-time streaming of tool outputs and responses
 * for the EmberUnit functionality.
 */

// Event types that can be emitted by the socket
export type EmberUnitSocketEvent = 
  | 'tool-output'
  | 'response'
  | 'warning'
  | 'error'
  | 'command-received'
  | 'thinking'
  | 'command-complete';

// Interface for socket message structure  
export interface EmberUnitSocketMessage {
  type: EmberUnitSocketEvent;
  data: any;
  timestamp: string;
}

// Socket event listener type
export type EmberUnitSocketListener = (message: EmberUnitSocketMessage) => void;

class EmberUnitSocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<EmberUnitSocketEvent, EmberUnitSocketListener[]> = new Map();
  private reconnectAttempts = 0;
  private isConnecting = false;
  
  /**
   * Connects to the EmberUnit WebSocket server
   */
  connect = () => {
    if (this.socket || this.isConnecting) return;
    
    this.isConnecting = true;
    
    // Connect to the WebSocket server
    try {
      // In a real implementation, this would connect to the actual WebSocket endpoint
      // For now, we're simulating the connection
      console.log('Connecting to EmberUnit WebSocket...');
      
      // Simulate successful connection
      setTimeout(() => {
        this.isConnecting = false;
        console.log('Connected to EmberUnit WebSocket');
        
        // Notify listeners that we're connected
        this.notifyListeners('command-received', {
          message: 'WebSocket connected'
        });
      }, 500);
      
    } catch (error) {
      this.isConnecting = false;
      console.error('Error connecting to WebSocket:', error);
      this.handleReconnect();
    }
  };
  
  /**
   * Attempts to reconnect to the WebSocket server
   */
  private handleReconnect = () => {
    this.reconnectAttempts += 1;
    
    if (this.reconnectAttempts < 5) {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/5)...`);
      setTimeout(this.connect, 2000 * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
      this.notifyListeners('error', {
        message: 'Failed to connect to the Orchestrator server'
      });
    }
  };

  /**
   * Registers a listener for a specific event type
   * 
   * @param event The event type to listen for
   * @param callback The function to call when the event occurs
   */
  on = (event: EmberUnitSocketEvent, callback: EmberUnitSocketListener) => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)?.push(callback);
  };
  
  /**
   * Removes a listener for a specific event type
   * 
   * @param event The event type to remove the listener from
   * @param callback The function to remove
   */
  off = (event: EmberUnitSocketEvent, callback: EmberUnitSocketListener) => {
    if (!this.listeners.has(event)) return;
    
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      this.listeners.set(
        event, 
        eventListeners.filter(listener => listener !== callback)
      );
    }
  };
  
  /**
   * Notifies all listeners of a specific event
   * 
   * @param event The event type
   * @param data The data to send with the event
   */
  private notifyListeners = (event: EmberUnitSocketEvent, data: any) => {
    if (!this.listeners.has(event)) return;
    
    const message: EmberUnitSocketMessage = {
      type: event,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.listeners.get(event)?.forEach(listener => {
      listener(message);
    });
  };
  
  /**
   * Simulates streaming tool outputs for development/testing
   * 
   * @param commandId The ID of the command being executed
   */
  simulateToolOutput = (commandId: string) => {
    // Simulate some tool outputs
    setTimeout(() => {
      this.notifyListeners('tool-output', {
        commandId,
        output: 'Analyzing request parameters...'
      });
    }, 500);
    
    setTimeout(() => {
      this.notifyListeners('tool-output', {
        commandId,
        output: 'Executing orchestrator task...'
      });
    }, 1200);
    
    setTimeout(() => {
      this.notifyListeners('tool-output', {
        commandId,
        output: 'Processing results...'
      });
    }, 2000);
  };
}

// Export a singleton instance
export const emberUnitSocket = new EmberUnitSocketService();