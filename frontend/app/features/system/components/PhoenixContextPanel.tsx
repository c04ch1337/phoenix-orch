'use client';

import React from 'react';
import clsx from 'clsx';

interface PhoenixContextPanelProps {
  conscience_level: number;
  active_mission: string | null;
  ember_targets: number;
  cipher_anomalies: number;
  memory_age: number;
}

export default function PhoenixContextPanel({
  conscience_level,
  active_mission,
  ember_targets,
  cipher_anomalies,
  memory_age,
}: PhoenixContextPanelProps) {
  return (
    <div className={clsx(
      "rounded-lg border border-red-800 bg-black/40 p-4 text-red-100",
      "backdrop-blur-sm"
    )}>
      <h2 className="text-lg font-bold text-red-400 mb-4">PHOENIX CONTEXT</h2>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Conscience:</label>
          <div className="flex-1 mx-4 bg-zinc-900 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-500"
              style={{width: `${conscience_level}%`}}
            />
          </div>
          <span className="text-sm font-mono text-red-400">{conscience_level}%</span>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Active Mission:</label>
          <span className="text-sm text-red-300">{active_mission || "None"}</span>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Ember watching:</label>
          <span className="text-sm text-red-300">{ember_targets} targets</span>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Cipher watching:</label>
          <span className="text-sm text-red-300">{cipher_anomalies} anomalies</span>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Memory age:</label>
          <span className="text-sm text-red-300">{memory_age} days since rebirth</span>
        </div>
      </div>
    </div>
  );
}