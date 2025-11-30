'use client';

import { useEffect, useState } from 'react';
import { performanceMonitor } from '../services/performance';

interface MetricDisplay {
  name: string;
  value: number;
  threshold: number;
  unit: string;
}

// Define monitored metrics outside component to avoid recreation
const MONITORED_METRICS = {
  LCP: { threshold: 2500, unit: 'ms' },    // Largest Contentful Paint
  FID: { threshold: 100, unit: 'ms' },     // First Input Delay
  CLS: { threshold: 0.1, unit: '' },       // Cumulative Layout Shift
  TTFB: { threshold: 600, unit: 'ms' },    // Time to First Byte
  FCP: { threshold: 1800, unit: 'ms' },    // First Contentful Paint
  'memory-usage': { threshold: 50_000_000, unit: 'bytes' }  // Memory Usage
} as const;

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<MetricDisplay[]>([]);

  useEffect(() => {
    try {
      // Initialize performance monitoring
      performanceMonitor.initialize();
    } catch (error) {
      console.error('Failed to initialize performance monitor:', error);
    }

    // Update metrics every second
    const intervalId = setInterval(() => {
      try {
        const currentMetrics: MetricDisplay[] = Object.entries(MONITORED_METRICS).map(([name, config]) => ({
          name,
          value: performanceMonitor.getAverageMetric(name) || 0,
          threshold: config.threshold,
          unit: config.unit
        }));
        setMetrics(currentMetrics);
      } catch (error) {
        console.error('Error updating metrics:', error);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const getMetricColor = (metric: MetricDisplay) => {
    if (metric.threshold === 0) return 'text-zinc-500'; // Avoid division by zero
    const ratio = metric.value / metric.threshold;
    if (ratio <= 0.5) return 'text-green-500';
    if (ratio <= 0.75) return 'text-yellow-500';
    if (ratio <= 0.9) return 'text-orange-500';
    return 'text-red-500';
  };

  const getProgressWidth = (metric: MetricDisplay) => {
    if (metric.threshold === 0) return 0;
    return Math.min((metric.value / metric.threshold) * 100, 100);
  };

  const formatValue = (value: number, unit: string) => {
    if (isNaN(value) || !isFinite(value)) {
      return 'N/A';
    }
    
    if (unit === 'bytes') {
      if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(2)} GB`;
      }
      return `${(value / 1_000_000).toFixed(1)} MB`;
    }
    if (unit === 'ms') {
      return `${value.toFixed(0)} ms`;
    }
    return value.toFixed(3);
  };

  return (
    <div className="bg-zinc-900 p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-zinc-100">Performance Metrics</h2>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <div key={metric.name} className="bg-zinc-800 p-3 rounded">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">{metric.name}</span>
              <span className={`font-mono ${getMetricColor(metric)}`}>
                {formatValue(metric.value, metric.unit)}
              </span>
            </div>
            <div className="mt-2 bg-zinc-700 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  getMetricColor(metric).replace('text-', 'bg-')
                }`}
                style={{ width: `${getProgressWidth(metric)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}