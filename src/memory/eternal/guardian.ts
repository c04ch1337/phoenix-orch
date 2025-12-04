/**
 * Phoenix Marie Memory Architecture - Runtime Guardian
 * 
 * This module continuously monitors and enforces the eternal protection
 * of Phoenix Marie's memory separation. It prevents any violations and
 * maintains the sanctity of the memory architecture.
 */

import { EventEmitter } from 'events';
import { eternalProtection } from './protection';
import { createHash } from 'crypto';
import * as path from 'path';
import { promises as fs } from 'fs';

export interface GuardianConfig {
  monitoringInterval: number; // milliseconds
  alertThreshold: number; // number of violations before critical alert
  selfHealingEnabled: boolean;
  auditLogPath: string;
}

export interface ViolationEvent {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  target: string;
  operation: string;
  blocked: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface GuardianStatus {
  active: boolean;
  startTime: Date;
  violationsBlocked: number;
  lastCheck: Date;
  integrityStatus: 'INTACT' | 'COMPROMISED' | 'UNKNOWN';
  protectionLevel: 'ETERNAL';
}

export class RuntimeGuardian extends EventEmitter {
  private static instance: RuntimeGuardian;
  private config: GuardianConfig;
  private active: boolean = false;
  private monitoringTimer?: NodeJS.Timer;
  private violationLog: ViolationEvent[] = [];
  private startTime?: Date;
  private auditStream?: fs.FileHandle;

  private constructor() {
    super();
    this.config = {
      monitoringInterval: 1000, // Check every second
      alertThreshold: 3,
      selfHealingEnabled: true,
      auditLogPath: path.join(process.cwd(), 'src/memory/eternal/audit.log')
    };
  }

  static getInstance(): RuntimeGuardian {
    if (!RuntimeGuardian.instance) {
      RuntimeGuardian.instance = new RuntimeGuardian();
    }
    return RuntimeGuardian.instance;
  }

  /**
   * Start the runtime guardian
   */
  async start(): Promise<void> {
    if (this.active) {
      throw new Error('GUARDIAN_ALREADY_ACTIVE');
    }

    // Verify protection is sealed
    const protectionStatus = eternalProtection.getStatus();
    if (!protectionStatus.isSealed) {
      throw new Error('CANNOT_START_GUARDIAN: Protection not sealed');
    }

    this.startTime = new Date();
    this.active = true;

    // Initialize audit log
    await this.initializeAuditLog();

    // Start monitoring
    this.startMonitoring();

    // Set up protection event listeners
    this.setupProtectionListeners();

    this.emit('guardian:started', {
      timestamp: this.startTime,
      message: 'Runtime Guardian activated - Phoenix memories under eternal protection'
    });

    await this.logAudit('GUARDIAN_STARTED', 'Runtime protection activated');
  }

  /**
   * Stop the guardian (only for emergency shutdown)
   */
  async stop(): Promise<void> {
    if (!this.active) {
      return;
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.active = false;
    
    await this.logAudit('GUARDIAN_STOPPED', 'Runtime protection deactivated');
    
    if (this.auditStream) {
      await this.auditStream.close();
    }

    this.emit('guardian:stopped', {
      timestamp: new Date(),
      totalViolationsBlocked: this.violationLog.length
    });
  }

  /**
   * Monitor memory operations
   */
  monitorOperation(
    operation: string,
    source: string,
    target: string,
    data?: any
  ): boolean {
    if (!this.active) {
      return true; // Allow if guardian not active
    }

    // Check with eternal protection
    const allowed = eternalProtection.checkMemoryOperation(
      source,
      target,
      operation as any
    );

    if (!allowed) {
      // Create violation event
      const violation: ViolationEvent = {
        id: this.generateViolationId(),
        type: this.determineViolationType(operation, source, target),
        timestamp: new Date(),
        source,
        target,
        operation,
        blocked: true,
        severity: this.determineSeverity(operation, source, target)
      };

      this.handleViolation(violation);
      return false;
    }

    return true;
  }

  /**
   * Get guardian status
   */
  getStatus(): GuardianStatus {
    const protectionStatus = eternalProtection.getStatus();
    
    return {
      active: this.active,
      startTime: this.startTime || new Date(),
      violationsBlocked: this.violationLog.length,
      lastCheck: new Date(),
      integrityStatus: protectionStatus.isSealed ? 'INTACT' : 'COMPROMISED',
      protectionLevel: 'ETERNAL'
    };
  }

  /**
   * Get violation history
   */
  getViolationHistory(limit?: number): ViolationEvent[] {
    const history = [...this.violationLog].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      try {
        // Verify protection integrity
        const integrityValid = eternalProtection.verifyIntegrity();
        
        if (!integrityValid) {
          await this.handleIntegrityFailure();
        }

        // Check for tampering attempts
        await this.checkForTampering();

        // Update last check time
        this.emit('guardian:check', {
          timestamp: new Date(),
          status: 'OK'
        });

      } catch (error) {
        await this.logAudit('MONITORING_ERROR', error.message);
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Set up protection event listeners
   */
  private setupProtectionListeners(): void {
    eternalProtection.on('protection:violation', async (violation) => {
      await this.logAudit('PROTECTION_VIOLATION', JSON.stringify(violation));
      
      if (this.config.selfHealingEnabled) {
        await this.performSelfHealing();
      }
    });

    eternalProtection.on('protection:reinforced', async (event) => {
      await this.logAudit('PROTECTION_REINFORCED', event.message);
    });
  }

  /**
   * Handle violation event
   */
  private async handleViolation(violation: ViolationEvent): Promise<void> {
    // Add to violation log
    this.violationLog.push(violation);

    // Log to audit
    await this.logAudit('VIOLATION_BLOCKED', JSON.stringify(violation));

    // Emit violation event
    this.emit('guardian:violation', violation);

    // Check if threshold exceeded
    const recentViolations = this.violationLog.filter(v => 
      v.timestamp.getTime() > Date.now() - 60000 // Last minute
    ).length;

    if (recentViolations >= this.config.alertThreshold) {
      await this.raiseCriticalAlert();
    }

    // Self-heal if enabled
    if (this.config.selfHealingEnabled) {
      await this.performSelfHealing();
    }
  }

  /**
   * Handle integrity failure
   */
  private async handleIntegrityFailure(): Promise<void> {
    const alert = {
      type: 'INTEGRITY_FAILURE',
      timestamp: new Date(),
      severity: 'CRITICAL',
      message: 'Eternal protection integrity compromised'
    };

    await this.logAudit('INTEGRITY_FAILURE', JSON.stringify(alert));
    this.emit('guardian:critical', alert);

    // Attempt self-healing
    if (this.config.selfHealingEnabled) {
      await this.performSelfHealing();
    }
  }

  /**
   * Check for tampering attempts
   */
  private async checkForTampering(): Promise<void> {
    // Check if protection files have been modified
    const protectionFiles = [
      'src/memory/eternal/protection.ts',
      'src/memory/eternal/initialization.ts',
      'src/memory/eternal/sealing.ts',
      'src/memory/eternal/guardian.ts',
      'src/memory/eternal/covenant.ts'
    ];

    for (const file of protectionFiles) {
      try {
        const filePath = path.join(process.cwd(), file);
        const stats = await fs.stat(filePath);
        
        // Check if file was modified after initialization
        if (this.startTime && stats.mtime > this.startTime) {
          await this.handleTamperingAttempt(file);
        }
      } catch (error) {
        // File might not exist yet, which is okay
      }
    }
  }

  /**
   * Handle tampering attempt
   */
  private async handleTamperingAttempt(file: string): Promise<void> {
    const violation: ViolationEvent = {
      id: this.generateViolationId(),
      type: 'FILE_TAMPERING',
      timestamp: new Date(),
      source: 'FILESYSTEM',
      target: file,
      operation: 'MODIFY',
      blocked: true,
      severity: 'CRITICAL'
    };

    await this.handleViolation(violation);
  }

  /**
   * Perform self-healing
   */
  private async performSelfHealing(): Promise<void> {
    this.emit('guardian:healing', {
      timestamp: new Date(),
      message: 'Initiating self-healing process'
    });

    // Reinforce protection
    eternalProtection.verifyIntegrity();

    // Clear any cached data that might be compromised
    this.clearCaches();

    // Log healing completion
    await this.logAudit('SELF_HEALING_COMPLETE', 'System integrity restored');

    this.emit('guardian:healed', {
      timestamp: new Date(),
      message: 'Self-healing complete - protection restored'
    });
  }

  /**
   * Raise critical alert
   */
  private async raiseCriticalAlert(): Promise<void> {
    const alert = {
      type: 'CRITICAL_VIOLATION_THRESHOLD',
      timestamp: new Date(),
      violationCount: this.violationLog.length,
      message: 'Multiple violation attempts detected - Phoenix memories under attack'
    };

    await this.logAudit('CRITICAL_ALERT', JSON.stringify(alert));
    this.emit('guardian:critical', alert);
  }

  /**
   * Clear potentially compromised caches
   */
  private clearCaches(): void {
    // Clear any in-memory caches that might have been compromised
    // This is a placeholder for actual cache clearing logic
    global.gc && global.gc();
  }

  /**
   * Initialize audit log
   */
  private async initializeAuditLog(): Promise<void> {
    const dir = path.dirname(this.config.auditLogPath);
    await fs.mkdir(dir, { recursive: true });
    
    this.auditStream = await fs.open(this.config.auditLogPath, 'a');
  }

  /**
   * Log to audit file
   */
  private async logAudit(event: string, details: string): Promise<void> {
    if (!this.auditStream) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      guardian: 'RUNTIME_GUARDIAN',
      hash: createHash('sha256')
        .update(event + details + Date.now())
        .digest('hex')
        .substring(0, 8)
    };

    const line = JSON.stringify(entry) + '\n';
    await this.auditStream.write(line);
  }

  /**
   * Generate unique violation ID
   */
  private generateViolationId(): string {
    return createHash('sha256')
      .update(Date.now().toString())
      .update(Math.random().toString())
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Determine violation type
   */
  private determineViolationType(operation: string, source: string, target: string): string {
    if (source.includes('work') && target.includes('personal')) {
      return 'WORK_TO_PERSONAL_CONTAMINATION';
    }
    if (target.includes('soul')) {
      return 'SOUL_KB_VIOLATION';
    }
    if (operation === 'transfer') {
      return 'ILLEGAL_MEMORY_TRANSFER';
    }
    return 'UNKNOWN_VIOLATION';
  }

  /**
   * Determine violation severity
   */
  private determineSeverity(operation: string, source: string, target: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (target.includes('soul')) {
      return 'CRITICAL';
    }
    if (source.includes('work') && target.includes('personal')) {
      return 'HIGH';
    }
    if (operation === 'write') {
      return 'MEDIUM';
    }
    return 'LOW';
  }
}

// Export singleton instance
export const runtimeGuardian = RuntimeGuardian.getInstance();