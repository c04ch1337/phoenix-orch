"use client";

/**
 * PistolCard Component
 *
 * Special card for PISTOL - Phoenix ORCH's pure-Rust Nmap replacement.
 */

import { useState, useEffect } from 'react';
import { Target, Zap, Loader2, Radio } from 'lucide-react';

export default function PistolCard() {
    const [target, setTarget] = useState('');
    const [ports, setPorts] = useState('top1000');
    const [customPorts, setCustomPorts] = useState('');
    const [scanType, setScanType] = useState('syn');
    const [hostDiscovery, setHostDiscovery] = useState(false);
    const [osDetection, setOsDetection] = useState(false);
    const [serviceDetection, setServiceDetection] = useState(true);
    const [output, setOutput] = useState<string>('');
    const [openPorts, setOpenPorts] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;

        const eventSource = new EventSource(`http://127.0.0.1:5001/api/v1/sse/tools/pistol/${jobId}`);
        
        eventSource.onmessage = (event) => {
            try {
                const update = JSON.parse(event.data);
                if (update.data?.result) {
                    const result = update.data.result;
                    if (result.data?.open_ports) {
                        setOpenPorts(result.data.open_ports);
                    }
                    if (result.data?.stdout) {
                        setOutput(prev => prev + result.data.stdout);
                    }
                }
            } catch (err) {
                console.error('Failed to parse PISTOL update:', err);
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
        setLoading(true);
        setJobId(null);

        try {
            const response = await fetch('http://127.0.0.1:5001/api/v1/tools/pistol', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: target.trim(),
                    ports: ports === 'custom' ? customPorts : ports,
                    type: scanType,
                    host_discovery: hostDiscovery,
                    os_detection: osDetection,
                    service_detection: serviceDetection,
                    format: 'json',
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'PISTOL scan failed');
            }

            const data = await response.json();
            setJobId(data.job_id);
        } catch (err) {
            console.error('PISTOL scan failed:', err);
            setLoading(false);
        }
    };

    return (
        <div className="border-2 border-red-700 rounded-lg p-6 bg-red-900/10 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
                <Target className="w-8 h-8 text-red-600 animate-pulse" />
                <div>
                    <h3 className="text-xl font-bold text-red-600">PISTOL</h3>
                    <p className="text-xs text-zinc-400">Pure-Rust Nmap Replacement</p>
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
                        placeholder="192.168.1.0/24 or example.com"
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono"
                        disabled={loading}
                    />
                </div>

                {/* Ports */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Ports</label>
                    <select
                        value={ports}
                        onChange={(e) => setPorts(e.target.value)}
                        className="w-full bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600"
                        disabled={loading}
                    >
                        <option value="top1000">Top 1000</option>
                        <option value="top100">Top 100</option>
                        <option value="all">All (1-65535)</option>
                        <option value="custom">Custom Range</option>
                    </select>
                    {ports === 'custom' && (
                        <input
                            type="text"
                            value={customPorts}
                            onChange={(e) => setCustomPorts(e.target.value)}
                            placeholder="80,443,8080 or 1-1024"
                            className="w-full mt-2 bg-zinc-900 border border-red-700/50 text-white px-4 py-2 rounded focus:outline-none focus:border-red-600 font-mono"
                            disabled={loading}
                        />
                    )}
                </div>

                {/* Scan Type */}
                <div>
                    <label className="block text-sm text-zinc-400 mb-2">Scan Type</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setScanType('syn')}
                            className={`px-3 py-2 rounded transition-colors ${
                                scanType === 'syn'
                                    ? 'bg-red-700 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                            disabled={loading}
                        >
                            SYN
                        </button>
                        <button
                            onClick={() => setScanType('connect')}
                            className={`px-3 py-2 rounded transition-colors ${
                                scanType === 'connect'
                                    ? 'bg-red-700 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                            disabled={loading}
                        >
                            CONNECT
                        </button>
                        <button
                            onClick={() => setScanType('udp')}
                            className={`px-3 py-2 rounded transition-colors ${
                                scanType === 'udp'
                                    ? 'bg-red-700 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                            disabled={loading}
                        >
                            UDP
                        </button>
                    </div>
                </div>

                {/* Options */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <input
                            type="checkbox"
                            checked={hostDiscovery}
                            onChange={(e) => setHostDiscovery(e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-zinc-900 border-red-700 rounded"
                            disabled={loading}
                        />
                        Host Discovery (-sn)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <input
                            type="checkbox"
                            checked={osDetection}
                            onChange={(e) => setOsDetection(e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-zinc-900 border-red-700 rounded"
                            disabled={loading}
                        />
                        OS Detection (-O)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <input
                            type="checkbox"
                            checked={serviceDetection}
                            onChange={(e) => setServiceDetection(e.target.checked)}
                            className="w-4 h-4 text-red-600 bg-zinc-900 border-red-700 rounded"
                            disabled={loading}
                        />
                        Service/Version Detection (-sV)
                    </label>
                </div>

                {/* Open Ports Display */}
                {openPorts.length > 0 && (
                    <div className="bg-zinc-900 border border-orange-700/50 rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Radio className="w-4 h-4 text-orange-600 animate-pulse" />
                            <span className="text-sm font-bold text-orange-600">
                                {openPorts.length} OPEN PORTS DISCOVERED
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {openPorts.map((port) => (
                                <span
                                    key={port}
                                    className="px-2 py-1 bg-orange-900/30 text-orange-400 border border-orange-700 rounded text-xs font-mono animate-pulse"
                                    style={{
                                        boxShadow: '0 0 10px rgba(255, 127, 0, 0.5)',
                                    }}
                                >
                                    {port}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Output Display */}
                {output && (
                    <div className="bg-black border border-orange-700/50 rounded p-3 max-h-64 overflow-y-auto">
                        <pre className="text-orange-400 text-xs font-mono whitespace-pre-wrap">
                            {output}
                        </pre>
                    </div>
                )}

                {/* Scan Button */}
                <button
                    onClick={handleScan}
                    disabled={!target.trim() || loading}
                    className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>SCANNING...</span>
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5" />
                            <span>FIRE PISTOL</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

