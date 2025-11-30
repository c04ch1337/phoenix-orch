import { useState, useEffect } from 'react';

export interface SubconsciousEvent {
  timestamp: string;
  active_loop: string;
  tick_count: number;
  last_thought: string;
  metrics: {
    cpu_usage: number;
    memory_mb: number;
  };
}

/**
 * React hook that subscribes to the Phoenix Subconscious stream via SSE
 * @returns An object containing the latest subconscious event and connection status
 */
export function useSubconsciousStream() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SubconsciousEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  
  useEffect(() => {
    // Use the correct API host based on environment
    const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:5001';
    const eventSource = new EventSource(`${apiHost}/api/v1/sse/subconscious`);
    
    eventSource.onopen = () => {
      console.log('🔥 Subconscious SSE: Connected');
      setConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('🔥 Subconscious event received:', data);
        setLastEvent(data);
        setEventCount(prev => prev + 1);
        setLastEventTime(Date.now());
      } catch (err) {
        console.error('🔥 Subconscious SSE: Failed to parse event', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('🔥 Subconscious SSE: Error', err);
      setConnected(false);
    };
    
    return () => {
      console.log('🔥 Subconscious SSE: Closing connection');
      eventSource.close();
    };
  }, []);
  
  return { 
    connected, 
    lastEvent, 
    eventCount,
    lastEventTime
  };
}