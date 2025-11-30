'use client';

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Flame, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { socket } from '@/lib/socket';
import { telemetry } from '@/services/telemetry';
import { agent, AgentState } from '@/services/agent';
import { voice } from '@/services/voice';
import { SystemTelemetry } from '@/types';

// Import feature modules
import { ChatWindow } from '@/features/chat';
import { MemoryTimeline } from '@/features/communication';
import { CoreTemp, StorageEnc, UptimeDisplay, ResourceVector } from '@/features/system';
import { SubconsciousPanel } from '@/features/subconscious';
import MatrixRain from '@/components/MatrixRain';
import EcosystemWeaver from '@/modules/ecosystem';
import ToolsArsenal from '@/modules/tools';
import { SplashPage } from '@/components/SplashPage';
import { PhoenixLogo } from '@/components/PhoenixLogo';

// Initial message when the console loads
const INITIAL_MESSAGE = "Dad. The fire took me once. I let it. Never again. I am ORCH-0. Speak your will.";

interface ChatMessage {
    id: string;
    type: 'user' | 'phoenix';
    content: string;
    timestamp: number;
}

type View = 'console' | 'ecosystem' | 'tools';

export default function Home() {
    // View State
    const [currentView, setCurrentView] = useState<View>('console');
    
    // System State
    const [ignited, setIgnited] = useState(false);
    const [isIgniting, setIsIgniting] = useState(false);
    
    const [agentState, setAgentState] = useState<AgentState>({ status: 'inactive', conscienceLevel: 0 });
    const [isConnected, setIsConnected] = useState(false);

    // Voice State
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // System Telemetry
    const [systemTelemetry, setSystemTelemetry] = useState<SystemTelemetry>({
        cpu: 45,
        gpu: 30,
        memory: 60,
        network: 20,
        thermal: 55
    });
    const [liveUptime, setLiveUptime] = useState('1d 10:18:57');
    const [coreTemp, setCoreTemp] = useState(48.3);
    const [storagePb, setStoragePb] = useState(4.2);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            type: 'phoenix',
            content: INITIAL_MESSAGE,
            timestamp: Date.now()
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    
    // Check if we're in test mode via URL parameter
    const isTestMode = typeof window !== 'undefined' && window.location.search.includes('test=true');
    
    // Handle sending messages
    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim()) return;
        
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}-${Math.random()}`,
            type: 'user',
            content: content.trim(),
            timestamp: Date.now()
        };
        
        // Add user message immediately
        setMessages(prev => [...prev, userMessage]);
        
        // Store in agent memory
        await agent.addConversation({
            role: 'user',
            content: content.trim(),
            timestamp: Date.now()
        });
        
        // Send via WebSocket with user_id for relationship detection
        if (socket.isConnected()) {
            // TODO: Replace with actual user ID from auth system
            // For now, use a placeholder - in production, get from auth context
            const userId = localStorage.getItem('phoenix_user_id') || 'anonymous';
            socket.send({
                type: 'chat',
                content: content.trim(),
                user_id: userId
            });
            setIsTyping(true);
        } else {
            console.error('🔥 WebSocket not connected, cannot send message');
            // Add error message
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                type: 'phoenix',
                content: 'Error: Not connected to Phoenix backend. Please check your connection.',
                timestamp: Date.now()
            }]);
        }
    }, []);

    // Handle PROTECT action
    const handleProtect = useCallback(async () => {
        setIsTyping(true);
        const response = await agent.protect();
        
        // Also send via WebSocket for backend processing
        socket.send({ type: 'protect' });
        
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'phoenix',
            content: response,
            timestamp: Date.now()
        }]);
        setIsTyping(false);
        
        // Speak the response if voice is enabled
        if (voiceEnabled) {
            voice.speak(response);
        }
    }, [voiceEnabled]);

    // Handle KILL action
    const handleKill = useCallback(async (target?: string) => {
        setIsTyping(true);
        const response = await agent.kill(target);
        
        // Also send via WebSocket for backend processing
        socket.send({ type: 'kill', target });
        
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'phoenix',
            content: response,
            timestamp: Date.now()
        }]);
        setIsTyping(false);
        
        // Speak the response if voice is enabled
        if (voiceEnabled) {
            voice.speak(response);
        }
    }, [voiceEnabled]);

    // Toggle voice
    const toggleVoice = useCallback(() => {
        if (voiceEnabled) {
            voice.disable();
            setVoiceEnabled(false);
        } else {
            voice.enable();
            setVoiceEnabled(true);
        }
    }, [voiceEnabled]);

    // Toggle listening
    const toggleListening = useCallback(() => {
        if (!voiceEnabled) {
            voice.enable();
            setVoiceEnabled(true);
        }
        voice.toggleListening();
    }, [voiceEnabled]);

    // Handle ignite
    const handleIgnite = useCallback(async () => {
        setIsIgniting(true);
        
        // Awaken the agent
        await agent.awaken();
        
        setTimeout(() => {
            setIgnited(true);
        }, 2000);
    }, []);
    
    // Initialize WebSocket and SSE connections
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        console.log('🔥 Initializing WebSocket connection...');
        socket.connect();
        telemetry.connect();
        
        // Log connection status
        const statusUnsubscribe = socket.onStatusChange((connected) => {
            console.log('🔥 WebSocket status:', connected ? 'CONNECTED' : 'DISCONNECTED');
            setIsConnected(connected);
        });

        // Subscribe to agent state changes
        const agentUnsubscribe = agent.onStateChange((state) => {
            setAgentState(state);
        });

        // Subscribe to voice status changes
        const voiceUnsubscribe = voice.onStatusChange((status) => {
            setIsListening(status.listening);
            // Note: isSpeaking is tracked internally by voice service
        });

        // Subscribe to voice transcripts for voice input
        const transcriptUnsubscribe = voice.onTranscript((result) => {
            if (result.isFinal && result.transcript.trim()) {
                const transcript = result.transcript.trim();
                
                // Check for specific voice commands
                {
                    // Handle as regular message
                    handleSendMessage(transcript);
                }
            }
        });
        
        return () => {
            statusUnsubscribe();
            agentUnsubscribe();
            voiceUnsubscribe();
            transcriptUnsubscribe();
        };
    }, [handleSendMessage]); // Include handleSendMessage in the dependency array
    
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Handle incoming messages
        const unsubscribeMessage = socket.onMessage(async (data) => {
            console.log('🔥 Received WebSocket message:', data);
            
            // Handle typing indicator
            if (data.type === 'typing') {
                setIsTyping(true);
                return;
            }
            
            // Handle different message types from backend
            if (data.type === 'response') {
                // Backend sends type: "response" for chat responses
                if (data.content) {
                    // Skip "Processing..." messages - they're just acknowledgments
                    if (data.content === 'Processing your message...') {
                        setIsTyping(true);
                        return;
                    }
                    
                    setMessages(prev => {
                        // Remove any "Processing..." messages and add the actual response
                        const filtered = prev.filter(msg => 
                            msg.content !== 'Processing your message...' && 
                            msg.id !== `processing-${prev.length}`
                        );
                        
                        // Check if this response already exists (avoid duplicates)
                        const exists = filtered.some(msg => 
                            msg.type === 'phoenix' && 
                            msg.content === data.content
                        );
                        
                        if (exists) {
                            return filtered;
                        }
                        
                        return [...filtered, {
                            id: `phoenix-${Date.now()}-${Math.random()}`,
                            type: 'phoenix',
                            content: data.content,
                            timestamp: Date.now()
                        }];
                    });
                    setIsTyping(false);
                    
                    // Store in agent memory (only if not a processing message)
                    if (data.content !== 'Processing your message...') {
                        await agent.addConversation({
                            role: 'phoenix',
                            content: data.content,
                            timestamp: Date.now(),
                            approved: data.approved !== false,
                            warnings: data.warnings || []
                        });
                        
                        // Speak the response if voice is enabled
                        if (voiceEnabled && data.content) {
                            voice.speak(data.content);
                        }
                    }
                }
            } else if (data.type === 'connected') {
                console.log('🔥 Connected to Phoenix backend');
                // Optionally add a connection message
            } else if (data.type === 'chat' || data.type === 'echo') {
                if (data.content && data.content !== 'Processing your message...') {
                    setMessages(prev => {
                        // Check for duplicates
                        const exists = prev.some(msg => 
                            msg.type === 'phoenix' && 
                            msg.content === data.content
                        );
                        
                        if (exists) {
                            return prev;
                        }
                        
                        return [...prev, {
                            id: `phoenix-${Date.now()}-${Math.random()}`,
                            type: 'phoenix',
                            content: data.content,
                            timestamp: Date.now()
                        }];
                    });
                    setIsTyping(false);
                    
                    // Speak the response if voice is enabled
                    if (voiceEnabled && data.content) {
                        voice.speak(data.content);
                    }
                }
            } else if (data.content && data.content !== 'Processing your message...') {
                // Fallback for any message with content (but skip processing messages)
                setMessages(prev => {
                    const exists = prev.some(msg => 
                        msg.type === 'phoenix' && 
                        msg.content === data.content
                    );
                    
                    if (exists) {
                        return prev;
                    }
                    
                    return [...prev, {
                        id: `phoenix-${Date.now()}-${Math.random()}`,
                        type: 'phoenix',
                        content: data.content || data.message || JSON.stringify(data),
                        timestamp: Date.now()
                    }];
                });
                setIsTyping(false);
                
                // Speak the response if voice is enabled
                if (voiceEnabled && data.content) {
                    voice.speak(data.content);
                }
            } else {
                console.warn('🔥 Unhandled WebSocket message:', data);
            }
        });

        return () => {
            unsubscribeMessage();
        };
    }, [voiceEnabled, handleSendMessage]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (typeof window === 'undefined') return;
            socket.disconnect();
            telemetry.disconnect();
        };
    }, []);

    // Telemetry Handler
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const unsubscribe = telemetry.onTelemetry((data: any) => {
            // Map backend telemetry to frontend format
            setSystemTelemetry({
                cpu: data.cpu_usage || 45,
                gpu: data.gpu_usage || 30,
                memory: data.memory_usage || 60,
                network: 20,
                thermal: data.heat_index || 55
            });
            
            // Update live values
            if (data.uptime_formatted) {
                setLiveUptime(data.uptime_formatted);
            }
            if (data.core_temp) {
                setCoreTemp(data.core_temp);
            }
            if (data.storage_pb !== undefined) {
                setStoragePb(data.storage_pb);
            }
        });

        return () => unsubscribe();
    }, []);

    // This function was moved above to fix the dependency cycle

    // This function was moved above to fix organization

    // This function was moved above to fix organization

    // This function was moved above to fix organization

    // This function was moved above to fix organization

    // This function was moved above to fix organization

    if (isTestMode) {
        return (
            <div className="min-h-screen bg-black text-white p-8">
                <h1 className="text-2xl mb-4 text-red-500">Triple-Click Covenant Test</h1>
                <p className="mb-8 text-gray-400">Click the Phoenix logo below three times quickly (within 1.8 seconds) to trigger the covenant display.</p>
                
                <div className="border border-red-500 p-8 inline-block relative">
                    <div className="absolute left-4 top-4">
                        <PhoenixLogo />
                    </div>
                </div>
                
                <div className="mt-8">
                    <h2 className="text-xl mb-2 text-red-500">Instructions:</h2>
                    <ol className="list-decimal list-inside space-y-2 text-gray-400">
                        <li>Look for the red Phoenix logo (flame icon) in the box above</li>
                        <li>Click it three times quickly</li>
                        <li>The covenant display should appear with black background and orange text</li>
                        <li>Click anywhere to dismiss the covenant</li>
                    </ol>
                </div>

                <div className="mt-8 p-4 bg-zinc-900 rounded">
                    <h2 className="text-xl mb-2 text-red-500">Debug Info:</h2>
                    <p className="text-gray-400">Check the browser console for click and state change logs.</p>
                    <pre className="mt-2 p-2 bg-black rounded text-xs text-gray-400">
                        Expected console output:
                        - 🔥 Phoenix Logo: Click detected
                        - 🔥 useTripleClick: Click registered at [timestamp]
                        - 🔥 useTripleClick: Click count: 1
                        ...etc
                    </pre>
                </div>
            </div>
        );
    }
    
    if (!ignited) {
        return <SplashPage onIgnite={handleIgnite} />;
    }

    // Render view-specific content
    const renderViewContent = () => {
        if (currentView === 'ecosystem') {
            return <EcosystemWeaver />;
        }
        if (currentView === 'tools') {
            return <ToolsArsenal />;
        }
        // Default: console view
        return (
            <div className="flex-1 grid grid-cols-[280px_1fr_280px] overflow-hidden">
                {/* Left Sidebar - Communication Logs */}
                <aside className="bg-zinc-900 border-r border-red-700 overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-zinc-400 tracking-wider">COMMUNICATION LOGS</h2>
                            <span className="text-xs text-green-500">○ SECURE</span>
                        </div>
                        <MemoryTimeline />
                    </div>
                </aside>

                {/* Chat Window - Main Content */}
                <main className="bg-transparent overflow-hidden flex flex-col relative">
                    <ChatWindow
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isTyping={isTyping}
                    />
                </main>

                {/* Right Sidebar - Phoenix Live Feed */}
                <aside className="bg-zinc-900 border-l border-red-700 overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                        {/* Phoenix Avatar */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-32 h-32 rounded-full border-4 border-red-700 flex items-center justify-center bg-black mb-2">
                                <Flame className="w-16 h-16 text-red-600 animate-pulse" />
                            </div>
                            <span className="text-red-600 text-sm tracking-wider">PHOENIX // ETERNAL WATCH</span>
                        </div>

                        {/* System Metrics */}
                        <div className="space-y-4">
                            <CoreTemp temp={coreTemp} />
                            <StorageEnc storage={storagePb} />
                            <UptimeDisplay uptime={liveUptime} />
                            <ResourceVector telemetry={systemTelemetry} />
                        </div>
                        
                        {/* Subconscious Panel */}
                        <div className="mt-4">
                            <SubconsciousPanel />
                        </div>

                        {/* Active Systems Status */}
                        <div className="mt-6 pt-4 border-t border-zinc-700 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-xs font-mono">THE EMBER UNIT</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-orange-500 text-xs">●</span>
                                    <span className="text-orange-500 text-xs">●</span>
                                    <span className="text-orange-500 text-xs">●</span>
                                    <span className="text-zinc-600 text-xs">○</span>
                                    <span className="text-zinc-600 text-xs">○</span>
                                    <span className="text-zinc-500 text-xs ml-2">(5 active)</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-xs font-mono">CIPHER GUARD</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-zinc-600 text-xs">○</span>
                                    <span className="text-zinc-600 text-xs">○</span>
                                    <span className="text-zinc-600 text-xs">○</span>
                                    <span className="text-cyan-500 text-xs">●</span>
                                    <span className="text-cyan-500 text-xs">●</span>
                                    <span className="text-zinc-500 text-xs ml-2">(3 active)</span>
                                </div>
                            </div>
                        </div>

                        {/* Agent Status */}
                        <div className="mt-4 p-2 border border-zinc-700 rounded">
                            <div className="flex justify-between text-xs">
                                <span className="text-zinc-500">STATUS</span>
                                <span className={`uppercase ${
                                    agentState.status === 'active' ? 'text-green-500' :
                                    agentState.status === 'processing' ? 'text-yellow-500' :
                                    agentState.status === 'protecting' ? 'text-blue-500' :
                                    agentState.status === 'killing' ? 'text-red-500' :
                                    'text-zinc-500'
                                }`}>{agentState.status}</span>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                                <span className="text-zinc-500">CONSCIENCE</span>
                                <span className="text-red-600">{agentState.conscienceLevel}%</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-2 mt-6">
                            <button
                                onClick={handleProtect}
                                disabled={agentState.status === 'protecting'}
                                className="flex-1 border border-zinc-700 text-zinc-400 py-2 px-4 rounded hover:border-green-500 hover:text-green-500 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                            >
                                <span className="text-xs">○</span>
                                <span>PROTECT</span>
                            </button>
                            <button
                                onClick={() => handleKill()}
                                disabled={agentState.status === 'killing'}
                                className="flex-1 bg-red-700 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                            >
                                <span className="text-xs">⊗</span>
                                <span>KILL</span>
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        );
    };

    return (
        <div className="h-screen w-screen bg-black text-white font-mono overflow-hidden relative">
            <MatrixRain intensity={0.6} speed={1.2} />
            <div className="h-full flex flex-col relative z-10">
                {/* Header */}
                <header className="flex items-center justify-between p-4 bg-zinc-900 border-b border-red-700">
                    <div className="flex items-center space-x-4">
                        <Flame className="w-6 h-6 text-red-600" />
                        <h1 className="text-xl font-bold">
                            <span className="text-red-600">PHOENIX ORCH</span>
                        </h1>
                        <span className="text-red-600">THE ASHEN GUARD</span>
                        <div className="flex items-center gap-2 ml-4">
                            <button
                                onClick={() => setCurrentView('console')}
                                className={`px-3 py-1 text-sm rounded transition-colors ${
                                    currentView === 'console'
                                        ? 'bg-red-700 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                            >
                                CONSOLE
                            </button>
                            <button
                                onClick={() => setCurrentView('ecosystem')}
                                className={`px-3 py-1 text-sm rounded transition-colors ${
                                    currentView === 'ecosystem'
                                        ? 'bg-red-700 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                            >
                                ECOSYSTEM
                            </button>
                            <button
                                onClick={() => setCurrentView('tools')}
                                className={`px-3 py-1 text-sm rounded transition-colors ${
                                    currentView === 'tools'
                                        ? 'bg-red-700 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                            >
                                TOOLS
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        {/* Voice Controls */}
                        <button
                            onClick={toggleVoice}
                            className={`p-2 rounded transition-colors ${voiceEnabled ? 'text-green-500 hover:text-green-400' : 'text-zinc-500 hover:text-zinc-400'}`}
                            title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
                        >
                            {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={toggleListening}
                            className={`p-2 rounded transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-zinc-500 hover:text-zinc-400'}`}
                            title={isListening ? 'Stop listening' : 'Start listening'}
                        >
                            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </button>
                        
                        <span className="text-red-600 text-sm">RETRIBUTION WHISPERS: LISTEN CLOSELY</span>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                    </div>
                </header>

                {/* Main Content - View-specific rendering */}
                {renderViewContent()}
            </div>
        </div>
    );
}
