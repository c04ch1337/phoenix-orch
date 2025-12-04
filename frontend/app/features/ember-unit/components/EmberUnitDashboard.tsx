'use client';

import React from 'react';
import { EmberUnit } from './EmberUnit';

/**
 * EmberUnitDashboard Component
 * 
 * Main dashboard container for the EmberUnit functionality.
 * Wraps the core EmberUnit component with any additional contextual elements.
 */
export const EmberUnitDashboard: React.FC = () => {
  return (
    <div className="h-full w-full">
      <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4 h-full">
        <h2 className="text-base font-medium text-phoenix-orange mb-4">
          Tactical Command Interface
        </h2>
        
        {/* Core EmberUnit Component */}
        <div className="h-[calc(100%-2rem)]">
          <EmberUnit />
        </div>
      </div>
    </div>
  );
};

export default EmberUnitDashboard;