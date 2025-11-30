import React from 'react';

export default function ActiveDefensesPanel() {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
      <h2 className="text-xl font-bold text-red-500 mb-4">Active Defenses</h2>
      <div className="space-y-4">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-3">Defense Systems</h3>
          <div className="space-y-3">
            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Neural Firewall</span>
                <span className="text-green-500">Active</span>
              </div>
              <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[95%]"></div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Efficiency: 95%</div>
            </div>

            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Quantum Encryption</span>
                <span className="text-green-500">Active</span>
              </div>
              <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[100%]"></div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Efficiency: 100%</div>
            </div>

            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">AI Threat Detection</span>
                <span className="text-yellow-500">Learning</span>
              </div>
              <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 w-[75%]"></div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">Efficiency: 75%</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-3">Defense Controls</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="p-2 bg-green-700/20 border border-green-700/50 rounded text-green-400 hover:bg-green-700/30 transition-colors">
              Enable All
            </button>
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Emergency Shutdown
            </button>
            <button className="p-2 bg-yellow-700/20 border border-yellow-700/50 rounded text-yellow-400 hover:bg-yellow-700/30 transition-colors">
              Recalibrate
            </button>
            <button className="p-2 bg-blue-700/20 border border-blue-700/50 rounded text-blue-400 hover:bg-blue-700/30 transition-colors">
              Update Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}