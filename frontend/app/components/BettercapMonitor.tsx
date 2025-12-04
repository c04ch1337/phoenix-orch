import React, { useState, useEffect, useRef } from 'react';
import { usePhoenixContext } from '../context/PhoenixContext';

interface CapturedPacket {
  timestamp: string;
  srcMac: string;
  srcIp: string;
  dstMac: string;
  dstIp: string;
  protocol: string;
  size: number;
  info: string;
}

interface BettercapSession {
  id: string;
  interface: string;
  startTime: string;
  packets: CapturedPacket[];
  status: 'active' | 'stopped' | 'error';
}

const BettercapMonitor: React.FC = () => {
  const { netPentestApi } = usePhoenixContext();
  
  const [availableInterfaces, setAvailableInterfaces] = useState<string[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [session, setSession] = useState<BettercapSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packets, setPackets] = useState<CapturedPacket[]>([]);
  const [filterText, setFilterText] = useState<string>('');
  
  const websocketRef = useRef<WebSocket | null>(null);
  const packetsEndRef = useRef<HTMLDivElement>(null);
  
  // Load available network interfaces
  useEffect(() => {
    const fetchInterfaces = async () => {
      try {
        const interfaces = await netPentestApi.listAvailableInterfaces();
        setAvailableInterfaces(interfaces);
        if (interfaces.length > 0) {
          setSelectedInterface(interfaces[0]);
        }
      } catch (err) {
        setError(`Failed to load network interfaces: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    fetchInterfaces();
  }, [netPentestApi]);
  
  // Auto-scroll to bottom of packet list
  useEffect(() => {
    if (packetsEndRef.current) {
      packetsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [packets.length]);
  
  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      
      // Stop monitoring if active
      if (isMonitoring) {
        netPentestApi.stopBettercapMonitor().catch(console.error);
      }
    };
  }, [isMonitoring, netPentestApi]);
  
  const startMonitoring = async () => {
    if (!selectedInterface) {
      setError('Please select a network interface');
      return;
    }
    
    try {
      setError(null);
      setPackets([]);
      
      // Start Bettercap session
      const sessionData = await netPentestApi.startBettercapMonitor(selectedInterface);
      setSession(sessionData);
      setIsMonitoring(true);
      
      // Connect to WebSocket for real-time updates
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${wsProtocol}://${window.location.host}/api/ws/bettercap/${sessionData.id}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected for Bettercap session');
      };
      
      ws.onmessage = (event) => {
        const packetData = JSON.parse(event.data);
        setPackets((currentPackets) => [...currentPackets, packetData]);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };
      
      websocketRef.current = ws;
    } catch (err) {
      setError(`Failed to start monitoring: ${err instanceof Error ? err.message : String(err)}`);
      setIsMonitoring(false);
    }
  };
  
  const stopMonitoring = async () => {
    try {
      await netPentestApi.stopBettercapMonitor();
      
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      
      if (session) {
        setSession({ ...session, status: 'stopped' });
      }
      
      setIsMonitoring(false);
    } catch (err) {
      setError(`Failed to stop monitoring: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Filter packets based on filter text
  const filteredPackets = filterText
    ? packets.filter((packet) => 
        packet.srcIp.includes(filterText) || 
        packet.dstIp.includes(filterText) || 
        packet.protocol.toLowerCase().includes(filterText.toLowerCase()) ||
        packet.info.toLowerCase().includes(filterText.toLowerCase()))
    : packets;
  
  // Get protocol distribution for the chart
  const protocolStats = packets.reduce((stats, packet) => {
    stats[packet.protocol] = (stats[packet.protocol] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-purple-400">Bettercap Network Monitor</h2>
      
      <div className="mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-gray-300 mb-2">Network Interface:</label>
            <select
              value={selectedInterface}
              onChange={(e) => setSelectedInterface(e.target.value)}
              disabled={isMonitoring}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableInterfaces.length === 0 && (
                <option value="">No interfaces available</option>
              )}
              
              {availableInterfaces.map((iface) => (
                <option key={iface} value={iface}>
                  {iface}
                </option>
              ))}
            </select>
          </div>
          
          {!isMonitoring ? (
            <button
              onClick={startMonitoring}
              disabled={!selectedInterface}
              className={`px-6 py-2 rounded font-semibold ${
                !selectedInterface
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500'
              }`}
            >
              Start Monitoring
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              className="px-6 py-2 rounded font-semibold bg-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Stop Monitoring
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-800 text-white rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {session && (
        <div className="mb-4 p-4 bg-gray-700 rounded">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-gray-400 block">Session ID:</span>
              <span className="text-white font-mono">{session.id}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Interface:</span>
              <span className="text-white">{session.interface}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Status:</span>
              <span className={`font-semibold ${
                session.status === 'active' ? 'text-green-400' : 
                session.status === 'stopped' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {session.status.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold text-purple-400">Captured Packets ({packets.length})</h3>
              <div className="flex items-center">
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter packets..."
                  className="px-3 py-1 bg-gray-900 text-white rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-gray-900 text-gray-400">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Destination</th>
                    <th className="px-4 py-2">Protocol</th>
                    <th className="px-4 py-2">Size</th>
                    <th className="px-4 py-2">Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {filteredPackets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-gray-400">
                        {isMonitoring ? "Waiting for packets..." : "No packets captured yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredPackets.map((packet, index) => (
                      <tr key={index} className="bg-gray-800 hover:bg-gray-700">
                        <td className="px-4 py-2 text-gray-300">{new Date(packet.timestamp).toLocaleTimeString()}</td>
                        <td className="px-4 py-2 text-cyan-400">{packet.srcIp}</td>
                        <td className="px-4 py-2 text-purple-400">{packet.dstIp}</td>
                        <td className="px-4 py-2 text-yellow-400">{packet.protocol}</td>
                        <td className="px-4 py-2 text-gray-300">{packet.size} B</td>
                        <td className="px-4 py-2 text-gray-300 truncate max-w-xs">{packet.info}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div ref={packetsEndRef} />
            </div>
          </div>
        </div>
      )}
      
      {packets.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-purple-400 mb-2">Protocol Distribution</h3>
          <div className="bg-gray-700 p-4 rounded">
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(protocolStats).map(([protocol, count]) => (
                <div key={protocol} className="bg-gray-800 rounded p-3">
                  <div className="text-lg font-bold text-white">{protocol}</div>
                  <div className="mt-1">
                    <span className="text-purple-400 text-lg font-bold">{count}</span>
                    <span className="text-gray-400 text-sm ml-1">packets</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-500 h-full"
                      style={{ width: `${(count / packets.length) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BettercapMonitor;