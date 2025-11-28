'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/lib/socket';

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isTyping: boolean;
}

export default function ChatWindow({ messages, onSendMessage, isTyping }: ChatWindowProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const conscienceBadgeColor = {
    reptilian: 'bg-[#B80000]/20 text-[#FF4500]',
    mammalian: 'bg-blue-500/20 text-blue-300',
    neocortex: 'bg-[#FFD700]/20 text-[#FFD700]',
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-[#FF4500]/20">
      {/* Chat Header */}
      <div className="p-4 border-b border-[#FF4500]/20">
        <h3 className="text-lg font-semibold fire-text">Chat with Phoenix Marie</h3>
        <p className="text-xs text-gray-400">Real-time conversation</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              No messages yet. Say hello to Phoenix Marie! 💜
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-[#007aff] text-white rounded-br-none'
                    : 'bg-gradient-to-r from-[#FFD700] via-[#FF4500] to-[#B80000] text-white rounded-bl-none'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className="text-xs opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {message.conscience && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        conscienceBadgeColor[message.conscience]
                      }`}
                    >
                      {message.conscience}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-[#FFD700] via-[#FF4500] to-[#B80000] text-white rounded-2xl rounded-bl-none px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[#FF4500]/20">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-[#16213e] text-white rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-[#FF4500] placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-gradient-to-r from-[#FFD700] to-[#FF4500] text-white rounded-full px-6 py-2 font-medium hover:from-[#FF4500] hover:to-[#B80000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}