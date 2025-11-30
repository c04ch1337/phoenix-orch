"use client";

/**
 * MasscanCard Component
 *
 * Special card for MASSCAN - Phoenix ORCH's Internet-scale port scanner.
 * Scan the entire Internet in under 5 minutes.
 */

import { useState, useEffect } from 'react';
import { Zap, Loader2, Globe, TrendingUp } from 'lucide-react';

export default function MasscanCard() {
    const [target, setTarget] = useState('');
    const [ports, setPorts] = useState('80,443');
    const [rate, setRate] = useState('1000000');
    const [banner, setBanner] = useState(false);
    const [exclude, setExclude] = useState('');
    const [output, setOutput] = useState<string>('');
    const [openPorts, setOpenPorts] = useState<any[]>([]);
    const [stats, setStats] = useState({ scanned: 0, rate: 0, elapsed: 0 });
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;

        const eventSource = new EventSource(`http://127.0.0.1:5001/api/v1/sse/tools/masscan/${jobId}`);
        
        eventSource.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);
                if (update.data?.result) {
                    const result = update.data.result;
                    if (result.data?.results) {
                        // Process real-time updates
                        for (const item of result.data.results) {
                            if (item.type === 'port_open') {
                                setOpenPorts(prev => [...prev, item]);
                                setOutput(prev => prev + `\n[OPEN] ${item.ip}:${item.port}`);
                            } else if (item.type === 'progress') {
                                setStats({
                                    scanned: item.scanned || 0,
                                    rate: item.rate || 0,
                                    elapsed: item.elapsed || 0,
                                });
                                setOutput(prev => prev + `\n[PROGRESS] Scanned: ${item.scanned?.toLocaleString()} IPs | Rate: ${(item.rate || 0).toFixed(0)} pps | Open: ${item.open_ports || 0}`);
                            } else if (item.type === 'complete') {
                                setOutput(prev => prev + `\n[COMPLETE] Total: ${item.scanned?.toLocaleString()} IPs scanned, ${item.open_ports || 0} open ports found`);
                                setLoading(false);
                                eventSource.close();
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to parse MASSCAN update:', err);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            setLoading(false);
        };

        return () => {
            eventSource.close();
        };
    }, [jobId]);

    const handleScan = async () => {
        if (!target.trim()) return;

        setOutput('');
        setOpenPorts([]);
        setStats({ scanned: 0, rate: 0, elapsed: 0 });
        setLoading(true);
        setJobId(null);

        try {
            const response = await fetch('http://127.0.0.1:5001/api/v1/tools/masscan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: target.trim(),
                    ports,
                    rate: parseInt(rate) || 1000000,
                    banner,
                    exclude: exclude.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'MASSCAN failed');
            }

            const data = await response.json();
            setJobId(data.job_id);
            setOutput(`🔥 MASSCAN STARTED\nTarget: ${target}\nPorts: ${ports}\nRate: ${rate} pps\n\n`);
        } catch (err) {
            console.error('MASSCAN failed:', err);
            setLoading(false);
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1_000_000_000) {
            return `${(num / 1_000_000_000).toFixed(2)}B`;
        } else if (num >= 1_000_000) {
            return `${(num / 1_000_000).toFixed(2)}M`;
        } else if (num >= 1_000) {
            return `${(num / 1_000).toFixed(2)}K`;
        }
        return num.toLocaleString();
    };

    return (
        <div className="border-2 border-red-800 rounded-lg p-6 bg-red-950/20 backdrop-blur-sm" style={{
            boxShadow: '0 0 20px rgba(220, 38, 38, 0.3)',
        }}>
            <div className="flex items-center gap-3 mb-4">
                <Globe className="w-8 h-8 text-red-600 animate-pulse" />
                <div>
                    <h3 className="text-xl font-bold text-red-600">MASSCAN</h3>
                    <p className="text-xs text-zinc-400">Internet in 5 Minutes</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Target Input */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Target</label>
                    <input
                        type="text"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder="0.0.0.0/0 or 192.168.1.0/24"
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono"
                        disabled={loading}
                    />
                </div>

                {/* Ports */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Ports</label>
                    <input
                        type="text"
                        value={ports}
                        onChange={(e) => setPorts(e.target.value)}
                        placeholder="80,443 or 1-65535"
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono"
                        disabled={loading}
                    />
                </div>

                {/* Rate */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Rate (packets/second)</label>
                    <input
                        type="text"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="1000000"
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono"
                        disabled={loading}
                    />
                    <p className="text-xs text-red-500 mt-1">
                        {parseInt(rate) > 1000000 ? '⚠️ High rate (>1M pps) requires approval' : ''}
                    </p>
                </div>

                {/* Options */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <input
                            type="checkbox"
                            checked={banner}
                            onChange={(e) => setBanner(e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-zinc-900 border-red-700 rounded"
                            disabled={loading}
                        />
                        Banner Grabbing
                    </label>
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Exclude (optional)</label>
                        <input
                            type="text"
                            value={exclude}
                            onChange={(e) => setExclude(e.target.value)}
                            placeholder="192.168.1.0/24"
                            className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono text-sm"
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Real-time Stats */}
                {stats.scanned > 0 && (
                    <div className="bg-red-950/30 border border-red-800/50 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-red-600 animate-pulse" />
                                <span className="text-sm font-bold text-red-600">LIVE STATS</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                            <div>
                                <div className="text-zinc-400">Scanned</div>
                                <div className="text-red-400 font-bold">{formatNumber(stats.scanned)}</div>
                            </div>
                            <div>
                                <div className="text-zinc-400">Rate</div>
                                <div className="text-orange-400 font-bold">{formatNumber(stats.rate)} pps</div>
                            </div>
                            <div>
                                <div className="text-zinc-400">Elapsed</div>
                                <div className="text-cyan-400 font-bold">{stats.elapsed}s</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Open Ports Display */}
                {openPorts.length > 0 && (
                    <div className="bg-zinc-900 border border-red-800/50 rounded p-3 max-h-48 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-red-600 animate-pulse" />
                            <span className="text-sm font-bold text-red-600">
                                {openPorts.length} OPEN PORTS
                            </span>
                        </div>
                        <div className="space-y-1">
                            {openPorts.slice(-20).map((item, idx) => (
                                <div key={idx} className="text-xs font-mono text-red-400">
                                    {item.ip}:{item.port}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Output Display */}
                {output && (
                    <div className="bg-black border border-red-800/50 rounded p-3 max-h-64 overflow-y-auto">
                        <pre className="text-red-400 text-xs font-mono whitespace-pre-wrap">
                            {output}
                        </pre>
                    </div>
                )}

                {/* Scan Button */}
                <button
                    onClick={handleScan}
                    disabled={!target.trim() || loading}
                    className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        boxShadow: loading ? '0 0 20px rgba(220, 38, 38, 0.5)' : 'none',
                    }}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>SCANNING THE INTERNET...</span>
                        </>
                    ) : (
                        <>
                            <Globe className="w-5 h-5" />
                            <span>UNLEASH MASSCAN</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

