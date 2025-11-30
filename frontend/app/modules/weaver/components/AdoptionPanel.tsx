"use client";

import React, { useState } from 'react';
import { AdoptionQueue, AdoptionStatus, PendingAdoption } from '../types';

interface AdoptionProgressProps {
    status: AdoptionStatus;
}

function AdoptionProgress({ status }: AdoptionProgressProps) {
    const progressColors = {
        pending: 'bg-blue-500',
        analyzing: 'bg-purple-500',
        building: 'bg-yellow-500',
        testing: 'bg-orange-500',
        ready: 'bg-green-500',
        failed: 'bg-red-500',
        archived: 'bg-gray-500',
    };

    return (
        <div className="w-full">
            <div className="flex justify-between mb-1">
                <span className="text-sm text-neutral-300">{status.phase}</span>
                <span className="text-sm text-neutral-300">{status.progress}%</span>
            </div>
            <div className="w-full h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${progressColors[status.phase]} transition-all duration-500`}
                    style={{ width: `${status.progress}%` }}
                />
            </div>
            <div className="mt-1 text-sm text-neutral-400">{status.message}</div>
            {status.error && (
                <div className="mt-1 text-sm text-red-400">{status.error}</div>
            )}
        </div>
    );
}

interface AdoptionItemProps {
    adoption: PendingAdoption;
    onCancel?: () => void;
    onRetry?: () => void;
}

function AdoptionItem({ adoption, onCancel, onRetry }: AdoptionItemProps) {
    return (
        <div className="p-4 bg-neutral-800 rounded-lg border border-neutral-700">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="text-white font-medium">{adoption.name}</h4>
                    <div className="text-sm text-neutral-400">{adoption.repoUrl}</div>
                </div>
                {(adoption.status.phase === 'pending' || adoption.status.phase === 'failed') && (
                    <div className="flex gap-2">
                        {adoption.status.phase === 'pending' && (
                            <button
                                onClick={onCancel}
                                className="p-1 text-neutral-400 hover:text-neutral-200"
                            >
                                Cancel
                            </button>
                        )}
                        {adoption.status.phase === 'failed' && (
                            <button
                                onClick={onRetry}
                                className="p-1 text-blue-400 hover:text-blue-300"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                )}
            </div>
            <AdoptionProgress status={adoption.status} />
        </div>
    );
}

export default function AdoptionPanel() {
    const [repoUrl, setRepoUrl] = useState('');
    
    // Mock data - replace with real data from API
    const queue: AdoptionQueue = {
        pending: [
            {
                id: '1',
                repoUrl: 'https://github.com/test/tool1',
                name: 'Security Tool 1',
                status: {
                    phase: 'pending',
                    progress: 0,
                    message: 'Waiting to start...',
                },
                createdAt: '2025-11-29T16:00:00Z',
                updatedAt: '2025-11-29T16:00:00Z',
            },
        ],
        inProgress: [
            {
                id: '2',
                repoUrl: 'https://github.com/test/tool2',
                name: 'Analysis Tool',
                status: {
                    phase: 'analyzing',
                    progress: 45,
                    message: 'Analyzing dependencies...',
                },
                createdAt: '2025-11-29T15:55:00Z',
                updatedAt: '2025-11-29T16:00:00Z',
            },
        ],
        completed: [],
        failed: [],
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Add adoption request logic here
        setRepoUrl('');
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-4">Tool Adoption</h2>
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="Enter repository URL"
                        className="flex-1 px-3 py-2 bg-neutral-700 rounded-lg text-white placeholder-neutral-400 border border-neutral-600 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        Adopt
                    </button>
                </form>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
                {queue.inProgress.length > 0 && (
                    <div>
                        <h3 className="text-lg font-medium text-white mb-3">In Progress</h3>
                        <div className="space-y-3">
                            {queue.inProgress.map(adoption => (
                                <AdoptionItem key={adoption.id} adoption={adoption} />
                            ))}
                        </div>
                    </div>
                )}

                {queue.pending.length > 0 && (
                    <div>
                        <h3 className="text-lg font-medium text-white mb-3">Pending</h3>
                        <div className="space-y-3">
                            {queue.pending.map(adoption => (
                                <AdoptionItem
                                    key={adoption.id}
                                    adoption={adoption}
                                    onCancel={() => {/* Add cancel logic */}}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {queue.failed.length > 0 && (
                    <div>
                        <h3 className="text-lg font-medium text-white mb-3">Failed</h3>
                        <div className="space-y-3">
                            {queue.failed.map(adoption => (
                                <AdoptionItem
                                    key={adoption.id}
                                    adoption={adoption}
                                    onRetry={() => {/* Add retry logic */}}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}