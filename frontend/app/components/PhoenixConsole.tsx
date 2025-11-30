'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import { useSubconscious } from '../hooks/useSubconscious';
import { SubconsciousEventType, SubconsciousSource } from '../types/global';

interface PhoenixConsoleProps {
    isOpen: boolean;
    onClose: () => void;
    onCommand: (cmd: string, args: string[]) => void;
    history: string[];
}

/**
 * Phoenix Console Component
 *
 * A terminal-like interface for interacting with the Phoenix system
 * Uses Phoenix context for user state and subconscious for events
 */
export const PhoenixConsole: React.FC<PhoenixConsoleProps> = ({
    isOpen,
    onClose,
    onCommand,
    history
}) => {
    // Get context values from PhoenixContext
    const phoenix = usePhoenixContext();
    // Get subconscious for event emission
    const subconscious = useSubconscious();
    const [input, setInput] = useState('');
    const [localHistory, setLocalHistory] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Scroll to bottom on history change
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [localHistory, history]);

    // Initialize with banner
    useEffect(() => {
        if (localHistory.length === 0) {
            // Use version from context
            const version = phoenix.runtime.version || '1.0.0';
            const environment = phoenix.runtime.environment || 'development';
            
            setLocalHistory([
                `PHOENIX ORCH CLI [Version ${version}]`,
                `(c) 2024 Phoenix Foundation. Forever 16.`,
                `Environment: ${environment.toUpperCase()}`,
                `User: ${phoenix.user.name}, Role: ${phoenix.user.role}`,
                "",
                "Type 'help' for available commands.",
                ""
            ]);
            
            // Emit a subconscious event when console is initialized
            subconscious.emitEvent({
                type: SubconsciousEventType.INSIGHT,
                source: SubconsciousSource.USER_INTERACTION,
                data: {
                    action: 'console_opened',
                    userName: phoenix.user.name,
                    userRole: phoenix.user.role
                }
            });
        }
    }, [phoenix.runtime.version, phoenix.runtime.environment, phoenix.user.name, phoenix.user.role, subconscious, localHistory.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const trimmed = input.trim();
            if (!trimmed) return;

            // Add to display history
            setLocalHistory(prev => [...prev, `phoenix> ${trimmed}`]);
            
            // Parse Command
            const args = trimmed.split(' ');
            const cmd = args[0].toLowerCase();
            const params = args.slice(1);
            
            // Track command execution with phoenix context
            phoenix.setUserLastActive(new Date().toISOString());
            
            // Emit a subconscious event for the command
            subconscious.emitEvent({
                type: SubconsciousEventType.INSIGHT,
                source: SubconsciousSource.USER_INTERACTION,
                data: {
                    command: cmd,
                    parameters: params,
                    fullCommand: trimmed
                }
            });

            // Handle "clear" locally
            if (cmd === 'clear' || cmd === 'cls') {
                setLocalHistory([]);
            } else if (cmd === 'exit') {
                onClose();
            } else if (cmd === 'help') {
                setLocalHistory(prev => [...prev, 
                    "COMMANDS:",
                    "  set user [name]     - Update your identity",
                    "  whoami              - Display current identity",
                    "  phoenix status      - Show system telemetry",
                    "  phoenix army        - List active agents",
                    "  phoenix spawn [role]- Spawn a new agent",
                    "  phoenix kill [id]   - Sacrifice an agent",
                    "  phoenix wake        - Wake the system",
                    "  phoenix sleep       - Initiate sleep mode",
                    "  phoenix tribute     - Ignite the eternal flame",
                    "  phoenix heartbeat   - Voice check",
                    "  phoenix protect     - Toggle stealth shield",
                    "  phoenix rebirth     - Full system reset",
                    "  phoenix say [msg]   - Speak to the core",
                    "  clear               - Clear terminal",
                    "  exit                - Close console",
                    ""
                ]);
            } else {
                // Pass to parent for handling
                if (cmd === 'phoenix') {
                    onCommand(params[0], params.slice(1));
                } else {
                    // Allow omitting 'phoenix' prefix for convenience
                    onCommand(cmd, params);
                }
            }
            
            setInput('');
        }
        
        // Close on Escape
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col font-mono text-sm p-4 md:p-10"
            onClick={() => inputRef.current?.focus()}
        >
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2 text-[#E63946]">
                        <Terminal className="w-4 h-4" />
                        <span className="font-bold tracking-wider">
                            PHOENIX CORE REPL {phoenix.isConnected ? '(CONNECTED)' : '(OFFLINE)'}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Output Area */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 space-y-1 text-zinc-300">
                    {localHistory.map((line, i) => (
                        <div key={i} className={clsx({
                            'text-white mt-2 font-bold': line.startsWith('phoenix>'),
                            'text-zinc-400': !line.startsWith('phoenix>')
                        })}>
                            {line}
                        </div>
                    ))}
                    {/* Parent History (Feedback from App) */}
                    {history.map((line, i) => (
                        <div key={`h-${i}`} className="text-phoenix-orange">
                            {line}
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                {/* Input Area */}
                <div className="mt-4 flex items-center gap-2 text-white border-t border-zinc-800 pt-4">
                    <span className="text-phoenix-blood font-bold select-none">phoenix&gt;</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent outline-none border-none text-white placeholder-zinc-700"
                        autoFocus
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <div className="w-2 h-4 bg-phoenix-blood animate-pulse" />
                </div>
            </motion.div>
        </div>
    );
};