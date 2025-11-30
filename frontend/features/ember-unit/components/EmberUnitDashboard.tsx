import React from 'react';

export default function EmberUnitDashboard() {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
      <h2 className="text-xl font-bold text-red-500 mb-4">Operation Dashboard</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-2">Active Operations</h3>
          <div className="space-y-2">
            {/* Placeholder for active operations */}
            <div className="text-zinc-400">No active operations</div>
          </div>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-2">Unit Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Readiness</span>
              <span className="text-green-500">100%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Operational Capacity</span>
              <span className="text-green-500">Optimal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}