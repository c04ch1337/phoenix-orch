'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Flame, Send, XCircle, Maximize2, Minimize2, Search, Book } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';
import { EmotionOrb } from './EmotionOrb';

interface OrchestratorResponse {
  result: string;
  status: 'success' | 'error' | 'in_progress';
}

export const UniversalOrchestratorBar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Array<{input: string, output: string, status: string, type?: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedResult, setCurrentStreamedResult] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom of results when they update
  useEffect(() => {
    if (resultsContainerRef.current) {
      resultsContainerRef.current.scrollTop = resultsContainerRef.current.scrollHeight;
    }
  }, [results, currentStreamedResult]);
  
  // Focus input when console opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  // Global keydown event listener for Ctrl+` shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+` (backtick)
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      // Allow Escape key to close the console when open
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    // Add user input to results
    setResults(prev => [...prev, { 
      input, 
      output: '', 
      status: 'in_progress' 
    }]);
    
    setIsProcessing(true);
    setIsStreaming(true);
    setCurrentStreamedResult('');
    
    const goal = input.trim();
    setInput('');
    
    try {
      // In a real streaming scenario, you would connect to a WebSocket or SSE
      // For this implementation, we'll directly use the Tauri invoke function
      const response = await invoke<OrchestratorResponse>('invoke_orchestrator_task', { goal });
      
      // Check if this is a Knowledge Base search (based on command text)
      const isKnowledgeBaseSearch = goal.toLowerCase().includes('search my') ||
                                  goal.toLowerCase().includes('find in my') ||
                                  goal.toLowerCase().includes('lookup in');
      
      // Simulate streaming by gradually adding characters
      const result = response.result;
      const chunkSize = 3; // Characters per chunk
      let currentPosition = 0;
      
      const streamResult = () => {
        if (currentPosition < result.length) {
          const chunk = result.substring(currentPosition, currentPosition + chunkSize);
          setCurrentStreamedResult(prev => prev + chunk);
          currentPosition += chunkSize;
          setTimeout(streamResult, 10); // Adjust timing as needed
        } else {
          setIsStreaming(false);
          setResults(prev => {
            const updatedResults = [...prev];
            updatedResults[updatedResults.length - 1] = {
              input: goal,
              output: result,
              status: response.status,
              // Tag knowledge base searches for custom rendering
              type: isKnowledgeBaseSearch ? 'kb_search' : undefined
            };
            return updatedResults;
          });
          setCurrentStreamedResult('');
          setIsProcessing(false);
        }
      };
      
      streamResult();
    } catch (error) {
      console.error('🔥 Failed to execute orchestrator task:', error);
      setIsStreaming(false);
      setResults(prev => {
        const updatedResults = [...prev];
        updatedResults[updatedResults.length - 1] = {
          input: goal,
          output: `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
          status: 'error'
        };
        return updatedResults;
      });
      setCurrentStreamedResult('');
      setIsProcessing(false);
    }
  };
  
  return (
    <>
      {/* Always-visible bottom bar */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[#E63946] text-white transition-all duration-300 ease-in-out ${
          isOpen ? 'h-screen' : 'h-12'
        }`}
        style={{ 
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2)',
          display: 'flex', 
          flexDirection: 'column'
        }}
      >
        {/* Bar header */}
        <div 
          className={`flex items-center justify-between px-4 h-12 cursor-pointer ${
            isOpen ? 'border-b border-white/20' : ''
          }`}
          onClick={() => !isProcessing && setIsOpen(prev => !prev)}
        >
          <div className="flex items-center space-x-2">
            <Flame className="h-5 w-5" />
            <span className="font-bold">PHOENIX ORCHESTRATOR</span>
            <div className="ml-4 flex items-center space-x-2">
              {/* Simplified conscience indicator instead of full ConscienceGauge */}
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs opacity-80">CONSCIENCE ACTIVE</span>
              </div>
              
              {/* Emotion orb component */}
              <div className="flex items-center space-x-1 ml-4">
                <EmotionOrb />
                <span className="text-xs opacity-80">EMOTION MONITOR</span>
              </div>
            </div>
          </div>
          
          <div>
            {isOpen ? (
              <Minimize2 
                className="h-5 w-5 hover:text-gray-200" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              />
            ) : (
              <Maximize2 
                className="h-5 w-5 hover:text-gray-200" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                }}
              />
            )}
          </div>
        </div>
        
        {/* Console content - only shown when open */}
        {isOpen && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Results area */}
            <div 
              ref={resultsContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-black/80 font-mono text-sm"
              style={{ maxHeight: 'calc(100vh - 12rem)' }}
            >
              {results.length === 0 ? (
                <div className="text-center text-white/50 mt-10">
                  <p>Enter a goal for the orchestrator.</p>
                  <p className="text-xs mt-2">Type your request and press Enter.</p>
                </div>
              ) : (
                <>
                  {results.map((item, index) => (
                    <div key={index} className="mb-4">
                      <div className="flex items-start mb-2">
                        <div className="flex-shrink-0 mr-2">
                          <div className="w-6 h-6 rounded-full bg-[#E63946] flex items-center justify-center">
                            <span className="text-xs">U</span>
                          </div>
                        </div>
                        <div className="bg-gray-800 rounded px-3 py-2 text-white inline-block">
                          {item.input}
                        </div>
                      </div>
                      
                      <div className="flex items-start pl-8">
                        <div className="flex-shrink-0 mr-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                            <Flame className="w-3 h-3" />
                          </div>
                        </div>
                        <div
                          className={`rounded px-3 py-2 text-white inline-block ${
                            item.status === 'error' ? 'bg-red-900/70' : 'bg-gray-700/70'
                          }`}
                        >
                          {item.output ? (
                            item.type === 'kb_search' ? (
                              <KnowledgeBaseResults output={item.output} />
                            ) : (
                              item.output
                            )
                          ) : (
                            <span className="inline-flex items-center">
                              <span className="mr-2">Processing</span>
                              <span className="animate-pulse">...</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Current streaming result */}
                  {isStreaming && (
                    <div className="flex items-start pl-8">
                      <div className="flex-shrink-0 mr-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                          <Flame className="w-3 h-3" />
                        </div>
                      </div>
                      <div className="bg-gray-700/70 rounded px-3 py-2 text-white inline-block">
                        {currentStreamedResult || (
                          <span className="inline-flex items-center">
                            <span className="mr-2">Processing</span>
                            <span className="animate-pulse">...</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Input area */}
            <div className="p-4 bg-black/90 border-t border-white/20">
              <form onSubmit={handleSubmit} className="flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter your goal..."
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-l-md focus:outline-none focus:ring-2 focus:ring-[#E63946] font-mono"
                  disabled={isProcessing}
                />
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-r-md flex items-center justify-center ${
                    isProcessing || !input.trim() 
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                      : 'bg-[#E63946] text-white hover:bg-[#D62936]'
                  }`}
                  disabled={isProcessing || !input.trim()}
                >
                  <Send size={18} />
                </button>
                
                {isProcessing && (
                  <button
                    type="button"
                    className="ml-2 px-3 py-2 bg-red-700 text-white rounded-md hover:bg-red-800"
                    onClick={() => {
                      setIsProcessing(false);
                      setIsStreaming(false);
                      setResults(prev => {
                        const updatedResults = [...prev];
                        const lastIndex = updatedResults.length - 1;
                        if (lastIndex >= 0) {
                          updatedResults[lastIndex] = {
                            ...updatedResults[lastIndex],
                            output: 'Task canceled by user',
                            status: 'error'
                          };
                        }
                        return updatedResults;
                      });
                    }}
                  >
                    <XCircle size={18} />
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
      
      {/* Overlay when console is open to capture clicks outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => !isProcessing && setIsOpen(false)}
        />
      )}
    </>
  );
};

// Component to format and display Knowledge Base search results
const KnowledgeBaseResults: React.FC<{output: string}> = ({ output }) => {
  // Split on "Result" pattern to separate individual results
  const parts = output.split(/Result \d+:/);

  // Check if it has any results or just a "no results" message
  if (parts.length <= 1 || output.includes("No results found")) {
    return (
      <div className="kb-no-results">
        <div className="flex items-center text-yellow-300 mb-2">
          <Search className="mr-2 h-4 w-4" />
          <span className="font-semibold">Knowledge Base Search</span>
        </div>
        <div>{output}</div>
      </div>
    );
  }

  // First part contains any pre-results text
  const preResultsText = parts[0].trim();
  
  // Format remaining parts as results
  const results = parts.slice(1).map((part, index) => {
    if (!part.trim()) return null;
    
    // Extract title, relevance, and content
    const titleMatch = part.match(/^(.*?)\(Relevance: ([\d.]+)\)/);
    const title = titleMatch ? titleMatch[1].trim() : "Unknown Title";
    const relevance = titleMatch ? titleMatch[2] : "N/A";
    
    // Get content after the Context: label
    const contextMatch = part.match(/Context:(.*?)(\n\n|$)/s);
    const context = contextMatch ? contextMatch[1].trim() : "";

    // Process context to highlight the bold parts (which indicate matches)
    const highlightedContext = context.split('**').map((segment, i) =>
      i % 2 === 1 ? <mark key={i} className="bg-yellow-300 text-black px-1 rounded">{segment}</mark> : segment
    );
    
    return (
      <div key={index} className="kb-result mb-3 border-l-2 border-blue-400 pl-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-blue-300">{title}</div>
          <div className="text-xs opacity-70">Relevance: {relevance}</div>
        </div>
        <div className="kb-context text-sm mt-1">{highlightedContext}</div>
      </div>
    );
  });
  
  return (
    <div className="kb-search-results">
      <div className="flex items-center text-blue-300 mb-3">
        <Book className="mr-2 h-4 w-4" />
        <span className="font-semibold">Knowledge Base Results</span>
      </div>
      {preResultsText && <div className="mb-3">{preResultsText}</div>}
      <div className="kb-results-list">
        {results}
      </div>
      {output.includes("Tip:") && (
        <div className="text-xs italic mt-2 text-gray-400">
          {output.split("Tip:")[1].trim()}
        </div>
      )}
    </div>
  );
};

export default UniversalOrchestratorBar;