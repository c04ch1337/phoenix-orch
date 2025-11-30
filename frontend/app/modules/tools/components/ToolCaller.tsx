"use client";

/**
 * ToolCaller Component
 *
 * Universal tool execution interface for any page.
 */

import { useState } from 'react';
import { Play, Loader2, Terminal } from 'lucide-react';
import { ToolInfo, ToolParams } from '../types';
import { useToolCall } from '../hooks/useToolCall';

interface ToolCallerProps {
    tools: ToolInfo[];
    onCall?: (name: string, params: ToolParams) => void;
}

export default function ToolCaller({ tools, onCall }: ToolCallerProps) {
    const [selectedTool, setSelectedTool] = useState<string>('');
    const [params, setParams] = useState<ToolParams>({});
    const [paramKey, setParamKey] = useState('');
    const [paramValue, setParamValue] = useState('');
    const { callTool, loading, error, output } = useToolCall();

    const handleCall = async () => {
        if (!selectedTool) return;

        try {
            const response = await callTool({
                name: selectedTool,
                params,
            });

            if (onCall) {
                onCall(selectedTool, params);
            }
        } catch (err) {
            console.error('Tool call failed:', err);
        }
    };

    const addParam = () => {
        if (paramKey.trim() && paramValue.trim()) {
            setParams(prev => ({
                ...prev,
                [paramKey.trim()]: paramValue.trim(),
            }));
            setParamKey('');
            setParamValue('');
        }
    };

    const removeParam = (key: string) => {
        setParams(prev => {
            const newParams = { ...prev };
            delete newParams[key];
            return newParams;
        });
    };

    return (
        <div className="border border-red-700/50 rounded-lg p-6 bg-black/50 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                CALL TOOL
            </h3>

            <div className="space-y-4">
                {/* Tool Selection */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Select Tool</label>
                    <select
                        value={selectedTool}
                        onChange={(e) => setSelectedTool(e.target.value)}
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600"
                        disabled={loading}
                    >
                        <option value="">-- Select a tool --</option>
                        {tools.map((tool) => (
                            <option key={tool.id} value={tool.name}>
                                {tool.name} - {tool.description}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Parameters */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Parameters</label>
                    <div className="space-y-2 mb-2">
                        {Object.entries(params).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2 bg-zinc-900 p-2 rounded">
                                <span className="text-sm text-zinc-300 flex-1">
                                    <span className="text-red-600">{key}:</span> {String(value)}
                                </span>
                                <button
                                    onClick={() => removeParam(key)}
                                    className="text-red-600 hover:text-red-400 text-xs"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={paramKey}
                            onChange={(e) => setParamKey(e.target.value)}
                            placeholder="Parameter name"
                            className="flex-1 bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600"
                            disabled={loading}
                        />
                        <input
                            type="text"
                            value={paramValue}
                            onChange={(e) => setParamValue(e.target.value)}
                            placeholder="Parameter value"
                            className="flex-1 bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600"
                            disabled={loading}
                            onKeyPress={(e) => e.key === 'Enter' && addParam()}
                        />
                        <button
                            onClick={addParam}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
                            disabled={loading}
                        >
                            Add
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-900/20 border border-red-700 rounded p-3">
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                )}

                {/* Output Display */}
                {output && (
                    <div className="bg-zinc-900 border border-zinc-700 rounded p-3">
                        <p className="text-green-400 text-sm font-mono">{output}</p>
                    </div>
                )}

                {/* Call Button */}
                <button
                    onClick={handleCall}
                    disabled={!selectedTool || loading}
                    className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>EXECUTING...</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5" />
                            <span>CALL TOOL</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

