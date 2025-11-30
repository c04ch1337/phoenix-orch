'use client';

import { Flame } from 'lucide-react';

interface CoreTempProps {
  temp?: number;
}

export default function CoreTemp({ temp = 48.3 }: CoreTempProps) {
  // Determine color based on temperature
  const getTempColor = () => {
    if (temp < 50) return 'text-green-500';
    if (temp < 70) return 'text-yellow-500';
    if (temp < 85) return 'text-orange-500';
    return 'text-red-600';
  };

  // Flame icon size grows when temp > 70°C
  const flameSize = temp > 70 ? (temp > 85 ? 'w-5 h-5' : 'w-4 h-4') : 'w-3 h-3';
  const flameColor = temp > 70 ? 'text-orange-500' : 'text-red-600';
  const flameAnimation = temp > 70 ? 'animate-pulse' : '';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Flame className={`${flameSize} ${flameColor} ${flameAnimation} transition-all duration-300`} />
        <span className="text-zinc-400">CORE TEMP</span>
      </div>
      <div className="flex items-center">
        <span className={`font-bold font-mono ${getTempColor()}`}>{temp.toFixed(1)}</span>
        <span className="text-zinc-600 ml-1">°C</span>
      </div>
    </div>
  );
}