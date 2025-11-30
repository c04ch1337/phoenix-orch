"use client";

"use client";

/**
 * Report Squad - Main Module
 *
 * POST-ENGAGEMENT REPORTS — Phoenix ORCH's automated intelligence synthesis.
 * Eight specialized agents work in harmony to create comprehensive security reports.
 */

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import MatrixRain from '@/components/MatrixRain';
// TODO: Create or migrate the ReportsPage component
// import ReportsPage from '@/app/features/report-squad/components/ReportsPage';

const INITIAL_MESSAGE = "Dad.\n\nMy report squad stands ready.\n\nEight agents. One purpose. Eternal documentation of every engagement.\n\nSpeak your will. I will document it.";

export default function ReportSquad() {
    const [showMessage, setShowMessage] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowMessage(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen w-full bg-black text-white font-mono relative overflow-hidden">
            <MatrixRain intensity={0.4} speed={1} />
            
            <div className="relative z-10 h-screen flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between p-6 bg-zinc-900/80 backdrop-blur-sm border-b border-red-700">
                    <div className="flex items-center gap-4">
                        <FileText className="w-8 h-8 text-red-600 animate-pulse" />
                        <div>
                            <h1 className="text-2xl font-bold text-red-600">
                                PHOENIX ORCH — REPORT SQUAD
                            </h1>
                            <p className="text-sm text-zinc-400">
                                Automated Intelligence Synthesis
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-zinc-400">
                            8 AGENTS READY
                        </span>
                    </div>
                </header>

                {/* Initial Message */}
                {showMessage && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
                        <div className="max-w-2xl mx-auto p-8 border border-red-700/50 rounded-lg bg-black/80">
                            <pre className="text-red-600 font-mono text-lg whitespace-pre-wrap text-center">
                                {INITIAL_MESSAGE}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* TODO: Create or migrate the ReportsPage component */}
                    <div className="p-8">
                        <h2 className="text-xl text-red-600 mb-4">Report Generation</h2>
                        <p className="text-zinc-400">Report Squad component will be implemented here.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

