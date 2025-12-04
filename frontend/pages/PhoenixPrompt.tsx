'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';

// Define the message interface
interface Message {
  id: string;
  type: 'user' | 'phoenix';
  content: string;
  timestamp: number;
}

// Define the response interface
interface OrchestratorResponse {
  success: boolean;
  response: string;
}

export function PhoenixPrompt() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Create a placeholder message for streaming updates
      const phoenixMessageId = (Date.now() + 1).toString();
      const phoenixMessage: Message = {
        id: phoenixMessageId,
        type: 'phoenix',
        content: '',  // Initially empty, will be updated with streaming content
        timestamp: Date.now() + 1
      };
      
      // Add the empty phoenix message to the chat
      setMessages((prev) => [...prev, phoenixMessage]);
      
      // Send message to OrchestratorAgent using Tauri's invoke
      const response = await invoke<OrchestratorResponse>('invoke_orchestrator_task', {
        goal: userMessage.content
      });
      
      if (response && response.success) {
        // Update the phoenix message with the response
        setMessages((prev) => 
          prev.map(msg => 
            msg.id === phoenixMessageId 
              ? { ...msg, content: response.response } 
              : msg
          )
        );
      } else {
        setError('Failed to get a response from Phoenix.');
        // Remove the placeholder message
        setMessages((prev) => prev.filter(msg => msg.id !== phoenixMessageId));
      }
    } catch (err) {
      setError(`An error occurred: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format timestamp for messages
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="flex flex-col h-full bg-black/50 text-white relative">
      {/* Messages Container */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar relative z-10">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-zinc-800 border border-zinc-700 text-white'
                    : 'bg-red-900/30 border border-red-700 text-red-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {message.type === 'phoenix' && (
                    <span className="text-red-500 text-xs font-bold">🔥 PHOENIX</span>
                  )}
                  {message.type === 'user' && (
                    <span className="text-zinc-400 text-xs font-bold">USER</span>
                  )}
                  <span className="text-zinc-500 text-xs">{formatTime(message.timestamp)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.content || '...'}</p>
              </div>
            </div>
          ))}
          
          {/* Phoenix Thinking Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-red-500 text-xs font-bold">🔥 PHOENIX</span>
                  <span className="text-sm">is thinking...</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="flex justify-start">
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-500 text-xs font-bold">ERROR</span>
                </div>
                <p className="text-sm text-red-200">{error}</p>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-4 border-t border-red-700 relative z-10 bg-black/60 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex items-center gap-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder="Type your message..."
            className={`flex-1 bg-transparent border text-white px-4 py-2 rounded focus:outline-none placeholder-zinc-600 transition-all duration-300 ${
              inputValue.trim() 
                ? 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' 
                : 'border-red-700 focus:border-red-500'
            } ${isLoading ? 'opacity-50' : ''}`}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="bg-red-700 text-white p-2 rounded hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}