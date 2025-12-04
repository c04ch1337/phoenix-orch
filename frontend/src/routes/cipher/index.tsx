/**
 * Cipher Route - Cipher Guard functionality
 * Pure React component with Tailwind styling
 * Uses Zustand for state and Tauri for backend communication
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhoenixStore } from '@/stores/phoenixStore';
import LoadingIndicator from '@/components/common/LoadingIndicator';

// TODO: Implement getHealthStatus when Tauri commands are ready
// import { getHealthStatus } from '@/tauri/invoke';

// Placeholder component for security dashboard
const SecurityDashboard = () => {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-900/50">
        <h3 className="text-lg font-semibold text-zinc-300 mb-4">System Protection</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Firewall Status</span>
            <span className="text-sm text-green-500">ACTIVE</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Threat Level</span>
            <div className="w-32 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 w-[45%]"></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Monitoring</span>
            <div className="w-32 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 w-[60%]"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="border border-zinc-700 rounded-lg p-6 bg-zinc-900/50">
        <h3 className="text-lg font-semibold text-zinc-300 mb-4">Security Protocols</h3>
        <div className="space-y-3">
          <div className="flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            <span className="text-sm text-zinc-300">Memory Encryption</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            <span className="text-sm text-zinc-300">Neural Barriers</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            <span className="text-sm text-zinc-300">Quantum Shield</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
            <span className="text-sm text-zinc-300">Reality Anchor</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CipherRoute() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isConnected, setConnectionStatus } = usePhoenixStore();
  
  useEffect(() => {
    // Simulate loading security data
    const fetchSecurityStatus = async () => {
      try {
        // TODO: Check health to verify connection when Tauri commands are ready
        // const health = await getHealthStatus();
        // setConnectionStatus(health.status === 'ok');
        setConnectionStatus(true); // Mock for now
        setLoading(false);
      } catch (error) {
        console.error('Failed to load security status:', error);
        setConnectionStatus(false);
        setLoading(false);
      }
    };
    
    fetchSecurityStatus();
  }, [setConnectionStatus]);
  
  if (loading) {
    return <LoadingIndicator message="Initializing Security Systems..." />;
  }
  
  return (
    <div className="w-full p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl text-red-600 mb-2">CIPHER GUARD</h1>
        <p className="text-zinc-400">Advanced security systems for Phoenix integrity</p>
      </div>
      
      {!isConnected ? (
        <div className="border border-red-700 rounded-lg p-6 bg-red-900/20 text-red-300">
          <p>Connection to security services unavailable. Check your connection and try again.</p>
          <button
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-white"
            onClick={() => navigate('/')}
            aria-label="Return to Control Center"
          >
            Return to Control Center
          </button>
        </div>
      ) : (
        <SecurityDashboard />
      )}
    </div>
  );
}