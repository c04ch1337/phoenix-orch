"use client";

/**
 * HitmPanel Component
 *
 * Human-in-the-Middle approval panel for spawn requests
 */

import { useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { ActiveSpawn } from '../types';

interface HitmPanelProps {
    pendingSpawns: ActiveSpawn[];
    onApprove: (spawnId: string) => Promise<void>;
    onReject: (spawnId: string) => Promise<void>;
}

export default function HitmPanel({ pendingSpawns, onApprove, onReject }: HitmPanelProps) {
    const [processing, setProcessing] = useState<string | null>(null);

    if (pendingSpawns.length === 0) {
        return (
            <div className="border border-zinc-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-zinc-400 mb-2">HUMAN-IN-THE-MIDDLE</h3>
                <p className="text-sm text-zinc-500">No pending approval requests</p>
            </div>
        );
    }

    const handleApprove = async (spawnId: string) => {
        setProcessing(spawnId);
        try {
            await onApprove(spawnId);
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (spawnId: string) => {
        setProcessing(spawnId);
        try {
            await onReject(spawnId);
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div className="border border-yellow-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-yellow-600" />
                <h3 className="text-lg font-bold text-yellow-600">AWAITING APPROVAL</h3>
                <span className="bg-yellow-900/30 text-yellow-400 text-xs px-2 py-1 rounded">
                    {pendingSpawns.length}
                </span>
            </div>

            <div className="space-y-4">
                {pendingSpawns.map((spawn) => (
                    <div
                        key={spawn.spawn_id}
                        className="border border-yellow-700/30 rounded p-4 bg-yellow-900/10"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-white">{spawn.framework}</span>
                                    <span className="text-xs text-zinc-400">#{spawn.spawn_id.slice(0, 8)}</span>
                                </div>
                                <p className="text-sm text-zinc-300">{spawn.task}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleApprove(spawn.spawn_id)}
                                disabled={processing === spawn.spawn_id}
                                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle className="w-4 h-4" />
                                <span>APPROVE</span>
                            </button>
                            <button
                                onClick={() => handleReject(spawn.spawn_id)}
                                disabled={processing === spawn.spawn_id}
                                className="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <XCircle className="w-4 h-4" />
                                <span>REJECT</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

