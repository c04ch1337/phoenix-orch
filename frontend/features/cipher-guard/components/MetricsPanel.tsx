import React from 'react';

interface Metric {
  name: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
}

interface MetricsPanelProps {
  metrics?: Metric[];
}

export default function MetricsPanel({ metrics = defaultMetrics }: MetricsPanelProps) {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
      <h2 className="text-xl font-bold text-red-500 mb-4">Defense Metrics</h2>
      <div className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-zinc-800 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">{metric.name}</span>
              <span className={`${getTrendColor(metric.trend)}`}>
                {metric.value}%
                {getTrendIcon(metric.trend)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const defaultMetrics: Metric[] = [
  { name: 'Threat Detection Rate', value: 98, trend: 'up' },
  { name: 'System Integrity', value: 100, trend: 'stable' },
  { name: 'Response Time', value: 85, trend: 'down' },
  { name: 'Defense Coverage', value: 94, trend: 'up' }
];

function getTrendColor(trend: Metric['trend']) {
  switch (trend) {
    case 'up':
      return 'text-green-500';
    case 'down':
      return 'text-red-500';
    default:
      return 'text-yellow-500';
  }
}

function getTrendIcon(trend: Metric['trend']) {
  switch (trend) {
    case 'up':
      return ' ↑';
    case 'down':
      return ' ↓';
    default:
      return ' →';
  }
}