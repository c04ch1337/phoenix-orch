'use client';

import {
    PanelLeft,
    PanelRight,
    Terminal,
    WifiOff,
    Network,
    Flame
} from 'lucide-react';
// Zustand removed - using PhoenixContext only
// TODO: Replace with PhoenixContext hook when implemented

/**
 * Optional props that can override context-based defaults
 */
interface ConscienceGaugeProps {
    onSidebarToggle?: () => void;
    onRightPanelToggle?: () => void;
    onOpenConsole?: () => void;
}

/**
 * ConscienceGauge component displays the system status and stability meter
 * Uses Phoenix context and subconscious hook for state management
 */
const ConscienceGauge: React.FC<ConscienceGaugeProps> = ({
    onSidebarToggle,
    onRightPanelToggle,
    onOpenConsole
}: ConscienceGaugeProps) => {
    // TODO: Replace with PhoenixContext hook when implemented
    // Temporary defaults until PhoenixContext is created
    const conscienceStability = 97; // Default conscience level
    const isOffline = false; // Will be set from PhoenixContext
    const userName = 'DAD'; // Will be set from PhoenixContext
    const subconsciousActive = false; // Will be set from PhoenixContext
    
    // Using callback functions from props or defaults
    const handleSidebarToggle = onSidebarToggle || (() => console.log('Toggle sidebar'));
    const handleRightPanelToggle = onRightPanelToggle || (() => console.log('Toggle right panel'));
    const handleOpenConsole = onOpenConsole || (() => console.log('Open console'));
    
    // Determine if conscience is unstable
    const isUnstable = conscienceStability < 60;
    
    return (
        <div className="h-16 md:h-14 border-b border-zinc-900 bg-[#050505] flex items-center justify-between px-4 shrink-0 relative z-20">
            {/* Left Controls */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSidebarToggle}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                    title="Toggle Army Panel"
                >
                    <PanelLeft className="w-5 h-5" />
                </button>

                <button
                    onClick={handleOpenConsole}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors border border-zinc-800 rounded"
                >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>REPL</span>
                </button>
            </div>

            {/* Center Status */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isOffline ? 'bg-zinc-700' : 'bg-[#E63946]'} animate-pulse`}></div>
                    <div className="font-orbitron tracking-widest text-[10px] text-zinc-400">
                        {isOffline ? 'OFFLINE MODE' : 'PHOENIX ORCH LITE'}
                        {subconsciousActive && ' ● SUBCONSCIOUS ACTIVE'}
                    </div>
                    <div className={`w-3 h-3 rounded-full ${isOffline ? 'bg-zinc-700' : 'bg-[#E63946]'} animate-pulse`}></div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                    {isOffline ? (
                        <WifiOff className="w-3 h-3 text-zinc-600" />
                    ) : (
                        <Network className="w-3 h-3 text-[#F77F00]" />
                    )}
                    <div className="text-[10px] font-mono text-zinc-500">
                        {userName.toUpperCase()} :: CONSCIENCE {conscienceStability.toFixed(1)}%
                    </div>
                    <Flame className={`w-3 h-3 ${isUnstable ? 'text-[#b91c1c] animate-pulse' : 'text-[#F77F00]'}`} />
                </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleRightPanelToggle}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                    title="Toggle Digital Twin"
                >
                    <PanelRight className="w-5 h-5" />
                </button>
            </div>

            {/* Bottom Progress Bar */}
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-zinc-900">
                <div 
                    className="h-full transition-all duration-1000 ease-out"
                    style={{ 
                        width: `${conscienceStability}%`,
                        backgroundColor: isUnstable ? '#b91c1c' : '#E63946'
                    }}
                ></div>
            </div>
        </div>
    );
};

export default ConscienceGauge;