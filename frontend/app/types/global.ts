/**
 * Global type definitions for the Phoenix application.
 * This file contains shared TypeScript interfaces and types that can 
 * be imported by both modules and components across application boundaries.
 */

/**
 * Phoenix application context providing core data about the current session
 * and application state that is available throughout the application.
 */
export interface PhoenixContext {
  user: {
    id: string;
    name: string;
    role: UserRole;
    permissions: string[];
    lastActive: string;
  };
  settings: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    telemetry: boolean;
    conscienceLevel: number;
  };
  runtime: {
    version: string;
    environment: 'development' | 'staging' | 'production';
    features: Record<string, boolean>;
    startTime: string;
  };
  subconscious: {
    active: boolean;
    eventsProcessed: number;
    lastEventTimestamp: string | null;
  };
}

/**
 * User roles in the Phoenix system.
 * Determines access level and available features.
 */
export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  ANALYST = 'analyst',
  VIEWER = 'viewer'
}

/**
 * Event emitted by the Phoenix subconscious processing system.
 * These events represent background insights, alerts, or discoveries
 * that bubble up from below the conscious threshold.
 */
export interface SubconsciousEvent {
  id: string;
  timestamp: string;
  type: SubconsciousEventType;
  source: SubconsciousSource;
  data: Record<string, any>;
  priority: SubconsciousPriority;
  processed: boolean;
  relatedEvents?: string[]; // IDs of related events
  processingMetadata?: {
    detectionTime: string;
    processingTime: number; // ms
    confidenceScore: number; // 0-1
    interpreter: string;
  };
}

/**
 * Possible subconscious event types
 */
export enum SubconsciousEventType {
  INSIGHT = 'insight',
  WARNING = 'warning',
  CRITICAL = 'critical',
  DISCOVERY = 'discovery',
  PATTERN = 'pattern',
  ANOMALY = 'anomaly',
  CONNECTION = 'connection'
}

/**
 * Priority levels for subconscious events
 */
export type SubconsciousPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Sources that can generate subconscious events
 */
export enum SubconsciousSource {
  KERNEL = 'kernel',
  EMBER_UNIT = 'ember-unit',
  CIPHER_GUARD = 'cipher-guard',
  LIVING_ARCHIVE = 'living-archive',
  USER_INTERACTION = 'user-interaction',
  EXTERNAL_STIMULUS = 'external-stimulus'
}

/**
 * Base interface for Phoenix system messages
 */
export interface PhoenixSystemMessage {
  id: string;
  timestamp: string;
  category: 'info' | 'warning' | 'error' | 'success';
  content: string;
  source: string;
  ephemeral: boolean;
  expiresAt?: string;
}

/**
 * Phoenix application error with contextual information for debugging and recovery
 */
export interface PhoenixError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  source: string;
  context?: Record<string, any>;
  stackTrace?: string;
  suggestedActions?: string[];
  userFriendlyMessage?: string;
}

/**
 * Phoenix feature flag configuration
 */
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number;
  requirements?: string[];
  metadata?: Record<string, any>;
}

/**
 * Phoenix module status information
 */
export interface ModuleStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded' | 'maintenance';
  version: string;
  lastUpdated: string;
  metrics?: Record<string, number>;
  dependencies?: string[];
  healthScore?: number; // 0-100
}