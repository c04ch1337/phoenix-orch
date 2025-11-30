"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceCommand } from '../types';

interface VoiceInterfaceProps {
    onCommand?: (command: VoiceCommand) => void;
}

export default function VoiceInterface({ onCommand }: VoiceInterfaceProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [availableCommands, setAvailableCommands] = useState<string[]>([]);
    const [isSupported, setIsSupported] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const processVoiceCommand = useCallback((text: string) => {
        // Simple command matching - replace with more sophisticated parsing
        const command = text.toLowerCase().trim();

        if (command.includes('scan target')) {
            const url = command.replace('scan target', '').trim();
            onCommand?.({
                alias: 'scan',
                action: 'scan',
                target: url,
                parameters: { type: 'vulnerability' }
            });
        } else if (command.includes('analyze vulnerabilities')) {
            onCommand?.({
                alias: 'analyze',
                action: 'analyze',
                target: 'current',
                parameters: { type: 'vulnerability' }
            });
        } else if (command.includes('generate report')) {
            onCommand?.({
                alias: 'report',
                action: 'generate',
                target: 'current',
                parameters: { format: 'pdf' }
            });
        } else if (command.includes('show status')) {
            onCommand?.({
                alias: 'status',
                action: 'show',
                target: 'system',
                parameters: {}
            });
        }
    }, [onCommand]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            setIsSupported(false);
            setError('Speech recognition is not supported in this browser');
            return;
        }

        setIsSupported(true);
        
        try {
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onstart = () => {
                setIsListening(true);
                setError(null);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                setIsListening(false);
                const errorMessage = event.error || 'Unknown speech recognition error';
                setError(`Speech recognition error: ${errorMessage}`);
                console.error('Speech recognition error:', event);
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                try {
                    const transcript = Array.from(event.results)
                        .map(result => result[0]?.transcript || '')
                        .join('');
                    
                    setTranscript(transcript);
                    
                    // Only process final results
                    const isFinal = Array.from(event.results).some(result => result.isFinal);
                    if (isFinal) {
                        processVoiceCommand(transcript);
                    }
                } catch (e) {
                    console.error('Error processing speech result:', e);
                    setError('Failed to process speech result');
                }
            };

            // Mock available commands - replace with real data from API
            setAvailableCommands([
                'scan target [url]',
                'analyze vulnerabilities',
                'generate report',
                'show status',
            ]);
        } catch (e) {
            console.error('Error initializing speech recognition:', e);
            setIsSupported(false);
            setError('Failed to initialize speech recognition');
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
        };
    }, [processVoiceCommand]);

    const toggleListening = () => {
        if (!recognitionRef.current || !isSupported) {
            return;
        }

        try {
            if (isListening) {
                recognitionRef.current.stop();
            } else {
                recognitionRef.current.start();
                setTranscript('');
                setError(null);
            }
        } catch (e) {
            console.error('Error toggling speech recognition:', e);
            setError('Failed to toggle speech recognition');
            setIsListening(false);
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-900 border-t border-neutral-800">
            <div className="max-w-screen-xl mx-auto">
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleListening}
                        className={`p-3 rounded-full ${
                            isListening 
                                ? 'bg-red-500 hover:bg-red-600' 
                                : 'bg-blue-500 hover:bg-blue-600'
                        } transition-colors`}
                    >
                        <span className="sr-only">
                            {isListening ? 'Stop Listening' : 'Start Listening'}
                        </span>
                        <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={isListening 
                                    ? 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z M16 8l-8 8m0-8l8 8'
                                    : 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
                                }
                            />
                        </svg>
                    </button>

                    <div className="flex-1">
                        {!isSupported ? (
                            <div className="text-sm text-yellow-500">
                                Speech recognition is not supported in this browser
                            </div>
                        ) : (
                            <>
                                <div className="text-sm text-neutral-400 mb-1">
                                    {isListening ? 'Listening...' : 'Click the microphone to start'}
                                </div>
                                {transcript && (
                                    <div className="text-white font-medium">{transcript}</div>
                                )}
                                {error && (
                                    <div className="text-sm text-red-500 mt-1">{error}</div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="hidden md:block">
                        <div className="text-sm text-neutral-400 mb-1">Available Commands</div>
                        <div className="flex gap-2">
                            {availableCommands.map((command, index) => (
                                <div
                                    key={index}
                                    className="px-3 py-1 bg-neutral-800 rounded text-sm text-neutral-300"
                                >
                                    {command}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}