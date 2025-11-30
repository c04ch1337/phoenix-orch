import React from 'react';

export default function OpportunityEngine() {
  return (
    <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
      <h2 className="text-xl font-bold text-red-500 mb-4">Opportunity Engine</h2>
      <div className="space-y-4">
        <div className="bg-zinc-800 rounded-lg p-4">
          <h3 className="text-red-400 mb-3">Tactical Opportunities</h3>
          <div className="space-y-3">
            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Infiltration Vector</span>
                <span className="text-yellow-500">Medium Priority</span>
              </div>
              <p className="text-sm text-zinc-400">Network vulnerability detected in target infrastructure</p>
            </div>
            <div className="p-3 border border-zinc-700 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-300">Data Exfiltration</span>
                <span className="text-red-500">High Priority</span>
              </div>
              <p className="text-sm text-zinc-400">Sensitive data transfer patterns identified</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg p-4">
          <h3 className="text-red-400 mb-3">Resource Allocation</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Processing Power</span>
              <span className="text-green-500">78%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Memory Usage</span>
              <span className="text-yellow-500">92%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Network Bandwidth</span>
              <span className="text-green-500">45%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}