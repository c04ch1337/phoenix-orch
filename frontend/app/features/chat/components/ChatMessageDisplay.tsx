'use client';

import React from 'react';

// Define the ChatMessage interface directly to avoid import issues
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'phoenix';
  content: string;
  timestamp: number;
}

interface ChatMessageDisplayProps {
  message: ChatMessage;
}

export default function ChatMessageDisplay({ message }: ChatMessageDisplayProps) {
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getMessageStyles = () => {
    switch (message.type) {
      case 'phoenix':
        return 'border-[#E63946] bg-[#E63946]/10 text-[#E63946]';
      case 'system':
        return 'border-zinc-700 bg-zinc-900/50 text-zinc-400';
      case 'user':
      default:
        return 'border-zinc-800 bg-zinc-950/50 text-zinc-300';
    }
  };

  return (
    <div className={`text-center italic border p-4 max-w-md mx-auto my-2 rounded ${getMessageStyles()}`}>
      <p className="text-sm leading-relaxed">{message.content}</p>
      <p className="text-xs mt-2 opacity-70">{formatTimestamp(message.timestamp)}</p>
    </div>
  );
}