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
  /** User information - immutable properties related to the authenticated user */
  readonly user: {
    /** Unique identifier for the user */
    readonly id: string;
    /** Display name of the user */
    readonly name: string;
    /** Access role determining user permissions */
    readonly role: UserRole;
    /** List of specific permissions granted to this user */
    readonly permissions: readonly string[];
    /** ISO timestamp of the user's last activity */
    lastActive: string;
  };

  /** User configurable application settings */
  settings: {
    /** UI theme preference */
    theme: ThemePreference;
    /** Whether notification features are enabled */
    notifications: boolean;
    /** Whether anonymous usage telemetry is enabled */
    telemetry: boolean;
    /** Neural conscience awareness level (0-100) */
    conscienceLevel: number;
  };

  /** Runtime environment configuration - immutable system properties */
  readonly runtime: {
    /** Semantic version of the Phoenix system */
    readonly version: string;
    /** Current deployment environment */
    readonly environment: Environment;
    /** Dictionary of enabled experimental features */
    readonly features: FeatureFlags;
    /** ISO timestamp when this Phoenix instance was initialized */
    readonly startTime: string;
  };

  /** Subconscious processing system state */
  subconscious: {
    /** Whether the subconscious processing system is active */
    active: boolean;
    /** Total number of subconscious events processed */
    eventsProcessed: number;
    /** ISO timestamp of the most recently processed event */
    lastEventTimestamp: string | null;
  };
}

/**
 * Type-safe feature flags mapping
 * Maps feature identifier to boolean enabled status
 */
export type FeatureFlags = {
  readonly [featureKey: string]: boolean;
};

/**
 * Valid theme preferences for the Phoenix UI
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Valid deployment environments for the Phoenix system
 */
export type Environment = 'development' | 'staging' | 'production';

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
 * 
 * Uses a discriminated union pattern with the 'type' field as the discriminator
 * to provide type-safe access to the appropriate data structure.
 */
export type SubconsciousEvent = {
  /** Unique identifier for this event */
  readonly id: string;
  /** ISO timestamp when this event was generated */
  readonly timestamp: string;
  /** Source system that generated this event */
  readonly source: SubconsciousSource;
  /** Priority level determining UI treatment and notification behavior */
  readonly priority: SubconsciousPriority;
  /** Whether this event has been processed by the system */
  processed: boolean;
  /** Optional list of related event IDs forming a causal chain or cluster */
  readonly relatedEvents?: readonly string[];
  /** Optional metadata about the event processing pipeline */
  readonly processingMetadata?: SubconsciousProcessingMetadata;
} & SubconsciousEventData;

/**
 * Metadata about the processing of a subconscious event
 */
export interface SubconsciousProcessingMetadata {
  /** ISO timestamp when this event was initially detected */
  readonly detectionTime: string;
  /** Processing duration in milliseconds */
  readonly processingTime: number;
  /** Confidence score between 0-1 representing certainty */
  readonly confidenceScore: number;
  /** Identifier for the interpreter that processed this event */
  readonly interpreter: string;
}

/**
 * Discriminated union type for subconscious events based on event type
 */
export type SubconsciousEventData =
  | InsightEvent
  | WarningEvent
  | CriticalEvent
  | DiscoveryEvent
  | PatternEvent
  | AnomalyEvent
  | ConnectionEvent;

/**
 * Insight event representing a novel understanding or realization
 */
export interface InsightEvent {
  /** Discriminator field */
  readonly type: SubconsciousEventType.INSIGHT;
  /** Event-specific data */
  readonly data: {
    /** Brief summary of the insight */
    readonly summary: string;
    /** Full description of the insight */
    readonly description: string;
    /** Confidence score between 0-1 */
    readonly confidence: number;
    /** Related concepts or entities */
    readonly relatedConcepts?: readonly string[];
    /** Additional insight-specific properties */
    readonly [key: string]: unknown;
  };
}

/**
 * Warning event indicating a potential issue requiring attention
 */
export interface WarningEvent {
  /** Discriminator field */
  readonly type: SubconsciousEventType.WARNING;
  /** Event-specific data */
  readonly data: {
    /** Brief description of the warning */
    readonly message: string;
    /** The specific component or system generating the warning */
    readonly component: string;
    /** Suggestions for resolving the warning */
    readonly suggestions?: readonly string[];
    /** Additional warning-specific properties */
    readonly [key: string]: unknown;
  };
}

/**
 * Critical event representing an urgent issue requiring immediate action
 */
export interface CriticalEvent {
  /** Discriminator field */
  readonly type: SubconsciousEventType.CRITICAL;
  /** Event-specific data */
  readonly data: {
    /** Brief description of the critical issue */
    readonly message: string;
    /** Detailed explanation of the critical issue */
    readonly details: string;
    /** The affected system or component */
    readonly affectedSystem: string;
    /** Recommended immediate actions */
    readonly recommendedActions: readonly string[];
    /** Time-to-impact in seconds (if applicable) */
    readonly timeToImpact?: number;
    /** Additional critical event-specific properties */
    readonly [key: string]: unknown;
  };
}

/**
 * Discovery event indicating a new finding from data analysis
 */
export interface DiscoveryEvent {
  /** Discriminator field */
  readonly type: SubconsciousEventType.DISCOVERY;
  /** Event-specific data */
  readonly data: {
    /** Brief summary of what was discovered */
    readonly summary: string;
    /** Full description of the discovery */
    readonly description: string;
    /** Source of the discovery (e.g., log analysis, pattern matching) */
    readonly source: string;
    /** Evidence supporting the discovery */
    readonly evidence?: readonly string[];
    /** Additional discovery-specific properties */
    readonly [key: string]: unknown;
  };
}

/**
 * Pattern event indicating a recognized repeated structure or behavior
 */
export interface PatternEvent {
  /** Discriminator field */
  readonly type: SubconsciousEventType.PATTERN;
  /** Event-specific data */
  readonly data: {
    /** Name of the identified pattern */
    readonly patternName: string;
    /** Description of the identified pattern */
    readonly description: string;
    /** Frequency of the pattern's occurrence */
    readonly frequency: number;
    /** Contexts in which the pattern appears */
    readonly contexts?: readonly string[];
    /** Additional pattern-specific properties */
    readonly [key: string]: unknown;
  };
}

/**
 * Anomaly event indicating an unexpected deviation from normal behavior
 */
export interface AnomalyEvent {
  /** Discriminator field */
  readonly type: SubconsciousEventType.ANOMALY;
  /** Event-specific data */
  readonly data: {
    /** Brief description of the anomaly */
    readonly description: string;
    /** Expected behavior or value */
    readonly expected: string;
    /** Actual behavior or value */
    readonly actual: string;
    /** Deviation magnitude (normalized between 0-1) */
    readonly deviationScore: number;
    /** Additional anomaly-specific properties */
    readonly [key: string]: unknown;
  };
}

/**
 * Connection event indicating a relationship between previously unrelated entities
 */
export interface ConnectionEvent {
  /** Discriminator field */
  readonly type: SubconsciousEventType.CONNECTION;
  /** Event-specific data */
  readonly data: {
    /** Description of the connection */
    readonly description: string;
    /** Strength of the connection (0-1) */
    readonly strength: number;
    /** First entity in the connection */
    readonly entityA: string;
    /** Second entity in the connection */
    readonly entityB: string;
    /** Nature of the relationship (e.g., causal, correlational) */
    readonly relationshipType: string;
    /** Additional connection-specific properties */
    readonly [key: string]: unknown;
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
  /** Unique identifier for this message */
  readonly id: string;
  /** ISO timestamp when this message was generated */
  readonly timestamp: string;
  /** Message categorization affecting UI treatment */
  readonly category: MessageCategory;
  /** The message content */
  readonly content: string;
  /** Component that generated the message */
  readonly source: string;
  /** Whether the message is temporary */
  readonly ephemeral: boolean;
  /** Optional ISO timestamp when this message should be automatically removed */
  readonly expiresAt?: string;
}

/**
 * Valid categories for system messages
 */
export type MessageCategory = 'info' | 'warning' | 'error' | 'success';

/**
 * Phoenix application error with contextual information for debugging and recovery
 */
export interface PhoenixError {
  /** Unique error code */
  readonly code: string;
  /** Technical error message */
  readonly message: string;
  /** Error impact severity */
  readonly severity: ErrorSeverity;
  /** ISO timestamp when this error occurred */
  readonly timestamp: string;
  /** Component that generated the error */
  readonly source: string;
  /** Additional structured context for debugging */
  readonly context?: ErrorContext;
  /** Stack trace if available */
  readonly stackTrace?: string;
  /** Actions the user can take to resolve the error */
  readonly suggestedActions?: readonly string[];
  /** Non-technical error message suitable for end users */
  readonly userFriendlyMessage?: string;
}

/**
 * Strongly typed error context object
 */
export interface ErrorContext {
  /** User ID if applicable */
  readonly userId?: string;
  /** Session ID if applicable */
  readonly sessionId?: string;
  /** Request URL if applicable */
  readonly requestUrl?: string;
  /** HTTP status code if applicable */
  readonly statusCode?: number;
  /** Operation being performed when the error occurred */
  readonly operation?: string;
  /** Input that caused the error */
  readonly input?: unknown;
  /** Module-specific information */
  readonly [key: string]: unknown;
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Phoenix feature flag configuration
 */
export interface FeatureFlag {
  /** Unique identifier for this feature */
  readonly name: string;
  /** Whether the feature is currently enabled */
  readonly enabled: boolean;
  /** Human-readable description of the feature */
  readonly description: string;
  /** Percentage of users who should have this feature (0-100) */
  readonly rolloutPercentage?: number;
  /** Dependencies that must be satisfied for this feature */
  readonly requirements?: readonly string[];
  /** Additional feature-specific configuration */
  readonly metadata?: FeatureFlagMetadata;
}

/**
 * Strongly typed metadata for feature flags
 */
export interface FeatureFlagMetadata {
  /** Version this feature was introduced */
  readonly introducedIn?: string;
  /** Whether the feature is in A/B testing */
  readonly isABTest?: boolean;
  /** Team responsible for the feature */
  readonly ownerTeam?: string;
  /** Sunset date for temporary features */
  readonly sunsetDate?: string;
  /** Additional custom properties */
  readonly [key: string]: unknown;
}

/**
 * Phoenix module status information
 */
export interface ModuleStatus {
  /** Unique identifier for this module */
  readonly id: string;
  /** Display name of the module */
  readonly name: string;
  /** Current operational status */
  readonly status: ModuleOperationalStatus;
  /** Semantic version of this module */
  readonly version: string;
  /** ISO timestamp of the most recent status update */
  readonly lastUpdated: string;
  /** Performance and operational metrics */
  readonly metrics?: ModuleMetrics;
  /** IDs of modules this module depends on */
  readonly dependencies?: readonly string[];
  /** Normalized health score (0-100) */
  readonly healthScore?: number;
}

/**
 * Valid operational status values for modules
 */
export type ModuleOperationalStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

/**
 * Strongly typed metrics for module status
 */
export interface ModuleMetrics {
  /** Response time in milliseconds */
  readonly responseTime?: number;
  /** Number of errors encountered */
  readonly errorCount?: number;
  /** Number of requests processed */
  readonly requestCount?: number;
  /** Memory usage in megabytes */
  readonly memoryUsage?: number;
  /** CPU utilization percentage (0-100) */
  readonly cpuUsage?: number;
  /** Additional custom metrics */
  readonly [key: string]: number | undefined;
}