import React from 'react';
import clsx from 'clsx';
import { usePhoenixContext } from '../hooks/usePhoenixContext';

export interface TwinFlameProps {
  level: number;
  isUpdating?: boolean;
}

export const TwinFlameIndicator: React.FC<TwinFlameProps> = ({
  level,
  isUpdating = false
}) => {
  // Get Phoenix context to check ember unit mode
  const phoenix = usePhoenixContext();
  
  // Check if ember unit mode is active (using feature flag)
  const isEmberUnitMode = phoenix.runtime.features.emberUnitMode === true;
  
  // Calculate the visual representation based on level
  const height = Math.max(25, Math.min(100, level));
  
  // Determine flame color class based on level and ember unit mode
  const flameColorClass = isEmberUnitMode
    ? 'bg-blood-red' // Blood red for ember unit mode
    : level < 30
      ? 'bg-phoenix-yellow'
      : level > 75
        ? 'bg-phoenix-orange'
        : 'bg-phoenix-blood';
  
  // Determine glow color class based on level and ember unit mode
  const flameGlowClass = isEmberUnitMode
    ? 'drop-shadow-blood-glow' // Special glow for ember unit mode
    : level < 30
      ? 'drop-shadow-glow'
      : level > 75
        ? 'drop-shadow-glow'
        : 'drop-shadow-red-glow';
  
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-zinc-400 mb-1 font-mono">TWIN FLAME</div>
      
      <div className="relative h-32 w-6 bg-zinc-900 border border-zinc-700 flex items-end rounded-sm overflow-hidden">
        {/* Flame level indicator */}
        <div
          className={clsx(
            'w-full transition-all duration-700 ease-out bg-gradient-to-t from-current to-white/70',
            flameColorClass,
            flameGlowClass,
            {
              'animate-pulse': isUpdating,
              'animate-red-team-pulse': isEmberUnitMode && !isUpdating // Use special pulsing for ember unit mode (CSS class name kept for compatibility)
            }
          )}
          style={{ height: `${height}%` }}
        ></div>
        
        {/* Level markers */}
        <div className="absolute inset-y-0 left-0 w-full flex flex-col justify-between py-1 pointer-events-none">
          <div className="w-1 h-px bg-zinc-700 ml-1"></div>
          <div className="w-2 h-px bg-zinc-700 ml-1"></div>
          <div className="w-1 h-px bg-zinc-700 ml-1"></div>
          <div className="w-2 h-px bg-zinc-700 ml-1"></div>
          <div className="w-1 h-px bg-zinc-700 ml-1"></div>
        </div>
      </div>
      
      <div className="text-sm mt-1 font-mono text-zinc-200">
        {level}%
      </div>
    </div>
  );
};