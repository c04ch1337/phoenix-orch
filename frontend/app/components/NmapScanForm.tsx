import React, { useState, useEffect } from 'react';
import { usePhoenixContext } from '../context/PhoenixContext';

type ScanType = 'Syn' | 'Ack' | 'Window' | 'Maimon' | 'Null' | 'Fin' | 'Xmas';

interface NmapScanFormProps {
  onScanComplete?: (results: any) => void;
}

const NmapScanForm: React.FC<NmapScanFormProps> = ({ onScanComplete }) => {
  const [target, setTarget] = useState<string>('');
  const [scanType, setScanType] = useState<ScanType>('Syn');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { netPentestApi } = usePhoenixContext();

  const scanTypes: { value: ScanType, label: string, description: string }[] = [
    { value: 'Syn', label: 'SYN Scan', description: 'Fast, stealthy scan that doesn\'t complete TCP connections' },
    { value: 'Ack', label: 'ACK Scan', description: 'Used to map firewall rulesets' },
    { value: 'Window', label: 'Window Scan', description: 'Detects open ports by examining TCP window size' },
    { value: 'Maimon', label: 'Maimon Scan', description: 'Specialized FIN/ACK scan technique' },
    { value: 'Null', label: 'NULL Scan', description: 'Stealthy scan with no flags set' },
    { value: 'Fin', label: 'FIN Scan', description: 'Stealthy scan using only FIN flag' },
    { value: 'Xmas', label: 'Xmas Scan', description: 'Sets FIN, PSH, and URG flags, "lighting up" the packet like a Christmas tree' },
  ];

  const handleScan = async () => {
    if (!target.trim()) {
      setError('Please enter a valid target');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      
      // Call the network scanning API
      const scanResults = await netPentestApi.executeNmapScan(target, scanType);
      
      setResults(scanResults);
      if (onScanComplete) {
        onScanComplete(scanResults);
      }
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-cyan-400">Nmap Network Scanner</h2>
      
      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Target (IP, CIDR, or hostname):</label>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="e.g., 192.168.1.1, 10.0.0.0/24, example.com"
          className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Scan Type:</label>
        <select
          value={scanType}
          onChange={(e) => setScanType(e.target.value as ScanType)}
          className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {scanTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <p className="text-gray-400 mt-1 text-sm">
          {scanTypes.find(t => t.value === scanType)?.description}
        </p>
      </div>
      
      <button
        onClick={handleScan}
        disabled={isScanning || !target.trim()}
        className={`px-6 py-2 rounded font-semibold ${
          isScanning || !target.trim()
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-cyan-600 text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800'
        }`}
      >
        {isScanning ? 'Scanning...' : 'Start Scan'}
      </button>
      
      {error && (
        <div className="mt-4 p-3 bg-red-800 text-white rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {results && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-cyan-400 mb-2">Scan Results</h3>
          <div className="bg-gray-700 rounded p-4 overflow-auto max-h-96">
            <div className="mb-3">
              <span className="text-gray-300 font-semibold">Target:</span>
              <span className="text-white ml-2">{results.target}</span>
            </div>
            <div className="mb-3">
              <span className="text-gray-300 font-semibold">Open Ports:</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {results.open_ports && results.open_ports.length > 0 ? (
                  results.open_ports.map((port: number) => (
                    <div key={port} className="bg-gray-600 rounded-md px-3 py-1 text-white">
                      {port} {results.services && results.services[port] ? `(${results.services[port]})` : ''}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400">No open ports found</div>
                )}
              </div>
            </div>
            
            {results.vulnerabilities && results.vulnerabilities.length > 0 && (
              <div className="mb-3">
                <span className="text-red-500 font-semibold">Potential Vulnerabilities:</span>
                <ul className="list-disc list-inside mt-1">
                  {results.vulnerabilities.map((vuln: string, index: number) => (
                    <li key={index} className="text-red-400">{vuln}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NmapScanForm;