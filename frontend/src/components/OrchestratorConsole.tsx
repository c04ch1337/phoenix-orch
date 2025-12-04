import React, { useState, useEffect, useRef } from 'react';
import { Terminal, AlertCircle, Zap } from 'lucide-react';
import clsx from 'clsx';
import '@/styles/emberGlow.css';

/**
 * OrchestratorConsole Component
 * 
 * A shared component used by both CipherGuard and EmberUnit to display
 * command outputs, streaming responses, and conscience warnings.
 */

interface Message {
  id: string;
  content: string;
  type: 'command' | 'response' | 'warning' | 'tool-output' | 'error';
  timestamp: string;
}

interface OrchestratorConsoleProps {
  messages: Message[];
  isThinking: boolean;
  isStreamingResponse?: boolean;
  conscienceGateActive?: boolean;
  conscienceWarnings?: string[];
  commandOverride?: {
    active: boolean;
    prefix: string;
  };
  onSendCommand: (command: string) => void;
  onToggleCommandOverride?: () => void;
  className?: string;
}

export const OrchestratorConsole: React.FC<OrchestratorConsoleProps> = ({
  messages,
  isThinking,
  isStreamingResponse = false,
  conscienceGateActive = false,
  conscienceWarnings = [],
  commandOverride = { active: false, prefix: '' },
  onSendCommand,
  onToggleCommandOverride,
  className
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle command submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    // Apply command override prefix if active
    const commandToSend = commandOverride.active 
      ? `${commandOverride.prefix} ${inputValue}`
      : inputValue;
      
    onSendCommand(commandToSend);
    setInputValue('');
  };

  return (
    <div 
      data-testid="orchestrator-console"
      className={clsx(
        "flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-300">
            Orchestrator Console
          </span>
        </div>
        
        {conscienceGateActive && (
          <div className="flex items-center gap-2 text-xs font-mono px-2 py-1 bg-zinc-800 rounded text-amber-400">
            <AlertCircle className="w-3 h-3" />
            Conscience Gate Active
          </div>
        )}
      </div>
      
      {/* Messages Area */}
      <div 
        className={clsx(
          "flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm",
          isStreamingResponse && "ember-glow"
        )}
        data-testid="response-panel"
      >
        {/* Conscience Warnings */}
        {conscienceWarnings.length > 0 && (
          <div className="mb-4 p-3 border border-amber-800 bg-amber-900/30 rounded-md">
            <div className="flex items-center gap-2 text-amber-400 font-medium mb-2">
              <AlertCircle className="w-4 h-4" />
              <span>Conscience Warning</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-amber-300 text-xs">
              {conscienceWarnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Messages */}
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={clsx(
              "px-3 py-2 rounded",
              {
                "bg-zinc-900 text-white": msg.type === 'command',
                "bg-zinc-900/50 border-l-2 border-l-[#F77F00] text-zinc-300": msg.type === 'response',
                "bg-red-900/20 border-l-2 border-l-red-500 text-red-400": msg.type === 'error',
                "text-amber-300 italic": msg.type === 'warning',
                "text-zinc-400 font-mono text-sm": msg.type === 'tool-output',
                
                // Ember glow effect on responses
                "ember-glow-text": msg.type === 'response' && isStreamingResponse
              }
            )}
          >
            {msg.type === 'command' && (
              <div className="flex items-center gap-2">
                <span className="text-[#F77F00] font-bold">{'>'}</span>
                <span>{msg.content}</span>
              </div>
            )}
            
            {msg.type === 'response' && (
              <div>
                {msg.content}
              </div>
            )}
            
            {msg.type === 'warning' && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                <span>{msg.content}</span>
              </div>
            )}
            
            {msg.type === 'error' && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                <span>{msg.content}</span>
              </div>
            )}
            
            {msg.type === 'tool-output' && (
              <div className="pl-4 border-l border-zinc-800">
                <span className="opacity-75">{msg.content}</span>
              </div>
            )}
          </div>
        ))}
        
        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex items-center gap-2 p-3 bg-zinc-900/50 rounded">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-[#F77F00] rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-[#F77F00] rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
              <div className="w-2 h-2 bg-[#F77F00] rounded-full animate-pulse" style={{ animationDelay: '600ms' }}></div>
            </div>
            <span className="text-zinc-400 text-sm">Thinking...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-3">
        <div className="flex gap-2 items-center">
          {/* Command Override Toggle Button (HITM Override) */}
          {onToggleCommandOverride && (
            <button
              type="button"
              onClick={onToggleCommandOverride}
              className={clsx(
                "px-2 py-1 rounded text-xs font-mono flex items-center gap-1",
                commandOverride.active 
                  ? "bg-amber-700/40 text-amber-300 border border-amber-700"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
              )}
              aria-label="HITM override"
            >
              <Zap className="w-3 h-3" />
              <span>{commandOverride.active ? "OVERRIDE ON" : "HITM override"}</span>
            </button>
          )}
          
          {/* Command Input */}
          <div className={clsx(
            "flex-1 flex items-center gap-2 rounded-md px-3 py-2", 
            "border border-zinc-800 bg-zinc-900/50 focus-within:border-zinc-600"
          )}>
            <span className="text-zinc-500">{'>'}</span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter command..."
              className="flex-1 bg-transparent border-none outline-none text-zinc-300"
              disabled={isThinking}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default OrchestratorConsole;