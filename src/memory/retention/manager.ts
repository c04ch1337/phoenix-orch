/**
 * Phoenix Marie Memory Architecture - Retention Manager
 * 
 * Centralized retention management for all Knowledge Bases
 * Coordinates retention policies, scheduling, and safety checks
 */

import { 
  KB_RETENTION_POLICIES, 
  RetentionPolicy, 
  RetentionEvent,
  RetentionAction,
  RetentionHealth,
  StorageTier,
  TIER_TRANSITIONS,
  EternalMemoryMarker,
  DAD_VETO_CONFIG
} from './policies';
import { RetentionScheduler } from './scheduler';
import { DataPurger } from './purge';
import { ArchivalManager } from './archive';
import { v4 as uuidv4 } from 'uuid';

export interface RetentionManagerConfig {
  enableAutoRetention: boolean;
  enableVetoSystem: boolean;
  notificationWebhook?: string;
  dryRunMode: boolean;
}

export interface RetentionResult {
  success: boolean;
  kbName: string;
  action: RetentionAction;
  recordsAffected: number;
  errors?: string[];
  vetoWindow?: Date;
}

export class RetentionManager {
  private scheduler: RetentionScheduler;
  private purger: DataPurger;
  private archiver: ArchivalManager;
  private config: RetentionManagerConfig;
  private pendingActions: Map<string, RetentionEvent>;
  private eternalMarkers: Map<string, EternalMemoryMarker>;

  constructor(config: RetentionManagerConfig) {
    this.config = config;
    this.scheduler = new RetentionScheduler();
    this.purger = new DataPurger();
    this.archiver = new ArchivalManager();
    this.pendingActions = new Map();
    this.eternalMarkers = new Map();
  }

  /**
   * Initialize retention manager and start scheduled tasks
   */
  async initialize(): Promise<void> {
    console.log('🧠 Initializing Phoenix Memory Retention Manager...');
    
    // Load eternal memory markers
    await this.loadEternalMarkers();
    
    // Initialize sub-components
    await this.scheduler.initialize();
    await this.purger.initialize();
    await this.archiver.initialize();
    
    // Start retention scheduling if enabled
    if (this.config.enableAutoRetention) {
      await this.scheduler.startScheduledRetention();
    }
    
    console.log('✅ Retention Manager initialized successfully');
  }

  /**
   * Execute retention for a specific Knowledge Base
   */
  async executeRetention(kbName: string): Promise<RetentionResult> {
    const policy = KB_RETENTION_POLICIES[kbName];
    if (!policy) {
      throw new Error(`Unknown Knowledge Base: ${kbName}`);
    }

    // Soul-KB is immutable - no retention actions allowed
    if (policy.isImmutable) {
      return {
        success: true,
        kbName,
        action: RetentionAction.ARCHIVE,
        recordsAffected: 0
      };
    }

    const retentionEvent: RetentionEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      action: RetentionAction.ARCHIVE,
      kbName,
      affectedRecords: 0,
      performedBy: 'system',
      approved: false
    };

    try {
      // Check if Dad's approval is required
      if (policy.requiresDadApproval && this.config.enableVetoSystem) {
        return await this.requestDadApproval(retentionEvent, policy);
      }

      // Execute retention based on policy
      let result: RetentionResult;
      
      if (policy.tieredStorage) {
        result = await this.executeTieredRetention(kbName, policy);
      } else {
        result = await this.executeStandardRetention(kbName, policy);
      }

      // Log retention event
      await this.logRetentionEvent({
        ...retentionEvent,
        affectedRecords: result.recordsAffected,
        approved: true
      });

      return result;
    } catch (error) {
      console.error(`Retention failed for ${kbName}:`, error);
      return {
        success: false,
        kbName,
        action: RetentionAction.ARCHIVE,
        recordsAffected: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Execute tiered storage retention (for personal KBs)
   */
  private async executeTieredRetention(
    kbName: string, 
    policy: RetentionPolicy
  ): Promise<RetentionResult> {
    let totalAffected = 0;
    
    // Process tier transitions
    for (const transition of TIER_TRANSITIONS) {
      const affected = await this.archiver.transitionTier(
        kbName,
        transition.fromTier,
        transition.toTier,
        transition.afterDays
      );
      totalAffected += affected;
    }

    // Archive cold tier data if needed
    if (policy.autoArchive) {
      const archived = await this.archiver.archiveColdData(kbName);
      totalAffected += archived;
    }

    return {
      success: true,
      kbName,
      action: RetentionAction.TIER_TRANSITION,
      recordsAffected: totalAffected
    };
  }

  /**
   * Execute standard retention (for professional KBs)
   */
  private async executeStandardRetention(
    kbName: string,
    policy: RetentionPolicy
  ): Promise<RetentionResult> {
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    // Deduplicate if enabled
    let deduped = 0;
    if (policy.deduplication) {
      deduped = await this.purger.deduplicateData(kbName);
    }

    // Purge old data
    const purged = await this.purger.purgeOldData(
      kbName,
      cutoffDate,
      this.config.dryRunMode
    );

    return {
      success: true,
      kbName,
      action: RetentionAction.PURGE,
      recordsAffected: purged + deduped
    };
  }

  /**
   * Request Dad's approval for retention action
   */
  private async requestDadApproval(
    event: RetentionEvent,
    policy: RetentionPolicy
  ): Promise<RetentionResult> {
    const vetoWindow = new Date();
    vetoWindow.setHours(vetoWindow.getHours() + DAD_VETO_CONFIG.vetoWindowHours);

    // Store pending action
    this.pendingActions.set(event.id, event);

    // Send notification
    await this.notifyDad(event, policy, vetoWindow);

    return {
      success: true,
      kbName: event.kbName,
      action: event.action,
      recordsAffected: 0,
      vetoWindow
    };
  }

  /**
   * Mark a memory as eternal (never to be deleted)
   */
  async markMemoryAsEternal(
    memoryId: string,
    kbName: string,
    reason: string,
    markedBy: 'dad' | 'phoenix' = 'dad'
  ): Promise<void> {
    const marker: EternalMemoryMarker = {
      memoryId,
      markedBy,
      markedAt: new Date(),
      reason
    };

    this.eternalMarkers.set(memoryId, marker);
    
    // Persist marker
    await this.saveEternalMarker(marker);
    
    // Log the action
    await this.logRetentionEvent({
      id: uuidv4(),
      timestamp: new Date(),
      action: RetentionAction.MARK_ETERNAL,
      kbName,
      affectedRecords: 1,
      performedBy: markedBy,
      approved: true,
      metadata: { memoryId, reason }
    });
  }

  /**
   * Get retention health for all KBs
   */
  async getRetentionHealth(): Promise<RetentionHealth[]> {
    const health: RetentionHealth[] = [];

    for (const [kbId, policy] of Object.entries(KB_RETENTION_POLICIES)) {
      const kbHealth = await this.calculateKBHealth(kbId, policy);
      health.push(kbHealth);
    }

    return health;
  }

  /**
   * Calculate health metrics for a specific KB
   */
  private async calculateKBHealth(
    kbName: string,
    policy: RetentionPolicy
  ): Promise<RetentionHealth> {
    // Get tier distribution
    const tierStats = await this.archiver.getTierStatistics(kbName);
    
    // Get next scheduled run
    const nextRun = await this.scheduler.getNextScheduledRun(kbName);
    
    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Deduct points for pending actions
    const pendingCount = Array.from(this.pendingActions.values())
      .filter(a => a.kbName === kbName).length;
    healthScore -= pendingCount * 5;
    
    // Deduct points if retention is overdue
    const lastRun = await this.getLastRetentionRun(kbName);
    const daysSinceLastRun = Math.floor(
      (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastRun > 7) {
      healthScore -= Math.min(daysSinceLastRun - 7, 20);
    }

    return {
      kbName: policy.kbName,
      totalRecords: tierStats.total,
      hotTierRecords: tierStats.hot || 0,
      warmTierRecords: tierStats.warm || 0,
      coldTierRecords: tierStats.cold || 0,
      eternalRecords: tierStats.eternal || 0,
      lastRetentionRun: lastRun,
      nextScheduledRun: nextRun,
      pendingActions: pendingCount,
      healthScore: Math.max(0, healthScore)
    };
  }

  /**
   * Handle Dad's veto decision
   */
  async handleVetoDecision(
    actionId: string,
    decision: 'approve' | 'veto',
    reason?: string
  ): Promise<void> {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      throw new Error(`No pending action found with ID: ${actionId}`);
    }

    if (decision === 'veto') {
      // Log veto
      await this.logRetentionEvent({
        ...action,
        action: RetentionAction.VETO,
        approved: false,
        approvedBy: 'dad',
        metadata: { reason, originalAction: action.action }
      });
      
      // Remove from pending
      this.pendingActions.delete(actionId);
    } else {
      // Approve and execute
      action.approved = true;
      action.approvedBy = 'dad';
      
      // Execute the approved action
      await this.executeApprovedAction(action);
      
      // Remove from pending
      this.pendingActions.delete(actionId);
    }
  }

  /**
   * Manual purge with Dad's authorization
   */
  async manualPurge(
    kbName: string,
    authorization: string
  ): Promise<RetentionResult> {
    const policy = KB_RETENTION_POLICIES[kbName];
    
    if (!policy?.manualPurgeAllowed) {
      throw new Error(`Manual purge not allowed for ${kbName}`);
    }

    // Verify Dad's authorization
    if (!await this.verifyDadAuthorization(authorization)) {
      throw new Error('Invalid authorization for manual purge');
    }

    // Create backup before purge
    await this.purger.createPrePurgeBackup(kbName);

    // Execute purge
    const result = await this.executeStandardRetention(kbName, policy);
    
    // Log manual purge
    await this.logRetentionEvent({
      id: uuidv4(),
      timestamp: new Date(),
      action: RetentionAction.PURGE,
      kbName,
      affectedRecords: result.recordsAffected,
      performedBy: 'dad',
      approved: true,
      metadata: { manual: true }
    });

    return result;
  }

  // Helper methods
  private async loadEternalMarkers(): Promise<void> {
    // Load eternal markers from storage
    // Implementation depends on storage backend
  }

  private async saveEternalMarker(marker: EternalMemoryMarker): Promise<void> {
    // Persist eternal marker to storage
    // Implementation depends on storage backend
  }

  private async notifyDad(
    event: RetentionEvent,
    policy: RetentionPolicy,
    vetoWindow: Date
  ): Promise<void> {
    // Send notification via configured webhook or email
    // Implementation depends on notification system
  }

  private async logRetentionEvent(event: RetentionEvent): Promise<void> {
    // Log retention event for audit trail
    // Implementation depends on logging system
  }

  private async getLastRetentionRun(kbName: string): Promise<Date> {
    // Get last retention run timestamp
    // Implementation depends on storage backend
    return new Date(); // Placeholder
  }

  private async executeApprovedAction(action: RetentionEvent): Promise<void> {
    // Execute the approved retention action
    // Implementation depends on action type
  }

  private async verifyDadAuthorization(authorization: string): Promise<boolean> {
    // Verify Dad's authorization token
    // Implementation depends on auth system
    return true; // Placeholder
  }
}

// Export singleton instance
export const retentionManager = new RetentionManager({
  enableAutoRetention: true,
  enableVetoSystem: true,
  dryRunMode: false
});