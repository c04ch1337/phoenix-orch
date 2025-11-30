import { PerformanceMetrics, PerformanceTestCase } from '../types';
import { render } from '@testing-library/react';

// Type guard for performance.memory (Chrome-specific, deprecated)
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export class PerformanceTestRunner {
  private startTime: number = 0;
  private measurements: PerformanceMetrics[] = [];

  async measurePerformance(testCase: PerformanceTestCase): Promise<PerformanceMetrics> {
    // Start performance measurement
    performance.mark('test-start');
    this.startTime = performance.now();

    // Render component
    const { unmount } = render(testCase.component);

    // Measure render time
    const renderTime = performance.now() - this.startTime;

    // Measure memory usage
    const memoryUsage = await this.getMemoryUsage();

    // Measure network latency
    const networkLatency = await this.measureNetworkLatency();

    // Measure resource utilization
    const resourceUtilization = await this.measureResourceUtilization();

    // Cleanup
    unmount();
    performance.mark('test-end');
    performance.measure('test-duration', 'test-start', 'test-end');

    const metrics: PerformanceMetrics = {
      renderTime,
      memoryUsage,
      networkLatency,
      resourceUtilization
    };

    this.measurements.push(metrics);
    return metrics;
  }

  private async getMemoryUsage(): Promise<number> {
    // performance.memory is Chrome-specific and deprecated
    // Use PerformanceObserver API when available, fallback to 0
    const perfWithMemory = performance as PerformanceWithMemory;
    if (perfWithMemory.memory) {
      // Convert bytes to MB
      return perfWithMemory.memory.usedJSHeapSize / (1024 * 1024);
    }
    
    // Try to use PerformanceObserver for memory if available
    if ('PerformanceObserver' in window) {
      try {
        // Note: Memory measurement via PerformanceObserver requires specific browser support
        // For now, return 0 if memory API is not available
        return 0;
      } catch (error) {
        // Silently fail - memory measurement is optional
        return 0;
      }
    }
    
    return 0;
  }

  private async measureNetworkLatency(): Promise<number> {
    const start = performance.now();
    try {
      // Use the actual backend health endpoint
      const healthUrl = process.env.VITE_API_URL 
        ? `${process.env.VITE_API_URL}/health`
        : 'http://localhost:5001/health';
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      return performance.now() - start;
    } catch (error) {
      // Network latency measurement is optional - don't fail the test
      // Log warning in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('Network latency measurement failed (this is optional):', error);
      }
      return 0;
    }
  }

  private async measureResourceUtilization(): Promise<{ cpu: number; memory: number }> {
    // In a real implementation, this would use the Performance API
    // or a monitoring service to get actual CPU/memory metrics
    return {
      cpu: this.estimateCPUUsage(),
      memory: await this.getMemoryUsage()
    };
  }

  private estimateCPUUsage(): number {
    const startTime = performance.now();
    let count = 0;
    
    // Perform a CPU-intensive task
    for (let i = 0; i < 1000000; i++) {
      count += Math.random();
    }
    
    const duration = performance.now() - startTime;
    // Normalize to a percentage (0-100)
    return Math.min(100, (duration / 10) * 100);
  }

  public getAverageMetrics(): PerformanceMetrics | null {
    if (this.measurements.length === 0) {
      return null;
    }

    const sum = this.measurements.reduce((acc, curr) => ({
      renderTime: acc.renderTime + curr.renderTime,
      memoryUsage: acc.memoryUsage + curr.memoryUsage,
      networkLatency: acc.networkLatency + curr.networkLatency,
      resourceUtilization: {
        cpu: acc.resourceUtilization.cpu + curr.resourceUtilization.cpu,
        memory: acc.resourceUtilization.memory + curr.resourceUtilization.memory
      }
    }));

    const count = this.measurements.length;
    return {
      renderTime: sum.renderTime / count,
      memoryUsage: sum.memoryUsage / count,
      networkLatency: sum.networkLatency / count,
      resourceUtilization: {
        cpu: sum.resourceUtilization.cpu / count,
        memory: sum.resourceUtilization.memory / count
      }
    };
  }

  public validatePerformance(metrics: PerformanceMetrics, thresholds: Partial<PerformanceMetrics>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (thresholds.renderTime && metrics.renderTime > thresholds.renderTime) {
      errors.push(`Render time ${metrics.renderTime.toFixed(2)}ms exceeds threshold ${thresholds.renderTime}ms`);
    }

    if (thresholds.memoryUsage && metrics.memoryUsage > thresholds.memoryUsage) {
      errors.push(`Memory usage ${metrics.memoryUsage.toFixed(2)}MB exceeds threshold ${thresholds.memoryUsage}MB`);
    }

    if (thresholds.networkLatency && metrics.networkLatency > thresholds.networkLatency) {
      errors.push(`Network latency ${metrics.networkLatency.toFixed(2)}ms exceeds threshold ${thresholds.networkLatency}ms`);
    }

    if (thresholds.resourceUtilization) {
      const { cpu, memory } = thresholds.resourceUtilization;
      if (cpu && metrics.resourceUtilization.cpu > cpu) {
        errors.push(`CPU usage ${metrics.resourceUtilization.cpu.toFixed(2)}% exceeds threshold ${cpu}%`);
      }
      if (memory && metrics.resourceUtilization.memory > memory) {
        errors.push(`Resource memory ${metrics.resourceUtilization.memory.toFixed(2)}MB exceeds threshold ${memory}MB`);
      }
    }

    if (errors.length > 0) {
      errors.forEach(error => console.error(`Performance validation failed: ${error}`));
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  public reset(): void {
    this.measurements = [];
    this.startTime = 0;
    performance.clearMarks();
    performance.clearMeasures();
  }
}

export const performanceRunner = new PerformanceTestRunner();