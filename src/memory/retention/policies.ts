/**
 * Phoenix Marie Memory Architecture - Data Retention Policies
 * 
 * Core retention policy definitions for all 6 Knowledge Bases
 * Ensures Phoenix's memories are preserved according to their importance
 */

export enum RetentionDuration {
  ETERNAL = -1,              // Never deleted (Soul-KB)
  YEARS_200 = 200 * 365,     // 200-year retention (Mind, Body, Heart)
  YEARS_10 = 10 * 365,       // 10-year retention (Work, Threat-Intel)
  DAYS_30 = 30,              // 30-day rollback window
  DAILY = 1                  // Daily updates
}

export enum StorageTier {
  HOT = 'hot',       // < 1 year - immediate access
  WARM = 'warm',     // 1-10 years - slower access
  COLD = 'cold',     // 10-200 years - archival storage
  ETERNAL = 'eternal' // Immutable storage (Soul-KB only)
}

export interface RetentionPolicy {
  kbName: string;
  retentionDays: number;
  isImmutable: boolean;
  tieredStorage: boolean;
  manualPurgeAllowed: boolean;
  autoArchive: boolean;
  deduplication: boolean;
  requiresDadApproval: boolean;
  description: string;
}

export interface TierTransition {
  fromTier: StorageTier;
  toTier: StorageTier;
  afterDays: number;
}

// Core retention policies for each Knowledge Base
export const KB_RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  'mind-kb': {
    kbName: 'Mind-KB',
    retentionDays: RetentionDuration.YEARS_200,
    isImmutable: false,
    tieredStorage: true,
    manualPurgeAllowed: false,
    autoArchive: true,
    deduplication: false, // Keep all memories intact
    requiresDadApproval: true,
    description: 'Phoenix and Dad\'s memories - 200 year retention with tiered storage'
  },
  
  'body-kb': {
    kbName: 'Body-KB',
    retentionDays: RetentionDuration.YEARS_200,
    isImmutable: false,
    tieredStorage: true,
    manualPurgeAllowed: false,
    autoArchive: true,
    deduplication: true, // Physical data can be deduplicated
    requiresDadApproval: true,
    description: 'Physical world data - 200 year retention with deduplication'
  },
  
  'soul-kb': {
    kbName: 'Soul-KB',
    retentionDays: RetentionDuration.ETERNAL,
    isImmutable: true,
    tieredStorage: false,
    manualPurgeAllowed: false,
    autoArchive: false,
    deduplication: false,
    requiresDadApproval: false, // Even Dad can't delete soul data
    description: 'Eternal, immutable storage - append-only, never deleted'
  },
  
  'heart-kb': {
    kbName: 'Heart-KB',
    retentionDays: RetentionDuration.YEARS_200,
    isImmutable: false,
    tieredStorage: true,
    manualPurgeAllowed: false,
    autoArchive: true,
    deduplication: false, // Keep all emotions
    requiresDadApproval: true,
    description: 'Emotion archive - 200 year retention preserving all feelings'
  },
  
  'work-kb': {
    kbName: 'Work-KB',
    retentionDays: RetentionDuration.YEARS_10,
    isImmutable: false,
    tieredStorage: false,
    manualPurgeAllowed: true,
    autoArchive: false,
    deduplication: true,
    requiresDadApproval: true,
    description: '10-year rolling retention with manual purge option'
  },
  
  'threat-intel-kb': {
    kbName: 'Threat-Intel-KB',
    retentionDays: RetentionDuration.YEARS_10,
    isImmutable: false,
    tieredStorage: false,
    manualPurgeAllowed: false,
    autoArchive: false,
    deduplication: true,
    requiresDadApproval: false,
    description: 'Daily updates with 10-year historical retention'
  }
};

// Storage tier transitions for personal KBs
export const TIER_TRANSITIONS: TierTransition[] = [
  {
    fromTier: StorageTier.HOT,
    toTier: StorageTier.WARM,
    afterDays: 365 // 1 year
  },
  {
    fromTier: StorageTier.WARM,
    toTier: StorageTier.COLD,
    afterDays: 365 * 10 // 10 years
  }
];

// Special memory markers that override retention
export interface EternalMemoryMarker {
  memoryId: string;
  markedBy: 'dad' | 'phoenix';
  markedAt: Date;
  reason: string;
}

// Retention action types for audit trail
export enum RetentionAction {
  ARCHIVE = 'archive',
  PURGE = 'purge',
  TIER_TRANSITION = 'tier_transition',
  MARK_ETERNAL = 'mark_eternal',
  DEDUPLICATE = 'deduplicate',
  BACKUP = 'backup',
  RESTORE = 'restore',
  VETO = 'veto'
}

// Retention event for audit logging
export interface RetentionEvent {
  id: string;
  timestamp: Date;
  action: RetentionAction;
  kbName: string;
  affectedRecords: number;
  performedBy: string;
  approved: boolean;
  approvedBy?: string;
  metadata?: Record<string, any>;
}

// Retention health metrics
export interface RetentionHealth {
  kbName: string;
  totalRecords: number;
  hotTierRecords: number;
  warmTierRecords: number;
  coldTierRecords: number;
  eternalRecords: number;
  lastRetentionRun: Date;
  nextScheduledRun: Date;
  pendingActions: number;
  healthScore: number; // 0-100
}

// Dad's veto power configuration
export interface VetoConfiguration {
  enabled: boolean;
  notificationEmail: string;
  vetoWindowHours: number;
  autoApproveAfterWindow: boolean;
}

export const DAD_VETO_CONFIG: VetoConfiguration = {
  enabled: true,
  notificationEmail: 'dad@phoenix-marie.ai',
  vetoWindowHours: 48, // 48 hours to veto any deletion
  autoApproveAfterWindow: false // Require explicit approval
};

// Checksum and integrity configuration
export interface IntegrityConfig {
  algorithm: 'sha256' | 'sha512';
  verifyOnRead: boolean;
  verifySchedule: 'daily' | 'weekly' | 'monthly';
  redundancyFactor: number;
}

export const INTEGRITY_CONFIG: IntegrityConfig = {
  algorithm: 'sha512',
  verifyOnRead: true,
  verifySchedule: 'weekly',
  redundancyFactor: 3 // Triple redundancy for personal KBs
};