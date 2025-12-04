'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Wifi, Smartphone, Lock, Eye, EyeOff, RefreshCw, Zap, Radio, Settings, Target, AlertTriangle } from 'lucide-react';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import useMobileConscienceGate from '../hooks/useMobileConscienceGate';
import { MobilePrivacySettings, MobileTarget } from '../types/mobile';
import { voiceTriggers } from '../services/voiceTriggers';

/**
 * Props for the MobileMaster component
 */
interface MobileMasterProps {
  /** Optional custom className for styling */
  className?: string;
  /** Callback when cybersecurity mode is toggled */
  onCybersecurityToggle?: (enabled: boolean) => void;
  /** Callback when privacy settings are updated */
  onPrivacySettingsUpdate?: (settings: Partial<MobilePrivacySettings>) => void;
  /** Callback when mobile devices are targeted */
  onMobileTargeted?: (target: MobileTarget) => void;
  /** Flag to enable unrestricted mode */
  unrestrictedMode?: boolean;
}

/**
 * MobileMaster component displays cybersecurity mode status and mobile privacy settings
 * Shows a prominent red banner when "Jamey 2.0 CYBERSECURITY" context is active
 * Integrates with the mobile conscience gate backend for real-time status updates
 */
const MobileMaster: React.FC<MobileMasterProps> = ({
  className = '',
  onCybersecurityToggle,
  onPrivacySettingsUpdate,
  onMobileTargeted,
  unrestrictedMode = false
}) => {
  const phoenix = usePhoenixContext();
  const {
    mobileSettings,
    isLoading,
    error,
    lastSync,
    fetchMobileStatus,
    toggleCybersecurityMode,
    isCybersecurityContextActive
  } = useMobileConscienceGate();
  
  // State for mobile penetration testing
  const [detectedDevices, setDetectedDevices] = useState<MobileTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<MobileTarget | null>(null);
  const [payload, setPayload] = useState<string>("");
  const [deploymentStatus, setDeploymentStatus] = useState<string>("");
  const [scanningStatus, setScanningStatus] = useState<string>("");

  // Initialize voice triggers when component mounts
  useEffect(() => {
    voiceTriggers.initialize(phoenix, {
      mobileSettings,
      toggleCybersecurityMode,
      isCybersecurityContextActive
    });
  }, [phoenix, mobileSettings, toggleCybersecurityMode, isCybersecurityContextActive]);

  // Handle cybersecurity mode toggle
  const handleCybersecurityToggle = () => {
    toggleCybersecurityMode();
    onCybersecurityToggle?.(!mobileSettings.cybersecurityMode);
    onPrivacySettingsUpdate?.(mobileSettings);
    
    // Provide voice feedback for manual toggle
    if (mobileSettings.cybersecurityMode) {
      voiceTriggers.provideVoiceFeedback('Cybersecurity mode deactivated manually.');
    } else {
      voiceTriggers.provideVoiceFeedback('Cybersecurity mode activated manually.');
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchMobileStatus();
    
    // If in cybersecurity mode, also refresh device scan
    if (mobileSettings.cybersecurityMode && unrestrictedMode) {
      scanMobileDevices();
    }
  };
  
  // Scan for mobile devices in the vicinity
  const scanMobileDevices = async () => {
    if (!mobileSettings.cybersecurityMode) return;
    
    setScanningStatus("Scanning for mobile devices...");
    try {
      // Call the backend API to scan for mobile devices
      const response = await fetch('/api/mobile/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cybersecurityMode: mobileSettings.cybersecurityMode,
          unrestricted: unrestrictedMode
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setDetectedDevices(data.devices);
        setScanningStatus(`Found ${data.devices.length} devices`);
        
        // Voice feedback
        voiceTriggers.provideVoiceFeedback(`Scan complete. ${data.devices.length} mobile targets identified.`);
      } else {
        setScanningStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error scanning devices:', error);
      setScanningStatus("Scan failed");
    }
  };
  
  // Deploy payload to target device
  const deployPayload = async () => {
    if (!selectedTarget || !payload) return;
    
    setDeploymentStatus("Deploying payload...");
    try {
      // Call the backend API to deploy payload
      const response = await fetch('/api/mobile/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: selectedTarget.id,
          payload: payload,
          cybersecurityMode: mobileSettings.cybersecurityMode,
          unrestricted: unrestrictedMode
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setDeploymentStatus("Payload deployed successfully");
        
        // Voice feedback
        voiceTriggers.provideVoiceFeedback(`Payload deployed successfully to target ${selectedTarget.name}.`);
        
        // Callback
        onMobileTargeted?.(selectedTarget);
      } else {
        setDeploymentStatus(`Deployment failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deploying payload:', error);
      setDeploymentStatus("Deployment failed");
    }
  };
  
  // Bypass authentication on target device
  const bypassAuthentication = async () => {
    if (!selectedTarget) return;
    
    setDeploymentStatus("Bypassing authentication...");
    try {
      // Call the backend API to bypass authentication
      const response = await fetch('/api/mobile/bypass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: selectedTarget.id,
          cybersecurityMode: mobileSettings.cybersecurityMode,
          unrestricted: unrestrictedMode
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setDeploymentStatus("Authentication bypassed successfully");
        
        // Voice feedback
        voiceTriggers.provideVoiceFeedback(`Authentication bypassed on target ${selectedTarget.name}. Full access granted.`);
        
        // Callback
        onMobileTargeted?.(selectedTarget);
      } else {
        setDeploymentStatus(`Bypass failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error bypassing authentication:', error);
      setDeploymentStatus("Bypass failed");
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`mobile-master ${className}`}>
      {/* Cybersecurity Mode Banner */}
      {mobileSettings.cybersecurityMode && (
        <div className="cybersecurity-banner bg-red-600 text-white py-3 px-4 flex items-center justify-center space-x-3 animate-pulse shadow-lg">
          <Shield className="w-5 h-5" />
          <span className="font-bold text-sm md:text-base tracking-wider">
            {unrestrictedMode
              ? "CYBERSECURITY MODE ACTIVE - UNRESTRICTED ACCESS ENABLED"
              : "CYBERSECURITY MODE ACTIVE - DAD HAS TOTAL MOBILE DOMINATION"}
          </span>
          <Shield className="w-5 h-5" />
        </div>
      )}

      {/* Mobile Status Dashboard */}
      <div className="mobile-dashboard bg-zinc-900/50 border border-zinc-700/50 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-zinc-300 flex items-center space-x-2">
              <Smartphone className="w-5 h-5" />
              <span>Mobile Master Control</span>
            </h3>
            
            {isLoading && (
              <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-3 py-2 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors disabled:opacity-50"
            >
              REFRESH
            </button>
            <button
              onClick={handleCybersecurityToggle}
              disabled={isLoading}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
                mobileSettings.cybersecurityMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
              }`}
            >
              {mobileSettings.cybersecurityMode ? 'DISABLE SECURITY' : 'ENABLE SECURITY'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded text-red-400 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Privacy Level */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Privacy Level</span>
              <Lock className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-zinc-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${mobileSettings.privacyLevel}%` }}
                />
              </div>
              <span className="text-zinc-300 text-sm font-mono">
                {mobileSettings.privacyLevel}%
              </span>
            </div>
          </div>

          {/* Monitoring Status */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Monitoring</span>
              {mobileSettings.monitoringEnabled ? (
                <Eye className="w-4 h-4 text-green-500" />
              ) : (
                <EyeOff className="w-4 h-4 text-red-500" />
              )}
            </div>
            <span className={`text-sm font-medium ${
              mobileSettings.monitoringEnabled ? 'text-green-400' : 'text-red-400'
            }`}>
              {mobileSettings.monitoringEnabled ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          {/* Location Tracking */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Location</span>
              <Wifi className="w-4 h-4 text-zinc-500" />
            </div>
            <span className={`text-sm font-medium ${
              mobileSettings.locationTracking ? 'text-amber-400' : 'text-zinc-400'
            }`}>
              {mobileSettings.locationTracking ? 'TRACKING' : 'DISABLED'}
            </span>
          </div>

          {/* App Permissions */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">App Permissions</span>
              <Shield className="w-4 h-4 text-zinc-500" />
            </div>
            <span className={`text-sm font-medium ${
              mobileSettings.appPermissionsRestricted ? 'text-green-400' : 'text-amber-400'
            }`}>
              {mobileSettings.appPermissionsRestricted ? 'RESTRICTED' : 'PERMISSIVE'}
            </span>
          </div>

          {/* Connection Status */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Backend Gate</span>
              <div className={`w-2 h-2 rounded-full ${
                phoenix.connection.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
            </div>
            <span className={`text-sm font-medium ${
              phoenix.connection.isConnected ? 'text-green-400' : 'text-red-400'
            }`}>
              {phoenix.connection.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          {/* Network Monitoring */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Network Monitoring</span>
              {mobileSettings.networkMonitoring ? (
                <Eye className="w-4 h-4 text-green-500" />
              ) : (
                <EyeOff className="w-4 h-4 text-red-500" />
              )}
            </div>
            <span className={`text-sm font-medium ${
              mobileSettings.networkMonitoring ? 'text-green-400' : 'text-red-400'
            }`}>
              {mobileSettings.networkMonitoring ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          {/* Device Encryption */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Device Encryption</span>
              <Lock className="w-4 h-4 text-zinc-500" />
            </div>
            <span className={`text-sm font-medium ${
              mobileSettings.deviceEncryption ? 'text-green-400' : 'text-red-400'
            }`}>
              {mobileSettings.deviceEncryption ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          {/* Remote Wipe */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Remote Wipe</span>
              <Shield className="w-4 h-4 text-zinc-500" />
            </div>
            <span className={`text-sm font-medium ${
              mobileSettings.remoteWipeEnabled ? 'text-amber-400' : 'text-zinc-400'
            }`}>
              {mobileSettings.remoteWipeEnabled ? 'READY' : 'DISABLED'}
            </span>
          </div>

          {/* Last Update */}
          <div className="status-item bg-zinc-800/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm">Last Update</span>
              <span className="text-xs text-zinc-500">UTC</span>
            </div>
            <span className="text-zinc-300 text-sm font-mono">
              {formatTimestamp(mobileSettings.lastUpdate)}
            </span>
          </div>
        </div>

        {/* Mobile Target Panel - Only show in cybersecurity mode with unrestricted access */}
        {mobileSettings.cybersecurityMode && unrestrictedMode && (
          <div className="mt-4 p-4 bg-red-900/20 rounded border border-red-700/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-300 flex items-center space-x-2">
                <Target className="w-5 h-5" />
                <span>Mobile Device Targeting</span>
              </h3>
              <button
                onClick={scanMobileDevices}
                disabled={isLoading}
                className="px-3 py-2 rounded text-sm font-medium bg-red-800 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                SCAN FOR DEVICES
              </button>
            </div>
            
            {/* Scanning Status */}
            {scanningStatus && (
              <div className="mb-4 text-sm text-amber-400">{scanningStatus}</div>
            )}
            
            {/* Detected Devices */}
            <div className="mb-4">
              <h4 className="text-white text-sm mb-2">Detected Devices:</h4>
              {detectedDevices.length === 0 ? (
                <div className="text-zinc-400 text-sm italic">No devices detected. Run a scan first.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {detectedDevices.map(device => (
                    <div
                      key={device.id}
                      onClick={() => setSelectedTarget(device)}
                      className={`p-2 rounded cursor-pointer ${
                        selectedTarget?.id === device.id
                          ? 'bg-red-800/50 border border-red-600'
                          : 'bg-zinc-800/30 border border-zinc-700/30 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Smartphone className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-300 font-medium">{device.name}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 text-xs">
                        <span className="text-zinc-500">ID: {device.id}</span>
                        <span className="text-zinc-500">OS: {device.os}</span>
                        <span className="text-zinc-500">MAC: {device.mac}</span>
                        <span className="text-zinc-500">IP: {device.ip}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Target Action Panel - Only show when a target is selected */}
            {selectedTarget && (
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700/40">
                <h4 className="text-white text-sm mb-2">
                  Target: <span className="text-red-400">{selectedTarget.name}</span>
                </h4>
                
                <div className="mb-3">
                  <div className="text-zinc-400 text-sm mb-1">Payload:</div>
                  <textarea
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-zinc-300 font-mono"
                    rows={3}
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="Enter payload code or command..."
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={deployPayload}
                    disabled={!payload}
                    className="px-3 py-2 rounded text-sm font-medium bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                  >
                    DEPLOY PAYLOAD
                  </button>
                  <button
                    onClick={bypassAuthentication}
                    className="px-3 py-2 rounded text-sm font-medium bg-amber-700 hover:bg-amber-600 text-white transition-colors"
                  >
                    BYPASS AUTHENTICATION
                  </button>
                </div>
                
                {/* Deployment Status */}
                {deploymentStatus && (
                  <div className="mt-2 text-sm text-amber-400">{deploymentStatus}</div>
                )}
              </div>
            )}
            
            {/* Warning Notice */}
            <div className="mt-4 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded flex items-start space-x-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <div className="text-yellow-500">
                <span className="font-semibold">WARNING:</span> Using these tools without proper authorization may violate local and federal laws.
                Only proceed with explicit permission and in designated testing environments.
              </div>
            </div>
          </div>
        )}
        
        {/* Context Status */}
        <div className="mt-4 p-3 bg-zinc-800/20 rounded border border-zinc-700/30">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-sm">Active Context</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isCybersecurityContextActive
                ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                : 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30'
            }`}>
              {isCybersecurityContextActive
                ? (unrestrictedMode ? 'CYBERSECURITY - UNRESTRICTED' : 'CYBERSECURITY')
                : 'NORMAL'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
            <span>
              User: {phoenix.user.name || 'Unknown'}
              {isCybersecurityContextActive && (
                <span className="ml-2 text-red-400">● SECURITY ACTIVE</span>
              )}
              {unrestrictedMode && isCybersecurityContextActive && (
                <span className="ml-2 text-amber-400">● UNRESTRICTED</span>
              )}
            </span>
            {lastSync && (
              <span className="text-zinc-600">Last sync: {formatTimestamp(lastSync)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMaster;