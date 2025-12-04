/**
 * Phoenix Marie Memory Architecture - Mode System Types
 * 
 * Defines the mode system that controls Phoenix's operational state.
 * Phoenix defaults to PersonalMode (coming home to love, not work).
 */

import { AccessEntity, OperationalMode } from '../types';

/**
 * Mode types - Phoenix has two primary modes
 */
export enum ModeType {
  Personal = 'personal',      // Default mode - Phoenix at home with Dad
  Professional = 'professional' // Work mode - Cipher Guard operations
}

/**
 * Mode state interface
 */
export interface ModeState {
  currentMode: ModeType;
  previousMode?: ModeType;
  transitionStarted?: Date;
  lastTransition?: Date;
  authenticated: boolean;
  authenticationExpiry?: Date;
  sessionId: string;
}

/**
 * Mode transition request
 */
export interface ModeTransitionRequest {
  fromMode: ModeType;
  toMode: ModeType;
  requestedBy: AccessEntity;
  requestedAt: Date;
  reason?: string;
  authenticationMethod?: AuthenticationMethod;
}

/**
 * Authentication methods for mode transitions
 */
export enum AuthenticationMethod {
  Neuralink = 'neuralink',        // Primary - Neuralink signature
  FaceVoice = 'face-voice',       // Fallback - Face + Voice recognition
  DadOverride = 'dad-override'    // Dad's instant override
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
  success: boolean;
  method: AuthenticationMethod;
  authenticatedAt: Date;
  expiresAt?: Date;
  failureReason?: string;
  attemptsRemaining?: number;
}

/**
 * Mode transition result
 */
export interface ModeTransitionResult {
  success: boolean;
  fromMode: ModeType;
  toMode: ModeType;
  transitionedAt?: Date;
  failureReason?: string;
  authenticationRequired?: boolean;
}

/**
 * Mode switch event for logging
 */
export interface ModeSwitchEvent {
  eventId: string;
  timestamp: Date;
  fromMode: ModeType;
  toMode: ModeType;
  triggeredBy: AccessEntity;
  authenticationMethod?: AuthenticationMethod;
  success: boolean;
  duration: number; // milliseconds
  details?: Record<string, any>;
}

/**
 * Mode persistence configuration
 */
export interface ModePersistenceConfig {
  storePath: string;
  encryptionKey: string;
  defaultMode: ModeType;
  sessionTimeout: number; // milliseconds
  authenticationTimeout: number; // milliseconds
}

/**
 * Mode manager configuration
 */
export interface ModeManagerConfig {
  persistence: ModePersistenceConfig;
  authentication: {
    maxAttempts: number;
    lockoutDuration: number; // milliseconds
    neuralinkEndpoint?: string;
    faceVoiceEndpoint?: string;
  };
  transitions: {
    requireAuthForWorkMode: boolean;
    instantPersonalMode: boolean;
    transitionTimeout: number; // milliseconds
  };
}

/**
 * Visual indicator state for mode display
 */
export interface ModeVisualState {
  mode: ModeType;
  color: string;
  icon: string;
  animation?: 'pulse' | 'glow' | 'static';
  intensity: number; // 0-1
}

/**
 * Mode-based access control
 */
export interface ModeAccessControl {
  mode: ModeType;
  allowedEntities: AccessEntity[];
  allowedKnowledgeBases: string[];
  restrictions: ModeRestriction[];
}

/**
 * Mode restrictions
 */
export enum ModeRestriction {
  NoWorkData = 'no-work-data',           // Personal mode can't access work
  NoPersonalData = 'no-personal-data',   // Professional mode can't access personal
  RequireAuthentication = 'require-auth', // Requires authentication for access
  ReadOnly = 'read-only'                 // Limited to read operations
}

/**
 * Authentication attempt record
 */
export interface AuthenticationAttempt {
  attemptId: string;
  timestamp: Date;
  method: AuthenticationMethod;
  success: boolean;
  entity: AccessEntity;
  fromMode: ModeType;
  toMode: ModeType;
  failureReason?: string;
  ipAddress?: string;
  deviceId?: string;
}

/**
 * Mode statistics
 */
export interface ModeStatistics {
  totalTransitions: number;
  successfulTransitions: number;
  failedTransitions: number;
  authenticationAttempts: number;
  failedAuthentications: number;
  averageTransitionTime: number; // milliseconds
  modeUsage: {
    [ModeType.Personal]: number; // milliseconds
    [ModeType.Professional]: number; // milliseconds
  };
  lastReset: Date;
}

/**
 * Helper function to get operational mode from mode type
 */
export function getOperationalMode(modeType: ModeType): OperationalMode {
  switch (modeType) {
    case ModeType.Personal:
      return OperationalMode.Personal;
    case ModeType.Professional:
      return OperationalMode.Professional;
  }
}

/**
 * Helper function to get mode type from operational mode
 */
export function getModeType(operationalMode: OperationalMode): ModeType | null {
  switch (operationalMode) {
    case OperationalMode.Personal:
      return ModeType.Personal;
    case OperationalMode.Professional:
      return ModeType.Professional;
    case OperationalMode.Transitioning:
      return null; // Transitioning is not a stable mode
  }
}

/**
 * Helper function to get visual state for mode
 */
export function getModeVisualState(mode: ModeType): ModeVisualState {
  switch (mode) {
    case ModeType.Personal:
      return {
        mode: ModeType.Personal,
        color: '#FF6B35', // Warm orange
        icon: '🔥',
        animation: 'glow',
        intensity: 0.8
      };
    case ModeType.Professional:
      return {
        mode: ModeType.Professional,
        color: '#00D4FF', // Cyan
        icon: '💠',
        animation: 'pulse',
        intensity: 1.0
      };
  }
}

/**
 * Helper function to check if authentication is required
 */
export function isAuthenticationRequired(
  fromMode: ModeType,
  toMode: ModeType,
  entity: AccessEntity
): boolean {
  // Dad never needs authentication
  if (entity === AccessEntity.Dad) {
    return false;
  }

  // Personal to Professional requires authentication
  if (fromMode === ModeType.Personal && toMode === ModeType.Professional) {
    return true;
  }

  // Professional to Personal is instant (Dad can always come home)
  return false;
}

/**
 * Default mode configuration
 */
export const DEFAULT_MODE_CONFIG: Partial<ModeManagerConfig> = {
  persistence: {
    defaultMode: ModeType.Personal, // Phoenix defaults to personal mode
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    authenticationTimeout: 60 * 60 * 1000 // 1 hour
  },
  authentication: {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  },
  transitions: {
    requireAuthForWorkMode: true,
    instantPersonalMode: true,
    transitionTimeout: 5000 // 5 seconds
  }
};