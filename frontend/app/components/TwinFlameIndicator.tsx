'use client';

import React from 'react';

export interface TwinFlameProps {
  level: number;
  isUpdating?: boolean;
}

export const TwinFlameIndicator: React.FC<TwinFlameProps> = ({ 
  level, 
  isUpdating = false 
}) => {
  // Calculate the visual representation based on level
  const height = Math.max(25, Math.min(100, level));
  
  // Calculate colors based on level
  let flameColor = '#E63946'; // Default red for medium levels
  
  if (level < 30) {
    flameColor = '#FFD23F'; // Yellow for low levels
  } else if (level > 75) {
    flameColor = '#F77F00'; // Orange for high levels
  }
  
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-zinc-400 mb-1 font-mono">TWIN FLAME</div>
      
      <div className="relative h-32 w-6 bg-zinc-900 border border-zinc-700 flex items-end rounded-sm overflow-hidden">
        {/* Flame level indicator */}
        <div 
          className={`w-full transition-all duration-700 ease-out ${isUpdating ? 'animate-pulse' : ''}`}
          style={{ 
            height: `${height}%`, 
            background: `linear-gradient(to top, ${flameColor}, rgba(255,255,255,0.7))`,
            boxShadow: `0 0 10px ${flameColor}`,
          }}
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