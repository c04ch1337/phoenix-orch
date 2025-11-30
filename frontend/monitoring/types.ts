// Extend the Performance interface to include Chrome's memory API
interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

declare global {
  interface Performance {
    memory?: MemoryInfo;
  }

  interface Window {
    gc?: () => void;
  }
}

export interface MonitoringMetric {
  timestamp: number;
  category: string;
  data: any;
}

export interface ErrorData {
  type: string;
  message: string;
  stack?: string;
  timestamp: number;
}

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceData {
  name: string;
  duration: number;
  startTime: number;
  entryType: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface MonitoringConfig {
  metricsEndpoint: string;
  logLevel: LogLevel;
  sampleRate: number;
  enableAutoRecovery: boolean;
}

// Utility type for monitoring buffer
export type MetricsBuffer = Array<MonitoringMetric>;

// Timer type for Node.js
export type NodeTimer = ReturnType<typeof setInterval>;