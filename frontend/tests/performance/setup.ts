import { vi } from 'vitest';

// Create performance.memory if it doesn't exist
if (typeof window !== 'undefined' && !window.performance.memory) {
  Object.defineProperty(window.performance, 'memory', {
    value: {
      jsHeapSizeLimit: 2147483648, // 2GB
      totalJSHeapSize: 50000000,   // 50MB
      usedJSHeapSize: 25000000     // 25MB
    },
    configurable: true
  });
}

// Global test constants
Object.defineProperty(global, 'LATENCY_THRESHOLD_MS', { value: 150 });
Object.defineProperty(global, 'MEMORY_GROWTH_THRESHOLD_MB', { value: 10 });