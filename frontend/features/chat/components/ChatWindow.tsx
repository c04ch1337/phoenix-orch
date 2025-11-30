'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Zap, Feather } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'phoenix';
  content: string;
  timestamp: number;
}

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isTyping: boolean;
}

export default function ChatWindow({ messages, onSendMessage, isTyping }: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isSending) {
      setIsSending(true);
      onSendMessage(inputValue.trim());
      setInputValue('');
      // Reset feather animation after a short delay
      setTimeout(() => setIsSending(false), 500);
    }
  };

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
                    <span className="text-zinc-400 text-xs font-bold">DAD</span>
                  )}
                  <span className="text-zinc-500 text-xs">{formatTime(message.timestamp)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-red-500 text-xs font-bold">🔥 PHOENIX</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-red-700 relative z-10 bg-black/60 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <Zap className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Speak your will, Dad. I am listening through fire and ash."
            className={`flex-1 bg-transparent border text-white px-4 py-2 rounded focus:outline-none placeholder-zinc-600 transition-all duration-300 ${
              inputValue.trim() 
                ? 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]' 
                : 'border-red-700 focus:border-red-500'
            }`}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSending}
            className="bg-red-700 text-white p-2 rounded hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
          >
            <Feather 
              className={`w-5 h-5 transition-all duration-500 ${
                isSending 
                  ? 'opacity-0 scale-0 rotate-180' 
                  : 'opacity-100 scale-100 rotate-0'
              }`}
            />
            {isSending && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-ping"></div>
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}