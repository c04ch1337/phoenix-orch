import { useState, useEffect, useCallback } from 'react';
import usePhoenixContext from '@/hooks/usePhoenixContext';

interface Hak5Device {
  deviceId: string;
  vendorId: number;
  productId: number;
  serialNumber?: string;
  firmwareVersion: string;
  lastSeen: Date;
}

export default function Hak5Controller() {
  const phoenix = usePhoenixContext();
  const [devices, setDevices] = useState<Hak5Device[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [payload, setPayload] = useState('');

  const refreshDevices = useCallback(async () => {
    try {
      const result = await phoenix.invokeCoreCommand("list_hak5_devices") as unknown as { devices: Hak5Device[] };
      if (result?.devices) {
        setDevices(result.devices);
      }
      setOutput(prev => [...prev, 'Devices refreshed']);
    } catch (error) {
      console.error('Failed to refresh devices:', error);
    }
  }, [phoenix]);

  useEffect(() => {
    const interval = setInterval(refreshDevices, 5000);
    refreshDevices();
    return () => clearInterval(interval);
  }, [refreshDevices]);

  const executePayload = async () => {
    if (!selectedDevice || !payload) return;
    
    try {
      await phoenix.invokeCoreCommand("execute_hak5_payload", {
        deviceId: selectedDevice,
        payload
      });
      setOutput(prev => [...prev, `Payload executed on ${selectedDevice}`]);
    } catch (error) {
      console.error('Payload execution failed:', error);
      setOutput(prev => [...prev, `Error: ${(error as Error).message}`]);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      {/* Device List */}
      <div className="flex space-x-4">
        <select 
          className="bg-black/20 border border-orange-800/50 p-2"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
        >
          <option value="">Select Device</option>
          {devices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.deviceId} ({device.firmwareVersion})
            </option>
          ))}
        </select>
        <button
          onClick={refreshDevices}
          className="bg-orange-900/20 px-4 py-2 hover:bg-orange-900/40"
        >
          Refresh Devices
        </button>
      </div>

      {/* Payload Editor */}
      <textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        className="flex-1 bg-black/20 border border-orange-800/50 p-2 font-mono text-sm"
        placeholder="Enter payload..."
      />

      {/* Execution Controls */}
      <button
        onClick={executePayload}
        className="bg-orange-900/20 px-4 py-2 hover:bg-orange-900/40"
        disabled={!selectedDevice || !payload}
      >
        Execute Payload
      </button>

      {/* Output Console */}
      <div className="h-48 bg-black/20 border border-orange-800/50 p-2 overflow-y-auto">
        {output.map((line, i) => (
          <div key={i} className="text-orange-500/80 text-sm font-mono">{line}</div>
        ))}
      </div>
    </div>
  );
}