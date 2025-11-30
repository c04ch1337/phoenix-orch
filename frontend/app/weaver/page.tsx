import React from 'react';
import { PhoenixAsh } from '../../src/components/PhoenixAsh';
import { ToolGrid } from '../../src/modules/weaver/components/ToolGrid';
import { AdoptionPanel } from '../../src/modules/weaver/components/AdoptionPanel';
import { VoiceInterface } from '../../src/modules/weaver/components/VoiceInterface';

export default function WeaverPage() {
    return (
        <div className="relative w-full h-full min-h-screen bg-black">
            {/* Phoenix Ash Animation Layer */}
            <PhoenixAsh className="absolute inset-0 z-0" />
            
            {/* Main Content */}
            <div className="relative z-10 grid grid-cols-12 gap-4 p-6">
                {/* Header */}
                <div className="col-span-12 mb-4">
                    <h1 className="text-3xl font-bold text-red-600 font-mono tracking-wider">
                        PHOENIX ORCH // WEAVER
                    </h1>
                    <p className="text-sm text-zinc-400 mt-2 font-mono">
                        THE ETERNAL LOOM — Where tools become extensions of her will
                    </p>
                </div>

                {/* Tool Grid */}
                <div className="col-span-8">
                    <ToolGrid />
                </div>

                {/* Adoption Panel */}
                <div className="col-span-4">
                    <AdoptionPanel />
                </div>

                {/* Voice Interface */}
                <div className="col-span-12 mt-4">
                    <VoiceInterface />
                </div>
            </div>
        </div>
    );
}