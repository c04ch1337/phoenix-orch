import React, { useState, useEffect } from 'react';
import { useForgeLeaderboardStream } from '../hooks/useForgeLeaderboardStream';
import { fetchLeaderboard, LeaderboardEntry } from '../api/forgeService';

interface ForgeLeaderboardProps {
  className?: string;
}

export function ForgeLeaderboard({ className = '' }: ForgeLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Subscribe to real-time updates
  const { connected, lastUpdate } = useForgeLeaderboardStream();
  
  // Fetch leaderboard data initially and when we get an update notification
  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        const data = await fetchLeaderboard();
        setLeaderboard(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        setError('Failed to load leaderboard data');
      } finally {
        setLoading(false);
      }
    }
    
    loadLeaderboard();
  }, [lastUpdate]); // Re-fetch when lastUpdate changes
  
  if (loading && leaderboard.length === 0) {
    return (
      <div className={`p-4 bg-gray-800 rounded-lg shadow-lg ${className}`}>
        <h2 className="text-lg font-semibold text-amber-500">Ember Forge Leaderboard</h2>
        <div className="mt-4 py-8 text-center text-gray-400">
          <div className="animate-pulse">Loading leaderboard data...</div>
        </div>
      </div>
    );
  }
  
  if (error && leaderboard.length === 0) {
    return (
      <div className={`p-4 bg-gray-800 rounded-lg shadow-lg ${className}`}>
        <h2 className="text-lg font-semibold text-amber-500">Ember Forge Leaderboard</h2>
        <div className="mt-4 py-8 text-center text-red-500">
          <div>Error: {error}</div>
          <button 
            className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`p-4 bg-gray-800 rounded-lg shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-amber-500">Ember Forge Leaderboard</h2>
        <div className="flex items-center">
          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-xs text-gray-400">{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>
      
      {leaderboard.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          No agents in leaderboard yet
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Agent</th>
                  <th className="py-2 px-2">Score</th>
                  <th className="py-2 px-2">Conscience</th>
                  <th className="py-2 px-2">Usage</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.agent_id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="py-2 px-2 text-sm">{entry.rank}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center">
                        {entry.is_ashen_saint && (
                          <span className="mr-2 text-amber-400">⭐</span>
                        )}
                        <span className="font-medium">{entry.agent_name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-sm">{entry.score.toFixed(2)}</td>
                    <td className="py-2 px-2 text-sm">{entry.conscience_score.toFixed(2)}</td>
                    <td className="py-2 px-2 text-sm">{entry.usage_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {lastUpdate && (
            <div className="mt-4 text-xs text-gray-400 text-right">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </>
      )}
      
      {loading && leaderboard.length > 0 && (
        <div className="absolute inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="animate-pulse text-amber-500">Refreshing...</div>
        </div>
      )}
    </div>
  );
}