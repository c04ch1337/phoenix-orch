import {
  MonitoringConfig,
  MonitoringMetric,
  ErrorData,
  MemoryMetrics,
  PerformanceData,
  MetricsBuffer,
  NodeTimer
} from './types';

export class MonitoringService {
  private static instance: MonitoringService;
  private metricsBuffer: MetricsBuffer = [];
  private readonly bufferSize = 100;
  private flushInterval: NodeTimer | null = null;
  private recoveryAttempts: Map<string, number> = new Map();

  constructor(private config: MonitoringConfig) {
    this.initializeMonitoring();
  }

  static getInstance(config: MonitoringConfig): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService(config);
    }
    return MonitoringService.instance;
  }

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Set up performance observer
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.logMetric('performance', {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            entryType: entry.entryType
          } as PerformanceData);
        });
      });

      try {
        observer.observe({ entryTypes: ['resource', 'navigation', 'longtask'] });
      } catch (e) {
        this.logError('performance_observer_error', e as Error);
      }
    }

    // Monitor memory usage if available
    if (this.hasMemoryAPI()) {
      setInterval(() => {
        const memoryInfo = this.getMemoryInfo();
        if (memoryInfo) {
          this.logMetric('memory', memoryInfo);
        }
      }, 10000);
    }

    // Set up error monitoring
    window.addEventListener('error', (event) => {
      this.logError('uncaught_error', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError('unhandled_rejection', event.reason);
    });

    // Start periodic metric flushing
    this.flushInterval = setInterval(() => this.flushMetrics(), 5000) as NodeTimer;
  }

  private hasMemoryAPI(): boolean {
    return typeof window !== 'undefined' && 
           'performance' in window && 
           'memory' in performance;
  }

  private getMemoryInfo(): MemoryMetrics | null {
    if (!this.hasMemoryAPI()) return null;

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }

  public logMetric(category: string, data: unknown): void {
    if (Math.random() > this.config.sampleRate) return;

    const metric: MonitoringMetric = {
      timestamp: Date.now(),
      category,
      data
    };

    this.metricsBuffer.push(metric);
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics();
    }
  }

  public logError(type: string, error: Error): void {
    const errorData: ErrorData = {
      type,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    };

    // Always log errors regardless of sample rate
    this.sendToServer('errors', errorData);

    if (this.config.enableAutoRecovery) {
      this.attemptRecovery(type, error);
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      await this.sendToServer('metrics', this.metricsBuffer);
      this.metricsBuffer = [];
    } catch (error) {
      if (this.config.logLevel === 'debug') {
        console.error('Failed to flush metrics:', error);
      }
    }
  }

  private async sendToServer(endpoint: string, data: unknown): Promise<void> {
    try {
      const response = await fetch(`${this.config.metricsEndpoint}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      if (this.config.logLevel === 'debug') {
        console.error(`Failed to send ${endpoint} to server:`, error);
      }
    }
  }

  private attemptRecovery(type: string, error: Error): void {
    const attempts = this.recoveryAttempts.get(type) || 0;
    if (attempts >= 3) return; // Max recovery attempts

    switch (type) {
      case 'memory_leak':
        this.handleMemoryLeak();
        break;
      case 'performance_degradation':
        this.handlePerformanceDegradation();
        break;
      case 'network_error':
        this.handleNetworkError();
        break;
      default:
        this.handleGenericError(error);
    }

    this.recoveryAttempts.set(type, attempts + 1);
  }

  private handleMemoryLeak(): void {
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
  }

  private handlePerformanceDegradation(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.clearResourceTimings();
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  private handleNetworkError(): void {
    // Implement exponential backoff for retries
    // This would be handled by the retry utility we created earlier
  }

  private handleGenericError(error: Error): void {
    if (typeof window === 'undefined') return;

    // Log detailed diagnostics
    const diagnostics = {
      error,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      memoryUsage: this.getMemoryInfo() || 'Not available'
    };

    console.error('Detailed error diagnostics:', diagnostics);
  }

  public cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushMetrics().catch(error => {
      console.error('Error during cleanup:', error);
    });
  }
}

// Export a default configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  metricsEndpoint: '/api/metrics',
  logLevel: 'info',
  sampleRate: 0.1, // Sample 10% of metrics
  enableAutoRecovery: true
};

// Create and export a default instance
export const monitoring = MonitoringService.getInstance(defaultMonitoringConfig);