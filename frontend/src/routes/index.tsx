/**
 * Home Route - Main application view
 * Pure React + TypeScript implementation with Tailwind styling
 * No inline styles, uses Zustand for state management
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhoenixStore, ChatMessage } from '../stores/phoenixStore';
import { sendChatMessage, ignitePhoenix } from '../tauri/invoke';

/**
 * Splash page component shown before initialization
 * Displays the main title and ignite button
 */
const SplashPage = ({ onIgnite }: { onIgnite: () => Promise<void> }) => (
  <div className="flex flex-col items-center justify-center h-screen">
    <h1 className="text-4xl text-red-600 mb-8">PHOENIX ORCH</h1>
    <div className="text-xl text-zinc-400 mb-12">THE ASHEN GUARD</div>
    <button
      className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition-colors"
      onClick={onIgnite}
      aria-label="Ignite Phoenix"
    >
      IGNITE
    </button>

    {/* Accessibility description for screen readers */}
    <div className="sr-only">
      This is the initialization page for Phoenix ORCH. Press Ignite to activate the system.
    </div>
  </div>
);

export default function HomeRoute() {
  // Initialization state
  const [ignited, setIgnited] = useState(false);
  const [isIgniting, setIsIgniting] = useState(false);
  const navigate = useNavigate();
  
  // Use Zustand store for application state (including chat)
  const { 
    isConnected, 
    agent, 
    chat,
    setAgentStatus, 
    setConscienceLevel,
    addMessage,
    setIsTyping,
    setInputValue
  } = usePhoenixStore();
  
  // Handle ignite action
  const handleIgnite = useCallback(async () => {
    setIsIgniting(true);
    
    try {
      // Awaken the agent via Tauri
      const result = await ignitePhoenix();
      
      // Update agent status in store with actual backend values
      setAgentStatus('active');
      setConscienceLevel(result.conscience_level);
      
      // Set ignited state immediately after successful ignition
      setIgnited(true);
    } catch (error) {
      console.error('Failed to awaken agent:', error);
      setIsIgniting(false);
      // Show error to user
      addMessage({
        id: `error-${Date.now()}`,
        type: 'phoenix',
        content: `Ignition failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      });
    }
  }, [setAgentStatus, setConscienceLevel, addMessage]);
  
  // Ref for retry function to avoid stale closures
  const sendMessageWithRetry = useRef<((content: string, retryCount: number) => Promise<void>) | null>(null);
  
  // Handle message sending with error recovery
  const handleSendMessage = useCallback(async (content: string, retryCount = 0) => {
    if (!content.trim()) return;
    
    // Create user message (only on first attempt)
    if (retryCount === 0) {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}-${Math.random()}`,
        type: 'user',
        content: content.trim(),
        timestamp: Date.now()
      };
      
      // Add to messages
      addMessage(userMessage);
      
      // Clear input
      setInputValue('');
    }
    
    // Send to backend via Tauri with retry logic
    setIsTyping(true);
    try {
      const userId = localStorage.getItem('phoenix_user_id') || 'anonymous';
      const result = await sendChatMessage({
        message: content.trim(),
        user_id: userId,
        context: undefined
      });
      
      if (result.response) {
        addMessage({
          id: `phoenix-${Date.now()}`,
          type: 'phoenix',
          content: result.response,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('🔥 Failed to send message:', error);
      
      // Retry logic: up to 2 retries with exponential backoff
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        addMessage({
          id: `retry-${Date.now()}`,
          type: 'phoenix',
          content: `Connection issue detected. Retrying... (attempt ${retryCount + 1}/2)`,
          timestamp: Date.now()
        });
        
        // Use ref to avoid stale closure
        setTimeout(() => {
          if (sendMessageWithRetry.current) {
            sendMessageWithRetry.current(content, retryCount + 1);
          }
        }, delay);
      } else {
        // Final failure after retries
        addMessage({
          id: `error-${Date.now()}`,
          type: 'phoenix',
          content: 'Error: Not connected to Phoenix backend. Please check your connection and try again.',
          timestamp: Date.now()
        });
      }
    } finally {
      setIsTyping(false);
    }
  }, [addMessage, setIsTyping, setInputValue]);
  
  // Update ref with current function
  sendMessageWithRetry.current = handleSendMessage;

  // If not ignited, show splash screen
  if (!ignited) {
    return <SplashPage onIgnite={handleIgnite} />;
  }
  
  // Main application view
  return (
    <div className="h-full grid grid-cols-[280px_1fr_280px] overflow-hidden">
      {/* Left Sidebar - Placeholder */}
      <aside className="bg-zinc-900 border-r border-red-700 overflow-y-auto custom-scrollbar" role="complementary" aria-label="Communication logs">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-400 tracking-wider">COMMUNICATION LOGS</h2>
            <span className="text-xs text-green-500">○ SECURE</span>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">Log entries will appear here</p>
          </div>
        </div>
      </aside>

      {/* Chat Window - Main Content */}
      <main className="bg-transparent overflow-hidden flex flex-col" role="main" aria-label="Chat interface">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {chat.messages.map((message) => (
            <div 
              key={message.id} 
              className={`mb-4 p-3 rounded ${
                message.type === 'phoenix' 
                  ? 'bg-zinc-800/50 border border-red-700/40' 
                  : 'bg-zinc-900/50 border border-zinc-700'
              }`}
            >
              <div className="flex justify-between mb-1">
                <span className={`text-xs font-bold ${
                  message.type === 'phoenix' ? 'text-red-500' : 'text-blue-400'
                }`}>
                  {message.type === 'phoenix' ? 'PHOENIX' : 'USER'}
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}
          
          {chat.isTyping && (
            <div
              className="flex items-center space-x-2 text-zinc-400"
              role="status"
              aria-label="Phoenix is typing"
            >
              <span>PHOENIX is typing</span>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true"></span>
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse delay-300" aria-hidden="true"></span>
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse delay-600" aria-hidden="true"></span>
              </div>
            </div>
          )}
        </div>
        
        {/* Input area */}
        <div className="border-t border-zinc-800 p-4 bg-zinc-900/70">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(chat.inputValue);
            }}
            className="flex space-x-2"
          >
            <input
              type="text"
              value={chat.inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter message..."
              className="flex-1 bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
            <button
              type="submit"
              disabled={!chat.inputValue.trim() || chat.isTyping}
              className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:bg-zinc-700"
              aria-label="Send message"
            >
              Send
            </button>
          </form>
        </div>
      </main>

      {/* Right Sidebar - Placeholder */}
      <aside className="bg-zinc-900 border-l border-red-700 overflow-y-auto custom-scrollbar" role="complementary" aria-label="System status panel">
        <div className="p-4">
          <h2 className="text-xs font-semibold text-zinc-400 tracking-wider mb-4">SYSTEM STATUS</h2>
          
          <div className="mb-4 p-2 border border-zinc-800 rounded">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">CONNECTION</span>
              <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          
          <div className="mb-4 p-2 border border-zinc-800 rounded">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">AGENT STATUS</span>
              <span className="uppercase text-red-500">{agent.status}</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-zinc-500">CONSCIENCE</span>
              <span className="text-red-600">{agent.conscienceLevel}%</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}