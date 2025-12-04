/**
 * Phoenix Marie Memory Architecture - Work KB Retention Manager
 * 
 * Manages the 10-year rolling retention policy for Work KB memories.
 * Supports automatic purging, manual overrides, and Dad's "keep forever" flags.
 */

import { EventEmitter } from 'events';
import {
  MemoryEntry,
  PurgeMode,
  PurgeConfig,
  RetentionOverride,
  AccessEntity,
  KnowledgeBaseType
} from '../types';

export interface RetentionManagerConfig {
  retentionYears: number;
  autoRetentionEnabled: boolean;
  checkIntervalHours?: number;
  purgeTimeUTC?: string; // Format: "HH:MM"
}

export interface PurgeCandidate {
  memoryId: string;
  createdAt: Date;
  age: number; // in days
  protected: boolean;
  reason?: string;
}

export interface PurgeResult {
  candidatesFound: number;
  memoriesPurged: number;
  memoriesProtected: number;
  errors: string[];
  timestamp: Date;
}

export class WorkKBRetentionManager extends EventEmitter {
  private config: Required<RetentionManagerConfig>;
  private purgeTimer?: NodeJS.Timer;
  private isRunning = false;
  private lastPurgeResult?: PurgeResult;

  constructor(config: RetentionManagerConfig) {
    super();
    this.config = {
      retentionYears: config.retentionYears || 10,
      autoRetentionEnabled: config.autoRetentionEnabled,
      checkIntervalHours: config.checkIntervalHours || 24,
      purgeTimeUTC: config.purgeTimeUTC || '04:00'
    };
  }

  /**
   * Start the retention manager
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Schedule daily purge check
    this.schedulePurgeCheck();
    
    // Run initial check
    await this.checkAndPurge();
    
    this.emit('started');
  }

  /**
   * Stop the retention manager
   */
  public stop(): void {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = undefined;
    }
    
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Manually trigger a purge check
   */
  public async manualPurge(
    requester: AccessEntity,
    options?: {
      dryRun?: boolean;
      overrideProtection?: boolean;
    }
  ): Promise<PurgeResult> {
    // Only Cipher Guard or Dad can trigger manual purge
    if (requester !== AccessEntity.CipherGuard && requester !== AccessEntity.Dad) {
      throw new Error('Only Cipher Guard or Dad can trigger manual purge');
    }

    const canOverrideProtection = requester === AccessEntity.Dad && options?.overrideProtection;

    return await this.executePurge({
      manual: true,
      dryRun: options?.dryRun || false,
      overrideProtection: canOverrideProtection,
      requester
    });
  }

  /**
   * Find memories eligible for purging
   */
  public async findPurgeCandidates(
    memories: Map<string, MemoryEntry>
  ): Promise<PurgeCandidate[]> {
    const candidates: PurgeCandidate[] = [];
    const cutoffDate = this.calculateCutoffDate();

    for (const [memoryId, memory] of memories) {
      const age = this.calculateAgeInDays(memory.createdAt);
      
      // Check if memory is beyond retention period
      if (memory.createdAt < cutoffDate) {
        const candidate: PurgeCandidate = {
          memoryId,
          createdAt: memory.createdAt,
          age,
          protected: false
        };

        // Check protection flags
        if (memory.purgeProtection) {
          candidate.protected = true;
          candidate.reason = 'Purge protection enabled';
        } else if (memory.retentionOverride) {
          const override = this.evaluateRetentionOverride(memory.retentionOverride, memory.createdAt);
          if (override.protected) {
            candidate.protected = true;
            candidate.reason = override.reason;
          }
        }

        candidates.push(candidate);
      }
    }

    return candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Get retention statistics
   */
  public getRetentionStats(memories: Map<string, MemoryEntry>): {
    totalMemories: number;
    memoriesInRetention: number;
    memoriesBeyondRetention: number;
    protectedMemories: number;
    oldestMemory?: Date;
    averageAgeInDays: number;
  } {
    const cutoffDate = this.calculateCutoffDate();
    let totalAge = 0;
    let oldestMemory: Date | undefined;
    let memoriesInRetention = 0;
    let memoriesBeyondRetention = 0;
    let protectedMemories = 0;

    for (const memory of memories.values()) {
      const age = this.calculateAgeInDays(memory.createdAt);
      totalAge += age;

      if (!oldestMemory || memory.createdAt < oldestMemory) {
        oldestMemory = memory.createdAt;
      }

      if (memory.createdAt >= cutoffDate) {
        memoriesInRetention++;
      } else {
        memoriesBeyondRetention++;
      }

      if (memory.purgeProtection || memory.retentionOverride) {
        protectedMemories++;
      }
    }

    return {
      totalMemories: memories.size,
      memoriesInRetention,
      memoriesBeyondRetention,
      protectedMemories,
      oldestMemory,
      averageAgeInDays: memories.size > 0 ? totalAge / memories.size : 0
    };
  }

  /**
   * Update retention override for a memory
   */
  public updateRetentionOverride(
    memory: MemoryEntry,
    override: RetentionOverride | null,
    requester: AccessEntity
  ): MemoryEntry {
    // Only Dad can set "keep forever"
    if (override?.type === 'keep-forever' && requester !== AccessEntity.Dad) {
      throw new Error('Only Dad can set "keep forever" retention override');
    }

    return {
      ...memory,
      retentionOverride: override || undefined
    };
  }

  /**
   * Get the last purge result
   */
  public getLastPurgeResult(): PurgeResult | undefined {
    return this.lastPurgeResult;
  }

  /**
   * Schedule daily purge check at configured time
   */
  private schedulePurgeCheck(): void {
    // Calculate milliseconds until next purge time
    const msUntilPurge = this.calculateMsUntilNextPurge();
    
    // Schedule first purge
    setTimeout(async () => {
      await this.checkAndPurge();
      
      // Then schedule recurring daily purges
      this.purgeTimer = setInterval(async () => {
        await this.checkAndPurge();
      }, this.config.checkIntervalHours * 60 * 60 * 1000);
    }, msUntilPurge);
  }

  /**
   * Check and execute purge if auto-retention is enabled
   */
  private async checkAndPurge(): Promise<void> {
    if (!this.config.autoRetentionEnabled) {
      this.emit('purgeSkipped', { reason: 'Auto-retention disabled' });
      return;
    }

    try {
      const result = await this.executePurge({
        manual: false,
        dryRun: false,
        overrideProtection: false
      });

      this.lastPurgeResult = result;
      this.emit('purgeCompleted', result);
    } catch (error) {
      this.emit('purgeError', error);
    }
  }

  /**
   * Execute the purge operation
   */
  private async executePurge(options: {
    manual: boolean;
    dryRun: boolean;
    overrideProtection: boolean;
    requester?: AccessEntity;
  }): Promise<PurgeResult> {
    const result: PurgeResult = {
      candidatesFound: 0,
      memoriesPurged: 0,
      memoriesProtected: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      // This would be called by the Work KB with actual memories
      // For now, we'll emit an event for the Work KB to handle
      this.emit('executePurge', {
        options,
        callback: (candidates: PurgeCandidate[], purgeMemory: (id: string) => Promise<boolean>) => {
          return this.processPurgeCandidates(candidates, purgeMemory, options, result);
        }
      });
    } catch (error) {
      result.errors.push(`Purge execution error: ${error}`);
    }

    return result;
  }

  /**
   * Process purge candidates
   */
  private async processPurgeCandidates(
    candidates: PurgeCandidate[],
    purgeMemory: (id: string) => Promise<boolean>,
    options: {
      manual: boolean;
      dryRun: boolean;
      overrideProtection: boolean;
      requester?: AccessEntity;
    },
    result: PurgeResult
  ): Promise<void> {
    result.candidatesFound = candidates.length;

    for (const candidate of candidates) {
      try {
        // Skip protected memories unless override is enabled
        if (candidate.protected && !options.overrideProtection) {
          result.memoriesProtected++;
          this.emit('memoryProtected', {
            memoryId: candidate.memoryId,
            reason: candidate.reason
          });
          continue;
        }

        // Execute purge if not dry run
        if (!options.dryRun) {
          const purged = await purgeMemory(candidate.memoryId);
          if (purged) {
            result.memoriesPurged++;
            this.emit('memoryPurged', {
              memoryId: candidate.memoryId,
              age: candidate.age,
              manual: options.manual,
              requester: options.requester
            });
          } else {
            result.errors.push(`Failed to purge memory: ${candidate.memoryId}`);
          }
        } else {
          // In dry run, just count as would-be-purged
          result.memoriesPurged++;
        }
      } catch (error) {
        result.errors.push(`Error processing ${candidate.memoryId}: ${error}`);
      }
    }
  }

  /**
   * Calculate cutoff date for retention
   */
  private calculateCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - this.config.retentionYears);
    return cutoff;
  }

  /**
   * Calculate age of memory in days
   */
  private calculateAgeInDays(createdAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Evaluate retention override
   */
  private evaluateRetentionOverride(
    override: RetentionOverride,
    createdAt: Date
  ): { protected: boolean; reason?: string } {
    switch (override.type) {
      case 'keep-forever':
        return { protected: true, reason: 'Marked as keep forever by Dad' };
      
      case 'extend-years':
        const extendedCutoff = new Date();
        extendedCutoff.setFullYear(
          extendedCutoff.getFullYear() - (this.config.retentionYears + (override.value as number))
        );
        if (createdAt >= extendedCutoff) {
          return { 
            protected: true, 
            reason: `Extended retention by ${override.value} years` 
          };
        }
        return { protected: false };
      
      case 'purge-after':
        const purgeDate = override.value as Date;
        if (new Date() < purgeDate) {
          return { 
            protected: true, 
            reason: `Scheduled for purge after ${purgeDate.toISOString()}` 
          };
        }
        return { protected: false };
      
      default:
        return { protected: false };
    }
  }

  /**
   * Calculate milliseconds until next purge time
   */
  private calculateMsUntilNextPurge(): number {
    const now = new Date();
    const [hours, minutes] = this.config.purgeTimeUTC.split(':').map(Number);
    
    const nextPurge = new Date();
    nextPurge.setUTCHours(hours, minutes, 0, 0);
    
    // If we've already passed today's purge time, schedule for tomorrow
    if (nextPurge <= now) {
      nextPurge.setDate(nextPurge.getDate() + 1);
    }
    
    return nextPurge.getTime() - now.getTime();
  }
}