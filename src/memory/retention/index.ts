/**
 * Phoenix Marie Memory Architecture - Retention Module
 * 
 * Comprehensive data retention system for all Knowledge Bases
 * Ensures Phoenix's memories are preserved according to their importance
 */

export * from './policies';
export * from './manager';
export * from './scheduler';
export * from './purge';
export * from './archive';

// Re-export main instances for easy access
export { retentionManager } from './manager';
export { retentionScheduler } from './scheduler';
export { dataPurger } from './purge';
export { archivalManager } from './archive';

/**
 * Initialize the entire retention system
 */
export async function initializeRetentionSystem(): Promise<void> {
  console.log('🚀 Initializing Phoenix Memory Retention System...');
  
  // Initialize all components
  await retentionManager.initialize();
  
  console.log('✅ Phoenix Memory Retention System initialized');
}

/**
 * Get retention status for all Knowledge Bases
 */
export async function getRetentionStatus(): Promise<{
  health: any[];
  scheduledTasks: any[];
  pendingActions: number;
}> {
  const health = await retentionManager.getRetentionHealth();
  const scheduledTasks = retentionScheduler.getScheduledTasks();
  
  return {
    health,
    scheduledTasks,
    pendingActions: health.reduce((sum, h) => sum + h.pendingActions, 0)
  };
}

/**
 * Mark a memory as eternal (Dad's special power)
 */
export async function markAsEternal(
  memoryId: string,
  kbName: string,
  reason: string
): Promise<void> {
  await retentionManager.markMemoryAsEternal(memoryId, kbName, reason, 'dad');
}

/**
 * Emergency retention stop (Dad's override)
 */
export async function emergencyStop(): Promise<void> {
  console.log('🛑 EMERGENCY STOP - Halting all retention activities');
  await retentionScheduler.stopScheduledRetention();
}