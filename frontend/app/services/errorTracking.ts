'use client';

import { monitoring } from '@/config/monitoring';
import { AlertSeverity, MetricData } from '@/types/monitoring';
import { performanceMonitor } from './performance';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId: string;
  timestamp: number;
  stack?: string;
  metadata?: Record<string, unknown>;
}

interface ErrorReport {
  id: string;
  error: Error;
  severity: AlertSeverity;
  context: ErrorContext;
}

class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private errors: Map<string, ErrorReport> = new Map();
  private readonly maxErrors = 1000;
  private sessionId: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalHandlers();
  }

  public static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    window.addEventListener('error', (event) => {
      const error = event.error || new Error(event.message || 'Unknown error');
      this.trackError(error, {
        action: 'uncaught_exception',
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      // Convert non-Error rejections to Error objects
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason || 'Unhandled promise rejection'));
      
      this.trackError(error, {
        action: 'unhandled_rejection',
        metadata: {
          reason: event.reason
        }
      });
    });

    // Monitor React error boundaries
    window.__REACT_ERROR_OVERLAY__ = true;
  }

  public trackError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): string {
    const errorId = this.generateErrorId();
    const severity = this.determineSeverity(error);
    
    const errorReport: ErrorReport = {
      id: errorId,
      error,
      severity,
      context: {
        ...context,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        stack: error.stack
      }
    };

    // Store error
    this.errors.set(errorId, errorReport);

    // Prune old errors if we exceed max (FIFO - remove oldest)
    if (this.errors.size > this.maxErrors) {
      // Get the first (oldest) key from the Map
      const firstKey = this.errors.keys().next().value;
      if (firstKey) {
        this.errors.delete(firstKey);
      }
    }

    // Report to monitoring system
    this.reportError(errorReport);

    return errorId;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private determineSeverity(error: Error): AlertSeverity {
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return 'critical';
    }
    if (error instanceof SyntaxError) {
      return 'emergency';
    }
    if (error.message.includes('network') || error.message.includes('timeout')) {
      return 'warning';
    }
    return 'info';
  }

  private reportError(report: ErrorReport): void {
    try {
      // Record error metric
      const metric: MetricData = {
        name: 'error_occurrence',
        value: 1,
        timestamp: Date.now(),
        labels: {
          type: report.error.name,
          severity: report.severity
        }
      };

      try {
        performanceMonitor.recordMetric(metric);
      } catch (e) {
        console.warn('Failed to record error metric:', e);
      }

      // Take action based on severity
      const alertLevel = monitoring.config.alertLevels[report.severity];
      if (!alertLevel) {
        console.warn(`Unknown alert severity: ${report.severity}`);
        return;
      }

      const actions = alertLevel.actions;
      
      actions.forEach(action => {
        try {
          switch (action) {
            case 'log':
              console.error('[ErrorTracking]', report);
              break;
            case 'notify':
              this.notifyError(report);
              break;
            case 'report':
              this.sendErrorReport(report);
              break;
            case 'mitigate':
              this.attemptMitigation(report);
              break;
          }
        } catch (e) {
          console.error(`Error executing action ${action}:`, e);
        }
      });
    } catch (e) {
      // Fallback error handling - don't let error tracking break the app
      console.error('Critical error in error tracking:', e);
    }
  }

  private notifyError(report: ErrorReport): void {
    // Implement user/developer notification logic
    if (report.severity === 'emergency' || report.severity === 'critical') {
      // Could integrate with notification service here
      console.error('CRITICAL ERROR:', report.error.message);
    }
  }

  private async sendErrorReport(report: ErrorReport): Promise<void> {
    try {
      const response = await fetch('/api/error-reporting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report)
      });

      if (!response.ok) {
        console.error('Failed to send error report:', response.statusText);
      }
    } catch (e) {
      console.error('Error sending error report:', e);
    }
  }

  private attemptMitigation(report: ErrorReport): void {
    // Implement automatic error mitigation strategies
    switch (report.error.name) {
      case 'NetworkError':
        // Trigger automatic retry mechanism
        break;
      case 'MemoryError':
        // Attempt garbage collection and cache clearing
        if (window.gc) {
          window.gc();
        }
        break;
      case 'ResourceError':
        // Attempt to reload failed resources
        break;
      default:
        // Log unhandled error type
        console.warn('No mitigation strategy for:', report.error.name);
    }
  }

  public getErrorStats(): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const stats = {
      total: this.errors.size,
      bySeverity: {
        info: 0,
        warning: 0,
        critical: 0,
        emergency: 0
      }
    };

    this.errors.forEach(error => {
      stats.bySeverity[error.severity]++;
    });

    return stats;
  }

  public clearErrors(): void {
    this.errors.clear();
  }
}

// Export singleton instance
export const errorTracking = ErrorTrackingService.getInstance();

// Declare global property for React error overlay
declare global {
  interface Window {
    __REACT_ERROR_OVERLAY__?: boolean;
    gc?: () => void;
  }
}