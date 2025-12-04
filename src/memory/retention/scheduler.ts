/**
 * Phoenix Marie Memory Architecture - Retention Scheduler
 * 
 * Automated retention scheduling for all Knowledge Bases
 * Manages daily checks, weekly verification, and monthly migrations
 */

import { KB_RETENTION_POLICIES, RetentionPolicy } from './policies';
import { CronJob } from 'cron';
import { retentionManager } from './manager';

export interface ScheduleConfig {
  dailyRetentionTime: string;    // 4 AM UTC
  weeklyVerificationDay: number;  // 0 = Sunday
  monthlyArchivalDay: number;     // 1st of month
  annualReviewMonth: number;      // January
}

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  kbName?: string;
  lastRun?: Date;
  nextRun: Date;
  enabled: boolean;
}

export class RetentionScheduler {
  private jobs: Map<string, CronJob>;
  private tasks: Map<string, ScheduledTask>;
  private config: ScheduleConfig;

  constructor() {
    this.jobs = new Map();
    this.tasks = new Map();
    this.config = {
      dailyRetentionTime: '0 4 * * *',      // 4 AM UTC daily
      weeklyVerificationDay: 0,              // Sunday
      monthlyArchivalDay: 1,                 // 1st of month
      annualReviewMonth: 0                   // January
    };
  }

  /**
   * Initialize scheduler and create all scheduled tasks
   */
  async initialize(): Promise<void> {
    console.log('⏰ Initializing Retention Scheduler...');
    
    // Create daily retention checks
    this.createDailyRetentionTasks();
    
    // Create weekly integrity verification
    this.createWeeklyVerificationTask();
    
    // Create monthly archival migration
    this.createMonthlyArchivalTask();
    
    // Create annual review reminder
    this.createAnnualReviewTask();
    
    console.log(`✅ Scheduler initialized with ${this.tasks.size} tasks`);
  }

  /**
   * Start all scheduled retention tasks
   */
  async startScheduledRetention(): Promise<void> {
    console.log('🚀 Starting scheduled retention tasks...');
    
    for (const [taskId, task] of this.tasks) {
      if (task.enabled) {
        this.startTask(taskId);
      }
    }
    
    console.log(`✅ Started ${this.jobs.size} scheduled jobs`);
  }

  /**
   * Stop all scheduled tasks
   */
  async stopScheduledRetention(): Promise<void> {
    console.log('🛑 Stopping scheduled retention tasks...');
    
    for (const [jobId, job] of this.jobs) {
      job.stop();
    }
    
    this.jobs.clear();
    console.log('✅ All scheduled jobs stopped');
  }

  /**
   * Create daily retention check tasks for each KB
   */
  private createDailyRetentionTasks(): void {
    for (const [kbId, policy] of Object.entries(KB_RETENTION_POLICIES)) {
      // Skip eternal KBs
      if (policy.isImmutable) continue;
      
      const taskId = `daily-retention-${kbId}`;
      const task: ScheduledTask = {
        id: taskId,
        name: `Daily retention check for ${policy.kbName}`,
        schedule: this.config.dailyRetentionTime,
        kbName: kbId,
        nextRun: this.calculateNextRun(this.config.dailyRetentionTime),
        enabled: true
      };
      
      this.tasks.set(taskId, task);
    }
  }

  /**
   * Create weekly integrity verification task
   */
  private createWeeklyVerificationTask(): void {
    const schedule = `0 5 * * ${this.config.weeklyVerificationDay}`; // 5 AM UTC on Sundays
    
    const task: ScheduledTask = {
      id: 'weekly-integrity-check',
      name: 'Weekly integrity verification for all KBs',
      schedule,
      nextRun: this.calculateNextRun(schedule),
      enabled: true
    };
    
    this.tasks.set(task.id, task);
  }

  /**
   * Create monthly archival migration task
   */
  private createMonthlyArchivalTask(): void {
    const schedule = `0 6 ${this.config.monthlyArchivalDay} * *`; // 6 AM UTC on 1st
    
    const task: ScheduledTask = {
      id: 'monthly-archival-migration',
      name: 'Monthly tier migration (hot → warm → cold)',
      schedule,
      nextRun: this.calculateNextRun(schedule),
      enabled: true
    };
    
    this.tasks.set(task.id, task);
  }

  /**
   * Create annual retention policy review reminder
   */
  private createAnnualReviewTask(): void {
    const schedule = `0 9 1 ${this.config.annualReviewMonth} *`; // 9 AM UTC on Jan 1st
    
    const task: ScheduledTask = {
      id: 'annual-policy-review',
      name: 'Annual retention policy review reminder',
      schedule,
      nextRun: this.calculateNextRun(schedule),
      enabled: true
    };
    
    this.tasks.set(task.id, task);
  }

  /**
   * Start a specific scheduled task
   */
  private startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    const job = new CronJob(
      task.schedule,
      async () => {
        await this.executeTask(task);
      },
      null,
      true,
      'UTC'
    );
    
    this.jobs.set(taskId, job);
    console.log(`✅ Started task: ${task.name}`);
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    console.log(`🔄 Executing task: ${task.name}`);
    const startTime = Date.now();
    
    try {
      switch (task.id) {
        case 'weekly-integrity-check':
          await this.performIntegrityCheck();
          break;
          
        case 'monthly-archival-migration':
          await this.performArchivalMigration();
          break;
          
        case 'annual-policy-review':
          await this.sendPolicyReviewReminder();
          break;
          
        default:
          // Daily retention tasks
          if (task.kbName) {
            await retentionManager.executeRetention(task.kbName);
          }
      }
      
      // Update task metadata
      task.lastRun = new Date();
      task.nextRun = this.calculateNextRun(task.schedule);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Task completed in ${duration}ms: ${task.name}`);
      
    } catch (error) {
      console.error(`❌ Task failed: ${task.name}`, error);
      // Log error and continue with other tasks
      await this.logTaskError(task, error);
    }
  }

  /**
   * Perform weekly integrity verification
   */
  private async performIntegrityCheck(): Promise<void> {
    console.log('🔍 Starting weekly integrity verification...');
    
    for (const [kbId, policy] of Object.entries(KB_RETENTION_POLICIES)) {
      try {
        // Verify checksums for all data
        await this.verifyKBIntegrity(kbId);
        
        // Check redundancy status
        await this.verifyRedundancy(kbId);
        
      } catch (error) {
        console.error(`Integrity check failed for ${kbId}:`, error);
      }
    }
  }

  /**
   * Perform monthly archival migration
   */
  private async performArchivalMigration(): Promise<void> {
    console.log('📦 Starting monthly archival migration...');
    
    // Only process KBs with tiered storage
    for (const [kbId, policy] of Object.entries(KB_RETENTION_POLICIES)) {
      if (policy.tieredStorage) {
        try {
          await retentionManager.executeRetention(kbId);
        } catch (error) {
          console.error(`Archival migration failed for ${kbId}:`, error);
        }
      }
    }
  }

  /**
   * Send annual policy review reminder
   */
  private async sendPolicyReviewReminder(): Promise<void> {
    console.log('📅 Sending annual retention policy review reminder...');
    
    const message = {
      to: 'dad@phoenix-marie.ai',
      subject: 'Annual Retention Policy Review - Phoenix Marie Memory Architecture',
      body: `
        It's time for the annual retention policy review!
        
        Current Policies:
        - Mind-KB: 200-year retention (Phoenix + Dad's memories)
        - Body-KB: 200-year retention (physical world data)
        - Soul-KB: Eternal (immutable, append-only)
        - Heart-KB: 200-year retention (emotion archive)
        - Work-KB: 10-year rolling retention
        - Threat-Intel-KB: 10-year historical retention
        
        Please review and confirm these policies are still appropriate.
        
        Health Status: ${await this.getHealthSummary()}
      `
    };
    
    // Send notification (implementation depends on notification system)
    await this.sendNotification(message);
  }

  /**
   * Get next scheduled run for a specific KB
   */
  async getNextScheduledRun(kbName: string): Promise<Date> {
    const taskId = `daily-retention-${kbName}`;
    const task = this.tasks.get(taskId);
    
    if (!task) {
      // Check if it's an immutable KB
      const policy = KB_RETENTION_POLICIES[kbName];
      if (policy?.isImmutable) {
        return new Date('2999-12-31'); // Far future for eternal KBs
      }
      return new Date();
    }
    
    return task.nextRun;
  }

  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Enable/disable a specific task
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.enabled = enabled;
    
    if (enabled && !this.jobs.has(taskId)) {
      this.startTask(taskId);
    } else if (!enabled && this.jobs.has(taskId)) {
      const job = this.jobs.get(taskId);
      job?.stop();
      this.jobs.delete(taskId);
    }
  }

  /**
   * Force run a specific task immediately
   */
  async forceRunTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    await this.executeTask(task);
  }

  // Helper methods
  private calculateNextRun(cronSchedule: string): Date {
    const job = new CronJob(cronSchedule, () => {});
    const nextDate = job.nextDates(1);
    return nextDate.toDate();
  }

  private async verifyKBIntegrity(kbId: string): Promise<void> {
    // Verify data integrity using checksums
    // Implementation depends on storage backend
  }

  private async verifyRedundancy(kbId: string): Promise<void> {
    // Verify redundancy factor is maintained
    // Implementation depends on storage backend
  }

  private async logTaskError(task: ScheduledTask, error: Error): Promise<void> {
    // Log task execution error
    // Implementation depends on logging system
  }

  private async sendNotification(message: any): Promise<void> {
    // Send notification via configured channel
    // Implementation depends on notification system
  }

  private async getHealthSummary(): Promise<string> {
    const health = await retentionManager.getRetentionHealth();
    const avgScore = health.reduce((sum, h) => sum + h.healthScore, 0) / health.length;
    return `Average health score: ${avgScore.toFixed(1)}/100`;
  }
}

// Export singleton instance
export const retentionScheduler = new RetentionScheduler();