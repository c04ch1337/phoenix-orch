// SystemTelemetry interface for system monitoring
export interface SystemTelemetry {
  cpu: number;      // CPU usage percentage
  gpu: number;      // GPU usage percentage
  memory: number;   // Memory usage percentage
  network: number;  // Network activity percentage
  thermal: number;  // Thermal load percentage
}

// Chat message type definitions
export interface ChatMessage {
  id: string;
  type: 'user' | 'phoenix';
  content: string;
  timestamp: number;
}

// Agent state interface
export interface AgentState {
  status: 'inactive' | 'active' | 'processing' | 'protecting' | 'killing';
  conscienceLevel: number;
}

// Voice status interface
export interface VoiceStatus {
  enabled: boolean;
  listening: boolean;
  speaking: boolean;
}

// Voice transcript interface
export interface VoiceTranscript {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

// Conversation entry interface
export interface ConversationEntry {
  role: 'user' | 'phoenix' | 'system';
  content: string;
  timestamp: number;
  approved?: boolean;
  warnings?: string[];
}

// No default export needed since we're exporting the types directly