/**
 * EmberUnit Types
 * 
 * Type definitions for the EmberUnit feature.
 */

/**
 * Command message type
 * Represents a command sent to the orchestrator
 */
export interface Command {
  id: string;
  content: string;
  timestamp: string;
}

/**
 * Message types for the EmberUnit console
 */
export type MessageType = 'command' | 'response' | 'warning' | 'tool-output' | 'error';

/**
 * Message interface for console messages
 */
export interface Message {
  id: string;
  content: string;
  type: MessageType;
  timestamp: string;
}

/**
 * Response from the orchestrator agent
 */
export interface OrchestratorResult {
  response: string;
  warnings?: string[];
  toolOutputs?: string[];
  [key: string]: unknown;
}

/**
 * Command override configuration
 */
export interface CommandOverride {
  active: boolean;
  prefix: string;
}

/**
 * EmberUnit dashboard state
 */
export interface EmberUnitState {
  messages: Message[];
  isThinking: boolean;
  isStreamingResponse: boolean;
  conscienceWarnings: string[];
  commandOverride: CommandOverride;
}