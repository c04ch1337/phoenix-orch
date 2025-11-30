'use client';

import { ReportHandler } from 'web-vitals';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  id?: string;
  delta?: number;
  navigationType?: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private observers: Set<(metric: PerformanceMetric) => void> = new Set();
  private webVitalsHandler: ReportHandler;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.webVitalsHandler = (metric) => {
      const performanceMetric: PerformanceMetric = {
        name: metric.name,
        value: metric.value,
        timestamp: Date.now(),
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType
      };
      this.recordMetric(performanceMetric);
    };
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public initialize() {
    // Start observing web vitals
    import('web-vitals')
      .then(({ onCLS, onFID, onLCP, onTTFB, onFCP }) => {
        onCLS(this.webVitalsHandler);
        onFID(this.webVitalsHandler);
        onLCP(this.webVitalsHandler);
        onTTFB(this.webVitalsHandler);
        onFCP(this.webVitalsHandler);
      })
      .catch((error) => {
        console.error('🔥 Phoenix Performance: Failed to load web-vitals', error);
      });

    // Set up performance observer for custom metrics
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordMetric({
              name: entry.name,
              value: entry.duration || entry.startTime,
              timestamp: Date.now()
            });
          });
        });

        // Observe various performance entry types
        try {
          this.performanceObserver.observe({ 
            entryTypes: [
              'resource',
              'paint',
              'largest-contentful-paint',
              'layout-shift',
              'first-input',
              'navigation'
            ] 
          });
        } catch (error) {
          // Some entry types may not be supported
          console.warn('🔥 Phoenix Performance: Some entry types not supported', error);
        }
      } catch (error) {
        console.error('🔥 Phoenix Performance: Failed to create PerformanceObserver', error);
      }
    }

    // Monitor memory usage if available (Chrome-specific API)
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      if (memory && typeof memory.usedJSHeapSize === 'number') {
        this.memoryInterval = setInterval(() => {
          this.recordMetric({
            name: 'memory-usage',
            value: memory.usedJSHeapSize,
            timestamp: Date.now()
          });
        }, 10000); // Check every 10 seconds
      }
    }
  }

  public shutdown() {
    // Cleanup performance observer
    if (this.performanceObserver) {
      try {
        this.performanceObserver.disconnect();
      } catch (error) {
        console.error('🔥 Phoenix Performance: Failed to disconnect observer', error);
      }
      this.performanceObserver = null;
    }

    // Cleanup memory interval
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  public recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    this.notifyObservers(metric);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  public getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name);
    }
    return this.metrics;
  }

  public onMetric(callback: (metric: PerformanceMetric) => void) {
    this.observers.add(callback);
    return () => {
      this.observers.delete(callback);
    };
  }

  private notifyObservers(metric: PerformanceMetric) {
    this.observers.forEach(observer => observer(metric));
  }

  public getAverageMetric(name: string, timeWindow: number = 60000): number {
    const now = Date.now();
    const relevantMetrics = this.metrics.filter(
      m => m.name === name && m.timestamp > now - timeWindow
    );

    if (relevantMetrics.length === 0) return 0;

    const sum = relevantMetrics.reduce((acc, curr) => acc + curr.value, 0);
    return sum / relevantMetrics.length;
  }

  public clearMetrics() {
    this.metrics = [];
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();