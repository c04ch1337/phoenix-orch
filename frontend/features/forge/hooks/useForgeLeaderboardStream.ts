import { useState, useEffect } from 'react';

/**
 * React hook that subscribes to the Forge Leaderboard updates via SSE
 * @returns An object containing the connection status and last update timestamp
 */
export function useForgeLeaderboardStream() {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  useEffect(() => {
    const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:5001';
    const eventSource = new EventSource(`${apiHost}/api/v1/sse/forge/leaderboard`);
    
    eventSource.onopen = () => {
      console.log('🔥 Forge Leaderboard SSE: Connected');
      setConnected(true);
    };
    
    // Listen for the specific forge_leaderboard_updated event
    eventSource.addEventListener('forge_leaderboard_updated', (event) => {
      try {
        console.log('🔥 Forge Leaderboard updated event received');
        const data = JSON.parse(event.data);
        setLastUpdate(new Date(data.timestamp));
      } catch (err) {
        console.error('🔥 Forge Leaderboard SSE: Failed to parse event', err);
      }
    });
    
    eventSource.onerror = (err) => {
      console.error('🔥 Forge Leaderboard SSE: Error', err);
      setConnected(false);
    };
    
    return () => {
      console.log('🔥 Forge Leaderboard SSE: Closing connection');
      eventSource.close();
    };
  }, []);
  
  return {
    connected,
    lastUpdate
  };
}