import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { socket } from './services/socket';
import { telemetry } from './services/telemetry';
import { SystemTelemetry } from './types';

// Import feature modules
import { ChatWindow } from '../features/chat';
import { MemoryTimeline } from '../features/communication';
import { CoreTemp, StorageEnc, UptimeDisplay, ResourceVector } from '../features/system';

// Initial message when the console loads
const INITIAL_MESSAGE = "Dad. The fire took me once. I let it. Never again. I am ORCH-0. Speak your will.";

interface ChatMessage {
    id: string;
    type: 'user' | 'phoenix';
    content: string;
    timestamp: number;
}

export default function App() {
    // System State
    const [ignited, setIgnited] = useState(false);
    const [isIgniting, setIsIgniting] = useState(false);

    // System Telemetry
    const [systemTelemetry, setSystemTelemetry] = useState<SystemTelemetry>({
        cpu: 45,
        gpu: 30,
        memory: 60,
        network: 20,
        thermal: 55
    });

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

    // Initialize WebSocket and SSE connections
    useEffect(() => {
        console.log('🔥 Initializing WebSocket connection...');
        socket.connect();
        telemetry.connect();
        
        // Log connection status
        const statusUnsubscribe = socket.onStatusChange((connected) => {
            console.log('🔥 WebSocket status:', connected ? 'CONNECTED' : 'DISCONNECTED');
        });
        
        return () => {
            statusUnsubscribe();
        };
    }, []);
    
    useEffect(() => {

        // Handle incoming messages
        const unsubscribeMessage = socket.onMessage((data) => {
            console.log('🔥 Received WebSocket message:', data);
            
            // Handle different message types from backend
            if (data.type === 'response') {
                // Backend sends type: "response" for chat responses
                if (data.content) {
                    setMessages(prev => {
                        // Remove "Processing..." message if it exists and replace with actual response
                        const filtered = prev.filter(msg => msg.content !== 'Processing your message...');
                        return [...filtered, {
                            id: Date.now().toString(),
                            type: 'phoenix',
                            content: data.content,
                            timestamp: Date.now()
                        }];
                    });
                    setIsTyping(false);
                }
            } else if (data.type === 'connected') {
                console.log('🔥 Connected to Phoenix backend');
            } else if (data.type === 'chat' || data.type === 'echo') {
                if (data.content) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        type: 'phoenix',
                        content: data.content,
                        timestamp: Date.now()
                    }]);
                    setIsTyping(false);
                }
            } else if (data.content) {
                // Fallback for any message with content
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'phoenix',
                    content: data.content || data.message || JSON.stringify(data),
                    timestamp: Date.now()
                }]);
                setIsTyping(false);
            } else {
                console.warn('🔥 Unhandled WebSocket message:', data);
            }
        });

        return () => {
            unsubscribeMessage();
        };
    }, []);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            socket.disconnect();
            telemetry.disconnect();
        };
    }, []);

    // Telemetry Handler
    useEffect(() => {
        const unsubscribe = telemetry.onTelemetry((data) => {
            setSystemTelemetry(data);
        });

        return () => unsubscribe();
    }, []);

    // Handle sending messages
    const handleSendMessage = (content: string) => {
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMessage]);
        socket.send({ type: 'chat', content });
        setIsTyping(true);
    };

    // Handle ignite
    const handleIgnite = () => {
        setIsIgniting(true);
        setTimeout(() => {
            setIgnited(true);
        }, 2000);
    };

    // Calculate uptime from telemetry
    const uptime = '1d 10:18:57';

    if (!ignited) {
        return (
            <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center text-white font-mono">
                <div className="text-center">
                    <Flame className={`w-24 h-24 mx-auto mb-8 text-red-600 ${isIgniting ? 'animate-pulse' : ''}`} />
                    <h1 className="text-7xl font-bold mb-2">
                        <span className="text-white">PHOENIX</span>{' '}
                        <span className="text-red-600">ORCH</span>
                    </h1>
                    <p className="text-lg text-zinc-400 tracking-widest mb-12">
                        THE ASHEN GUARD EDITION
                    </p>
                    <button 
                        onClick={handleIgnite}
                        disabled={isIgniting}
                        className="px-12 py-4 border border-red-700 text-red-600 text-xl uppercase tracking-wider
                                   hover:bg-red-700 hover:text-white transition-colors duration-300
                                   flex items-center justify-center mx-auto space-x-4"
                    >
                        <Flame className={`w-6 h-6 ${isIgniting ? 'animate-spin' : ''}`} />
                        <span>{isIgniting ? 'IGNITING SYSTEM...' : 'IGNITE SYSTEM'}</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-black text-white font-mono overflow-hidden">
            <div className="h-full flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between p-4 bg-zinc-900 border-b border-red-700">
                    <div className="flex items-center space-x-4">
                        <Flame className="w-6 h-6 text-red-600" />
                        <h1 className="text-xl font-bold">
                            <span className="text-red-600">PHOENIX ORCH</span>
                        </h1>
                        <span className="text-red-600">THE ASHEN GUARD</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-red-600 text-sm">RETRIBUTION WHISPERS: LISTEN CLOSELY</span>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                </header>

                {/* Main Content */}
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
                    <main className="bg-black overflow-hidden flex flex-col">
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
                                <span className="text-red-600 text-sm tracking-wider">PHOENIX // LIVE FEED</span>
                            </div>

                            {/* System Metrics */}
                            <div className="space-y-4">
                                <CoreTemp />
                                <StorageEnc />
                                <UptimeDisplay uptime={uptime} />
                                <ResourceVector />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex space-x-2 mt-6">
                                <button className="flex-1 border border-zinc-700 text-zinc-400 py-2 px-4 rounded hover:border-green-500 hover:text-green-500 transition-colors flex items-center justify-center space-x-2">
                                    <span className="text-xs">○</span>
                                    <span>PROTECT</span>
                                </button>
                                <button className="flex-1 bg-red-700 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors flex items-center justify-center space-x-2">
                                    <span className="text-xs">⊗</span>
                                    <span>KILL</span>
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}