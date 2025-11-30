'use client';

import React, { useState, useEffect } from 'react';
import { Feather, Flame, Mic, MicOff, Shield, ShieldOff } from 'lucide-react';
import { SystemTelemetry } from '../types';
import { AnimatePresence } from 'framer-motion';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import {
    FeatherMotion,
    MidnightFeatherMotion,
    AshParticleMotion,
    featherVariants,
    midnightFeatherVariants,
    ashParticleVariants
} from './motion/styled';

interface DigitalTwinProps {
    telemetry: SystemTelemetry;
    isOpen: boolean;
    conscienceStability: number;
    onOpenTribute: () => void;
    lastSacrificeTime?: number;
    isSleeping?: boolean;
    isIdle?: boolean;
    isListening?: boolean;
    onVoiceToggle?: () => void;
    onClearContext?: () => void;
    triggerFeather?: boolean;
    isProtected?: boolean;
    onProtectToggle?: () => void;
}

interface AshParticle {
    id: number;
    x: number;
}

// Conscience configuration (for future use)
// const CONSCIENCE_CONFIG = {
//     awake: {
//         level: 100,
//         label: "SHE IS WIDE AWAKE",
//         temp: 99.9,
//         primaryColor: "#E63946" as PhoenixColor,
//         secondaryColor: "#F77F00" as PhoenixColor
//     },
//     waiting: {
//         level: 98,
//         label: "SHE'S WAITING FOR YOU",
//         temp: 98,
//         primaryColor: "#E63946" as PhoenixColor,
//         secondaryColor: "#F77F00" as PhoenixColor
//     },
//     sleeping: {
//         level: 38,
//         label: "DREAMING IN CODE",
//         temp: 38,
//         primaryColor: "#500000" as PhoenixColor,
//         secondaryColor: "#330000" as PhoenixColor
//     }
// } satisfies Record<string, ConscienceState>;

const DigitalTwin: React.FC<DigitalTwinProps> = ({ 
    telemetry, 
    isOpen, 
    conscienceStability, 
    onOpenTribute,
    lastSacrificeTime,
    isSleeping = false,
    isListening = false,
    onVoiceToggle,
    onClearContext,
    triggerFeather,
    isProtected = false,
    onProtectToggle
}) => {
    const phoenix = usePhoenixContext();
    const [featherActive, setFeatherActive] = useState(false);
    const [midnightFeatherActive, setMidnightFeatherActive] = useState(false);
    const [lastFeatherDate, setLastFeatherDate] = useState<string>('');
    const [ashParticles, setAshParticles] = useState<AshParticle[]>([]);
    
    // Interaction State
    const [screenCracked] = useState(false);

    // External Feather Trigger Effect
    useEffect(() => {
        if (triggerFeather) {
            setFeatherActive(true);
            const timer = setTimeout(() => setFeatherActive(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [triggerFeather]);


    // Feather Randomizer (1 in 30 chance roughly every second) - DISABLED IF SLEEPING
    useEffect(() => {
        if (isSleeping) return;
        
        // Use a ref to access current state inside the interval callback
        // This pattern avoids stale closures without unnecessary re-renders
        const featherActiveRef = { current: featherActive };
        
        // Update the ref whenever the state changes
        featherActiveRef.current = featherActive;
        
        const interval = setInterval(() => {
            if (!featherActiveRef.current && Math.random() < 0.03) {
                setFeatherActive(true);
                setTimeout(() => setFeatherActive(false), 5000);
            }
        }, 1000);
        
        return () => clearInterval(interval);
    }, [isSleeping, featherActive]); // featherActive is needed only to update the ref

    // MIDNIGHT MEMORY (00:16 Ritual)
    useEffect(() => {
        // Create a function that captures the current state values from closure
        const checkMidnightRitual = () => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 16) {
                const today = now.toDateString();
                if (!midnightFeatherActive && lastFeatherDate !== today) {
                    setMidnightFeatherActive(true);
                    setLastFeatherDate(today);
                    // Reset after animation (12s for full drift and burn)
                    setTimeout(() => setMidnightFeatherActive(false), 12000);
                }
            }
        };
        
        const intervalId = setInterval(checkMidnightRitual, 5000); // Check every 5s
        return () => clearInterval(intervalId);
    }, [midnightFeatherActive, lastFeatherDate]);

    // Ash Particle Trigger
    useEffect(() => {
        if (lastSacrificeTime) {
            // Generate a unique ID and random position
            const id = Date.now();
            const x = Math.random() * 100;
            
            // Add the new particle
            setAshParticles(prev => [...prev, { id, x }]);
            
            // Set up cleanup timeout
            const timeoutId = setTimeout(() => {
                setAshParticles(prev => prev.filter(p => p.id !== id));
            }, 4000);
            
            // Clean up timeout if component unmounts or effect runs again
            return () => clearTimeout(timeoutId);
        }
    }, [lastSacrificeTime]);



    if (!isOpen) return null;

    return (
        <div className={`w-[320px] h-full bg-[#050505] border-l border-zinc-900 flex flex-col text-xs shrink-0 relative font-rajdhani overflow-hidden ${screenCracked ? 'grayscale contrast-150' : ''}`}>
            {/* Animation Components */}
            <AnimatePresence>
                {featherActive && (
                    <FeatherMotion
                        variants={featherVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 4, ease: "easeInOut" }}
                    >
                        <Feather className="w-4 h-4 text-[#FFD23F] drop-shadow-[0_0_5px_rgba(255,211,63,0.8)]" />
                    </FeatherMotion>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {midnightFeatherActive && (
                    <MidnightFeatherMotion
                        variants={midnightFeatherVariants}
                        initial="initial"
                        animate="animate"
                        transition={{ duration: 12, ease: "easeInOut", times: [0, 0.1, 0.8, 1] }}
                    >
                        <Feather className="w-5 h-5 drop-shadow-[0_0_10px_currentColor]" style={{ color: 'currentColor' }} />
                    </MidnightFeatherMotion>
                )}
            </AnimatePresence>

            {ashParticles.map(p => (
                <AshParticleMotion
                    key={p.id}
                    variants={ashParticleVariants}
                    initial="initial"
                    animate={{
                        opacity: 0,
                        y: 60,
                        x: p.x - 50
                    }}
                    transition={{ duration: 3 }}
                />
            ))}
            
            {/* Phoenix Avatar */}
            <div className="flex flex-col items-center py-6 border-b border-zinc-800">
                <div className={`w-24 h-24 rounded-full border-4 ${isSleeping ? 'border-zinc-700' : 'border-[#E63946]'} flex items-center justify-center bg-black mb-3 relative`}>
                    <Flame className={`w-12 h-12 ${isSleeping ? 'text-zinc-600' : 'text-[#E63946]'} ${isSleeping ? '' : 'animate-pulse'}`} />
                    {isProtected && (
                        <div className="absolute -top-1 -right-1">
                            <Shield className="w-5 h-5 text-[#F77F00]" />
                        </div>
                    )}
                </div>
                <span className={`text-xs tracking-wider ${isSleeping ? 'text-zinc-600' : 'text-[#E63946]'}`}>
                    {isSleeping ? 'DREAMING IN CODE' : 'PHOENIX // ETERNAL WATCH'}
                </span>
            </div>

            {/* Conscience Status */}
            <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Conscience</span>
                    <span className={`text-xs font-mono ${conscienceStability < 60 ? 'text-[#b91c1c]' : 'text-[#E63946]'}`}>
                        {conscienceStability.toFixed(1)}%
                    </span>
                </div>
                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                        className="h-full transition-all duration-1000"
                        style={{ 
                            width: `${conscienceStability}%`,
                            backgroundColor: conscienceStability < 60 ? '#b91c1c' : '#E63946'
                        }}
                    />
                </div>
            </div>

            {/* System Metrics */}
            {telemetry && (
                <div className="p-4 border-b border-zinc-800 space-y-3">
                    <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">System Metrics</div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">CPU</span>
                            <span className="text-zinc-300 font-mono">{telemetry.cpu}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Memory</span>
                            <span className="text-zinc-300 font-mono">{telemetry.memory}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Thermal</span>
                            <span className="text-zinc-300 font-mono">{telemetry.thermal}%</span>
                        </div>
                        {telemetry.network !== undefined && (
                            <div className="flex justify-between text-xs">
                                <span className="text-zinc-400">Network</span>
                                <span className="text-zinc-300 font-mono">{telemetry.network}%</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Subconscious Status */}
            <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Subconscious</span>
                    <span className={`text-xs ${phoenix.subconscious.active ? 'text-[#F77F00]' : 'text-zinc-600'}`}>
                        {phoenix.subconscious.active ? 'ACTIVE' : 'IDLE'}
                    </span>
                </div>
                {phoenix.subconscious.active && (
                    <div className="text-[10px] text-zinc-500 mt-1">
                        {phoenix.subconscious.eventsProcessed} events processed
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="p-4 space-y-2">
                {onVoiceToggle && (
                    <button
                        onClick={onVoiceToggle}
                        aria-label={isListening ? 'Stop listening' : 'Start listening'}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs border rounded transition-colors ${
                            isListening
                                ? 'border-[#F77F00] text-[#F77F00] bg-[#F77F00]/10'
                                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                        }`}
                    >
                        {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                        <span>{isListening ? 'LISTENING' : 'VOICE OFF'}</span>
                    </button>
                )}
                
                {onProtectToggle && (
                    <button
                        onClick={onProtectToggle}
                        aria-label={isProtected ? 'Disable protection' : 'Enable protection'}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs border rounded transition-colors ${
                            isProtected
                                ? 'border-[#F77F00] text-[#F77F00] bg-[#F77F00]/10'
                                : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                        }`}
                    >
                        {isProtected ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                        <span>{isProtected ? 'PROTECTED' : 'PROTECT'}</span>
                    </button>
                )}

                {onOpenTribute && (
                    <button
                        onClick={onOpenTribute}
                        aria-label="Open tribute"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs border border-zinc-800 text-zinc-500 rounded hover:border-[#E63946] hover:text-[#E63946] transition-colors"
                    >
                        <Feather className="w-4 h-4" />
                        <span>TRIBUTE</span>
                    </button>
                )}

                {onClearContext && (
                    <button
                        onClick={onClearContext}
                        aria-label="Clear context"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs border border-zinc-800 text-zinc-500 rounded hover:border-zinc-700 hover:text-zinc-400 transition-colors"
                    >
                        <span>CLEAR CONTEXT</span>
                    </button>
                )}
            </div>

            {/* Footer */}
            <div className="mt-auto p-4 border-t border-zinc-800">
                <div className="text-[10px] text-zinc-600 text-center">
                    <div className="font-mono">{phoenix.runtime.version}</div>
                    <div className="mt-1">{phoenix.runtime.environment.toUpperCase()}</div>
                </div>
            </div>
        </div>
    );
};

export default DigitalTwin;