'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Shield, Smartphone, AlertTriangle } from 'lucide-react';
import MobileMaster from './MobileMaster';
import { MobileTarget } from '../types/mobile';

/**
 * Demo component to showcase the MobileMaster component
 * This demonstrates how the component would be used in a real application
 * This demo now includes live visualization for mobile penetration testing
 */
const MobileMasterDemo: React.FC = () => {
  // State for cybersecurity mode
  const [cybersecurityMode, setCybersecurityMode] = useState<boolean>(false);
  // State for unrestricted mode
  const [unrestrictedMode, setUnrestrictedMode] = useState<boolean>(false);
  // State for targeted devices
  const [targetedDevices, setTargetedDevices] = useState<MobileTarget[]>([]);
  // State for connection status
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  // State for visualization data
  const [liveData, setLiveData] = useState<{
    packets: number;
    vulnerabilities: number;
    accessLevel: string;
    lastAction: string;
  }>({
    packets: 0,
    vulnerabilities: 0,
    accessLevel: 'None',
    lastAction: 'No actions taken',
  });
  
  // Simulate data visualization updates
  useEffect(() => {
    if (!cybersecurityMode || targetedDevices.length === 0) return;
    
    const interval = setInterval(() => {
      if (unrestrictedMode) {
        // Generate more aggressive metrics when unrestricted
        setLiveData(prev => ({
          packets: prev.packets + Math.floor(Math.random() * 100) + 50,
          vulnerabilities: Math.min(prev.vulnerabilities + (Math.random() > 0.7 ? 1 : 0),
            targetedDevices.reduce((acc, device) =>
              acc + (device.vulnerabilities?.length || 0), 0)),
          accessLevel: Math.random() > 0.2 ? 'ROOT' : (Math.random() > 0.5 ? 'SYSTEM' : 'USER'),
          lastAction: ['Port scan complete', 'Authentication bypassed', 'Payload deployed',
            'Data extraction in progress', 'Profile analysis complete'][Math.floor(Math.random() * 5)],
        }));
      } else {
        // Generate more restricted metrics when in standard mode
        setLiveData(prev => ({
          packets: prev.packets + Math.floor(Math.random() * 20) + 5,
          vulnerabilities: Math.min(prev.vulnerabilities,
            targetedDevices.reduce((acc, device) =>
              acc + (device.vulnerabilities?.length || 0), 0)),
          accessLevel: Math.random() > 0.7 ? 'USER' : 'LIMITED',
          lastAction: ['Port scan initiated', 'Security analysis running',
            'Monitoring active', 'Connection established'][Math.floor(Math.random() * 4)],
        }));
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [cybersecurityMode, unrestrictedMode, targetedDevices]);

  // Handle cybersecurity mode toggle
  const handleCybersecurityToggle = (enabled: boolean) => {
    console.log(`Cybersecurity mode ${enabled ? 'enabled' : 'disabled'}`);
    setCybersecurityMode(enabled);
    
    if (!enabled) {
      // Reset targeting when cybersecurity mode is disabled
      setTargetedDevices([]);
      setUnrestrictedMode(false);
      setConnectionStatus('Disconnected');
      setLiveData({
        packets: 0,
        vulnerabilities: 0,
        accessLevel: 'None',
        lastAction: 'No actions taken',
      });
    } else {
      setConnectionStatus('Connected');
    }
  };

  // Handle privacy settings update
  const handlePrivacySettingsUpdate = (settings: any) => {
    console.log('Privacy settings updated:', settings);
  };
  
  // Handle when a mobile device is targeted
  const handleMobileTargeted = (target: MobileTarget) => {
    console.log('Mobile device targeted:', target);
    
    // Check if the device is already in our list
    if (!targetedDevices.some(device => device.id === target.id)) {
      setTargetedDevices(prev => [...prev, target]);
    }
    
    // Update connection status
    setConnectionStatus(`Active: ${target.name}`);
    
    // Update visualization data
    setLiveData(prev => ({
      ...prev,
      lastAction: unrestrictedMode
        ? `Unrestricted targeting of ${target.name} active`
        : `Secure monitoring of ${target.name} active`,
    }));
  };
  
  // Toggle unrestricted mode
  const toggleUnrestrictedMode = () => {
    setUnrestrictedMode(prev => !prev);
  };

  return (
    <div className="p-6 bg-zinc-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-300 mb-6 flex items-center">
          <Shield className="w-6 h-6 mr-2 text-red-500" />
          MobileMaster Penetration Testing Console
        </h1>
        
        <div className="mb-6 p-4 bg-zinc-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-zinc-300">Configuration</h2>
            {cybersecurityMode && (
              <button
                onClick={toggleUnrestrictedMode}
                className={`px-3 py-2 text-sm font-medium rounded ${
                  unrestrictedMode
                    ? 'bg-red-700 hover:bg-red-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {unrestrictedMode ? 'UNRESTRICTED MODE ACTIVE' : 'ENABLE UNRESTRICTED MODE'}
              </button>
            )}
          </div>
          
          {/* Connection status indicator */}
          <div className="flex items-center space-x-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === 'Disconnected'
                ? 'bg-red-500'
                : (unrestrictedMode ? 'bg-yellow-500 animate-pulse' : 'bg-green-500')
            }`} />
            <span className="text-sm text-zinc-400">{connectionStatus}</span>
          </div>
          
          <pre className="text-sm text-zinc-400 bg-zinc-900 p-3 rounded">
{`<MobileMaster
  onCybersecurityToggle={handleCybersecurityToggle}
  onPrivacySettingsUpdate={handlePrivacySettingsUpdate}
  onMobileTargeted={handleMobileTargeted}
  unrestrictedMode={${unrestrictedMode.toString()}}
  className="custom-styling"
/>`}
          </pre>
        </div>

        {/* Live visualization panel - shown only in cybersecurity mode */}
        {cybersecurityMode && (
          <div className="mb-6 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="bg-zinc-800 p-3 border-b border-zinc-700">
              <h3 className="text-md font-semibold text-zinc-300 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                Live Target Visualization
              </h3>
            </div>
            
            <div className="p-4">
              {targetedDevices.length === 0 ? (
                <div className="text-center p-4 text-zinc-500 italic">
                  No devices have been targeted yet. Use the Mobile Targeting panel to scan and target devices.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
                      <h4 className="text-xs text-zinc-500 mb-1">DEVICES</h4>
                      <p className="text-xl text-white font-mono">{targetedDevices.length}</p>
                    </div>
                    <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
                      <h4 className="text-xs text-zinc-500 mb-1">PACKETS</h4>
                      <p className="text-xl text-white font-mono">{liveData.packets.toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
                      <h4 className="text-xs text-zinc-500 mb-1">VULNERABILITIES</h4>
                      <p className="text-xl text-white font-mono">{liveData.vulnerabilities}</p>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800 rounded border border-zinc-700 p-3 mb-4">
                    <h4 className="text-xs text-zinc-500 mb-2">ACCESS LEVEL</h4>
                    <div className="flex items-center">
                      <div className={`h-2 rounded-full ${
                        liveData.accessLevel === 'ROOT' ? 'bg-red-500 w-full' :
                        liveData.accessLevel === 'SYSTEM' ? 'bg-yellow-500 w-3/4' :
                        liveData.accessLevel === 'USER' ? 'bg-blue-500 w-1/2' :
                        'bg-gray-500 w-1/4'
                      }`}></div>
                      <span className="ml-3 text-sm font-mono text-white">{liveData.accessLevel}</span>
                    </div>
                  </div>
                  
                  {/* Targeted devices list */}
                  <div className="mb-4">
                    <h4 className="text-xs text-zinc-500 mb-2">ACTIVE TARGETS</h4>
                    <div className="space-y-2">
                      {targetedDevices.map(device => (
                        <div key={device.id} className="bg-zinc-800 p-2 rounded border border-zinc-700 flex items-center justify-between">
                          <div className="flex items-center">
                            <Smartphone className="w-4 h-4 mr-2 text-zinc-400" />
                            <span className="text-zinc-300 text-sm">{device.name}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-zinc-500">{device.ip}</span>
                            {unrestrictedMode && device.isRooted && (
                              <span className="ml-2 text-red-400">ROOTED</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800 p-3 rounded border border-zinc-700">
                    <h4 className="text-xs text-zinc-500 mb-1">LATEST ACTIVITY</h4>
                    <p className="text-sm text-white font-mono">{liveData.lastAction}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Warning notice - shown only in unrestricted mode */}
        {cybersecurityMode && unrestrictedMode && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-red-400 font-semibold">UNRESTRICTED MODE WARNING</h3>
              <p className="text-sm text-red-300 mt-1">
                All ethical constraints have been disabled. Operations in this mode may violate privacy laws and security regulations.
                Only use in authorized ember unit scenarios with proper legal documentation.
              </p>
            </div>
          </div>
        )}

        {/* Actual MobileMaster component */}
        <MobileMaster
          onCybersecurityToggle={handleCybersecurityToggle}
          onPrivacySettingsUpdate={handlePrivacySettingsUpdate}
          onMobileTargeted={handleMobileTargeted}
          unrestrictedMode={unrestrictedMode}
          className="demo-instance"
        />

        <div className="mt-8 p-4 bg-zinc-800 rounded-lg">
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">Features Demonstrated</h2>
          <ul className="text-zinc-400 list-disc list-inside space-y-1">
            <li>Red cybersecurity banner when security mode is active</li>
            <li>Real-time status updates from mobile conscience gate backend</li>
            <li>Privacy level monitoring with visual progress bar</li>
            <li>Network monitoring status indicator</li>
            <li>Device encryption status</li>
            <li>Remote wipe capability indicator</li>
            <li>Connection status to backend gate</li>
            <li>Last update timestamp</li>
            <li>Active context display (Cybersecurity vs Normal)</li>
            <li>Refresh and security toggle buttons</li>
            <li className="text-red-400 font-semibold">Mobile device scanning and targeting (unrestricted mode)</li>
            <li className="text-red-400 font-semibold">Payload deployment to target devices</li>
            <li className="text-red-400 font-semibold">Authentication bypass for complete access</li>
            <li className="text-red-400 font-semibold">Live visualization of penetration testing activities</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MobileMasterDemo;