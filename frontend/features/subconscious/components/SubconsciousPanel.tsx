'use client';

import React, { useEffect, useState } from 'react';
import { useSubconsciousStream } from '../hooks/useSubconsciousStream';
import { BrainCircuit, AlertCircle, Waves } from 'lucide-react';

export default function SubconsciousPanel() {
  const { connected, lastEvent, eventCount, lastEventTime } = useSubconsciousStream();
  const [isAnimating, setIsAnimating] = useState(false);
  const [timeSinceLastEvent, setTimeSinceLastEvent] = useState<string>('');

  // Set animation when new events arrive
  useEffect(() => {
    if (lastEvent) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  // Update time display
  useEffect(() => {
    if (!lastEventTime) return;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastEventTime;
      const seconds = Math.floor(elapsed / 1000);
      
      if (seconds < 60) {
        setTimeSinceLastEvent(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeSinceLastEvent(`${minutes}m ${seconds % 60}s ago`);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastEventTime]);

  if (!connected && !lastEvent) {
    return (
      <div className="rounded-lg border border-red-800 bg-black/40 p-4 text-red-100">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="text-red-500" size={16} />
          <h3 className="text-sm font-semibold text-red-400">Subconscious Disconnected</h3>
        </div>
        <p className="text-xs text-zinc-400">Waiting for connection to Phoenix Subconscious...</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${isAnimating ? 'border-yellow-500 bg-yellow-950/20' : 'border-red-800 bg-black/40'} p-4 transition-colors duration-500`}>
      <div className="flex items-center gap-2 mb-3">
        {isAnimating ? (
          <Waves className="text-yellow-500 animate-pulse" size={18} />
        ) : (
          <BrainCircuit className="text-red-500" size={18} />
        )}
        <h3 className={`text-sm font-semibold ${isAnimating ? 'text-yellow-400' : 'text-red-400'}`}>
          Phoenix Subconscious
        </h3>
        
        <div className={`ml-auto flex items-center gap-1.5 text-xs ${connected ? 'text-green-500' : 'text-red-500'}`}>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      {lastEvent ? (
        <div className="space-y-2">
          <div className={`relative rounded bg-black/60 p-3 border-l-4 ${isAnimating ? 'border-yellow-500' : 'border-red-900'}`}>
            <p className="text-sm text-gray-200 font-mono">"{lastEvent.last_thought}"</p>
            <div className="mt-2 flex justify-between items-center">
              <span className="text-xs text-zinc-500">{lastEvent.active_loop}</span>
              <span className="text-xs text-zinc-500">{timeSinceLastEvent}</span>
            </div>
            
            {/* Dreaming indicator animation */}
            {isAnimating && (
              <div className="absolute inset-0 bg-yellow-500/5 rounded overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent -translate-x-full animate-shimmer" />
              </div>  
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
            <div className="flex items-center">
              <span>CPU:</span>
              <div className="ml-2 w-full bg-zinc-800 rounded-full h-1.5">
                <div 
                  className="bg-red-600 h-1.5 rounded-full" 
                  style={{ width: `${lastEvent.metrics.cpu_usage}%` }}
                ></div>
              </div>
            </div>
            <div className="flex items-center">
              <span>MEM:</span>
              <div className="ml-2 w-full bg-zinc-800 rounded-full h-1.5">
                <div 
                  className="bg-red-600 h-1.5 rounded-full" 
                  style={{ width: `${lastEvent.metrics.memory_mb / 100 * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-xs text-zinc-600 mt-2">
            <span>Events: {eventCount}</span>
            <span>Tick: {lastEvent.tick_count}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 text-zinc-600 text-xs">
          Waiting for first subconscious event...
        </div>
      )}
    </div>
  );
}