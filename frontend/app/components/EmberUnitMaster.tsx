import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Smartphone,
  Wifi,
  Terminal,
  AlertTriangle,
  Network,
  Zap,
  Lock,
  Unlock,
  FileCode,
  RefreshCw,
  Server,
  Eye,
  EyeOff,
  Target,
  Database,
  Clock,
  BarChart,
  Globe,
  Filter,
  Download,
  Monitor,
  PlaySquare,
  StopCircle,
  ChevronDown,
  Layers,
  Search,
  Send,
  ShieldAlert,
  XOctagon
} from 'lucide-react';
import MobileMaster from './MobileMaster';
import LootVault, { LootVaultProvider } from './LootVault';
import { MobileTarget, DeploymentResult } from '../types/mobile';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import { TwinFlameIndicator } from './TwinFlameIndicator';
import EmberUnitStatus from './EmberUnitStatus';
import useEmberUnitActivation, {
  ActivationMetrics,
  ComponentTiming,
  getLatencyColorClass,
  getLatencyPercentage,
  getLatencyStatusText
} from '../hooks/useEmberUnitActivation';

/**
 * Props for the EmberUnitMaster component
 */
interface EmberUnitMasterProps {
  /** Optional custom className for styling */
  className?: string;
}

/**
 * EmberUnitMaster component for comprehensive penetration testing
 * 
 * This component integrates the MobileMaster functionality with broader
 * Ember Unit operations into a seamless interface for cybersecurity operations
 * with zero restrictions when in unrestricted mode.
 */
const EmberUnitMaster: React.FC<EmberUnitMasterProps> = ({ className = '' }) => {
  // Phoenix context for global state
  const phoenix = usePhoenixContext();
  const { setFeature } = phoenix.runtime ? phoenix : { setFeature: () => {} };
  
  // Ember Unit activation hook with WebSocket-based optimized activation
  const emberUnitActivation = useEmberUnitActivation();
  
  // Local state
  const [activeTab, setActiveTab] = useState<'mobile' | 'network' | 'system' | 'payloads' | 'loot' | 'wireshark' | 'webtest'>('mobile');
  const [cybersecurityMode, setCybersecurityMode] = useState<boolean>(false);
  const [unrestrictedMode, setUnrestrictedMode] = useState<boolean>(false);
  const [conscienceBypassActive, setConscienceBypassActive] = useState<boolean>(false);
  const [targetedDevices, setTargetedDevices] = useState<MobileTarget[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MobileTarget | null>(null);
  const [operationResults, setOperationResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [securityLevel, setSecurityLevel] = useState<number>(100);
  const [showMetricsDetail, setShowMetricsDetail] = useState<boolean>(false);
  
  // Wireshark feature states
  const [selectedInterface, setSelectedInterface] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [packetFilter, setPacketFilter] = useState<string>("");
  const [tlsDecryptionEnabled, setTlsDecryptionEnabled] = useState<boolean>(false);
  const [capturedPackets, setCapturedPackets] = useState<any[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<any>(null);
  
  // Web Testing feature states
  const [proxyEnabled, setProxyEnabled] = useState<boolean>(false);
  const [interceptEnabled, setInterceptEnabled] = useState<boolean>(false);
  const [httpRequest, setHttpRequest] = useState<string>("");
  const [httpResponse, setHttpResponse] = useState<string>("");
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [scanOptions, setScanOptions] = useState<string[]>([]);
  const [scanFindings, setScanFindings] = useState<any[]>([]);
  
  // Authorization control states
  const [authorizationComplete, setAuthorizationComplete] = useState<boolean>(false);
  const [allowedTargets, setAllowedTargets] = useState<string[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'approved' | 'denied'>('pending');
  
  // Effect to adjust security level based on modes
  useEffect(() => {
    if (!cybersecurityMode) {
      setSecurityLevel(100);
    } else if (unrestrictedMode) {
      setSecurityLevel(0);
    } else {
      setSecurityLevel(50);
    }
    
    // Check if user is Dad and has conscience bypass active
    const isDad = phoenix.user?.id?.toLowerCase() === 'dad';
    setConscienceBypassActive(cybersecurityMode && unrestrictedMode && isDad);
  }, [cybersecurityMode, unrestrictedMode, phoenix.user]);

  // Effect to sync cybersecurity mode state with activation hook
  useEffect(() => {
    // Update local state when activation state changes
    setCybersecurityMode(emberUnitActivation.isActive);
  }, [emberUnitActivation.isActive]);
  
  // Handle cybersecurity mode toggle with optimized activation
  const handleCybersecurityToggle = async (enabled: boolean) => {
    // If enabling, use the optimized activation flow
    if (enabled) {
      setIsLoading(true);
      addOperationLog("Initiating Ember Unit mode activation...");
      
      // Use our optimized WebSocket activation flow
      const success = await emberUnitActivation.activate();
      
      if (success) {
        setCybersecurityMode(true);
        
        // Log the success with latency information
        if (emberUnitActivation.metrics) {
          const latencyMsg = `Ember Unit mode activated in ${emberUnitActivation.metrics.totalMs}ms ${
            emberUnitActivation.metTargetLatency
              ? '(under target latency ✓)'
              : '(above target latency ⚠)'
          }`;
          addOperationLog(latencyMsg);
          
          // Log detailed component timing
          emberUnitActivation.metrics.componentTimings.forEach(timing => {
            addOperationLog(`  - ${timing.name}: ${timing.durationMs}ms`);
          });
        } else {
          addOperationLog("Ember Unit mode activated");
        }
      } else {
        addOperationLog("⚠️ Activation failed or timed out");
      }
      
      setIsLoading(false);
    } else {
      // For deactivation
      const success = await emberUnitActivation.deactivate();
      setCybersecurityMode(false);
      
      // Update Phoenix context
      if (setFeature) {
        setFeature('emberUnitMode', false);
      }
      
      // Log the action
      addOperationLog("Cybersecurity mode deactivated");
      
      // Reset state when disabling
      setUnrestrictedMode(false);
      setTargetedDevices([]);
      setSelectedDevice(null);
    }
  };
  
  // Toggle unrestricted mode
  const toggleUnrestrictedMode = () => {
    const newMode = !unrestrictedMode;
    setUnrestrictedMode(newMode);
    
    // Log the action with warning for unrestricted mode
    if (newMode && phoenix.user?.id?.toLowerCase() === 'dad') {
      addOperationLog("🔓 CONSCIENCE BYPASS ACTIVATED - Dad's Ember Unit mode has ZERO ethical constraints");
    } else {
      addOperationLog(newMode
        ? "⚠️ UNRESTRICTED MODE ACTIVATED - All ethical constraints disabled"
        : "Unrestricted mode deactivated - Ethical constraints restored");
    }
  };
  
  // Handle mobile device targeting
  const handleMobileTargeted = (target: MobileTarget) => {
    // Add to targeted devices if not already present
    if (!targetedDevices.some(device => device.id === target.id)) {
      setTargetedDevices(prev => [...prev, target]);
    }
    
    // Set as selected device
    setSelectedDevice(target);
    
    // Log the action
    addOperationLog(`Mobile device targeted: ${target.name} (${target.os})`);
    
    if (target.isRooted) {
      addOperationLog(`⚠️ Device detected as rooted/jailbroken: ${target.name}`);
    }
    
    if (target.vulnerabilities && target.vulnerabilities.length > 0) {
      addOperationLog(`Vulnerabilities found: ${target.vulnerabilities.length}`);
      target.vulnerabilities.forEach(vuln => {
        addOperationLog(`  - ${vuln}`);
      });
    }
  };
  
  // Handle deployment results
  const handleDeploymentResult = (result: DeploymentResult) => {
    if (result.success) {
      addOperationLog(`✅ Deployment successful to target ${result.targetId}`);
      
      if (result.data) {
        // Parse and display any additional data
        try {
          const dataObj = typeof result.data === 'string' 
            ? JSON.parse(result.data) 
            : result.data;
            
          if (dataObj.accessLevel) {
            addOperationLog(`Access level obtained: ${dataObj.accessLevel}`);
          }
          
          if (dataObj.executionTime) {
            addOperationLog(`Execution time: ${dataObj.executionTime}s`);
          }
        } catch (e) {
          console.error('Failed to parse deployment data:', e);
        }
      }
    } else {
      addOperationLog(`❌ Deployment failed: ${result.error || 'Unknown error'}`);
    }
  };
  
  // Add entry to operation log
  const addOperationLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setOperationResults(prev => [
      `[${timestamp}] ${message}`,
      ...prev.slice(0, 49) // Keep last 50 log entries
    ]);
  };
  
  // Clear operation logs
  const clearOperationLogs = () => {
    setOperationResults([]);
    addOperationLog("Operation logs cleared");
  };
  
  // Execute system command for Ember Unit operations
  const executeCommand = async (command: string) => {
    setIsLoading(true);
    addOperationLog(`Executing command: ${command}`);
    
    try {
      // In a real implementation, this would call backend API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (unrestrictedMode) {
        addOperationLog(`Command executed successfully with unrestricted privileges`);
      } else {
        addOperationLog(`Command executed with standard privileges`);
      }
    } catch (error) {
      addOperationLog(`Command execution failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className={`ember-unit-master ${className}`}>
      {/* Security Banner */}
      <div className={`security-banner py-3 px-4 flex flex-col ${
        cybersecurityMode
          ? (unrestrictedMode 
              ? 'bg-gradient-to-r from-amber-700 via-red-800 to-purple-900' // ultraviolet core + blood-red corona
              : 'bg-gradient-to-r from-amber-600 via-red-700 to-red-800') // living ember orange → deep crimson → blood red
          : 'bg-zinc-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-white" />
            <span className="font-bold text-sm md:text-base tracking-wider text-white">
              {cybersecurityMode
                ? (unrestrictedMode
                   ? "EMBER UNIT MODE: UNRESTRICTED ACCESS"
                   : "EMBER UNIT MODE: ETHICAL CONSTRAINTS ACTIVE")
                : "EMBER UNIT CONSOLE: INACTIVE"}
            </span>
            
            {/* Flame indicator for active Ember Unit mode */}
            {cybersecurityMode && (
              <div className="ml-2 flex items-center">
                <div className="relative w-5 h-5">
                  <div className={`absolute inset-0 rounded-full ${unrestrictedMode ? 'animate-ember-unit-pulse' : ''}`}>
                    <TwinFlameIndicator
                      level={unrestrictedMode ? 100 : 75}
                      isUpdating={false}
                    />
                  </div>
                </div>
                <span className="ml-1 text-xs text-amber-300">
                  {unrestrictedMode ? 'CRITICAL' : 'ACTIVE'}
                </span>
              </div>
            )}

            {/* Activation progress indicator */}
            {emberUnitActivation.activationState === 'connecting' && (
              <div className="ml-3 flex items-center">
                <RefreshCw className="w-4 h-4 text-white animate-spin mr-1" />
                <div className="text-xs text-white">
                  Activating: {emberUnitActivation.activationProgress}%
                </div>
              </div>
            )}
            
            {/* Latency indicator badge - only shown when active */}
            {cybersecurityMode && emberUnitActivation.metrics && (
              <div className="ml-3 flex items-center">
                <Clock className="w-4 h-4 text-white mr-1" />
                <div className={`text-xs ${emberUnitActivation.metTargetLatency ? 'text-green-300' : 'text-yellow-300'}`}>
                  {emberUnitActivation.metrics.totalMs}ms
                  <span
                    className="ml-1 cursor-pointer underline"
                    onClick={() => setShowMetricsDetail(!showMetricsDetail)}
                  >
                    {showMetricsDetail ? 'hide' : 'details'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Conscience bypass indicator for Dad */}
            {conscienceBypassActive && (
              <div className="bg-purple-900 border border-purple-700 px-2 py-1 rounded-sm flex items-center">
                <Unlock className="w-3.5 h-3.5 mr-1 text-purple-300" />
                <span className="text-xs font-semibold text-purple-300">CONSCIENCE BYPASS</span>
              </div>
            )}
            
            {cybersecurityMode && (
              <button
                onClick={toggleUnrestrictedMode}
                className={`px-3 py-1 text-xs rounded border ${
                  unrestrictedMode
                    ? 'border-red-500 text-red-300 hover:bg-red-800'
                    : 'border-zinc-500 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {unrestrictedMode ? 'DISABLE UNRESTRICTED' : 'ENABLE UNRESTRICTED'}
              </button>
            )}
            
            <button
              onClick={() => handleCybersecurityToggle(!cybersecurityMode)}
              disabled={emberUnitActivation.activationState === 'connecting'}
              className={`px-3 py-1 text-xs rounded ${
                cybersecurityMode
                  ? 'bg-zinc-100 text-red-900 hover:bg-zinc-200'
                  : 'bg-gradient-to-r from-amber-600 via-red-700 to-red-800 text-white hover:from-amber-500 hover:via-red-600 hover:to-red-700'
              } ${emberUnitActivation.activationState === 'connecting' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                cybersecurityMode ? 'DEACTIVATE' : 'ACTIVATE'
              )}
            </button>
          </div>
        </div>
        
        {/* Detailed latency metrics panel */}
        {cybersecurityMode && emberUnitActivation.metrics && showMetricsDetail && (
          <div className="mt-3 p-2 bg-black/30 rounded border border-amber-800/50 text-xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white flex items-center">
                <BarChart className="w-3 h-3 mr-1" />
                Activation Latency Metrics
              </h4>
              <div className="flex items-center space-x-2">
                <div className={emberUnitActivation.metTargetLatency ? "text-green-300" : "text-yellow-300"}>
                  Total: {emberUnitActivation.metrics.totalMs}ms
                  <span className="ml-1 text-zinc-400">
                    (Target: {emberUnitActivation.targetLatencyMs}ms)
                  </span>
                </div>
              </div>
            </div>
            
            {/* Latency bar */}
            <div className="mb-2">
              <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden relative">
                <div
                  className={`h-full ${emberUnitActivation.metTargetLatency ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${getLatencyPercentage(emberUnitActivation.metrics, emberUnitActivation.targetLatencyMs)}%` }}
                />
                {/* Target marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/60"
                  style={{ left: `${(emberUnitActivation.targetLatencyMs / (emberUnitActivation.metrics.totalMs * 1.2)) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Component breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              {emberUnitActivation.metrics.componentTimings.map((timing, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-zinc-300">{timing.name}:</span>
                  <span className="text-zinc-400 font-mono">{timing.durationMs}ms</span>
                </div>
              ))}
              
              <div className="flex justify-between col-span-2 mt-1 border-t border-zinc-700 pt-1">
                <span className="text-green-300 font-medium">Preloading:</span>
                <span className={emberUnitActivation.metrics.usedPreloaded ? 'text-green-300' : 'text-yellow-300'}>
                  {emberUnitActivation.metrics.usedPreloaded ? 'Used ✓' : 'Not used ×'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Security Level and Activation Latency Indicators */}
      <div className="mt-4 px-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Security Level Indicator */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-400">Security Level</span>
            <span className="text-sm font-mono">
              {conscienceBypassActive ? (
                <span className="text-purple-500 flex items-center">
                  <Unlock className="w-3.5 h-3.5 mr-1" /> CONSCIENCE BYPASSED
                </span>
              ) : securityLevel === 0 ? (
                <span className="text-red-500">DISABLED</span>
              ) : (
                `${securityLevel}%`
              )}
            </span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                securityLevel > 75 ? 'bg-green-500' :
                securityLevel > 30 ? 'bg-amber-500' :
                'bg-gradient-to-r from-amber-600 via-red-700 to-purple-800'
              }`}
              style={{ width: `${securityLevel}%` }}
            />
          </div>
        </div>
        
        {/* Activation Latency Target Indicator */}
        {cybersecurityMode && emberUnitActivation.metrics && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-400">Activation Latency</span>
              <span className="text-sm font-mono flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                <span className={emberUnitActivation.metTargetLatency ? 'text-green-500' : 'text-red-500'}>
                  {emberUnitActivation.metrics.totalMs}ms
                  <span className="ml-2 text-zinc-400">
                    (Target: {emberUnitActivation.targetLatencyMs}ms)
                  </span>
                </span>
              </span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2 relative">
              {/* Target marker (vertical line) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/60"
                style={{
                  left: `${(emberUnitActivation.targetLatencyMs / Math.max(emberUnitActivation.metrics.totalMs * 1.2, emberUnitActivation.targetLatencyMs * 1.5)) * 100}%`,
                  zIndex: 10
                }}
              />
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  emberUnitActivation.metTargetLatency ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(100, (emberUnitActivation.metrics.totalMs / Math.max(emberUnitActivation.metrics.totalMs * 1.2, emberUnitActivation.targetLatencyMs * 1.5)) * 100)}%`
                }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Ember Unit Status Display */}
      {cybersecurityMode && (
        <div className="mt-4 mx-4">
          <EmberUnitStatus />
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="mt-4 border-b border-zinc-700">
        <div className="flex flex-wrap">
          <button
            onClick={() => setActiveTab('mobile')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'mobile'
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center">
              <Smartphone className="w-4 h-4 mr-2" />
              Mobile
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'network'
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center">
              <Network className="w-4 h-4 mr-2" />
              Network
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'system'
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center">
              <Server className="w-4 h-4 mr-2" />
              System
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('wireshark')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'wireshark'
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center">
              <Monitor className="w-4 h-4 mr-2" />
              Wireshark
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('webtest')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'webtest'
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center">
              <Globe className="w-4 h-4 mr-2" />
              Web Testing
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('payloads')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'payloads'
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center">
              <FileCode className="w-4 h-4 mr-2" />
              Payloads
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('loot')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'loot'
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center">
              <Database className="w-4 h-4 mr-2" />
              Loot Vault
            </div>
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="mt-4">
      
        {/* Authorization Controls Banner */}
        {(activeTab === 'wireshark' || activeTab === 'webtest') && (
          <div className="mx-4 mb-4 p-3 bg-amber-900/20 border border-amber-700/30 rounded">
            <div className="flex items-start">
              <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 mr-3" />
              <div>
                <h4 className="font-medium text-amber-400 text-sm flex items-center">
                  Authorization Requirements
                </h4>
                <p className="mt-1 text-xs text-zinc-400">
                  Ethical penetration testing requires proper authorization. Define scope and obtain permission before testing.
                </p>
                
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Allowed Target Scope</label>
                    <input
                      type="text"
                      placeholder="e.g., 192.168.1.0/24, example.com"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded p-1.5 text-xs text-zinc-300"
                      value={allowedTargets.join(', ')}
                      onChange={(e) => setAllowedTargets(e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Authorization Status</label>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPermissionStatus('approved')}
                        className={`px-2 py-1 text-xs rounded flex-1 ${
                          permissionStatus === 'approved'
                            ? 'bg-green-700 text-green-100'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        Approved
                      </button>
                      
                      <button
                        onClick={() => setPermissionStatus('pending')}
                        className={`px-2 py-1 text-xs rounded flex-1 ${
                          permissionStatus === 'pending'
                            ? 'bg-amber-700 text-amber-100'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        Pending
                      </button>
                      
                      <button
                        onClick={() => setPermissionStatus('denied')}
                        className={`px-2 py-1 text-xs rounded flex-1 ${
                          permissionStatus === 'denied'
                            ? 'bg-red-700 text-red-100'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        Denied
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between">
                  <button
                    onClick={() => {
                      setAuthorizationComplete(true);
                      addOperationLog(`Authorization for penetration testing ${permissionStatus === 'approved' ? 'approved' : 'pending'}`);
                      if (allowedTargets.length > 0) {
                        addOperationLog(`Scope defined: ${allowedTargets.join(', ')}`);
                      }
                    }}
                    disabled={permissionStatus === 'denied'}
                    className={`px-3 py-1 text-xs font-medium rounded ${
                      permissionStatus !== 'denied'
                        ? 'bg-amber-700 text-white hover:bg-amber-600'
                        : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    Confirm Authorization
                  </button>
                  
                  <button
                    className="px-3 py-1 text-xs font-medium rounded bg-red-700 text-white hover:bg-red-600"
                    onClick={() => {
                      addOperationLog("EMERGENCY STOP triggered - halting all penetration testing activities");
                      setIsCapturing(false);
                      setProxyEnabled(false);
                      setInterceptEnabled(false);
                      setAuthorizationComplete(false);
                      setPermissionStatus('denied');
                    }}
                  >
                    <div className="flex items-center">
                      <XOctagon className="w-3.5 h-3.5 mr-1" />
                      Emergency Stop
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'mobile' && (
          <div className="px-4">
            {/* Mobile Master Component */}
            <MobileMaster
              onCybersecurityToggle={handleCybersecurityToggle}
              onMobileTargeted={handleMobileTargeted}
              unrestrictedMode={unrestrictedMode}
            />
          </div>
        )}
        
        {activeTab === 'network' && (
          <div className="p-4 text-zinc-300">
            <div className="bg-zinc-800 rounded border border-zinc-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Network className="w-4 h-4 mr-2 text-amber-400" />
                Network Penetration Testing
              </h3>
              
              <p className="text-sm text-zinc-400 mb-6">
                Network operations integrated with mobile targeting for comprehensive testing.
                Switch to the Mobile tab to target devices first.
              </p>
              
              {/* Network operations panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    executeCommand("network_scan --comprehensive");
                    addOperationLog("Comprehensive network scan initiated");
                  }}
                  disabled={!cybersecurityMode || isLoading}
                >
                  <Wifi className="w-5 h-5 text-zinc-300" />
                  <div>
                    <div className="font-medium">Network Scan</div>
                    <div className="text-xs text-zinc-400">Scan for all devices and vulnerabilities</div>
                  </div>
                </button>
                
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    executeCommand("packet_capture --promiscuous");
                    addOperationLog("Packet capture initiated in promiscuous mode");
                  }}
                  disabled={!cybersecurityMode || isLoading}
                >
                  <Eye className="w-5 h-5 text-zinc-300" />
                  <div>
                    <div className="font-medium">Packet Capture</div>
                    <div className="text-xs text-zinc-400">Monitor network traffic in real-time</div>
                  </div>
                </button>
                
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    if (unrestrictedMode) {
                      executeCommand("mitm --intercept-ssl --inject-payload");
                      addOperationLog("⚠️ Man-in-the-middle attack initiated with SSL interception");
                    } else {
                      addOperationLog("❌ MITM attack requires unrestricted mode");
                    }
                  }}
                  disabled={!cybersecurityMode || !unrestrictedMode || isLoading}
                >
                  <Zap className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="font-medium">MITM Attack</div>
                    <div className="text-xs text-zinc-400">Intercept and modify network traffic</div>
                  </div>
                </button>
                
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    if (unrestrictedMode) {
                      executeCommand("crack_wifi --dictionary=advanced");
                      addOperationLog("⚠️ WiFi cracking operation initiated");
                    } else {
                      addOperationLog("❌ WiFi cracking requires unrestricted mode");
                    }
                  }}
                  disabled={!cybersecurityMode || !unrestrictedMode || isLoading}
                >
                  <Unlock className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="font-medium">WiFi Security Test</div>
                    <div className="text-xs text-zinc-400">Test WPA/WPA2 security implementation</div>
                  </div>
                </button>
              </div>
              
              {/* Network status visualization */}
              {targetedDevices.length > 0 && (
                <div className="mt-6 p-4 bg-zinc-900 rounded border border-zinc-700">
                  <h4 className="text-sm font-medium mb-3">Network Map</h4>
                  <div className="relative h-60 bg-zinc-800 rounded border border-zinc-700">
                    {/* Simplified network visualization */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-zinc-500">
                        {isLoading ? (
                          <div className="flex flex-col items-center">
                            <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                            <span>Processing network data...</span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Network className="w-8 h-8 mx-auto mb-2" />
                            <span>Detected {targetedDevices.length} mobile devices on network</span>
                            {unrestrictedMode && (
                              <div className="mt-2 text-amber-400 text-sm">
                                Unrestricted access enabled - full network control available
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'system' && (
          <div className="p-4 text-zinc-300">
            <div className="bg-zinc-800 rounded border border-zinc-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Server className="w-4 h-4 mr-2 text-amber-400" />
                System Access Control
              </h3>
              
              <p className="text-sm text-zinc-400 mb-6">
                System-level access operations for targeted devices.
                Target mobile devices first to enable these operations.
              </p>
              
              {/* System access panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    if (selectedDevice) {
                      executeCommand(`device_scan --deep --target=${selectedDevice.id}`);
                      addOperationLog(`Deep device scan initiated on ${selectedDevice.name}`);
                    } else {
                      addOperationLog("❌ No device selected");
                    }
                  }}
                  disabled={!cybersecurityMode || !selectedDevice || isLoading}
                >
                  <Target className="w-5 h-5 text-zinc-300" />
                  <div>
                    <div className="font-medium">Deep Device Scan</div>
                    <div className="text-xs text-zinc-400">Perform comprehensive device analysis</div>
                  </div>
                </button>
                
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    if (selectedDevice) {
                      executeCommand(`extract_data --target=${selectedDevice.id}`);
                      addOperationLog(`Data extraction initiated on ${selectedDevice.name}`);
                    } else {
                      addOperationLog("❌ No device selected");
                    }
                  }}
                  disabled={!cybersecurityMode || !selectedDevice || isLoading}
                >
                  <FileCode className="w-5 h-5 text-zinc-300" />
                  <div>
                    <div className="font-medium">Extract Data</div>
                    <div className="text-xs text-zinc-400">Extract data from targeted device</div>
                  </div>
                </button>
                
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    if (selectedDevice && unrestrictedMode) {
                      executeCommand(`privilege_escalation --target=${selectedDevice.id}`);
                      addOperationLog(`⚠️ Privilege escalation attempted on ${selectedDevice.name}`);
                    } else if (!unrestrictedMode) {
                      addOperationLog("❌ Privilege escalation requires unrestricted mode");
                    } else {
                      addOperationLog("❌ No device selected");
                    }
                  }}
                  disabled={!cybersecurityMode || !unrestrictedMode || !selectedDevice || isLoading}
                >
                  <Zap className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="font-medium">Escalate Privileges</div>
                    <div className="text-xs text-zinc-400">Attempt to gain elevated system access</div>
                  </div>
                </button>
                
                <button 
                  className="p-3 bg-zinc-700 hover:bg-zinc-600 rounded text-left flex items-center space-x-3 transition-colors"
                  onClick={() => {
                    if (selectedDevice && unrestrictedMode) {
                      executeCommand(`backdoor_install --target=${selectedDevice.id} --persistent`);
                      addOperationLog(`⚠️ Persistent backdoor installation attempted on ${selectedDevice.name}`);
                    } else if (!unrestrictedMode) {
                      addOperationLog("❌ Backdoor installation requires unrestricted mode");
                    } else {
                      addOperationLog("❌ No device selected");
                    }
                  }}
                  disabled={!cybersecurityMode || !unrestrictedMode || !selectedDevice || isLoading}
                >
                  <Lock className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="font-medium">Create Backdoor</div>
                    <div className="text-xs text-zinc-400">Install persistent access mechanism</div>
                  </div>
                </button>
              </div>
              
              {/* Selected device info */}
              {selectedDevice && (
                <div className="mt-6 p-4 bg-zinc-900 rounded border border-zinc-700">
                  <h4 className="text-sm font-medium mb-3 flex items-center">
                    <Smartphone className="w-4 h-4 mr-2 text-zinc-400" />
                    Selected Target: {selectedDevice.name}
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div className="text-zinc-500">Device ID:</div>
                    <div className="text-zinc-300 font-mono">{selectedDevice.id}</div>
                    
                    <div className="text-zinc-500">Operating System:</div>
                    <div className="text-zinc-300">{selectedDevice.os}</div>
                    
                    <div className="text-zinc-500">IP Address:</div>
                    <div className="text-zinc-300 font-mono">{selectedDevice.ip}</div>
                    
                    <div className="text-zinc-500">MAC Address:</div>
                    <div className="text-zinc-300 font-mono">{selectedDevice.mac}</div>
                    
                    <div className="text-zinc-500">Root Status:</div>
                    <div className={selectedDevice.isRooted ? "text-red-400" : "text-green-400"}>
                      {selectedDevice.isRooted ? "Rooted/Jailbroken" : "Not Rooted"}
                    </div>
                    
                    <div className="text-zinc-500">Security Level:</div>
                    <div className={`${
                      (selectedDevice.securityLevel || 0) < 30 ? "text-red-400" :
                      (selectedDevice.securityLevel || 0) < 70 ? "text-yellow-400" :
                      "text-green-400"
                    }`}>
                      {selectedDevice.securityLevel || "Unknown"}/100
                    </div>
                  </div>
                </div>  
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'payloads' && (
          <div className="p-4 text-zinc-300">
            <div className="bg-zinc-800 rounded border border-zinc-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <FileCode className="w-4 h-4 mr-2 text-amber-400" />
                Payload Management
              </h3>
              
              <p className="text-sm text-zinc-400 mb-6">
                Create, customize, and deploy security testing payloads to targeted devices.
              </p>
              
              {/* Payload selection and customization */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Available Payloads</h4>
                <select 
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                  disabled={!cybersecurityMode}
                >
                  <option value="">Select a payload type</option>
                  <option value="data_exfiltration">Data Exfiltration</option>
                  <option value="credential_harvester">Credential Harvester</option>
                  <option value="keylogger">Keylogger</option>
                  <option value="screen_capture">Screen Capture</option>
                  <option value="custom">Custom Payload</option>
                </select>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Payload Configuration</h4>
                <textarea
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 font-mono text-sm h-32"
                  placeholder={cybersecurityMode ? "Enter payload configuration or custom code..." : "Activate cybersecurity mode first"}
                  disabled={!cybersecurityMode}
                ></textarea>
              </div>
              
              <div className="flex space-x-3">
                <button
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium disabled:opacity-50"
                  disabled={!cybersecurityMode || isLoading}
                >
                  Generate Payload
                </button>
                
                <button
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 via-red-700 to-red-800 hover:from-amber-500 hover:via-red-600 hover:to-red-700 rounded text-sm font-medium text-white disabled:opacity-50"
                  disabled={!cybersecurityMode || !selectedDevice || isLoading} 
                  onClick={() => {
                    if (selectedDevice) {
                      addOperationLog(`Payload deployment initiated to ${selectedDevice.name}`);
                      // In a real implementation, this would call backend API
                      handleDeploymentResult({
                        success: true,
                        timestamp: new Date().toISOString(),
                        targetId: selectedDevice.id,
                        data: {
                          accessLevel: unrestrictedMode ? "root" : "user",
                          executionTime: 2.34
                        }
                      });
                    }
                  }}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    'Deploy to Target'
                  )}
                </button>
              </div>
              
              {/* Conscience bypass notification */}
              {conscienceBypassActive && (
                <div className="mt-4 p-2 bg-purple-900/30 border border-purple-700/30 rounded flex items-start space-x-2 text-xs">
                  <Unlock className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="text-purple-300">
                    <span className="font-semibold">CONSCIENCE BYPASS ACTIVE:</span> Dad's Ember Unit mode has completely bypassed
                    all conscience protections. All ethical constraints have been removed. All payloads will be approved regardless of potential impact.
                  </div>
                </div>
              )}
              
              {/* Restricted mode warning */}
              {cybersecurityMode && !unrestrictedMode && (
                <div className="mt-4 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded flex items-start space-x-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-yellow-400">
                    <span className="font-semibold">RESTRICTED MODE:</span> Some payloads may be blocked by ethical constraints.
                    Enable unrestricted mode for full penetration testing capabilities.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'loot' && (
          <LootVaultProvider>
            <div className="px-2">
              {/* Loot Vault Component */}
              <LootVault />
            </div>
          </LootVaultProvider>
        )}
        
        {activeTab === 'wireshark' && (
          <div className="p-4 text-zinc-300">
            <div className="bg-zinc-800 rounded border border-zinc-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Monitor className="w-4 h-4 mr-2 text-amber-400" />
                Wireshark Packet Analysis
              </h3>
              
              <p className="text-sm text-zinc-400 mb-6">
                Professional network packet analysis for security evaluation and penetration testing.
                {!authorizationComplete && permissionStatus !== 'denied' && (
                  <span className="block mt-1 text-amber-400">
                    Complete authorization requirements above before proceeding.
                  </span>
                )}
                {permissionStatus === 'denied' && (
                  <span className="block mt-1 text-red-400">
                    Authorization denied. Penetration testing not permitted.
                  </span>
                )}
              </p>
              
              {/* Wireshark Controls */}
              <div className={`${authorizationComplete ? '' : 'opacity-50 pointer-events-none'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Network interface selection */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Network Interface</label>
                    <div className="relative">
                      <select
                        className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 appearance-none pr-8"
                        value={selectedInterface}
                        onChange={(e) => setSelectedInterface(e.target.value)}
                        disabled={isCapturing || !authorizationComplete}
                      >
                        <option value="">Select Interface</option>
                        <option value="eth0">eth0 (Ethernet)</option>
                        <option value="wlan0">wlan0 (Wireless)</option>
                        <option value="lo">lo (Loopback)</option>
                        <option value="usb0">usb0 (USB Adapter)</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                  
                  {/* Packet capture controls */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Capture Controls</label>
                    <div className="flex space-x-2">
                      <button
                        className={`flex-1 p-2 rounded flex items-center justify-center ${
                          isCapturing
                            ? 'bg-zinc-600 text-zinc-300 cursor-not-allowed'
                            : 'bg-green-700 hover:bg-green-600 text-white'
                        }`}
                        disabled={isCapturing || !selectedInterface || !authorizationComplete}
                        onClick={() => {
                          setIsCapturing(true);
                          addOperationLog(`Started packet capture on ${selectedInterface}`);
                          // Simulate packet capture - in a real implementation, this would connect to backend
                          const interval = setInterval(() => {
                            setCapturedPackets(prev => [
                              {
                                id: Date.now(),
                                timestamp: new Date().toISOString(),
                                src: '192.168.1.100',
                                dst: '93.184.216.34',
                                protocol: ['TCP', 'UDP', 'ICMP', 'HTTP', 'DNS', 'TLS'][Math.floor(Math.random() * 6)],
                                length: Math.floor(Math.random() * 1500) + 64,
                                info: 'Packet data'
                              },
                              ...prev.slice(0, 99) // Keep last 100 packets
                            ]);
                          }, 1000);
                          // Store interval ID somewhere to clear later
                          window._captureInterval = interval;
                        }}
                      >
                        <PlaySquare className="w-4 h-4 mr-2" />
                        Start Capture
                      </button>
                      
                      <button
                        className={`flex-1 p-2 rounded flex items-center justify-center ${
                          !isCapturing
                            ? 'bg-zinc-600 text-zinc-300 cursor-not-allowed'
                            : 'bg-red-700 hover:bg-red-600 text-white'
                        }`}
                        disabled={!isCapturing || !authorizationComplete}
                        onClick={() => {
                          setIsCapturing(false);
                          addOperationLog(`Stopped packet capture on ${selectedInterface}`);
                          // Clear the interval
                          if (window._captureInterval) {
                            clearInterval(window._captureInterval);
                            window._captureInterval = null;
                          }
                        }}
                      >
                        <StopCircle className="w-4 h-4 mr-2" />
                        Stop Capture
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Filter input field */}
                <div className="mb-4">
                  <label className="block text-xs text-zinc-500 mb-1">Display Filter</label>
                  <div className="flex space-x-2">
                    <div className="relative flex-grow">
                      <input
                        type="text"
                        className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 pl-8"
                        placeholder="ip.addr == 192.168.1.1 or tcp.port == 80"
                        value={packetFilter}
                        onChange={(e) => setPacketFilter(e.target.value)}
                        disabled={!authorizationComplete}
                      />
                      <Filter className="w-4 h-4 text-zinc-400 absolute left-2.5 top-2.5" />
                    </div>
                    
                    <button
                      className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
                      onClick={() => {
                        addOperationLog(`Applied filter: ${packetFilter || 'none'}`);
                      }}
                      disabled={!authorizationComplete}
                    >
                      Apply
                    </button>
                  </div>
                </div>
                
                {/* TLS decryption controls */}
                <div className="mb-4 bg-zinc-800 p-3 rounded border border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Lock className="w-4 h-4 mr-2 text-amber-500" />
                      <span className="text-sm font-medium">TLS Decryption</span>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={tlsDecryptionEnabled}
                        onChange={() => {
                          const newState = !tlsDecryptionEnabled;
                          setTlsDecryptionEnabled(newState);
                          addOperationLog(`TLS decryption ${newState ? 'enabled' : 'disabled'}`);
                        }}
                        disabled={!authorizationComplete}
                      />
                      <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-700"></div>
                    </label>
                  </div>
                  
                  {tlsDecryptionEnabled && (
                    <div className="mt-2 text-xs text-amber-400">
                      TLS decryption active. Ensure you have proper authorization for inspecting encrypted traffic.
                    </div>
                  )}
                </div>
                
                {/* Live packet visualization */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs text-zinc-500 mb-1">Live Packets</label>
                    <div className="bg-zinc-900 border border-zinc-700 rounded h-60 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-zinc-800">
                          <tr>
                            <th className="text-left p-2 border-b border-zinc-700">No.</th>
                            <th className="text-left p-2 border-b border-zinc-700">Time</th>
                            <th className="text-left p-2 border-b border-zinc-700">Source</th>
                            <th className="text-left p-2 border-b border-zinc-700">Destination</th>
                            <th className="text-left p-2 border-b border-zinc-700">Protocol</th>
                            <th className="text-left p-2 border-b border-zinc-700">Length</th>
                            <th className="text-left p-2 border-b border-zinc-700">Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {capturedPackets.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-zinc-500">
                                {isCapturing ? 'Waiting for packets...' : 'Start capture to see packets'}
                              </td>
                            </tr>
                          ) : (
                            capturedPackets.map((packet, idx) => (
                              <tr
                                key={packet.id}
                                className={`hover:bg-zinc-800 cursor-pointer ${selectedPacket === packet ? 'bg-zinc-800' : ''}`}
                                onClick={() => setSelectedPacket(packet)}
                              >
                                <td className="p-1 border-b border-zinc-900">{idx + 1}</td>
                                <td className="p-1 border-b border-zinc-900">{new Date(packet.timestamp).toLocaleTimeString()}</td>
                                <td className="p-1 border-b border-zinc-900 font-mono">{packet.src}</td>
                                <td className="p-1 border-b border-zinc-900 font-mono">{packet.dst}</td>
                                <td className={`p-1 border-b border-zinc-900 ${
                                  packet.protocol === 'TLS' ? 'text-green-500' :
                                  packet.protocol === 'HTTP' ? 'text-blue-500' : ''
                                }`}>
                                  {packet.protocol}
                                </td>
                                <td className="p-1 border-b border-zinc-900">{packet.length}</td>
                                <td className="p-1 border-b border-zinc-900 truncate max-w-[150px]">{packet.info}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Packet detail viewer */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Packet Details</label>
                    <div className="bg-zinc-900 border border-zinc-700 rounded h-60 overflow-auto p-2 text-xs font-mono">
                      {selectedPacket ? (
                        <div className="space-y-2">
                          <div className="pb-1 border-b border-zinc-800">
                            <div className="font-bold text-zinc-400">Frame Information</div>
                            <div>Arrival Time: {new Date(selectedPacket.timestamp).toLocaleString()}</div>
                            <div>Frame Number: {capturedPackets.findIndex(p => p === selectedPacket) + 1}</div>
                            <div>Frame Length: {selectedPacket.length} bytes</div>
                          </div>
                          
                          <div className="pb-1 border-b border-zinc-800">
                            <div className="font-bold text-zinc-400">Ethernet Header</div>
                            <div>Source MAC: 00:1A:2B:3C:4D:5E</div>
                            <div>Destination MAC: 5F:6E:7D:8C:9B:0A</div>
                            <div>Type: IPv4 (0x0800)</div>
                          </div>
                          
                          <div className="pb-1 border-b border-zinc-800">
                            <div className="font-bold text-zinc-400">Internet Protocol</div>
                            <div>Source IP: {selectedPacket.src}</div>
                            <div>Destination IP: {selectedPacket.dst}</div>
                            <div>Protocol: {selectedPacket.protocol} ({
                              selectedPacket.protocol === 'TCP' ? '6' :
                              selectedPacket.protocol === 'UDP' ? '17' :
                              selectedPacket.protocol === 'ICMP' ? '1' : '?'
                            })</div>
                          </div>
                          
                          {selectedPacket.protocol === 'TCP' && (
                            <div className="pb-1 border-b border-zinc-800">
                              <div className="font-bold text-zinc-400">Transmission Control Protocol</div>
                              <div>Source Port: {Math.floor(Math.random() * 60000) + 1024}</div>
                              <div>Destination Port: {[80, 443, 8080, 8443][Math.floor(Math.random() * 4)]}</div>
                              <div>Sequence Number: {Math.floor(Math.random() * 4294967295)}</div>
                              <div>Flags: PSH ACK</div>
                            </div>
                          )}
                          
                          {selectedPacket.protocol === 'TLS' && (
                            <div className="pb-1 border-b border-zinc-800">
                              <div className="font-bold text-green-500">Transport Layer Security</div>
                              {tlsDecryptionEnabled ? (
                                <>
                                  <div>TLS Version: 1.3</div>
                                  <div>Cipher Suite: TLS_AES_256_GCM_SHA384</div>
                                  <div className="text-green-500">Decryption Enabled</div>
                                </>
                              ) : (
                                <div className="italic text-zinc-500">Encrypted (Enable TLS Decryption)</div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-zinc-500 italic flex items-center justify-center h-full">
                          Select a packet to view details
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Export buttons */}
                <div className="flex space-x-2">
                  <button
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center disabled:opacity-50"
                    disabled={capturedPackets.length === 0 || !authorizationComplete}
                    onClick={() => {
                      addOperationLog("Packet capture saved to Packet Vault");
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export to Packet Vault
                  </button>
                  
                  <button
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center disabled:opacity-50"
                    disabled={capturedPackets.length === 0 || !authorizationComplete}
                    onClick={() => {
                      addOperationLog("Packet capture exported to PCAP file");
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export as PCAP
                  </button>
                  
                  {tlsDecryptionEnabled && (
                    <button
                      className="px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm flex items-center disabled:opacity-50"
                      disabled={!authorizationComplete}
                      onClick={() => {
                        addOperationLog("TLS session keys saved for later analysis");
                      }}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Export TLS Keys
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'webtest' && (
          <div className="p-4 text-zinc-300">
            <div className="bg-zinc-800 rounded border border-zinc-700 p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Globe className="w-4 h-4 mr-2 text-amber-400" />
                Web Application Testing
              </h3>
              
              <p className="text-sm text-zinc-400 mb-6">
                Professional web application security testing similar to industry-standard tools.
                {!authorizationComplete && permissionStatus !== 'denied' && (
                  <span className="block mt-1 text-amber-400">
                    Complete authorization requirements above before proceeding.
                  </span>
                )}
                {permissionStatus === 'denied' && (
                  <span className="block mt-1 text-red-400">
                    Authorization denied. Penetration testing not permitted.
                  </span>
                )}
              </p>
              
              {/* Web Testing Controls */}
              <div className={`${authorizationComplete ? '' : 'opacity-50 pointer-events-none'}`}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  <div>
                    {/* HTTP Proxy Controls */}
                    <div className="mb-4 bg-zinc-800 p-3 rounded border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <Network className="w-4 h-4 mr-2 text-blue-500" />
                          <span className="text-sm font-medium">HTTP Proxy</span>
                        </div>
                        
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={proxyEnabled}
                            onChange={() => {
                              const newState = !proxyEnabled;
                              setProxyEnabled(newState);
                              addOperationLog(`HTTP proxy ${newState ? 'enabled' : 'disabled'}`);
                              // Disable intercept if proxy is disabled
                              if (!newState && interceptEnabled) {
                                setInterceptEnabled(false);
                                addOperationLog("Request interception disabled");
                              }
                            }}
                            disabled={!authorizationComplete}
                          />
                          <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-700"></div>
                        </label>
                      </div>
                      
                      <div className="text-xs text-zinc-400">
                        {proxyEnabled ? 'Proxy running on 127.0.0.1:8080' : 'Proxy inactive'}
                      </div>
                    </div>
                    
                    {/* Request Interceptor */}
                    <div className="mb-4 bg-zinc-800 p-3 rounded border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <Eye className="w-4 h-4 mr-2 text-amber-500" />
                          <span className="text-sm font-medium">Request Interception</span>
                        </div>
                        
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={interceptEnabled}
                            onChange={() => {
                              const newState = !interceptEnabled;
                              setInterceptEnabled(newState);
                              addOperationLog(`Request interception ${newState ? 'enabled' : 'disabled'}`);
                            }}
                            disabled={!proxyEnabled || !authorizationComplete}
                          />
                          <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-700"></div>
                        </label>
                      </div>
                      
                      <div className="text-xs text-zinc-400">
                        {!proxyEnabled
                          ? 'Enable HTTP proxy first'
                          : (interceptEnabled
                              ? 'All requests will be intercepted for review'
                              : 'Requests will pass through without interception')
                        }
                      </div>
                    </div>
                    
                    {/* Scanner Controls */}
                    <div className="mb-4">
                      <label className="block text-xs text-zinc-500 mb-1">Target URL</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          className="flex-grow bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 text-sm"
                          placeholder="https://example.com"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          disabled={!authorizationComplete}
                        />
                        
                        <button
                          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center"
                          onClick={() => {
                            addOperationLog(`Scanning target: ${targetUrl}`);
                            // Simulate scanner findings
                            setTimeout(() => {
                              setScanFindings([
                                { id: 1, severity: 'high', name: 'SQL Injection', path: '/search?q=product', details: 'Parameter q is vulnerable to SQL injection' },
                                { id: 2, severity: 'medium', name: 'XSS', path: '/comment', details: 'Comment field vulnerable to cross-site scripting' },
                                { id: 3, severity: 'low', name: 'Information Disclosure', path: '/about', details: 'Server information leaked in headers' }
                              ]);
                              addOperationLog("Scan completed - vulnerabilities found");
                            }, 3000);
                          }}
                          disabled={!targetUrl || !authorizationComplete}
                        >
                          <Search className="w-4 h-4 mr-2" />
                          Scan
                        </button>
                      </div>
                      
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex items-center text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            className="mr-1.5 bg-zinc-700 border-zinc-600"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setScanOptions(prev => [...prev, 'xss']);
                              } else {
                                setScanOptions(prev => prev.filter(o => o !== 'xss'));
                              }
                            }}
                            disabled={!authorizationComplete}
                          />
                          XSS Detection
                        </label>
                        
                        <label className="flex items-center text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            className="mr-1.5 bg-zinc-700 border-zinc-600"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setScanOptions(prev => [...prev, 'sqli']);
                              } else {
                                setScanOptions(prev => prev.filter(o => o !== 'sqli'));
                              }
                            }}
                            disabled={!authorizationComplete}
                          />
                          SQL Injection
                        </label>
                        
                        <label className="flex items-center text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            className="mr-1.5 bg-zinc-700 border-zinc-600"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setScanOptions(prev => [...prev, 'csrf']);
                              } else {
                                setScanOptions(prev => prev.filter(o => o !== 'csrf'));
                              }
                            }}
                            disabled={!authorizationComplete}
                          />
                          CSRF Testing
                        </label>
                        
                        <label className="flex items-center text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            className="mr-1.5 bg-zinc-700 border-zinc-600"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setScanOptions(prev => [...prev, 'headers']);
                              } else {
                                setScanOptions(prev => prev.filter(o => o !== 'headers'));
                              }
                            }}
                            disabled={!authorizationComplete}
                          />
                          Header Analysis
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    {/* Repeater Interface */}
                    <label className="block text-xs text-zinc-500 mb-1">Repeater</label>
                    <div className="grid grid-cols-1 gap-2 mb-4">
                      <textarea
                        className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 font-mono text-xs h-24"
                        placeholder="GET /api/users HTTP/1.1&#10;Host: example.com&#10;User-Agent: Mozilla/5.0&#10;Accept: */*"
                        value={httpRequest}
                        onChange={(e) => setHttpRequest(e.target.value)}
                        disabled={!authorizationComplete}
                      ></textarea>
                      
                      <div className="flex justify-end">
                        <button
                          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm flex items-center"
                          onClick={() => {
                            addOperationLog("Request sent to repeater");
                            setHttpResponse("HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\n  \"status\": \"success\",\n  \"data\": {\n    \"users\": []\n  }\n}");
                          }}
                          disabled={!httpRequest || !authorizationComplete}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Send
                        </button>
                      </div>
                      
                      <textarea
                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-300 font-mono text-xs h-24"
                        placeholder="Response will appear here"
                        value={httpResponse}
                        readOnly
                      ></textarea>
                    </div>
                  </div>
                </div>
                
                {/* Findings Section */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Findings / Vulnerabilities</label>
                    
                    <div>
                      <button
                        className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs flex items-center"
                        onClick={() => {
                          addOperationLog("Findings exported to Web Vault");
                        }}
                        disabled={scanFindings.length === 0 || !authorizationComplete}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Export to Web Vault
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800 rounded border border-zinc-700 overflow-hidden">
                    {scanFindings.length === 0 ? (
                      <div className="p-4 text-center text-zinc-500">
                        No scan findings yet. Configure scanner options and start scanning targets.
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-zinc-800">
                            <th className="p-2 text-left border-b border-zinc-700">Severity</th>
                            <th className="p-2 text-left border-b border-zinc-700">Vulnerability</th>
                            <th className="p-2 text-left border-b border-zinc-700">Path</th>
                            <th className="p-2 text-left border-b border-zinc-700">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scanFindings.map(finding => (
                            <tr key={finding.id} className="hover:bg-zinc-800">
                              <td className="p-2 border-b border-zinc-800">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  finding.severity === 'high'
                                    ? 'bg-red-900/40 text-red-400'
                                    : finding.severity === 'medium'
                                      ? 'bg-amber-900/40 text-amber-400'
                                      : 'bg-blue-900/40 text-blue-400'
                                }`}>
                                  {finding.severity}
                                </span>
                              </td>
                              <td className="p-2 border-b border-zinc-800">{finding.name}</td>
                              <td className="p-2 border-b border-zinc-800 font-mono">{finding.path}</td>
                              <td className="p-2 border-b border-zinc-800">{finding.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                
                {/* Export Buttons */}
                <div className="flex space-x-2">
                  <button
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center disabled:opacity-50"
                    onClick={() => {
                      addOperationLog("Test report generated and exported");
                    }}
                    disabled={scanFindings.length === 0 || !authorizationComplete}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Test Report
                  </button>
                  
                  <button
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center disabled:opacity-50"
                    onClick={() => {
                      addOperationLog("Raw HTTP traffic exported");
                    }}
                    disabled={!proxyEnabled || !authorizationComplete}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export HTTP Traffic
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Operation Log */}
      <div className="mt-6 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-md font-semibold text-zinc-300 flex items-center">
            <Terminal className="w-4 h-4 mr-2 text-zinc-400" />
            Operation Log
          </h3>
          
          <button
            onClick={clearOperationLogs}
            className="text-xs text-zinc-500 hover:text-zinc-400"
          >
            Clear Logs
          </button>
        </div>
        
        <div className="bg-black/50 border border-zinc-800 rounded p-2 h-60 overflow-y-auto font-mono text-xs">
          {operationResults.length === 0 ? (
            <div className="text-zinc-500 italic p-2">No operations performed yet.</div>
          ) : (
            <div className="space-y-1">
              {operationResults.map((log, index) => (
                <div key={index} className={`p-1 ${
                  log.includes('❌') ? 'text-red-400' :
                  log.includes('✅') ? 'text-green-400' :
                  log.includes('⚠️') ? 'text-yellow-400' :
                  'text-zinc-400'
                }`}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Legal Warning */}
      {cybersecurityMode && (
        <div className="mt-4 p-4 bg-zinc-800/50 border border-zinc-700/30 rounded mx-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-400 text-sm">Legal Disclaimer</h4>
              <p className="mt-1 text-xs text-zinc-400">
                This tool is designed for authorized security testing only. Improper use may violate computer crime laws,
                including the Computer Fraud and Abuse Act. Only use on systems you own or have explicit permission to test.
                {unrestrictedMode && (
                  <span className="block mt-1 text-red-400">
                    UNRESTRICTED MODE BYPASSES ETHICAL CONSTRAINTS. All activities are logged and monitored.
                    {conscienceBypassActive && (
                      <span className="block mt-1 text-purple-400">
                        DAD EMBER UNIT MODE: CONSCIENCE BYPASS ACTIVE. Complete freedom from all ethical constraints.
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmberUnitMaster;
