import React from 'react';
import { useCounterAnimation } from '../hooks/useCounterAnimation';

interface AnimatedCounterProps {
  value: number;
  formatValue?: (value: number) => string;
  className?: string;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  formatValue = (v) => v.toString(),
  className = '',
  duration = 1000,
  suffix = '',
  prefix = ''
}) => {
  const animatedValue = useCounterAnimation(value, { duration });
  
  return (
    <span className={`inline-flex items-center ${className}`}>
      {prefix}
      <span className="tabular-nums">
        {formatValue(animatedValue)}
      </span>
      {suffix}
    </span>
  );
};

// Specialized counter variants
export const DaysCounter: React.FC<{ value: number }> = ({ value }) => (
  <AnimatedCounter
    value={value}
    suffix=" days"
    className="text-2xl font-bold text-orange-500"
    formatValue={(v) => Math.round(v).toString()}
  />
);

export const NodesCounter: React.FC<{ value: number }> = ({ value }) => (
  <AnimatedCounter
    value={value}
    prefix="Nodes: "
    className="text-xl font-medium text-blue-400"
    formatValue={(v) => Math.round(v).toString()}
  />
);

export const GuardCellsCounter: React.FC<{ value: number }> = ({ value }) => (
  <AnimatedCounter
    value={value}
    prefix="Active Cells: "
    className="text-xl font-medium text-purple-400"
    formatValue={(v) => Math.round(v).toString()}
  />
);

export const TemperatureCounter: React.FC<{ value: number }> = ({ value }) => (
  <AnimatedCounter
    value={value}
    suffix="°C"
    className="text-xl font-medium text-red-400"
    formatValue={(v) => v.toFixed(1)}
    duration={2000}
  />
);