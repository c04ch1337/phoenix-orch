'use client';

import React from 'react';

interface SystemTelemetry {
  cpu: number;
  gpu: number;
  memory: number;
  network: number;
  thermal: number;
}

interface ResourceVectorProps {
  telemetry?: SystemTelemetry;
}

export default function ResourceVector({ telemetry }: ResourceVectorProps) {
  // Use telemetry data or defaults
  const resources = {
    cpu: telemetry?.cpu ?? 75,
    memory: telemetry?.memory ?? 60,
    gpu: telemetry?.gpu ?? 85,
    heat: telemetry?.thermal ?? 70
  };

  // Normalize values to 0-100 range for display
  const normalize = (value: number) => Math.min(100, Math.max(0, value));

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
        </svg>
        <span className="text-zinc-400">RESOURCE VECTOR</span>
      </div>
      
      <div className="relative w-full h-32 bg-black border border-red-700/30 rounded">
        {/* Resource Vector Graph */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Background grid */}
          <path
            d="M50,0 L50,100 M0,50 L100,50"
            stroke="rgba(255,0,0,0.2)"
            strokeWidth="0.5"
          />
          
          {/* Outer boundary */}
          <path
            d="M50,10 L90,50 L50,90 L10,50 Z"
            fill="none"
            stroke="rgba(255,0,0,0.1)"
            strokeWidth="0.5"
          />
          
          {/* Resource vector shape - animated */}
          <path
            d={`M50,${50 - normalize(resources.cpu) * 0.4} L${50 + normalize(resources.gpu) * 0.4},50 L50,${50 + normalize(resources.heat) * 0.4} L${50 - normalize(resources.memory) * 0.4},50 Z`}
            fill="rgba(255,0,0,0.3)"
            stroke="#ff0000"
            strokeWidth="1.5"
            className="transition-all duration-500"
          />
          
          {/* Center point */}
          <circle cx="50" cy="50" r="2" fill="#ff0000" />
          
          {/* Labels */}
          <text x="50" y="8" textAnchor="middle" fill="#666" fontSize="6">CPU</text>
          <text x="92" y="52" textAnchor="start" fill="#666" fontSize="6">GPU</text>
          <text x="50" y="98" textAnchor="middle" fill="#666" fontSize="6">HEAT</text>
          <text x="8" y="52" textAnchor="end" fill="#666" fontSize="6">MEM</text>
        </svg>
      </div>
    </div>
  );
}