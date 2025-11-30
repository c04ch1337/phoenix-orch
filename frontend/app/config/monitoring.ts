import { MetricThreshold, AlertLevel } from '../types/monitoring';

export interface MonitoringConfig {
  metricsInterval: number;
  memoryThreshold: number;
  heapUsageThreshold: number;
  eventListenerThreshold: number;
  detachedNodeThreshold: number;
  performanceThresholds: {
    [key: string]: MetricThreshold;
  };
  alertLevels: {
    [key: string]: AlertLevel;
  };
}

export const monitoringConfig: MonitoringConfig = {
  // Base monitoring interval (ms)
  metricsInterval: 30000,

  // Memory thresholds (bytes)
  memoryThreshold: 500 * 1024 * 1024, // 500MB
  heapUsageThreshold: 0.9, // 90% of available heap
  eventListenerThreshold: 1000,
  detachedNodeThreshold: 50,

  // Performance thresholds
  performanceThresholds: {
    // Response time thresholds (ms)
    apiResponseTime: {
      warning: 1000,
      critical: 3000,
      interval: '1m',
      occurrences: 3
    },
    
    // Frame rate thresholds (fps)
    frameRate: {
      warning: 30,
      critical: 15,
      interval: '30s',
      occurrences: 5
    },

    // Memory leak detection
    memoryGrowth: {
      warning: 50 * 1024 * 1024, // 50MB increase
      critical: 100 * 1024 * 1024, // 100MB increase
      interval: '5m',
      occurrences: 3
    },

    // WebSocket latency (ms)
    websocketLatency: {
      warning: 200,
      critical: 500,
      interval: '1m',
      occurrences: 3
    },

    // Resource loading (ms)
    resourceTiming: {
      warning: 2000,
      critical: 5000,
      interval: '5m',
      occurrences: 2
    },

    // DOM Updates (ms)
    domUpdateTime: {
      warning: 50,
      critical: 100,
      interval: '1m',
      occurrences: 5
    }
  },

  // Alert severity levels and actions
  alertLevels: {
    info: {
      priority: 0,
      actions: ['log']
    },
    warning: {
      priority: 1,
      actions: ['log', 'notify']
    },
    critical: {
      priority: 2,
      actions: ['log', 'notify', 'report']
    },
    emergency: {
      priority: 3,
      actions: ['log', 'notify', 'report', 'mitigate']
    }
  }
};

/**
 * Validation function to ensure thresholds are properly configured
 * @param config - The monitoring configuration to validate
 * @returns true if configuration is valid, false otherwise
 */
export function validateThresholds(config: MonitoringConfig): boolean {
  try {
    // Validate basic thresholds
    if (config.metricsInterval < 1000) {
      console.warn('Invalid metricsInterval: must be >= 1000ms');
      return false;
    }
    if (config.memoryThreshold < 1024 * 1024) {
      console.warn('Invalid memoryThreshold: must be >= 1MB');
      return false;
    }
    if (config.heapUsageThreshold <= 0 || config.heapUsageThreshold > 1) {
      console.warn('Invalid heapUsageThreshold: must be between 0 and 1');
      return false;
    }

    // Validate performance thresholds
    for (const [metric, threshold] of Object.entries(config.performanceThresholds)) {
      if (threshold.warning >= threshold.critical) {
        console.warn(`Invalid threshold for ${metric}: warning must be < critical`);
        return false;
      }
      if (!threshold.interval.match(/^\d+[smh]$/)) {
        console.warn(`Invalid interval for ${metric}: must match pattern \\d+[smh]`);
        return false;
      }
      if (threshold.occurrences < 1) {
        console.warn(`Invalid occurrences for ${metric}: must be >= 1`);
        return false;
      }
    }

    // Validate alert levels
    const priorities = new Set<number>();
    for (const [levelName, level] of Object.entries(config.alertLevels)) {
      if (priorities.has(level.priority)) {
        console.warn(`Duplicate priority ${level.priority} for alert level ${levelName}`);
        return false;
      }
      priorities.add(level.priority);
      if (!Array.isArray(level.actions)) {
        console.warn(`Invalid actions for alert level ${levelName}: must be an array`);
        return false;
      }
      // Validate action names
      const validActions = ['log', 'notify', 'report', 'mitigate'];
      for (const action of level.actions) {
        if (!validActions.includes(action)) {
          console.warn(`Invalid action "${action}" for alert level ${levelName}`);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating monitoring config:', error);
    return false;
  }
}

// Export singleton instance
export const monitoring = {
  config: monitoringConfig,
  validate: () => validateThresholds(monitoringConfig)
};