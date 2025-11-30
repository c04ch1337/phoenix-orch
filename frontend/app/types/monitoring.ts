export interface MetricThreshold {
  warning: number;
  critical: number;
  interval: string; // Format: number + unit (e.g., '30s', '1m', '1h')
  occurrences: number; // Number of times threshold must be exceeded
}

export interface AlertLevel {
  priority: number;
  actions: AlertAction[];
}

export type AlertAction = 'log' | 'notify' | 'report' | 'mitigate';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface Alert {
  id: string;
  level: AlertSeverity;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    limit: number;
  };
  cpu: {
    usage: number;
    tasks: number;
  };
  network: {
    requests: number;
    latency: number;
    errors: number;
  };
  dom: {
    nodes: number;
    listeners: number;
    updates: number;
  };
  resources: {
    loading: number;
    complete: number;
    failed: number;
  };
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  tags: Record<string, string>;
}

export interface MetricsSummary {
  timestamp: number;
  metrics: PerformanceMetrics;
  alerts: Alert[];
  status: 'healthy' | 'degraded' | 'critical';
}