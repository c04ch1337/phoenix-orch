"use client";

/**
 * FrameworkGrid Component
 *
 * Grid display of available and integrated agentic AI frameworks
 */

import { useState } from 'react';
import { Zap, CheckCircle, Loader2 } from 'lucide-react';
import { FrameworkCard, EcosystemPlugin, SpawnRequest } from '../types';

interface FrameworkGridProps {
    plugins: EcosystemPlugin[];
    onSpawn: (request: SpawnRequest) => Promise<void>;
}

const DEFAULT_FRAMEWORKS: FrameworkCard[] = [
    { id: 'crewai', name: 'CrewAI', description: 'Multi-agent orchestration framework', icon: '🤖', color: 'cyan', status: 'available' },
    { id: 'langgraph', name: 'LangGraph', description: 'State machine for LLM applications', icon: '🕸️', color: 'orange', status: 'available' },
    { id: 'autogen', name: 'AutoGen', description: 'Conversational AI framework', icon: '💬', color: 'red', status: 'available' },
    { id: 'antigravity', name: 'Antigravity', description: 'Advanced agentic systems', icon: '🚀', color: 'yellow', status: 'available' },
    { id: 'notebooklm', name: 'NotebookLM', description: 'AI notebook and research tool', icon: '📓', color: 'cyan', status: 'available' },
    { id: 'notion', name: 'Notion', description: 'Workspace and knowledge base', icon: '📝', color: 'orange', status: 'available' },
    { id: 'llamaindex', name: 'LlamaIndex', description: 'Data framework for LLMs', icon: '🦙', color: 'red', status: 'available' },
    { id: 'semantickernel', name: 'Semantic Kernel', description: 'Microsoft AI orchestration', icon: '⚡', color: 'cyan', status: 'available' },
    { id: 'metagpt', name: 'MetaGPT', description: 'Multi-agent software development', icon: '🔧', color: 'orange', status: 'available' },
    { id: 'openai_swarm', name: 'OpenAI Swarm', description: 'Distributed agent coordination', icon: '🐝', color: 'red', status: 'available' },
];

export default function FrameworkGrid({ plugins, onSpawn }: FrameworkGridProps) {
    const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
    const [task, setTask] = useState('');
    const [hitm, setHitm] = useState(false);
    const [spawning, setSpawning] = useState<string | null>(null);
    
    const isSpawningFramework = selectedFramework ? spawning === selectedFramework : false;

    // Merge default frameworks with integrated plugins
    const frameworks = DEFAULT_FRAMEWORKS.map(fw => {
        const plugin = plugins.find(p => p.name.toLowerCase() === fw.name.toLowerCase());
        return {
            ...fw,
            status: plugin ? (plugin.status === 'online' ? 'integrated' : 'available') : 'available',
            plugin,
        };
    });

    const handleSpawn = async (framework: string) => {
        if (!task.trim()) {
            alert('Please enter a task');
            return;
        }

        setSpawning(framework);
        try {
            await onSpawn({
                framework,
                task: task.trim(),
                hitm,
            });
            setTask('');
            setSelectedFramework(null);
        } catch (err) {
            console.error('Failed to spawn:', err);
        } finally {
            setSpawning(null);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-red-600">AVAILABLE FRAMEWORKS</h3>
                {selectedFramework && (
                    <button
                        onClick={() => {
                            setSelectedFramework(null);
                            setTask('');
                        }}
                        className="text-zinc-400 hover:text-white text-sm"
                    >
                        Cancel
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {frameworks.map((fw) => {
                    const isSelected = selectedFramework === fw.name;

                    return (
                        <div
                            key={fw.id}
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                isSelected
                                    ? 'border-red-600 bg-red-900/20 shadow-lg'
                                    : 'border-zinc-700 hover:border-red-700/50 bg-zinc-900/50'
                            }`}
                            onClick={() => setSelectedFramework(fw.name)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{fw.icon}</span>
                                    <span className="font-bold text-white">{fw.name}</span>
                                </div>
                                {fw.status === 'integrated' && (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                )}
                            </div>
                            <p className="text-xs text-zinc-400 mb-3">{fw.description}</p>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                    fw.status === 'integrated'
                                        ? 'bg-green-900/30 text-green-400 border border-green-700'
                                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                }`}>
                                    {fw.status === 'integrated' ? 'INTEGRATED' : 'AVAILABLE'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedFramework && (
                <div className="border border-red-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm mt-6">
                    <h4 className="text-lg font-bold text-red-600 mb-4">
                        SPAWN {selectedFramework.toUpperCase()} TEAM
                    </h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Task</label>
                            <textarea
                                value={task}
                                onChange={(e) => setTask(e.target.value)}
                                placeholder="Describe the task for this team..."
                                className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 min-h-[100px]"
                                disabled={isSpawningFramework}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="hitm"
                                checked={hitm}
                                onChange={(e) => setHitm(e.target.checked)}
                                className="w-4 h-4 text-red-600 bg-zinc-900 border-red-700 rounded focus:ring-red-600"
                                disabled={isSpawningFramework}
                            />
                            <label htmlFor="hitm" className="text-sm text-zinc-400">
                                Require Human-in-the-Middle approval
                            </label>
                        </div>
                        <button
                            onClick={() => handleSpawn(selectedFramework)}
                            disabled={!task.trim() || isSpawningFramework}
                            className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSpawningFramework ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>SPAWNING...</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5" />
                                    <span>SPAWN TEAM</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

