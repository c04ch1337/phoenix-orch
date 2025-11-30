import React from 'react';

export default function DefenseDashboard() {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
      <h2 className="text-xl font-bold text-red-500 mb-4">Defense Matrix</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-2">System Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Firewall</span>
              <span className="text-green-500">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Encryption</span>
              <span className="text-green-500">Enabled</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Intrusion Detection</span>
              <span className="text-green-500">Monitoring</span>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-2">Threat Level</h3>
          <div className="text-center">
            <div className="text-4xl font-bold text-yellow-500">MEDIUM</div>
            <div className="text-sm text-zinc-400 mt-2">3 Active Threats</div>
          </div>
        </div>
      </div>
    </div>
  );
}