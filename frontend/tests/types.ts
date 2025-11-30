import { ReactElement, ReactNode } from 'react';
import { RenderOptions, RenderResult } from '@testing-library/react';

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Record<string, any>;
  route?: string;
}

export interface TestRenderResult extends Omit<RenderResult, 'rerender'> {
  rerender: (ui: ReactNode) => void;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffFactor: number;
  initialDelay: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
  };
}

export interface TestContext {
  retryConfig: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  performanceThresholds: {
    maxRenderTime: number;
    maxMemoryUsage: number;
    maxNetworkLatency: number;
  };
}

// Test utility types
export type MockFn<T extends (...args: any[]) => any> = jest.Mock<ReturnType<T>, Parameters<T>>;

export interface TestError extends Error {
  code?: string;
  details?: Record<string, any>;
}

// Performance testing types
export interface PerformanceTestCase {
  name: string;
  component: ReactElement;
  expectations: Partial<PerformanceMetrics>;
}

// Memory leak testing types
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export interface MemoryLeakTestResult {
  initialSnapshot: MemorySnapshot;
  finalSnapshot: MemorySnapshot;
  difference: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  hasLeak: boolean;
}