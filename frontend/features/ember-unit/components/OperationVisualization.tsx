import React from 'react';

export default function OperationVisualization() {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4 h-full">
      <h2 className="text-xl font-bold text-red-500 mb-4">Operation Map</h2>
      <div className="bg-zinc-800 rounded-lg p-4 h-[400px] flex items-center justify-center">
        <div className="text-zinc-400 text-center">
          <div className="mb-2">No active operations</div>
          <div className="text-sm">Operation visualization will appear here</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Grid Status</span>
          <span className="text-green-500">Online</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Coverage</span>
          <span className="text-green-500">100%</span>
        </div>
      </div>
    </div>
  );
}