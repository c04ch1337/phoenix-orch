/**
 * Phoenix Marie Memory Architecture - Access Logging Infrastructure
 * 
 * Comprehensive logging system for all memory access attempts.
 * Tracks both successful and failed access, isolation violations,
 * and provides audit trails for security compliance.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  AccessLog,
  AccessEntity,
  KnowledgeBaseType,
  MemoryOperation,
  OperationalMode,
  IsolationViolation,
  ViolationType
} from '../types';
import { ModeSwitchEvent, ModeType } from '../modes/types';

export interface LoggerConfig {
  logPath: string;
  maxLogSize: number; // bytes
  rotationPolicy: 'daily' | 'size' | 'both';
  encryptLogs: boolean;
  encryptionKey?: string;
  alertThresholds: {
    violationsPerHour: number;
    failedAccessPerHour: number;
    crossDomainAttempts: number;
  };
}

export interface LogEntry extends AccessLog {
  logId: string;
  loggedAt: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ViolationLogEntry extends IsolationViolation {
  logId: string;
  loggedAt: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  alertSent: boolean;
}

export interface LogStats {
  totalLogs: number;
  successfulAccess: number;
  failedAccess: number;
  violations: number;
  byEntity: Record<AccessEntity, number>;
  byKbType: Record<KnowledgeBaseType, number>;
  byOperation: Record<MemoryOperation, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export class AccessLogger extends EventEmitter {
  private config: LoggerConfig;
  private currentLogFile: string;
  private logBuffer: LogEntry[] = [];
  private violationBuffer: ViolationLogEntry[] = [];
  private flushTimer?: NodeJS.Timer;
  private rotationTimer?: NodeJS.Timer;
  private alertCounts: Map<string, number[]> = new Map();

  constructor(config: LoggerConfig) {
    super();
    this.config = config;
    this.currentLogFile = this.generateLogFileName();
    this.startFlushTimer();
    this.startRotationTimer();
  }

  /**
   * Log a memory access attempt
   */
  public async logAccess(log: AccessLog, metadata?: {
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const logEntry: LogEntry = {
      ...log,
      logId: this.generateLogId(),
      loggedAt: new Date(),
      ...metadata
    };

    this.logBuffer.push(logEntry);

    // Check for suspicious patterns
    await this.checkAccessPatterns(logEntry);

    // Emit for real-time monitoring
    this.emit('accessLogged', logEntry);

    // Flush if buffer is getting large
    if (this.logBuffer.length >= 100) {
      await this.flush();
    }
  }

  /**
   * Log an isolation violation
   */
  public async logViolation(violation: IsolationViolation): Promise<void> {
    const severity = this.calculateViolationSeverity(violation);
    
    const violationEntry: ViolationLogEntry = {
      ...violation,
      logId: this.generateLogId(),
      loggedAt: new Date(),
      severity,
      alertSent: false
    };

    this.violationBuffer.push(violationEntry);

    // Send alert if critical
    if (severity === 'critical') {
      await this.sendViolationAlert(violationEntry);
      violationEntry.alertSent = true;
    }

    // Check violation thresholds
    await this.checkViolationThresholds();

    // Emit for real-time monitoring
    this.emit('violationLogged', violationEntry);

    // Always flush violations immediately
    await this.flushViolations();
  }

  /**
   * Log a mode switch event
   */
  public async logModeSwitch(event: ModeSwitchEvent): Promise<void> {
    // Mode switches are critical events that should be logged immediately
    const logEntry: LogEntry = {
      logId: this.generateLogId(),
      loggedAt: new Date(),
      timestamp: event.timestamp,
      entity: event.triggeredBy,
      operation: 'MODE_SWITCH' as MemoryOperation,
      kbType: 'SYSTEM' as KnowledgeBaseType,
      success: event.success,
      mode: event.toMode === ModeType.Personal ?
        OperationalMode.Personal : OperationalMode.Professional,
      details: {
        fromMode: event.fromMode,
        toMode: event.toMode,
        duration: event.duration,
        authenticationMethod: event.authenticationMethod,
        eventId: event.eventId,
        ...event.details
      }
    };

    // Add to buffer for immediate flush
    this.logBuffer.push(logEntry);

    // Check if this is a suspicious mode switch pattern
    await this.checkModeSwitchPatterns(event);

    // Emit for real-time monitoring
    this.emit('modeSwitchLogged', event);

    // Always flush mode switches immediately
    await this.flush();
  }

  /**
   * Query access logs
   */
  public async queryLogs(filter: {
    startTime?: Date;
    endTime?: Date;
    entity?: AccessEntity;
    kbType?: KnowledgeBaseType;
    operation?: MemoryOperation;
    success?: boolean;
    limit?: number;
  }): Promise<LogEntry[]> {
    const logs = await this.loadLogs(filter.startTime, filter.endTime);
    
    let filtered = logs;

    if (filter.entity !== undefined) {
      filtered = filtered.filter(log => log.entity === filter.entity);
    }

    if (filter.kbType !== undefined) {
      filtered = filtered.filter(log => log.kbType === filter.kbType);
    }

    if (filter.operation !== undefined) {
      filtered = filtered.filter(log => log.operation === filter.operation);
    }

    if (filter.success !== undefined) {
      filtered = filtered.filter(log => log.success === filter.success);
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Get access statistics
   */
  public async getStats(startTime?: Date, endTime?: Date): Promise<LogStats> {
    const logs = await this.loadLogs(startTime, endTime);
    
    const stats: LogStats = {
      totalLogs: logs.length,
      successfulAccess: 0,
      failedAccess: 0,
      violations: 0,
      byEntity: {} as Record<AccessEntity, number>,
      byKbType: {} as Record<KnowledgeBaseType, number>,
      byOperation: {} as Record<MemoryOperation, number>,
      timeRange: {
        start: logs[0]?.timestamp || new Date(),
        end: logs[logs.length - 1]?.timestamp || new Date()
      }
    };

    // Initialize counters
    Object.values(AccessEntity).forEach(entity => {
      stats.byEntity[entity as AccessEntity] = 0;
    });
    Object.values(KnowledgeBaseType).forEach(kb => {
      stats.byKbType[kb as KnowledgeBaseType] = 0;
    });
    Object.values(MemoryOperation).forEach(op => {
      stats.byOperation[op as MemoryOperation] = 0;
    });

    // Count logs
    for (const log of logs) {
      if (log.success) {
        stats.successfulAccess++;
      } else {
        stats.failedAccess++;
      }

      stats.byEntity[log.entity]++;
      stats.byKbType[log.kbType]++;
      stats.byOperation[log.operation]++;
    }

    // Count violations
    const violations = await this.loadViolations(startTime, endTime);
    stats.violations = violations.length;

    return stats;
  }

  /**
   * Generate security audit report
   */
  public async generateAuditReport(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    summary: LogStats;
    violations: ViolationLogEntry[];
    suspiciousPatterns: Array<{
      pattern: string;
      count: number;
      entities: AccessEntity[];
    }>;
    recommendations: string[];
  }> {
    const summary = await this.getStats(timeRange.start, timeRange.end);
    const violations = await this.loadViolations(timeRange.start, timeRange.end);
    const suspiciousPatterns = await this.analyzeSuspiciousPatterns(timeRange);
    const recommendations = this.generateRecommendations(summary, violations, suspiciousPatterns);

    return {
      summary,
      violations,
      suspiciousPatterns,
      recommendations
    };
  }

  /**
   * Clean up old logs based on retention policy
   */
  public async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const logFiles = await this.getLogFiles();
    let deletedCount = 0;

    for (const file of logFiles) {
      const filePath = path.join(this.config.logPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
        this.emit('logFileDeleted', file);
      }
    }

    return deletedCount;
  }

  /**
   * Flush log buffers to disk
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const logData = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
      const dataToWrite = this.config.encryptLogs ? 
        await this.encryptData(logData) : 
        logData;

      await fs.appendFile(
        path.join(this.config.logPath, this.currentLogFile),
        dataToWrite
      );

      this.emit('logsFlushed', logs.length);
    } catch (error) {
      // Re-add logs to buffer on error
      this.logBuffer.unshift(...logs);
      this.emit('flushError', error);
      throw error;
    }
  }

  /**
   * Flush violation buffer
   */
  private async flushViolations(): Promise<void> {
    if (this.violationBuffer.length === 0) {
      return;
    }

    const violations = [...this.violationBuffer];
    this.violationBuffer = [];

    try {
      const violationFile = this.currentLogFile.replace('.log', '.violations.log');
      const violationData = violations.map(v => JSON.stringify(v)).join('\n') + '\n';
      const dataToWrite = this.config.encryptLogs ? 
        await this.encryptData(violationData) : 
        violationData;

      await fs.appendFile(
        path.join(this.config.logPath, violationFile),
        dataToWrite
      );

      this.emit('violationsFlushed', violations.length);
    } catch (error) {
      // Re-add violations to buffer on error
      this.violationBuffer.unshift(...violations);
      this.emit('flushError', error);
      throw error;
    }
  }

  /**
   * Check for suspicious access patterns
   */
  private async checkAccessPatterns(log: LogEntry): Promise<void> {
    // Pattern 1: Rapid failed access attempts
    if (!log.success) {
      const key = `failed_${log.entity}_${log.kbType}`;
      this.incrementAlertCount(key);
      
      const count = this.getHourlyCount(key);
      if (count > this.config.alertThresholds.failedAccessPerHour) {
        this.emit('suspiciousPattern', {
          type: 'rapid_failed_access',
          entity: log.entity,
          kbType: log.kbType,
          count,
          log
        });
      }
    }

    // Pattern 2: Cross-domain access attempts
    if (log.details?.reason?.includes('Cross-domain')) {
      const key = 'cross_domain_attempts';
      this.incrementAlertCount(key);
      
      const count = this.getHourlyCount(key);
      if (count > this.config.alertThresholds.crossDomainAttempts) {
        this.emit('suspiciousPattern', {
          type: 'excessive_cross_domain',
          count,
          log
        });
      }
    }

    // Pattern 3: Unusual access times
    const hour = log.timestamp.getHours();
    if (hour >= 2 && hour <= 5) { // 2 AM - 5 AM
      this.emit('suspiciousPattern', {
        type: 'unusual_access_time',
        hour,
        log
      });
    }

    // Pattern 4: Rapid mode switching
    const recentModeSwitches = await this.getRecentModeSwitches(log.entity);
    if (recentModeSwitches.length > 5) { // More than 5 switches in an hour
      this.emit('suspiciousPattern', {
        type: 'rapid_mode_switching',
        entity: log.entity,
        count: recentModeSwitches.length,
        log
      });
    }
  }

  /**
   * Check for suspicious mode switch patterns
   */
  private async checkModeSwitchPatterns(event: ModeSwitchEvent): Promise<void> {
    const key = `mode_switch_${event.triggeredBy}`;
    this.incrementAlertCount(key);
    
    const count = this.getHourlyCount(key);
    
    // Alert on excessive mode switching
    if (count > 10) { // More than 10 mode switches per hour
      this.emit('suspiciousPattern', {
        type: 'excessive_mode_switching',
        entity: event.triggeredBy,
        count,
        event
      });
    }

    // Alert on failed authentication attempts during mode switch
    if (!event.success && event.details?.failureReason?.includes('Authentication')) {
      const authKey = `mode_auth_fail_${event.triggeredBy}`;
      this.incrementAlertCount(authKey);
      
      const authFailCount = this.getHourlyCount(authKey);
      if (authFailCount > 3) { // More than 3 failed auth attempts per hour
        this.emit('suspiciousPattern', {
          type: 'mode_authentication_failures',
          entity: event.triggeredBy,
          count: authFailCount,
          event
        });
      }
    }
  }

  /**
   * Get recent mode switches for an entity
   */
  private async getRecentModeSwitches(entity: AccessEntity): Promise<LogEntry[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const logs = await this.queryLogs({
      entity,
      operation: 'MODE_SWITCH' as MemoryOperation,
      startTime: oneHourAgo
    });
    
    return logs;
  }

  /**
   * Check violation thresholds
   */
  private async checkViolationThresholds(): Promise<void> {
    const key = 'violations_total';
    this.incrementAlertCount(key);
    
    const count = this.getHourlyCount(key);
    if (count > this.config.alertThresholds.violationsPerHour) {
      await this.sendThresholdAlert('violations', count);
    }
  }

  /**
   * Calculate violation severity
   */
  private calculateViolationSeverity(violation: IsolationViolation): 'critical' | 'high' | 'medium' | 'low' {
    // Cross-domain access is always critical
    if (violation.violationType === ViolationType.CrossDomainAccess) {
      return 'critical';
    }

    // Invalid authentication is high
    if (violation.violationType === ViolationType.InvalidAuthentication) {
      return 'high';
    }

    // Unauthorized mode is medium
    if (violation.violationType === ViolationType.UnauthorizedMode) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Send violation alert
   */
  private async sendViolationAlert(violation: ViolationLogEntry): Promise<void> {
    // In production, this would send to monitoring system
    this.emit('alert', {
      type: 'isolation_violation',
      severity: violation.severity,
      violation,
      timestamp: new Date(),
      message: `CRITICAL: ${violation.violationType} detected - ${violation.details}`
    });
  }

  /**
   * Send threshold alert
   */
  private async sendThresholdAlert(type: string, count: number): Promise<void> {
    this.emit('alert', {
      type: 'threshold_exceeded',
      threshold: type,
      count,
      timestamp: new Date(),
      message: `Threshold exceeded: ${count} ${type} in the last hour`
    });
  }

  /**
   * Load logs from disk
   */
  private async loadLogs(startTime?: Date, endTime?: Date): Promise<LogEntry[]> {
    const logFiles = await this.getLogFiles();
    const logs: LogEntry[] = [];

    for (const file of logFiles) {
      if (!file.includes('.violations.')) {
        const fileLogs = await this.readLogFile(file);
        logs.push(...fileLogs);
      }
    }

    // Filter by time range
    return logs.filter(log => {
      if (startTime && log.timestamp < startTime) return false;
      if (endTime && log.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Load violations from disk
   */
  private async loadViolations(startTime?: Date, endTime?: Date): Promise<ViolationLogEntry[]> {
    const logFiles = await this.getLogFiles();
    const violations: ViolationLogEntry[] = [];

    for (const file of logFiles) {
      if (file.includes('.violations.')) {
        const fileViolations = await this.readViolationFile(file);
        violations.push(...fileViolations);
      }
    }

    // Filter by time range
    return violations.filter(v => {
      if (startTime && v.timestamp < startTime) return false;
      if (endTime && v.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Read a log file
   */
  private async readLogFile(filename: string): Promise<LogEntry[]> {
    try {
      const filePath = path.join(this.config.logPath, filename);
      let content = await fs.readFile(filePath, 'utf-8');
      
      if (this.config.encryptLogs) {
        content = await this.decryptData(content);
      }

      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (error) {
      this.emit('readError', { filename, error });
      return [];
    }
  }

  /**
   * Read a violation file
   */
  private async readViolationFile(filename: string): Promise<ViolationLogEntry[]> {
    try {
      const filePath = path.join(this.config.logPath, filename);
      let content = await fs.readFile(filePath, 'utf-8');
      
      if (this.config.encryptLogs) {
        content = await this.decryptData(content);
      }

      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (error) {
      this.emit('readError', { filename, error });
      return [];
    }
  }

  /**
   * Analyze suspicious patterns
   */
  private async analyzeSuspiciousPatterns(timeRange: {
    start: Date;
    end: Date;
  }): Promise<Array<{
    pattern: string;
    count: number;
    entities: AccessEntity[];
  }>> {
    const logs = await this.loadLogs(timeRange.start, timeRange.end);
    const patterns: Array<{
      pattern: string;
      count: number;
      entities: AccessEntity[];
    }> = [];

    // Pattern: Multiple failed access from same entity
    const failedByEntity = new Map<AccessEntity, number>();
    logs.filter(log => !log.success).forEach(log => {
      failedByEntity.set(log.entity, (failedByEntity.get(log.entity) || 0) + 1);
    });

    failedByEntity.forEach((count, entity) => {
      if (count > 10) {
        patterns.push({
          pattern: 'excessive_failed_access',
          count,
          entities: [entity]
        });
      }
    });

    // Pattern: Cross-domain attempts
    const crossDomainLogs = logs.filter(log => 
      log.details?.reason?.includes('Cross-domain')
    );
    
    if (crossDomainLogs.length > 0) {
      const entities = [...new Set(crossDomainLogs.map(log => log.entity))];
      patterns.push({
        pattern: 'cross_domain_attempts',
        count: crossDomainLogs.length,
        entities
      });
    }

    // Pattern: Mode switching anomalies
    const modeSwitchLogs = logs.filter(log =>
      log.operation === ('MODE_SWITCH' as MemoryOperation)
    );
    
    if (modeSwitchLogs.length > 0) {
      // Group by entity
      const switchesByEntity = new Map<AccessEntity, number>();
      modeSwitchLogs.forEach(log => {
        switchesByEntity.set(log.entity, (switchesByEntity.get(log.entity) || 0) + 1);
      });

      switchesByEntity.forEach((count, entity) => {
        if (count > 20) { // More than 20 mode switches in the time range
          patterns.push({
            pattern: 'excessive_mode_switching',
            count,
            entities: [entity]
          });
        }
      });
    }

    return patterns;
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(
    stats: LogStats,
    violations: ViolationLogEntry[],
    patterns: Array<{ pattern: string; count: number; entities: AccessEntity[] }>
  ): string[] {
    const recommendations: string[] = [];

    // Check violation rate
    if (violations.length > 0) {
      recommendations.push(
        `Review and address ${violations.length} isolation violations detected`
      );
    }

    // Check failed access rate
    const failureRate = stats.failedAccess / stats.totalLogs;
    if (failureRate > 0.1) {
      recommendations.push(
        `High failure rate (${(failureRate * 100).toFixed(1)}%) - review access permissions`
      );
    }

    // Check for suspicious patterns
    patterns.forEach(pattern => {
      if (pattern.pattern === 'excessive_failed_access') {
        recommendations.push(
          `Investigate excessive failed access attempts from: ${pattern.entities.join(', ')}`
        );
      }
      if (pattern.pattern === 'cross_domain_attempts') {
        recommendations.push(
          `Critical: Cross-domain access attempts detected - verify isolation integrity`
        );
      }
      if (pattern.pattern === 'excessive_mode_switching') {
        recommendations.push(
          `Investigate excessive mode switching by: ${pattern.entities.join(', ')}`
        );
      }
    });

    // Check for mode-related issues
    const modeSwitchLogs = stats.byOperation['MODE_SWITCH' as MemoryOperation] || 0;
    if (modeSwitchLogs > 100) {
      recommendations.push(
        `High mode switch frequency (${modeSwitchLogs} switches) - review mode transition patterns`
      );
    }

    // General recommendations
    if (stats.totalLogs === 0) {
      recommendations.push('No access logs found - verify logging is enabled');
    }

    return recommendations;
  }

  /**
   * Encrypt data
   */
  private async encryptData(data: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const cipher = crypto.createCipher('aes-256-gcm', this.config.encryptionKey);
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);

    return encrypted.toString('base64');
  }

  /**
   * Decrypt data
   */
  private async decryptData(data: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const decipher = crypto.createDecipher('aes-256-gcm', this.config.encryptionKey);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Get log files
   */
  private async getLogFiles(): Promise<string[]> {
    try {
      await fs.mkdir(this.config.logPath, { recursive: true });
      const files = await fs.readdir(this.config.logPath);
      return files.filter(f => f.endsWith('.log')).sort();
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Generate log file name
   */
  private generateLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return `access-${dateStr}.log`;
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Increment alert count
   */
  private incrementAlertCount(key: string): void {
    if (!this.alertCounts.has(key)) {
      this.alertCounts.set(key, []);
    }
    
    const counts = this.alertCounts.get(key)!;
    counts.push(Date.now());
    
    // Keep only last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.alertCounts.set(key, counts.filter(time => time > oneHourAgo));
  }

  /**
   * Get hourly count
   */
  private getHourlyCount(key: string): number {
    return this.alertCounts.get(key)?.length || 0;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush();
      await this.flushViolations();
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Start rotation timer
   */
  private startRotationTimer(): void {
    if (this.config.rotationPolicy === 'daily' || this.config.rotationPolicy === 'both') {
      // Check every hour for daily rotation
      this.rotationTimer = setInterval(() => {
        const newFileName = this.generateLogFileName();
        if (newFileName !== this.currentLogFile) {
          this.currentLogFile = newFileName;
          this.emit('logRotated', newFileName);
        }
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Cleanup on shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    
    await this.flush();
    await this.flushViolations();
  }
}

// Export singleton instance
export const globalAccessLogger = new AccessLogger({
  logPath: '/phoenix/logs/access',
  maxLogSize: 100 * 1024 * 1024, // 100MB
  rotationPolicy: 'both',
  encryptLogs: true,
  encryptionKey: process.env.LOG_ENCRYPTION_KEY,
  alertThresholds: {
    violationsPerHour: 10,
    failedAccessPerHour: 50,
    crossDomainAttempts: 5
  }
});