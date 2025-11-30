"use client";

/**
 * ToolRegistry Component
 *
 * Grid display of all registered tools with "Weave New" button.
 */

import { useState } from 'react';
import { Wrench, Plus, Flame } from 'lucide-react';
import { ToolInfo, ToolRegisterRequest } from '../types';
import { useToolsList } from '../hooks/useToolCall';

interface ToolRegistryProps {
    onWeaveNew?: (request: ToolRegisterRequest) => Promise<void>;
}

export default function ToolRegistry({ onWeaveNew }: ToolRegistryProps) {
    const { tools, loading } = useToolsList();
    const [showWeaveForm, setShowWeaveForm] = useState(false);
    const [repoUrl, setRepoUrl] = useState('');
    const [toolName, setToolName] = useState('');
    const [weaving, setWeaving] = useState(false);

    const handleWeave = async () => {
        if (!repoUrl.trim()) return;

        setWeaving(true);
        try {
            if (onWeaveNew) {
                await onWeaveNew({
                    github_repo: repoUrl.trim(),
                    name: toolName.trim() || undefined,
                });
                setRepoUrl('');
                setToolName('');
                setShowWeaveForm(false);
            }
        } catch (err) {
            console.error('Failed to weave tool:', err);
        } finally {
            setWeaving(false);
        }
    };

    const getHitmColor = (level: string) => {
        switch (level) {
            case 'Critical':
            case 'High':
                return 'border-red-700 bg-red-900/20';
            case 'Medium':
                return 'border-orange-700 bg-orange-900/20';
            case 'Low':
                return 'border-yellow-700 bg-yellow-900/20';
            default:
                return 'border-cyan-700 bg-cyan-900/20';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-red-600">TOOLS ARSENAL</h3>
                <button
                    onClick={() => setShowWeaveForm(!showWeaveForm)}
                    className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    <span>WEAVE NEW</span>
                </button>
            </div>

            {showWeaveForm && (
                <div className="border border-red-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm">
                    <h4 className="text-lg font-bold text-red-600 mb-4">WEAVE NEW TOOL</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">GitHub Repository URL</label>
                            <input
                                type="url"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                placeholder="https://github.com/username/tool-repo"
                                className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600"
                                disabled={weaving}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Tool Name (optional)</label>
                            <input
                                type="text"
                                value={toolName}
                                onChange={(e) => setToolName(e.target.value)}
                                placeholder="Custom name for this tool"
                                className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600"
                                disabled={weaving}
                            />
                        </div>
                        <button
                            onClick={handleWeave}
                            disabled={!repoUrl.trim() || weaving}
                            className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Flame className="w-5 h-5" />
                            <span>{weaving ? 'WEAVING...' : 'WEAVE TOOL'}</span>
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center text-zinc-400 py-8">Loading tools...</div>
            ) : tools.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">
                    No tools registered yet. Weave your first tool to begin.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map((tool) => (
                        <div
                            key={tool.id}
                            className={`border rounded-lg p-4 ${getHitmColor(tool.hitm_level)}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Wrench className="w-5 h-5 text-red-600" />
                                    <span className="font-bold text-white">{tool.name}</span>
                                </div>
                                <span className="text-xs text-zinc-400">v{tool.version}</span>
                            </div>
                            <p className="text-sm text-zinc-300 mb-3">{tool.description}</p>
                            <div className="flex items-center justify-between">
                                <span className={`text-xs px-2 py-1 rounded ${
                                    tool.hitm_level === 'Critical' || tool.hitm_level === 'High'
                                        ? 'bg-red-900/30 text-red-400 border border-red-700'
                                        : tool.hitm_level === 'Medium'
                                        ? 'bg-orange-900/30 text-orange-400 border border-orange-700'
                                        : 'bg-cyan-900/30 text-cyan-400 border border-cyan-700'
                                }`}>
                                    {tool.hitm_level}
                                </span>
                                {tool.last_used && (
                                    <span className="text-xs text-zinc-500">
                                        Used: {new Date(tool.last_used).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

