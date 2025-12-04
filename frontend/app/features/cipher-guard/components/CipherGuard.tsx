'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import OrchestratorConsole from '../../../../src/components/OrchestratorConsole';
import { invoke } from '@tauri-apps/api/tauri';

// Define return type for the orchestrator task
interface OrchestratorResult {
  response: string;
  warnings?: string[];
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
 * CipherGuard Component
 * 
 * Provides security and protection-related command interface
 * integrated with the OrchestratorAgent for intelligent security responses.
 */
export const CipherGuard: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [conscienceWarnings, setConscienceWarnings] = useState<string[]>([]);

  // Initialize with welcome message
  useEffect(() => {
    setMessages([
      {
        id: generateId(),
        content: "Cipher Guard active — conscience gate engaged",
        type: 'warning',
        timestamp: new Date().toISOString(),
      },
      {
        id: generateId(),
        content: "Security interface ready. Enter protection commands to analyze and mitigate threats.",
        type: 'response',
        timestamp: new Date().toISOString(),
      }
    ]);
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
      
      // Add response to messages
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          content: result.response || "Command processed successfully.",
          type: 'response',
          timestamp: new Date().toISOString(),
        }
      ]);

      // Check for warnings in the result
      if (result.warnings && result.warnings.length > 0) {
        setConscienceWarnings(result.warnings);
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
      <div className="flex items-center justify-between mb-4 p-4 bg-zinc-900 border-b border-red-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          <h1 className="text-xl font-semibold text-red-500">CIPHER GUARD</h1>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/30 border border-red-800 rounded-md">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-red-400">
            Cipher Guard active — conscience gate engaged
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
            conscienceGateActive={true}
            conscienceWarnings={conscienceWarnings}
            onSendCommand={handleSendCommand}
            className="h-full ember-border"
          />
        </div>
        
        {/* Right panel - Security status */}
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-md">
            <h3 className="text-sm font-semibold text-red-500 mb-3">Protection Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Memory Shield</span>
                <span className="text-xs text-green-500">Active</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Execution Guard</span>
                <span className="text-xs text-green-500">Active</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Constraint Engine</span>
                <span className="text-xs text-green-500">Active</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-md">
            <h3 className="text-sm font-semibold text-amber-500 mb-3">Conscience Gate</h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-xs text-amber-400">Active & Monitoring</span>
            </div>
            <p className="text-xs text-zinc-500">
              All commands are filtered through ethical guardrails and security constraints
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CipherGuard;