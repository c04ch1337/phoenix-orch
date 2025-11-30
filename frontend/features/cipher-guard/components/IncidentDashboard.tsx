import React from 'react';

export default function IncidentDashboard() {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
      <h2 className="text-xl font-bold text-red-500 mb-4">Incident Monitor</h2>
      <div className="space-y-4">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-3">Active Incidents</h3>
          <div className="space-y-3">
            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Unauthorized Access Attempt</span>
                <span className="text-red-500">Critical</span>
              </div>
              <p className="text-sm text-zinc-400">Multiple failed authentication attempts detected</p>
              <div className="mt-2 text-xs text-zinc-500">Location: 192.168.1.100</div>
            </div>
            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Suspicious Network Activity</span>
                <span className="text-yellow-500">Warning</span>
              </div>
              <p className="text-sm text-zinc-400">Unusual outbound traffic patterns detected</p>
              <div className="mt-2 text-xs text-zinc-500">Duration: 15 minutes</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-red-400 mb-3">Response Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Block IP
            </button>
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Isolate System
            </button>
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Generate Report
            </button>
            <button className="p-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors">
              Reset Access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}