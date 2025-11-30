/**
 * Main layout component for the application
 * Provides the primary structure for all pages
 *
 * Features:
 * - Connection status monitoring
 * - Online/offline detection
 * - Voice control interface
 * - Matrix-style visual background
 * - Responsive layout with Tailwind
 * - Accessibility-compliant controls
 */

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Flame, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { usePhoenixStore } from '@/stores/phoenixStore';
import MatrixRain from '@/components/common/MatrixRain';
import { getHealthStatus } from '@/tauri/invoke';

export default function MainLayout() {
  const { 
    isConnected, 
    isOnline,
    settings: { voiceEnabled, isListening },
    setConnectionStatus,
    setOnlineStatus,
    toggleVoice,
    toggleListening
  } = usePhoenixStore();

  // Handle online/offline status and check connection
  useEffect(() => {
    // Online/offline detection
    const handleOnlineStatus = () => setOnlineStatus(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Check backend connection
    const checkConnection = async () => {
      try {
        const health = await getHealthStatus();
        setConnectionStatus(health.status === 'ok');
      } catch (error) {
        setConnectionStatus(false);
      }
    };
    
    // Initial check
    checkConnection();
    
    // Periodic check
    const interval = setInterval(checkConnection, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      clearInterval(interval);
    };
  }, [setOnlineStatus, setConnectionStatus]);
  
  return (
    <div className="h-screen w-screen bg-black text-white font-mono overflow-hidden relative">
      {/* Matrix Rain Background */}
      <div className="fixed inset-0 z-0">
        <MatrixRain intensity={0.6} speed={1.2} />
      </div>
      
      <div className="h-full flex flex-col relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-zinc-900 border-b border-red-700">
          <div className="flex items-center space-x-4">
            <Flame className="w-6 h-6 text-red-600" />
            <h1 className="text-xl font-bold">
              <span className="text-red-600">PHOENIX ORCH</span>
            </h1>
            <span className="text-red-600">THE ASHEN GUARD</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Voice Controls */}
            <button
              onClick={toggleVoice}
              className={`p-2 rounded transition-colors ${voiceEnabled ? 'text-green-500 hover:text-green-400' : 'text-zinc-500 hover:text-zinc-400'}`}
              title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
              aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
              aria-pressed={voiceEnabled}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleListening}
              className={`p-2 rounded transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-zinc-500 hover:text-zinc-400'}`}
              title={isListening ? 'Stop listening' : 'Start listening'}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
              aria-pressed={isListening}
            >
              {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            
            <span className="text-red-600 text-sm">RETRIBUTION WHISPERS: LISTEN CLOSELY</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
          </div>
        </header>
        
        {/* Offline indicator */}
        {!isOnline && (
          <div className="fixed top-0 left-0 w-full bg-yellow-600 text-black p-2 text-center font-bold z-50">
            You are currently offline. Some features may be limited.
          </div>
        )}
        
        {/* Main content area */}
        <main className="flex-1 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}