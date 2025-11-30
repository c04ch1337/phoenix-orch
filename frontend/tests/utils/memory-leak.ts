import { MemorySnapshot, MemoryLeakTestResult } from '../types';
import { render, RenderResult } from '@testing-library/react';
import { ReactElement } from 'react';

export class MemoryLeakDetector {
  private readonly LEAK_THRESHOLD_BYTES = 1024 * 1024; // 1MB
  private readonly GARBAGE_COLLECTION_ATTEMPTS = 5;

  async detectMemoryLeak(
    component: ReactElement,
    interactions: (renderResult: RenderResult) => Promise<void>,
    iterations: number = 10
  ): Promise<MemoryLeakTestResult> {
    // Take initial snapshot
    const initialSnapshot = await this.captureMemorySnapshot();
    
    // Perform test iterations
    for (let i = 0; i < iterations; i++) {
      const { unmount } = render(component);
      await interactions({ unmount } as RenderResult);
      unmount();
      
      // Force garbage collection if available
      await this.attemptGarbageCollection();
    }

    // Wait for any pending cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take final snapshot
    const finalSnapshot = await this.captureMemorySnapshot();
    
    // Calculate differences
    const difference = {
      heapUsed: finalSnapshot.heapUsed - initialSnapshot.heapUsed,
      heapTotal: finalSnapshot.heapTotal - initialSnapshot.heapTotal,
      external: finalSnapshot.external - initialSnapshot.external
    };

    // Determine if there's a leak
    const hasLeak = difference.heapUsed > this.LEAK_THRESHOLD_BYTES;

    return {
      initialSnapshot,
      finalSnapshot,
      difference,
      hasLeak
    };
  }

  private async captureMemorySnapshot(): Promise<MemorySnapshot> {
    // Use performance.memory if available (Chrome only)
    const memory = (performance as any).memory;
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memory?.usedJSHeapSize || 0,
      heapTotal: memory?.totalJSHeapSize || 0,
      external: memory?.jsHeapSizeLimit || 0
    };

    return snapshot;
  }

  private async attemptGarbageCollection(): Promise<void> {
    if (global.gc) {
      for (let i = 0; i < this.GARBAGE_COLLECTION_ATTEMPTS; i++) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async monitorMemoryUsage(
    duration: number = 10000,
    interval: number = 1000
  ): Promise<MemorySnapshot[]> {
    const snapshots: MemorySnapshot[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      snapshots.push(await this.captureMemorySnapshot());
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return snapshots;
  }

  analyzeMemoryTrend(snapshots: MemorySnapshot[]): {
    trend: 'increasing' | 'stable' | 'decreasing';
    averageGrowthRate: number;
  } {
    if (snapshots.length < 2) {
      return { trend: 'stable', averageGrowthRate: 0 };
    }

    const growthRates = snapshots.slice(1).map((snapshot, index) => {
      const prevSnapshot = snapshots[index];
      return (snapshot.heapUsed - prevSnapshot.heapUsed) / prevSnapshot.heapUsed;
    });

    const averageGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;

    let trend: 'increasing' | 'stable' | 'decreasing';
    if (averageGrowthRate > 0.05) { // 5% growth threshold
      trend = 'increasing';
    } else if (averageGrowthRate < -0.05) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { trend, averageGrowthRate };
  }

  generateMemoryReport(testResult: MemoryLeakTestResult): string {
    const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    
    return `
Memory Leak Test Report
======================
Status: ${testResult.hasLeak ? '❌ Memory leak detected' : '✅ No memory leak detected'}

Initial Memory State:
- Heap Used: ${formatBytes(testResult.initialSnapshot.heapUsed)}
- Heap Total: ${formatBytes(testResult.initialSnapshot.heapTotal)}
- External: ${formatBytes(testResult.initialSnapshot.external)}

Final Memory State:
- Heap Used: ${formatBytes(testResult.finalSnapshot.heapUsed)}
- Heap Total: ${formatBytes(testResult.finalSnapshot.heapTotal)}
- External: ${formatBytes(testResult.finalSnapshot.external)}

Memory Growth:
- Heap Used: ${formatBytes(testResult.difference.heapUsed)}
- Heap Total: ${formatBytes(testResult.difference.heapTotal)}
- External: ${formatBytes(testResult.difference.external)}

Analysis:
${testResult.hasLeak 
  ? `⚠️ Memory growth exceeded threshold of ${formatBytes(this.LEAK_THRESHOLD_BYTES)}`
  : '✅ Memory usage is within acceptable limits'}
    `.trim();
  }
}

export const memoryLeakDetector = new MemoryLeakDetector();