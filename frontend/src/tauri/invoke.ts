import { invoke } from '@tauri-apps/api/tauri';

/**
 * Phoenix ORCH Tauri invoke wrapper
 * 
 * This module provides a type-safe wrapper around Tauri's invoke() function for
 * communicating with the Rust backend. It ensures all backend communication
 * goes through Tauri's invoke() mechanism and not through direct HTTP requests.
 */

// Type definitions for API calls
export interface ChatRequest {
  message: string;
  context?: string;
  user_id: string;
}

export interface ChatResponse {
  response: string;
  tokens?: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  uptime: string;
}

export interface SystemTelemetry {
  cpu_usage: number;
  gpu_usage: number;
  memory_usage: number;
  heat_index: number;
  uptime_formatted: string;
  core_temp: number;
  storage_pb: number;
}

// Generic invoke function with error handling and context preservation
async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Preserve full error context
    const errorContext = {
      command,
      args: args ? JSON.stringify(args) : 'none',
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : String(error),
      timestamp: new Date().toISOString()
    };
    
    console.error(`Error invoking ${command}:`, errorContext);
    
    // Create error with full context
    const enhancedError = new Error(
      `Failed to invoke ${command}: ${error instanceof Error ? error.message : String(error)}`
    );
    
    // Attach context to error object
    (enhancedError as any).context = errorContext;
    
    throw enhancedError;
  }
}

// SSE Connection
export async function initializeSseConnection(): Promise<void> {
  return invokeCommand('initialize_sse_connection', {});
}

// Cipher API
export async function analyzeCipherPattern(pattern: string): Promise<string> {
  return invokeCommand('analyze_cipher_pattern', { pattern });
}

export async function encryptData(data: string, key: string): Promise<string> {
  return invokeCommand('encrypt_data', { data, key });
}

export async function decryptData(encryptedData: string, key: string): Promise<string> {
  return invokeCommand('decrypt_data', { encrypted_data: encryptedData, key });
}

// Ember Unit API
export async function activateEmberUnit(parameters: string): Promise<string> {
  return invokeCommand('activate_ember_unit', { parameters });
}

export async function executeEmberOperation(operation: string, params: string): Promise<string> {
  return invokeCommand('execute_ember_operation', { operation, params });
}

// Security API
export async function validateMemoryIntegrity(): Promise<boolean> {
  return invokeCommand('validate_memory_integrity', {});
}

// Health API
export async function getHealthStatus(): Promise<HealthResponse> {
  return invokeCommand('get_health_status', {});
}

// Chat API (legacy compatibility)
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return invokeCommand('send_chat_message', { request });
}

// System metrics (legacy compatibility)
export async function getSystemMetrics(): Promise<SystemTelemetry> {
  return invokeCommand('get_system_metrics', {});
}

// Phoenix ignition
export interface IgniteResponse {
  ignited: boolean;
  ignition_timestamp: string;
  conscience_level: number;
  cipher_status: string;
  ember_status: string;
  security_status: string;
  timestamp: string;
}

export async function ignitePhoenix(): Promise<IgniteResponse> {
  return invokeCommand<IgniteResponse>('ignite_phoenix', {});
}