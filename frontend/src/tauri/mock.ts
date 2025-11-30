/**
 * Mock implementations of Tauri APIs for development
 * This allows the application to run in a browser without Tauri
 */

import { ChatRequest } from './invoke';

// API base URL with correct port (5001 as per requirements)
export const API_BASE = 'http://localhost:5001';

// Mock SSE connection for development
let sseConnection: EventSource | null = null;

// Mock implementation of invoke function
export async function invoke<T>(command: string, args?: any): Promise<T> {
  console.log(`[Tauri Mock] invoke: ${command}`, args);
  
  switch (command) {
    // SSE Connection
    case 'initialize_sse_connection': {
      if (!sseConnection) {
        sseConnection = new EventSource(`${API_BASE}/events`);
        
        sseConnection.onopen = () => {
          console.log('[SSE] Connection established');
        };
        
        sseConnection.onerror = (error: Event) => {
          console.error('[SSE] Connection error:', error);
        };
        
        // Set up default event listeners
        sseConnection.addEventListener('health_status', (event: MessageEvent) => {
          console.log('[SSE] Health status:', event.data);
        });
      }
      return undefined as unknown as T;
    }
    
    // Cipher API
    case 'analyze_cipher_pattern': {
      const pattern = args.pattern as string;
      // Mock cipher analysis
      return JSON.stringify({
        pattern: pattern,
        type: "mock_pattern",
        complexity: pattern.length * 2,
        timestamp: new Date().toISOString()
      }) as unknown as T;
    }
    
    case 'encrypt_data': {
      const { data } = args;
      // Mock encryption (just base64 in development)
      return JSON.stringify({
        encrypted_data: btoa(data),
        salt: "mock_salt_base64",
        nonce: "mock_nonce_base64"
      }) as unknown as T;
    }
    
    case 'decrypt_data': {
      const { encrypted_data } = args;
      try {
        // Parse the encrypted data structure
        const parsedData = JSON.parse(encrypted_data);
        // Mock decryption (assume base64)
        return atob(parsedData.encrypted_data) as unknown as T;
      } catch {
        return "Decryption failed (mock)" as unknown as T;
      }
    }
    
    // Ember Unit API
    case 'activate_ember_unit': {
      return JSON.stringify({
        activated: true,
        engagement_id: "mock-ember-engagement-123",
        timestamp: new Date().toISOString()
      }) as unknown as T;
    }
    
    case 'execute_ember_operation': {
      const { operation } = args;
      return JSON.stringify({
        execution: {
          operation: operation,
          status: "completed",
          result: "Mock execution completed successfully",
          timestamp: new Date().toISOString()
        }
      }) as unknown as T;
    }
    
    // Security API
    case 'validate_memory_integrity': {
      return true as unknown as T;
    }
    
    // Health API
    case 'get_health_status': {
      return {
        status: 'ok',
        uptime: '1d 10:18:57' // Mock uptime
      } as unknown as T;
    }
    
    // Legacy Chat API (for compatibility)
    case 'send_chat_message': {
      const request = args.request as ChatRequest;
      // Mock chat response
      return {
        response: `Mock response to: ${request.message}`,
        tokens: request.message.length * 2
      } as unknown as T;
    }
    
    // System metrics (for compatibility)
    case 'get_system_metrics': {
      return {
        cpu_usage: 45,
        gpu_usage: 30,
        memory_usage: 60,
        heat_index: 55,
        uptime_formatted: '1d 10:18:57',
        core_temp: 48.3,
        storage_pb: 4.2
      } as unknown as T;
    }
    
    default:
      throw new Error(`Unimplemented command: ${command}`);
  }
}

// Cleanup function to close SSE connection when needed
export function cleanup() {
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }
}