"use client";

import { useState, useEffect } from 'react';
import { Connection, AdoptedTool } from '../types';
import { Play, FileText, Settings, Trash2 } from 'lucide-react';

interface ToolCardProps {
    tool: AdoptedTool;
    connections: Connection[];
    onAction?: (toolId: string, actionName: string) => void;
}

function ToolCard({ tool, connections, onAction }: ToolCardProps) {
    const getIcon = (iconName: string) => {
        switch (iconName.toLowerCase()) {
            case 'play':
                return <Play className="w-4 h-4" />;
            case 'document':
            case 'file':
                return <FileText className="w-4 h-4" />;
            case 'settings':
                return <Settings className="w-4 h-4" />;
            case 'delete':
            case 'trash':
                return <Trash2 className="w-4 h-4" />;
            default:
                return <span className="text-xs">{iconName[0]?.toUpperCase()}</span>;
        }
    };

    const formatLastUsed = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays}d ago`;
        } catch {
            return 'Unknown';
        }
    };

    return (
        <div className="relative p-4 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-red-600/50 transition-all duration-300 group">
            {/* Connection indicator */}
            {connections.length > 0 && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" 
                     title={`${connections.length} connection(s)`} />
            )}

            <div className="tool-header flex items-center gap-3 mb-4">
                <div className="tool-icon w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-red-glow">
                    <span className="text-lg font-bold text-white">{tool.type[0]?.toUpperCase() || '?'}</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white font-mono">{tool.name}</h3>
                    <p className="text-xs text-zinc-500">{tool.type}</p>
                </div>
            </div>

            <div className="tool-stats grid grid-cols-2 gap-4 mb-4">
                <div className="stat-group">
                    <div className="text-xs text-zinc-400 uppercase tracking-wider">CPU</div>
                    <div className={`text-lg font-mono font-bold ${
                        tool.metrics.cpu > 80 ? 'text-red-500' : 
                        tool.metrics.cpu > 50 ? 'text-orange-500' : 'text-green-500'
                    }`}>
                        {tool.metrics.cpu}%
                    </div>
                </div>
                <div className="stat-group">
                    <div className="text-xs text-zinc-400 uppercase tracking-wider">Memory</div>
                    <div className="text-lg font-mono font-bold text-white">
                        {tool.metrics.memory}MB
                    </div>
                </div>
                <div className="stat-group">
                    <div className="text-xs text-zinc-400 uppercase tracking-wider">Success</div>
                    <div className={`text-lg font-mono font-bold ${
                        tool.stats.successRate >= 99 ? 'text-green-500' : 
                        tool.stats.successRate >= 95 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                        {tool.stats.successRate.toFixed(1)}%
                    </div>
                </div>
                <div className="stat-group">
                    <div className="text-xs text-zinc-400 uppercase tracking-wider">Calls</div>
                    <div className="text-lg font-mono font-bold text-white">
                        {tool.stats.totalCalls.toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="mb-2">
                <div className="text-xs text-zinc-500">Last used: {formatLastUsed(tool.stats.lastUsed)}</div>
            </div>

            <div className="tool-actions flex items-center justify-between pt-3 border-t border-zinc-700">
                <div className="voice-alias px-3 py-1 rounded bg-zinc-800 text-xs font-mono text-red-500 border border-red-500/30">
                    {tool.voiceAlias}
                </div>
                <div className="actions flex gap-2">
                    {tool.actions.map((action) => (
                        <button
                            key={action.name}
                            onClick={() => onAction?.(tool.id, action.name)}
                            className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                            title={action.name}
                        >
                            {getIcon(action.icon)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function ToolGrid() {
    const [tools, setTools] = useState<AdoptedTool[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // TODO: Replace with real API call
        const fetchTools = async () => {
            try {
                setLoading(true);
                // Mock data - replace with real API call
                const mockTools: AdoptedTool[] = [
                    {
                        id: '1',
                        name: 'Security Scanner',
                        type: 'scanner',
                        metrics: { cpu: 15, memory: 256, latency: 50 },
                        stats: { totalCalls: 1234, successRate: 99.8, lastUsed: new Date().toISOString() },
                        voiceAlias: 'scan target',
                        actions: [
                            { name: 'Start Scan', icon: 'play', handler: () => {} },
                            { name: 'View Reports', icon: 'document', handler: () => {} },
                        ],
                    },
                ];
                
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 500));
                
                setTools(mockTools);
                setConnections([]);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load tools');
                console.error('Error loading tools:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchTools();
    }, []);

    const handleAction = (toolId: string, actionName: string) => {
        console.log(`Action ${actionName} triggered for tool ${toolId}`);
        // TODO: Implement action handling
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-zinc-400">Loading tools...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-red-500">Error: {error}</div>
            </div>
        );
    }

    if (tools.length === 0) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-zinc-400">No tools available</div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map(tool => (
                <ToolCard
                    key={tool.id}
                    tool={tool}
                    connections={connections.filter(c => c.sourceId === tool.id || c.targetId === tool.id)}
                    onAction={handleAction}
                />
            ))}
        </div>
    );
}