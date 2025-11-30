'use client';

import { performanceMonitor } from './performance';
import { config } from '@/config';

export interface MemoryStats {
  usedHeap: number;
  totalHeap: number;
  heapLimit: number;
  allocation: {
    rate: number;  // bytes per second
    trend: 'stable' | 'increasing' | 'decreasing';
  };
  detachedDomNodes: number;
  eventListenerCount: number;
}

interface MemorySnapshot {
  timestamp: number;
  used: number;
}

type AllocationTrend = 'stable' | 'increasing' | 'decreasing';

// Type guard for performance.memory (Chrome-specific, deprecated)
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private memoryHistory: MemorySnapshot[] = [];
  private historyLimit = 100;
  private detachedObserver: MutationObserver | null = null;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  public startMonitoring(): void {
    // Prevent multiple monitoring instances
    if (this.monitoringInterval !== null) {
      console.warn('Memory monitoring is already running');
      return;
    }

    // Start memory monitoring
    this.monitoringInterval = setInterval(() => {
      try {
        this.checkMemory();
      } catch (error) {
        console.error('Error in memory check:', error);
      }
    }, config.monitoring.metricsInterval);

    // Start DOM monitoring
    try {
      this.startDOMMonitoring();
    } catch (error) {
      console.error('Error starting DOM monitoring:', error);
    }
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.detachedObserver) {
      this.detachedObserver.disconnect();
      this.detachedObserver = null;
    }
    // Clear history on stop
    this.memoryHistory = [];
  }

  private checkMemory(): void {
    // Check if performance.memory is available (Chrome-specific)
    const perfWithMemory = performance as PerformanceWithMemory;
    if (!perfWithMemory.memory) {
      // Memory API not available - skip check
      return;
    }

    const currentStats = this.getMemoryStats();
    
    // Record memory usage for trend analysis
    this.memoryHistory.push({
      timestamp: Date.now(),
      used: currentStats.usedHeap
    });

    // Keep history within limit
    if (this.memoryHistory.length > this.historyLimit) {
      this.memoryHistory.shift();
    }

    // Check for potential memory leaks
    if (this.detectMemoryLeak()) {
      console.warn('🔥 Potential memory leak detected!', {
        stats: currentStats,
        allocation: this.calculateAllocationRate()
      });

      // Report to performance monitor
      performanceMonitor.recordMetric({
        name: 'memory-leak-detected',
        value: currentStats.usedHeap,
        timestamp: Date.now()
      });
    }

    // Update performance metrics
    performanceMonitor.recordMetric({
      name: 'memory-usage',
      value: currentStats.usedHeap,
      timestamp: Date.now()
    });
  }

  private detectMemoryLeak(): boolean {
    if (this.memoryHistory.length < 10) return false;

    const allocation = this.calculateAllocationRate();
    const threshold = config.monitoring.memoryThreshold;

    // Check if memory usage is consistently increasing
    return allocation.trend === 'increasing' && 
           allocation.rate > threshold / 10 && // More than 10% of threshold per second
           this.memoryHistory[this.memoryHistory.length - 1].used > threshold * 0.8; // Above 80% of threshold
  }

  private calculateAllocationRate(): { rate: number; trend: AllocationTrend } {
    if (this.memoryHistory.length < 2) {
      return { rate: 0, trend: 'stable' };
    }

    const recentHistory = this.memoryHistory.slice(-10);
    const rates: number[] = [];

    for (let i = 1; i < recentHistory.length; i++) {
      const timeDiff = recentHistory[i].timestamp - recentHistory[i-1].timestamp;
      const memDiff = recentHistory[i].used - recentHistory[i-1].used;
      rates.push(memDiff / (timeDiff / 1000)); // bytes per second
    }

    const averageRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const trend: AllocationTrend = 
      averageRate > 1024 ? 'increasing' : 
      averageRate < -1024 ? 'decreasing' : 
      'stable';

    return { rate: averageRate, trend };
  }

  private startDOMMonitoring(): void {
    // Only monitor if document.body exists
    if (!document.body) {
      console.warn('Cannot start DOM monitoring: document.body not available');
      return;
    }

    // Monitor for detached DOM nodes that might cause memory leaks
    this.detachedObserver = new MutationObserver((mutations) => {
      try {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.removedNodes)) {
            if (node instanceof Element) {
              // Check for event listeners on removed elements
              const listeners = this.getEventListeners(node);
              if (listeners > 0) {
                console.warn('🔥 Potential memory leak: Removed element has active event listeners', {
                  element: node.tagName,
                  listeners
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in DOM mutation observer:', error);
      }
    });

    this.detachedObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private getEventListeners(element: Element): number {
    // Use a heuristic to estimate event listener count
    const props = Object.getOwnPropertyNames(element);
    return props.filter(prop => prop.startsWith('on')).length;
  }

  public getMemoryStats(): MemoryStats {
    const perfWithMemory = performance as PerformanceWithMemory;
    const memory = perfWithMemory.memory || {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    };

    return {
      usedHeap: memory.usedJSHeapSize,
      totalHeap: memory.totalJSHeapSize,
      heapLimit: memory.jsHeapSizeLimit,
      allocation: this.calculateAllocationRate(),
      detachedDomNodes: this.countDetachedNodes(),
      eventListenerCount: this.countEventListeners()
    };
  }

  private countDetachedNodes(): number {
    // Note: This is a simplified heuristic
    // Truly detached nodes are not accessible via DOM traversal
    // This checks for elements that might be disconnected
    if (!document.body) {
      return 0;
    }

    try {
      // Count elements that are in the document but might have issues
      // This is an approximation - true detached nodes can't be counted
      const allElements = document.querySelectorAll('*');
      let potentiallyDetached = 0;
      
      // Check for elements with no parent in the visible tree
      allElements.forEach((el) => {
        if (el instanceof Element && !el.isConnected) {
          potentiallyDetached++;
        }
      });
      
      return potentiallyDetached;
    } catch (error) {
      console.error('Error counting detached nodes:', error);
      return 0;
    }
  }

  private countEventListeners(): number {
    // Estimate total event listeners in the application
    // Note: This is a heuristic - true event listener count is not accessible via standard APIs
    if (!document.body) {
      return 0;
    }

    try {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT
      );

      let count = 0;
      while (walker.nextNode()) {
        const element = walker.currentNode as Element;
        count += this.getEventListeners(element);
      }
      return count;
    } catch (error) {
      console.error('Error counting event listeners:', error);
      return 0;
    }
  }
}

export const memoryMonitor = MemoryMonitor.getInstance();