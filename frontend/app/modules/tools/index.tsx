import React from 'react';
import { Shield, Database, Cpu, Terminal, RefreshCw, Network } from 'lucide-react';

const ToolsArsenal: React.FC = () => {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-red-600 mb-6">TOOLS ARSENAL</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Security Tools */}
        <div className="border border-red-800 bg-zinc-900 rounded p-4">
          <div className="flex items-center mb-3">
            <Shield className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-500 font-semibold">SECURITY</h3>
          </div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Intrusion Detection
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Threat Analysis
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Perimeter Defense
            </li>
          </ul>
        </div>
        
        {/* Database Tools */}
        <div className="border border-red-800 bg-zinc-900 rounded p-4">
          <div className="flex items-center mb-3">
            <Database className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-500 font-semibold">DATABASE</h3>
          </div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Memory Indexing
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Data Extraction
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
              Pattern Recognition
            </li>
          </ul>
        </div>
        
        {/* System Tools */}
        <div className="border border-red-800 bg-zinc-900 rounded p-4">
          <div className="flex items-center mb-3">
            <Cpu className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-500 font-semibold">SYSTEM</h3>
          </div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Resource Monitor
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Diagnostic Tools
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Performance Optimizer
            </li>
          </ul>
        </div>
        
        {/* Terminal Tools */}
        <div className="border border-red-800 bg-zinc-900 rounded p-4">
          <div className="flex items-center mb-3">
            <Terminal className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-500 font-semibold">TERMINAL</h3>
          </div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Command Line Interface
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
              Script Execution
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              System Access (Locked)
            </li>
          </ul>
        </div>
        
        {/* Maintenance Tools */}
        <div className="border border-red-800 bg-zinc-900 rounded p-4">
          <div className="flex items-center mb-3">
            <RefreshCw className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-500 font-semibold">MAINTENANCE</h3>
          </div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Self-Repair Utilities
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Memory Cleanup
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              System Integrity Check
            </li>
          </ul>
        </div>
        
        {/* Network Tools */}
        <div className="border border-red-800 bg-zinc-900 rounded p-4">
          <div className="flex items-center mb-3">
            <Network className="text-red-500 mr-2" size={20} />
            <h3 className="text-red-500 font-semibold">NETWORK</h3>
          </div>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Connection Monitor
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
              Data Transfer Analysis
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              External Communications (Restricted)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ToolsArsenal;
