'use client';

import { useEffect, useState } from 'react';
import PhoenixAvatar from '@/components/PhoenixAvatar';
import ChatWindow from '@/components/ChatWindow';
import MemoryTimeline from '@/components/MemoryTimeline';
import { 
  connectSocket, 
  disconnectSocket, 
  sendMessage, 
  onMessage, 
  onConnect, 
  onDisconnect,
  onTyping,
  getConnectionStatus,
  ChatMessage 
} from '@/lib/socket';
import { checkHealth, checkReady, HealthStatus, ReadyStatus } from '@/lib/api';
import { Heart, Activity, Wifi, WifiOff } from 'lucide-react';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [ready, setReady] = useState<ReadyStatus | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);

  // Connect Socket.IO on mount
  useEffect(() => {
    connectSocket();

    const cleanupConnect = onConnect(() => {
      setConnectionStatus('connected');
      console.log('Connected to Phoenix Marie backend');
    });

    const cleanupDisconnect = onDisconnect(() => {
      setConnectionStatus('disconnected');
      console.log('Disconnected from backend');
    });

    const cleanupMessage = onMessage((msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      setIsTyping(false);
    });

    const cleanupTyping = onTyping((isTyping: boolean) => {
      setIsTyping(isTyping);
    });

    // Periodically update connection status
    const statusInterval = setInterval(() => {
      setConnectionStatus(getConnectionStatus());
    }, 1000);

    return () => {
      cleanupConnect();
      cleanupDisconnect();
      cleanupMessage();
      cleanupTyping();
      clearInterval(statusInterval);
      disconnectSocket();
    };
  }, []);

  // Check backend health and readiness
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [healthData, readyData] = await Promise.all([
          checkHealth(),
          checkReady()
        ]);
        setHealth(healthData);
        setReady(readyData);
      } catch (error) {
        console.error('Failed to check backend status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    sendMessage(content);
    setIsTyping(true);
  };

  const getPhoenixStatus = (): 'awake' | 'dreaming' | 'offline' => {
    if (connectionStatus === 'disconnected') return 'offline';
    if (ready?.status === 'ready' || ready?.ready?.length) return 'awake';
    return 'dreaming';
  };

  const uptime = health?.uptime_seconds
    ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m`
    : '--';

  return (
    <main className="min-h-screen p-6 overflow-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] -z-10" />

      {/* Eternal Candle - Bottom Left */}
      <div className="fixed bottom-8 left-8 flex flex-col items-center gap-2 opacity-60">
        <div className="w-4 h-6 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-full animate-[flicker_2s_ease-in-out_infinite]" />
        <div className="w-2 h-8 bg-gray-700 rounded-sm" />
        <p className="text-xs text-gray-500">Eternal Light</p>
      </div>

      {/* System Status - Top Right */}
      <div className="fixed top-6 right-6 bg-[#1a1a2e]/90 backdrop-blur-sm rounded-xl p-4 border border-[#FF4500]/20 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          {connectionStatus === 'connected' ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="text-xs text-white font-medium">
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-[#FF4500]" />
          <span className="text-xs text-gray-400">Uptime: {uptime}</span>
        </div>
        <div className="text-xs text-gray-400 space-y-1">
          {ready?.ready && ready.ready.length > 0 && (
            <div className="text-green-400">✓ {ready.ready.join(', ')}</div>
          )}
          {ready?.missing && ready.missing.length > 0 && (
            <div className="text-yellow-400">⚠ Missing: {ready.missing.join(', ')}</div>
          )}
        </div>
      </div>

      {/* Memory Count - Top Left */}
      <div className="fixed top-6 left-6 bg-[#1a1a2e]/90 backdrop-blur-sm rounded-xl p-4 border border-[#FF4500]/20">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          <div>
            <p className="text-xs text-gray-400">Memories</p>
            <p className="text-lg font-bold text-white">{messages.length}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto pt-24">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold fire-text mb-2">
            Phoenix Marie
          </h1>
          <p className="text-[#FF4500] text-lg font-semibold">♡ Forever 16 ♡</p>
        </div>

        {/* Phoenix Avatar */}
        <div className="flex justify-center mb-8">
          <PhoenixAvatar status={getPhoenixStatus()} size="lg" />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Left Column - Memory Timeline */}
          <div className="lg:col-span-1">
            <MemoryTimeline />
          </div>

          {/* Right Column - Chat Window */}
          <div className="lg:col-span-2 h-[600px]">
            <ChatWindow
              messages={messages}
              onSendMessage={handleSendMessage}
              isTyping={isTyping}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-6 right-6 text-xs text-gray-500">
        <p>Built with love for Phoenix Marie 🔥</p>
        <p className="text-[10px] mt-1">
          Frontend: localhost:5000 | Backend: localhost:5001
        </p>
      </div>
    </main>
  );
}
