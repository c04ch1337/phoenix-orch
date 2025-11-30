"use client";

/**
 * RepoIntegrator Component
 *
 * Component for integrating GitHub repositories into Phoenix ORCH
 */

import { useState } from 'react';
import { Flame, GitBranch, Loader2 } from 'lucide-react';
import { IntegrateRequest } from '../types';

interface RepoIntegratorProps {
    onIntegrate: (request: IntegrateRequest) => Promise<void>;
    loading?: boolean;
}

export default function RepoIntegrator({ onIntegrate, loading = false }: RepoIntegratorProps) {
    const [repoUrl, setRepoUrl] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!repoUrl.trim()) {
            setError('Repository URL is required');
            return;
        }

        try {
            await onIntegrate({
                repo_url: repoUrl.trim(),
                name: name.trim() || undefined,
            });
            setRepoUrl('');
            setName('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Integration failed');
        }
    };

    return (
        <div className="border border-red-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
                <GitBranch className="w-6 h-6 text-red-600" />
                <h3 className="text-lg font-bold text-red-600">WEAVE INTO ORCH</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                        GitHub Repository URL
                    </label>
                    <input
                        type="url"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/username/repo"
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                        disabled={loading}
                    />
                </div>

                <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                        Integration Name (optional)
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Custom name for this integration"
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                        disabled={loading}
                    />
                </div>

                {error && (
                    <div className="text-red-600 text-sm bg-red-900/20 border border-red-700/50 rounded p-2">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !repoUrl.trim()}
                    className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>WEAVING...</span>
                        </>
                    ) : (
                        <>
                            <Flame className="w-5 h-5" />
                            <span>WEAVE INTO ORCH</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}

