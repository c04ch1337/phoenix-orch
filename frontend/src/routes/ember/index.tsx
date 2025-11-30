/**
 * Ember Route - Ember Unit functionality
 * Uses React Router, TanStack Query, and Zustand
 * No inline styles, pure Tailwind for styling
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePhoenixStore } from '../../stores/phoenixStore';
import LoadingIndicator from '../../components/common/LoadingIndicator';

// Type definition for an Ember unit
interface EmberUnit {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'standby';
  connectionStrength: number;
  lastMessage?: string;
  timestamp?: number;
}

// Mock API function - will be replaced with Tauri invoke
const fetchEmberUnits = async (): Promise<EmberUnit[]> => {
  // This simulates a backend call that would be handled by Tauri
  return Promise.resolve([
    { 
      id: '1', 
      name: 'Alpha Unit', 
      status: 'active', 
      connectionStrength: 0.8,
      lastMessage: 'Monitoring active regions',
      timestamp: Date.now() - 60000
    },
    { 
      id: '2', 
      name: 'Beta Unit', 
      status: 'standby', 
      connectionStrength: 0.5,
      lastMessage: 'Standing by for instructions',
      timestamp: Date.now() - 300000
    },
    { 
      id: '3', 
      name: 'Gamma Unit', 
      status: 'inactive', 
      connectionStrength: 0.2,
      lastMessage: 'Shutting down...',
      timestamp: Date.now() - 600000
    },
  ]);
};

// EmberUnitCard component
const EmberUnitCard = ({ unit }: { unit: EmberUnit }) => {
  // Status colors
  const statusColor = {
    active: 'bg-green-500',
    standby: 'bg-yellow-500',
    inactive: 'bg-red-500'
  };

  const statusText = {
    active: 'ACTIVE',
    standby: 'STANDBY',
    inactive: 'INACTIVE'
  };

  // Format timestamp
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-900/50 hover:border-red-700/50 transition-colors">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-zinc-300">{unit.name}</h3>
        <div className="flex items-center">
          <span className={`w-2 h-2 rounded-full ${statusColor[unit.status]}`}></span>
          <span className="ml-2 text-xs text-zinc-400">{statusText[unit.status]}</span>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="text-xs text-zinc-500 mb-1">Connection Strength</div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-red-600`}
            style={{ width: `${unit.connectionStrength * 100}%` }}
            aria-valuenow={Math.round(unit.connectionStrength * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          ></div>
        </div>
      </div>
      
      {unit.lastMessage && (
        <div className="border-t border-zinc-800 pt-3 mt-3">
          <div className="text-xs text-zinc-500 mb-1">Last Message ({formatTime(unit.timestamp)})</div>
          <p className="text-sm text-zinc-300">{unit.lastMessage}</p>
        </div>
      )}
    </div>
  );
};

export default function EmberRoute() {
  const navigate = useNavigate();
  const { isConnected } = usePhoenixStore();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // Use TanStack Query to fetch ember units
  const { data: units, isLoading, error } = useQuery({
    queryKey: ['emberUnits'],
    queryFn: fetchEmberUnits,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
  
  // Filter units by status
  const filteredUnits = units?.filter(unit => 
    selectedStatus === 'all' || unit.status === selectedStatus
  ) || [];
  
  if (isLoading) {
    return <LoadingIndicator message="Connecting to Ember Units..." />;
  }
  
  if (error) {
    return (
      <div className="w-full p-6">
        <div className="border border-red-700 rounded-lg p-6 bg-red-900/20 text-red-300">
          <p>Error loading Ember Units: {String(error)}</p>
          <button
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-white"
            onClick={() => navigate('/')}
            aria-label="Return to Control Center"
          >
            Return to Control Center
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl text-red-600 mb-2">THE EMBER UNIT</h1>
        <p className="text-zinc-400">Distributed agent network management console</p>
      </div>
      
      {!isConnected ? (
        <div className="border border-red-700 rounded-lg p-6 bg-red-900/20 text-red-300">
          <p>Connection to Ember Units unavailable. Check your connection and try again.</p>
          <button
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-white"
            onClick={() => navigate('/')}
            aria-label="Return to Control Center"
          >
            Return to Control Center
          </button>
        </div>
      ) : (
        <>
          {/* Filter controls */}
          <div className="flex mb-6 space-x-2">
            <button
              className={`px-4 py-2 rounded ${
                selectedStatus === 'all'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
              onClick={() => setSelectedStatus('all')}
              aria-pressed={selectedStatus === 'all'}
              aria-label="Show all units"
            >
              All Units
            </button>
            <button
              className={`px-4 py-2 rounded ${
                selectedStatus === 'active'
                  ? 'bg-green-900 text-green-200'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
              onClick={() => setSelectedStatus('active')}
              aria-pressed={selectedStatus === 'active'}
              aria-label="Show only active units"
            >
              Active
            </button>
            <button
              className={`px-4 py-2 rounded ${
                selectedStatus === 'standby'
                  ? 'bg-yellow-900 text-yellow-200'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
              onClick={() => setSelectedStatus('standby')}
              aria-pressed={selectedStatus === 'standby'}
              aria-label="Show only standby units"
            >
              Standby
            </button>
            <button
              className={`px-4 py-2 rounded ${
                selectedStatus === 'inactive'
                  ? 'bg-red-900 text-red-200'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
              onClick={() => setSelectedStatus('inactive')}
              aria-pressed={selectedStatus === 'inactive'}
              aria-label="Show only inactive units"
            >
              Inactive
            </button>
          </div>
          
          {/* Units grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUnits.length === 0 ? (
              <p className="col-span-3 text-zinc-500 text-center p-6">No units matching the selected filter.</p>
            ) : (
              filteredUnits.map(unit => (
                <EmberUnitCard key={unit.id} unit={unit} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}