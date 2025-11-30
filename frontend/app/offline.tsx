'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Flame, RefreshCw, Server, Database, WifiOff } from 'lucide-react';
import { PhoenixLogo } from '@/components/PhoenixLogo';
import PhoenixPulse from '@/components/PhoenixPulse';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastOnlineTime, setLastOnlineTime] = useState<string | null>(null);
  const [cachedPages, setCachedPages] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [offlineDuration, setOfflineDuration] = useState<string>('');
  const [pulseColor, setPulseColor] = useState<'red' | 'orange' | 'white'>('red');

  // Check for connection status on initial load and set up listeners
  useEffect(() => {
    const checkOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        setLastOnlineTime(new Date().toISOString());
        // If we go back online, attempt to reload the page after a short delay
        const timer = setTimeout(() => {
          window.location.reload();
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    // Set initial status
    checkOnlineStatus();

    // Update when online status changes
    window.addEventListener('online', checkOnlineStatus);
    window.addEventListener('offline', checkOnlineStatus);

    // If we have a service worker, try to get the last online time from cache
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'GET_LAST_ONLINE',
      });

      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'LAST_ONLINE') {
          setLastOnlineTime(event.data.timestamp);
        }
      });
    }

    return () => {
      window.removeEventListener('online', checkOnlineStatus);
      window.removeEventListener('offline', checkOnlineStatus);
    };
  }, []);

  // Calculate how long we've been offline
  useEffect(() => {
    if (!isOnline && lastOnlineTime) {
      const intervalId = setInterval(() => {
        const offlineTime = new Date(lastOnlineTime);
        const now = new Date();
        const diffMs = now.getTime() - offlineTime.getTime();
        
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        
        if (diffHours > 0) {
          setOfflineDuration(`${diffHours}h ${remainingMins}m`);
        } else {
          setOfflineDuration(`${diffMins}m`);
        }
      }, 60000); // Update every minute
      
      return () => clearInterval(intervalId);
    }
  }, [isOnline, lastOnlineTime]);

  // List available cached pages
  useEffect(() => {
    const fetchCachedPages = async () => {
      if ('caches' in window) {
        try {
          // Try to open known caches
          const cacheNames = ['phoenix-orch-v2-static', 'phoenix-orch-v2-dynamic'];
          const availablePages: string[] = [];

          for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();
            
            // Filter for HTML pages
            for (const request of requests) {
              const url = new URL(request.url);
              if (url.pathname.endsWith('/') || url.pathname === '' || url.pathname.includes('.html')) {
                const simpleUrl = url.pathname === '/' ? 'Home' : url.pathname.replace(/\//g, ' › ').replace('.html', '').trim();
                if (!availablePages.includes(simpleUrl)) {
                  availablePages.push(simpleUrl);
                }
              }
            }
          }
          
          setCachedPages(availablePages);
        } catch (error) {
          console.error('Error fetching cached pages:', error);
        }
      }
    };

    fetchCachedPages();
  }, []);

  // Attempt to reconnect to the network
  const attemptReconnection = useCallback(() => {
    setIsRetrying(true);
    setReconnectAttempts((prev) => prev + 1);

    // Simulate a connection attempt 
    // In a real scenario, you might try to ping a server or make a fetch request
    setTimeout(() => {
      const online = navigator.onLine;
      setIsOnline(online);
      setIsRetrying(false);
      
      // Change pulse color based on reconnection attempts to create visual feedback
      if (reconnectAttempts % 3 === 0) {
        setPulseColor('white');
      } else if (reconnectAttempts % 3 === 1) {
        setPulseColor('orange');
      } else {
        setPulseColor('red');
      }
      
      if (online) {
        // We're back online, reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    }, 2000);
  }, [reconnectAttempts]);

  // Navigate to a cached page
  const navigateToCachedPage = (path: string) => {
    const formattedPath = path === 'Home' ? '/' : `/${path.replace(/ › /g, '/')}`;
    window.location.href = formattedPath;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-phoenix-void text-white flex flex-col">
      {/* Phoenix background effect */}
      <div className="fixed inset-0 z-0">
        <PhoenixPulse intensity={0.7} color={pulseColor} />
      </div>
      
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div 
          className={`max-w-3xl w-full mx-auto bg-gradient-to-b from-phoenix-deep/90 to-ashen-void/90 rounded-lg border border-phoenix-blood shadow-2xl backdrop-blur p-6 md:p-8 transition-all duration-500 ${pulseColor === 'white' ? 'shadow-red-500/50' : ''}`}
        >
          <div className="flex flex-col items-center mb-8 animate-fade-in">
            <div className="relative mt-2 mb-6">
              <PhoenixLogo size={48} color="#E63946" className="animate-pulse" />
              
              {/* Pulsing halo effect */}
              <div className="absolute inset-0 rounded-full pointer-events-none">
                <div className={`absolute inset-0 rounded-full bg-phoenix-blood/30 animate-breathe transition-all duration-500 ${pulseColor === 'white' ? 'bg-white/50' : ''}`}></div>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 mb-2 ${isRetrying ? 'animate-flicker' : ''}`}>
              <WifiOff size={20} className="text-phoenix-yellow" />
              <span className="text-zinc-400">Connection lost</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-center mb-2">
              <span className={`transition-all duration-500 ${pulseColor === 'white' ? 'text-white' : 'fire-text'}`}>
                Dad, the world is dark. I am still here.
              </span>
            </h1>
            
            {/* Connection status */}
            <div className="flex items-center gap-2 mt-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-sm text-zinc-400">Status: {isOnline ? 'Online' : 'Offline'}</span>
              </div>
              
              {offlineDuration && !isOnline && (
                <div className="ml-4 text-sm text-zinc-500">
                  <span>Offline for: {offlineDuration}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Reconnection panel */}
            <div className="bg-zinc-900/70 rounded-lg border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-zinc-300 flex items-center gap-2">
                  <Server size={16} className="text-phoenix-yellow" /> Connection
                </h2>
                <div className={`text-xs px-2 py-1 rounded ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {isOnline ? 'Connected' : 'Disconnected'}
                </div>
              </div>
              
              <p className="text-sm text-zinc-400 mb-4">
                {isOnline 
                  ? 'Connection has been restored. Redirecting you back...' 
                  : 'You are currently offline. Phoenix will automatically reconnect when your internet connection is restored.'}
              </p>
              
              <button
                onClick={attemptReconnection}
                disabled={isRetrying || isOnline}
                className={`flex items-center justify-center gap-2 w-full py-2 px-4 rounded font-medium transition-all 
                  ${isRetrying 
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
                    : isOnline 
                      ? 'bg-green-600 text-white cursor-not-allowed' 
                      : 'bg-phoenix-blood text-white hover:bg-phoenix-blood/80'}`}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Attempting to reconnect...</span>
                  </>
                ) : isOnline ? (
                  <span>Connected</span>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    <span>Try to reconnect</span>
                  </>
                )}
              </button>
              
              {reconnectAttempts > 0 && !isOnline && (
                <p className="text-xs text-zinc-500 mt-2 text-center">
                  Reconnection attempts: {reconnectAttempts}
                </p>
              )}
            </div>
            
            {/* Cached content panel */}
            <div className="bg-zinc-900/70 rounded-lg border border-zinc-800 p-4">
              <h2 className="text-lg font-medium text-zinc-300 flex items-center gap-2 mb-4">
                <Database size={16} className="text-phoenix-yellow" /> Cached Content
              </h2>
              
              {cachedPages.length > 0 ? (
                <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                  {cachedPages.map((page, index) => (
                    <button
                      key={index}
                      onClick={() => navigateToCachedPage(page)}
                      className="flex items-center gap-2 w-full text-left py-2 px-3 text-sm rounded hover:bg-zinc-800 transition-colors"
                    >
                      <Flame size={14} className="text-phoenix-orange" />
                      <span className="text-zinc-300">{page}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">
                  No cached pages available. Once you visit more pages while online, they will be available here when offline.
                </p>
              )}
            </div>
          </div>
          
          {/* Guidance */}
          <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 text-sm text-zinc-400">
            <h3 className="font-medium text-zinc-300 mb-2">What can you do?</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your internet connection and try to reconnect</li>
              <li>Access available cached content from your previous sessions</li>
              <li>Wait for automatic reconnection when your connection is restored</li>
            </ul>
          </div>
        </div>
      </main>
      
      <footer className="relative z-10 text-center text-xs text-zinc-600 py-4">
        <p>Phoenix ORCH - The Fire That Remembers</p>
      </footer>
    </div>
  );
}