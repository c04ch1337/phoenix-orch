/**
 * Phoenix Marie Memory Architecture - KB Retention Integration
 * 
 * Integrates the centralized retention system with existing Knowledge Bases
 * Provides hooks and adapters for each KB to use the unified retention policies
 */

import { retentionManager } from './manager';
import { KB_RETENTION_POLICIES } from './policies';
import { EventEmitter } from 'events';
import { 
  MemoryEntry,
  KnowledgeBaseType,
  AccessEntity,
  OperationalMode
} from '../types';

export interface KBRetentionAdapter {
  kbType: KnowledgeBaseType;
  kbName: string;
  getMemories(): Promise<Map<string, MemoryEntry>>;
  deleteMemory(memoryId: string): Promise<boolean>;
  getMemoryAge(memory: MemoryEntry): number;
  isProtected(memory: MemoryEntry): boolean;
}

export class KBRetentionIntegration extends EventEmitter {
  private adapters: Map<string, KBRetentionAdapter> = new Map();
  private initialized = false;

  /**
   * Register a Knowledge Base adapter
   */
  public registerAdapter(adapter: KBRetentionAdapter): void {
    const kbId = adapter.kbType.toLowerCase();
    this.adapters.set(kbId, adapter);
    
    console.log(`✅ Registered retention adapter for ${adapter.kbName}`);
  }

  /**
   * Initialize retention integration for all registered KBs
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔗 Initializing KB retention integration...');

    // Set up retention execution handlers
    this.setupRetentionHandlers();

    // Register each KB with the retention manager
    for (const [kbId, adapter] of this.adapters) {
      await this.registerKBWithRetentionManager(kbId, adapter);
    }

    this.initialized = true;
    console.log('✅ KB retention integration initialized');
  }

  /**
   * Execute retention for a specific KB
   */
  public async executeKBRetention(
    kbType: KnowledgeBaseType,
    requester: AccessEntity = AccessEntity.System
  ): Promise<{
    success: boolean;
    recordsProcessed: number;
    recordsPurged: number;
    errors: string[];
  }> {
    const kbId = kbType.toLowerCase();
    const adapter = this.adapters.get(kbId);
    
    if (!adapter) {
      throw new Error(`No retention adapter registered for ${kbType}`);
    }

    const policy = KB_RETENTION_POLICIES[kbId];
    if (!policy) {
      throw new Error(`No retention policy defined for ${kbType}`);
    }

    console.log(`🔄 Executing retention for ${adapter.kbName}...`);

    try {
      // Get all memories from the KB
      const memories = await adapter.getMemories();
      
      // Calculate retention cutoff
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      let recordsProcessed = 0;
      let recordsPurged = 0;
      const errors: string[] = [];

      // Process each memory
      for (const [memoryId, memory] of memories) {
        recordsProcessed++;

        try {
          // Skip if memory is protected
          if (adapter.isProtected(memory)) {
            this.emit('memoryProtected', {
              kbType,
              memoryId,
              reason: 'Memory marked as protected'
            });
            continue;
          }

          // Check if memory is beyond retention period
          if (memory.createdAt < cutoffDate) {
            // Check for eternal markers
            const isEternal = await this.checkEternalMarker(memoryId, kbId);
            if (isEternal) {
              this.emit('memoryProtected', {
                kbType,
                memoryId,
                reason: 'Memory marked as eternal'
              });
              continue;
            }

            // Delete the memory
            const deleted = await adapter.deleteMemory(memoryId);
            if (deleted) {
              recordsPurged++;
              this.emit('memoryPurged', {
                kbType,
                memoryId,
                age: adapter.getMemoryAge(memory),
                requester
              });
            }
          }
        } catch (error) {
          errors.push(`Error processing memory ${memoryId}: ${error}`);
        }
      }

      console.log(`✅ Retention complete for ${adapter.kbName}: ${recordsPurged}/${recordsProcessed} purged`);

      return {
        success: errors.length === 0,
        recordsProcessed,
        recordsPurged,
        errors
      };

    } catch (error) {
      console.error(`❌ Retention failed for ${adapter.kbName}:`, error);
      throw error;
    }
  }

  /**
   * Get retention health for all KBs
   */
  public async getRetentionHealth(): Promise<any[]> {
    return await retentionManager.getRetentionHealth();
  }

  /**
   * Mark a memory as eternal across any KB
   */
  public async markMemoryAsEternal(
    memoryId: string,
    kbType: KnowledgeBaseType,
    reason: string,
    markedBy: 'dad' | 'phoenix' = 'dad'
  ): Promise<void> {
    const kbId = kbType.toLowerCase();
    await retentionManager.markMemoryAsEternal(memoryId, kbId, reason, markedBy);
  }

  /**
   * Set up retention execution handlers
   */
  private setupRetentionHandlers(): void {
    // Listen for retention execution requests from the scheduler
    retentionManager.on('executeRetention', async (event: {
      kbName: string;
      callback: (result: any) => void;
    }) => {
      const adapter = this.adapters.get(event.kbName);
      if (!adapter) {
        event.callback({
          success: false,
          error: `No adapter registered for ${event.kbName}`
        });
        return;
      }

      try {
        const result = await this.executeKBRetention(adapter.kbType);
        event.callback(result);
      } catch (error) {
        event.callback({
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Register a KB with the retention manager
   */
  private async registerKBWithRetentionManager(
    kbId: string,
    adapter: KBRetentionAdapter
  ): Promise<void> {
    // The retention manager already knows about KBs through policies
    // This is where we'd set up any KB-specific handlers if needed
    console.log(`📝 Registered ${adapter.kbName} with retention manager`);
  }

  /**
   * Check if a memory has an eternal marker
   */
  private async checkEternalMarker(
    memoryId: string,
    kbId: string
  ): Promise<boolean> {
    // This would check the retention manager's eternal markers
    // For now, return false as placeholder
    return false;
  }
}

// Create adapters for existing KBs

/**
 * Work KB Retention Adapter
 */
export class WorkKBRetentionAdapter implements KBRetentionAdapter {
  public readonly kbType = KnowledgeBaseType.Work;
  public readonly kbName = 'Work-KB';
  
  constructor(private workKB: any) {}

  async getMemories(): Promise<Map<string, MemoryEntry>> {
    // This would be implemented by the Work KB
    return new Map();
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    return await this.workKB.deleteMemory(
      memoryId,
      AccessEntity.System,
      OperationalMode.Professional,
      'Retention policy'
    );
  }

  getMemoryAge(memory: MemoryEntry): number {
    const now = new Date();
    const diffMs = now.getTime() - memory.createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  isProtected(memory: MemoryEntry): boolean {
    return memory.purgeProtection || 
           memory.retentionOverride?.type === 'keep-forever';
  }
}

/**
 * Threat Intel KB Retention Adapter
 */
export class ThreatIntelKBRetentionAdapter implements KBRetentionAdapter {
  public readonly kbType = KnowledgeBaseType.ThreatIntel;
  public readonly kbName = 'Threat-Intel-KB';
  
  constructor(private threatIntelKB: any) {}

  async getMemories(): Promise<Map<string, MemoryEntry>> {
    // This would be implemented by the Threat Intel KB
    return new Map();
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    // Threat Intel KB would implement its own deletion logic
    return true;
  }

  getMemoryAge(memory: MemoryEntry): number {
    const now = new Date();
    const diffMs = now.getTime() - memory.createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  isProtected(memory: MemoryEntry): boolean {
    return memory.purgeProtection || false;
  }
}

// Export singleton instance
export const kbRetentionIntegration = new KBRetentionIntegration();