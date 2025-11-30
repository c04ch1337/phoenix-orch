'use client';

import { useState, useEffect } from 'react';
import { Feather } from 'lucide-react';
import { SystemTelemetry } from '@/types';
import { AnimatePresence } from 'framer-motion';
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
    telemetry: _telemetry, 
    isOpen, 
    conscienceStability: _conscienceStability, 
    onOpenTribute: _onOpenTribute,
    lastSacrificeTime,
    isSleeping = false,
    isListening: _isListening,
    onVoiceToggle: _onVoiceToggle,
    triggerFeather
}) => {
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
        const interval = setInterval(() => {
            if (!featherActive && Math.random() < 0.03) {
                setFeatherActive(true);
                setTimeout(() => setFeatherActive(false), 5000);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [featherActive, isSleeping]);

    // MIDNIGHT MEMORY (00:16 Ritual)
    useEffect(() => {
        const checkMidnight = setInterval(() => {
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
        }, 5000); // Check every 5s
        return () => clearInterval(checkMidnight);
    }, [midnightFeatherActive, lastFeatherDate]);

    // Ash Particle Trigger
    useEffect(() => {
        if (lastSacrificeTime) {
            const id = Date.now();
            const x = Math.random() * 100;
            setAshParticles(prev => [...prev, { id, x }]);
            setTimeout(() => {
                setAshParticles(prev => prev.filter(p => p.id !== id));
            }, 4000);
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
            
            {/* Rest of the component layout */}
        </div>
    );
};

export default DigitalTwin;