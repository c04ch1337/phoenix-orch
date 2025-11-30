/**
 * Login Route - Authentication page
 * Uses Zustand for state management and Tailwind for styling
 */

import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { usePhoenixStore } from '@/stores/phoenixStore';

export default function LoginRoute() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  // Use Zustand store for authentication state
  const { agent, setAgentStatus, isConnected } = usePhoenixStore();
  
  // If already active, redirect to home
  if (agent.status === 'active') {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Authentication logic would use Tauri invoke in a real implementation
      if (credentials.username === 'admin' && credentials.password === 'phoenix') {
        // Success - update agent status
        setAgentStatus('active');
        navigate('/');
      } else {
        setError('Invalid credentials. Access denied.');
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 shadow-lg rounded-lg px-8 pt-6 pb-8">
          <div className="flex flex-col items-center mb-6">
            <Flame className="h-16 w-16 text-red-600 mb-2" />
            <h1 className="text-red-600 text-2xl font-bold">PHOENIX ORCH</h1>
            <p className="text-zinc-500 text-sm">THE ASHEN GUARD</p>
          </div>
          
          {!isConnected && (
            <div className="bg-red-900/30 border border-red-800 rounded-md p-3 mb-4 text-red-300 text-sm">
              Warning: Not connected to backend services. Authentication may fail.
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-md p-3 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-zinc-400 text-sm font-bold mb-2" htmlFor="username">
                Username
              </label>
              <input
                className="bg-zinc-800 appearance-none border border-zinc-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                id="username"
                type="text"
                placeholder="Enter username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-zinc-400 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input
                className="bg-zinc-800 appearance-none border border-zinc-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                id="password"
                type="password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center justify-center">
              <button
                className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-50 disabled:bg-zinc-700"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Authenticating...' : 'ACCESS SYSTEM'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-zinc-500 text-xs">
              Authorized Personnel Only • Zero-Day Protocol Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}