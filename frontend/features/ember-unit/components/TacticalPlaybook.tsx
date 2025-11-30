import React from 'react';

export default function TacticalPlaybook() {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
      <h2 className="text-xl font-bold text-red-500 mb-4">Tactical Playbook</h2>
      <div className="space-y-4">
        <div className="bg-zinc-800 rounded-lg p-4">
          <h3 className="text-red-400 mb-3">Active Strategies</h3>
          <div className="space-y-3">
            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Silent Infiltration</span>
                <span className="text-green-500">Active</span>
              </div>
              <p className="text-sm text-zinc-400">Stealth-based network penetration protocol</p>
              <div className="mt-2">
                <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-3/4"></div>
                </div>
              </div>
            </div>
            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Data Mining</span>
                <span className="text-yellow-500">Pending</span>
              </div>
              <p className="text-sm text-zinc-400">Automated intelligence gathering operation</p>
              <div className="mt-2">
                <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 w-1/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg p-4">
          <h3 className="text-red-400 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Deploy Agent
            </button>
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Extract Data
            </button>
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Analyze Target
            </button>
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}