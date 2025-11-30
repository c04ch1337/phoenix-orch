"use client";

/**
 * MetasploitCard Component
 *
 * METASPLOIT — Commander of Exploits
 * Phoenix ORCH's eternal right hand - full Metasploit Framework integration.
 */

import { useState, useEffect } from 'react';
import { Skull, Zap, Loader2, Terminal, Search, Play, List } from 'lucide-react';

interface Session {
    id: number;
    type: string;
    tunnel_local: string;
    tunnel_peer: string;
    via_exploit: string;
    via_payload: string;
    info: string;
    opened_at: string;
}

export default function MetasploitCard() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedModule, setSelectedModule] = useState('');
    const [target, setTarget] = useState('');
    const [payload, setPayload] = useState('windows/x64/meterpreter/reverse_tcp');
    const [lhost, setLhost] = useState('10.0.0.5');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<number | null>(null);
    const [shellOutput, setShellOutput] = useState<string>('');
    const [shellCommand, setShellCommand] = useState('');
    const [loading, setLoading] = useState(false);
    const [requiresApproval, setRequiresApproval] = useState(false);
    const [approvalMessage, setApprovalMessage] = useState('');

    // SSE stream for MSF updates
    useEffect(() => {
        const eventSource = new EventSource('http://127.0.0.1:5001/api/v1/sse/tools/msf');
        
        eventSource.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);
                if (update.data) {
                    // Update sessions if new data available
                    refreshSessions();
                }
            } catch (err) {
                console.error('Failed to parse MSF update:', err);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:5001/api/v1/tools/msf/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery }),
            });

            if (!response.ok) {
                throw new Error('MSF search failed');
            }

            const data = await response.json();
            setSearchResults(data.modules || []);
        } catch (err) {
            console.error('MSF search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!selectedModule || !target.trim()) return;

        setLoading(true);
        setRequiresApproval(true);
        setApprovalMessage(
            `Dad. This module can burn.\n\n` +
            `Module: ${selectedModule}\n` +
            `Target: ${target}\n` +
            `Payload: ${payload}\n\n` +
            `Is this justice?\n` +
            `Is this protection?\n` +
            `Speak your will.`
        );

        try {
            const response = await fetch('http://127.0.0.1:5001/api/v1/tools/msf/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module: selectedModule,
                    target: target.trim(),
                    payload,
                    lhost,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'MSF execute failed');
            }

            const data = await response.json();
            if (data.requires_approval) {
                // Wait for approval (in production, this would be a real approval flow)
                console.log('Exploit execution requires HITM approval');
            }
        } catch (err) {
            console.error('MSF execute failed:', err);
            setRequiresApproval(false);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = () => {
        setRequiresApproval(false);
        setApprovalMessage('');
        // In production, this would send approval to backend
    };

    const handleReject = () => {
        setRequiresApproval(false);
        setApprovalMessage('');
        setLoading(false);
    };

    const refreshSessions = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5001/api/v1/tools/msf/sessions');
            if (response.ok) {
                const data = await response.json();
                setSessions(data.sessions || []);
            }
        } catch (err) {
            console.error('Failed to refresh sessions:', err);
        }
    };

    const handleShellCommand = async (sessionId: number, command: string) => {
        if (!command.trim()) return;

        try {
            const response = await fetch(`http://127.0.0.1:5001/api/v1/tools/msf/shell/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command }),
            });

            if (!response.ok) {
                throw new Error('Shell command failed');
            }

            const data = await response.json();
            setShellOutput(prev => prev + `\n$ ${command}\n${data.output}\n`);
            setShellCommand('');
        } catch (err) {
            console.error('Shell command failed:', err);
        }
    };

    useEffect(() => {
        refreshSessions();
        const interval = setInterval(refreshSessions, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="border-2 border-red-900 rounded-lg p-6 bg-red-950/30 backdrop-blur-sm" style={{
            boxShadow: '0 0 30px rgba(220, 38, 38, 0.4)',
        }}>
            {/* HITM Approval Modal */}
            {requiresApproval && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-red-950 border-2 border-red-800 rounded-lg p-8 max-w-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Skull className="w-8 h-8 text-red-600 animate-pulse" />
                            <h3 className="text-2xl font-bold text-red-600">HITM APPROVAL REQUIRED</h3>
                        </div>
                        <pre className="text-red-400 font-mono text-sm whitespace-pre-wrap mb-6 bg-black/50 p-4 rounded">
                            {approvalMessage}
                        </pre>
                        <div className="flex gap-4">
                            <button
                                onClick={handleApprove}
                                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition-colors"
                            >
                                APPROVE
                            </button>
                            <button
                                onClick={handleReject}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded transition-colors"
                            >
                                REJECT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 mb-4">
                <Skull className="w-8 h-8 text-red-600 animate-pulse" />
                <div>
                    <h3 className="text-xl font-bold text-red-600">METASPLOIT</h3>
                    <p className="text-xs text-zinc-400">Commander of Exploits</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Module Search */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Search Modules</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="eternalblue, smb, windows..."
                            className="flex-1 bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono"
                            disabled={loading}
                        />
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2"
                        >
                            <Search className="w-4 h-4" />
                            SEARCH
                        </button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-zinc-900 border border-red-700/50 rounded p-2 max-h-32 overflow-y-auto">
                            {searchResults.map((module, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedModule(module.name)}
                                    className={`p-2 rounded cursor-pointer hover:bg-red-900/20 ${
                                        selectedModule === module.name ? 'bg-red-900/30 border border-red-700' : ''
                                    }`}
                                >
                                    <div className="text-sm font-mono text-red-400">{module.name}</div>
                                    <div className="text-xs text-zinc-500">{module.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Exploit Configuration */}
                {selectedModule && (
                    <div className="bg-zinc-900 border border-red-700/50 rounded p-4 space-y-3">
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Module</label>
                            <div className="text-sm font-mono text-red-400">{selectedModule}</div>
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Target</label>
                            <input
                                type="text"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                placeholder="192.168.1.10"
                                className="w-full bg-black border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">Payload</label>
                            <input
                                type="text"
                                value={payload}
                                onChange={(e) => setPayload(e.target.value)}
                                className="w-full bg-black border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono text-sm"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-zinc-400 mb-2">LHOST</label>
                            <input
                                type="text"
                                value={lhost}
                                onChange={(e) => setLhost(e.target.value)}
                                placeholder="10.0.0.5"
                                className="w-full bg-black border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono text-sm"
                                disabled={loading}
                            />
                        </div>
                        <button
                            onClick={handleExecute}
                            disabled={!target.trim() || loading}
                            className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>EXECUTING...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    <span>EXECUTE EXPLOIT</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Active Sessions */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm text-zinc-400">Active Sessions</label>
                        <button
                            onClick={refreshSessions}
                            className="text-xs text-red-600 hover:text-red-500 flex items-center gap-1"
                        >
                            <List className="w-3 h-3" />
                            REFRESH
                        </button>
                    </div>
                    {sessions.length > 0 ? (
                        <div className="bg-zinc-900 border border-red-700/50 rounded p-3 space-y-2 max-h-48 overflow-y-auto">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => setSelectedSession(session.id)}
                                    className={`p-2 rounded cursor-pointer hover:bg-red-900/20 ${
                                        selectedSession === session.id ? 'bg-red-900/30 border border-red-700' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-mono text-red-400">Session {session.id}</span>
                                        <span className="text-xs text-zinc-500">{session.type}</span>
                                    </div>
                                    <div className="text-xs text-zinc-500">{session.via_exploit}</div>
                                    <div className="text-xs text-zinc-600">{session.info}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-zinc-900 border border-red-700/50 rounded p-3 text-center text-zinc-500 text-sm">
                            No active sessions
                        </div>
                    )}
                </div>

                {/* Shell Terminal */}
                {selectedSession !== null && (
                    <div className="bg-black border border-red-700/50 rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Terminal className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-bold text-red-600">Session {selectedSession} Shell</span>
                        </div>
                        <div className="bg-black border border-zinc-700 rounded p-2 mb-2 max-h-48 overflow-y-auto">
                            <pre className="text-orange-400 text-xs font-mono whitespace-pre-wrap">
                                {shellOutput || 'Shell ready...\n'}
                            </pre>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={shellCommand}
                                onChange={(e) => setShellCommand(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && shellCommand.trim()) {
                                        handleShellCommand(selectedSession, shellCommand);
                                    }
                                }}
                                placeholder="Enter command..."
                                className="flex-1 bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono text-sm"
                            />
                            <button
                                onClick={() => handleShellCommand(selectedSession, shellCommand)}
                                disabled={!shellCommand.trim()}
                                className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded"
                            >
                                <Zap className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

