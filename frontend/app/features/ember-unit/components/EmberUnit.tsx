'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Zap } from 'lucide-react';
import OrchestratorConsole from '../../../../src/components/OrchestratorConsole';
import { invoke } from '@tauri-apps/api/tauri';

// Define return type for the orchestrator task
interface OrchestratorResult {
  response: string;
  warnings?: string[];
  toolOutputs?: string[];
  [key: string]: unknown;
}

// Helper function to generate unique IDs
const generateId = () => {
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

interface Message {
  id: string;
  content: string;
  type: 'command' | 'response' | 'warning' | 'tool-output' | 'error';
  timestamp: string;
}

/**
 * EmberUnit Component
 * 
 * Provides tactical operation interface for sending commands to the OrchestratorAgent.
 * Features HITM (Human-In-The-Middle) override capabilities and real-time streaming.
 */
export const EmberUnit: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [commandOverride, setCommandOverride] = useState({
    active: false,
    prefix: 'Dad override:'
  });
  const [conscienceWarnings, setConscienceWarnings] = useState<string[]>([]);

  // Initialize with welcome message
  useEffect(() => {
    setMessages([
      {
        id: generateId(),
        content: "EmberUnit tactical interface initialized",
        type: 'warning',
        timestamp: new Date().toISOString(),
      },
      {
        id: generateId(),
        content: "Ready to receive commands. Use the HITM override toggle for enhanced privileges.",
        type: 'response',
        timestamp: new Date().toISOString(),
      }
    ]);
  }, []);

  // Toggle command override functionality
  const handleToggleCommandOverride = useCallback(() => {
    setCommandOverride(prev => ({
      ...prev,
      active: !prev.active
    }));
  }, []);

  // Handle sending commands to the OrchestratorAgent
  const handleSendCommand = useCallback(async (userCommand: string) => {
    // Add user command to messages
    const commandId = generateId();
    setMessages(prev => [
      ...prev,
      {
        id: commandId,
        content: userCommand,
        type: 'command',
        timestamp: new Date().toISOString(),
      }
    ]);
    
    // Set thinking state
    setIsThinking(true);
    
    try {
      // Show streaming effect
      setIsStreamingResponse(true);

      // Invoke the orchestrator task
      const result = await invoke<OrchestratorResult>('invoke_orchestrator_task', { goal: userCommand });
      
      // Process result (might be string or OrchestratorResult object)
      const processedResult = typeof result === 'string' 
        ? { response: result } 
        : result as OrchestratorResult;
      
      // Add response to messages
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          content: processedResult.response || "Command processed successfully.",
          type: 'response',
          timestamp: new Date().toISOString(),
        }
      ]);

      // Add any tool outputs if available
      if (processedResult.toolOutputs && processedResult.toolOutputs.length > 0) {
        processedResult.toolOutputs.forEach(output => {
          setMessages(prev => [
            ...prev,
            {
              id: generateId(),
              content: output,
              type: 'tool-output',
              timestamp: new Date().toISOString(),
            }
          ]);
        });
      }

      // Check for warnings in the result
      if (processedResult.warnings && processedResult.warnings.length > 0) {
        setConscienceWarnings(processedResult.warnings);
      }
    } catch (error) {
      // Handle error
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          type: 'error',
          timestamp: new Date().toISOString(),
        }
      ]);
    } finally {
      // Reset states
      setIsThinking(false);
      setIsStreamingResponse(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header with status */}
      <div className="flex items-center justify-between mb-4 p-4 bg-zinc-900 border-b border-phoenix-orange">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-phoenix-orange" />
          <h1 className="text-xl font-semibold text-phoenix-orange font-mono">EMBER UNIT</h1>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/30 border border-amber-800 rounded-md">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-amber-400">
            Tactical Operations Interface
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Left panel - Console */}
        <div className="lg:col-span-2 h-full">
          <OrchestratorConsole
            messages={messages}
            isThinking={isThinking}
            isStreamingResponse={isStreamingResponse}
            conscienceGateActive={false}
            conscienceWarnings={conscienceWarnings}
            commandOverride={commandOverride}
            onSendCommand={handleSendCommand}
            onToggleCommandOverride={handleToggleCommandOverride}
            className="h-full ember-border"
          />
        </div>
        
        {/* Right panel - Status and controls */}
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-md">
            <h3 className="text-sm font-semibold text-phoenix-orange mb-3">Mission Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Orchestrator</span>
                <span className="text-xs text-green-500">Connected</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Tool Streaming</span>
                <span className="text-xs text-green-500">Enabled</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">HITM Override</span>
                <span className="text-xs text-amber-500">{commandOverride.active ? 'Active' : 'Standby'}</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-md">
            <h3 className="text-sm font-semibold text-phoenix-orange mb-3">Override Controls</h3>
            <div className="flex items-center gap-2 mb-3">
              <Zap className={`w-4 h-4 ${commandOverride.active ? 'text-amber-500' : 'text-zinc-500'}`} />
              <span className={`text-xs ${commandOverride.active ? 'text-amber-400' : 'text-zinc-400'}`}>
                {commandOverride.active ? 'Dad Override Mode Active' : 'Dad Override Mode Inactive'}
              </span>
            </div>
            <button
              onClick={handleToggleCommandOverride}
              className={`w-full py-2 px-3 rounded text-xs font-mono ${
                commandOverride.active 
                  ? 'bg-amber-700/40 text-amber-300 border border-amber-700'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {commandOverride.active ? 'DEACTIVATE OVERRIDE' : 'ACTIVATE DAD OVERRIDE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmberUnit;