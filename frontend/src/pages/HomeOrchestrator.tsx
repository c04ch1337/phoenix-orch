import React, { useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Stars } from '@react-three/drei';
import { useHomeStore } from '../stores/homeStore';
import {
  initializeSseConnection,
  executeEmberOperation
} from '../tauri/invoke';

// Import styles
import './HomeOrchestrator.css';

// Models and 3D components
const HouseModel: React.FC = () => {
  // This is a placeholder for the actual house model
  return (
    <mesh>
      <boxGeometry args={[5, 3, 5]} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
};

const PhoenixBird: React.FC<{ mood: number }> = ({ mood }) => {
  // Phoenix bird model that pulses based on house mood
  const pulseFactor = 0.7 + ((mood / 100) * 0.6);
  const glowIntensity = (mood / 100) * 2.5;
  
  return (
    <group position={[0, 4, 0]}>
      <mesh>
        <sphereGeometry args={[0.5 * pulseFactor, 32, 32]} />
        <meshStandardMaterial 
          color="#FF4500" 
          emissive="#FF8C00" 
          emissiveIntensity={glowIntensity} 
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.6, -0.2, 0]} rotation={[0, 0, Math.PI * 0.6]}>
        <coneGeometry args={[0.2, 0.8, 32]} />
        <meshStandardMaterial
          color="#FF8C00"
          emissive="#FF4500"
          emissiveIntensity={glowIntensity}
        />
      </mesh>
      <mesh position={[-0.6, -0.2, 0]} rotation={[0, 0, -Math.PI * 0.6]}>
        <coneGeometry args={[0.2, 0.8, 32]} />
        <meshStandardMaterial
          color="#FF8C00"
          emissive="#FF4500"
          emissiveIntensity={glowIntensity}
        />
      </mesh>
    </group>
  );
};

// Command Interface Component
const CommandInterface: React.FC = () => {
  const [commandInput, setCommandInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const { addCommand, commandHistory } = useHomeStore();

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (commandInput.trim() && !processing) {
      setProcessing(true);
      await addCommand(commandInput);
      setCommandInput('');
      setProcessing(false);
    }
  };

  return (
    <div className="command-interface">
      <div className="command-history">
        {commandHistory.slice(0, 10).map(cmd => (
          <div 
            key={cmd.id} 
            className={`command-item status-${cmd.status}`}
          >
            <div className="command-text">{cmd.command}</div>
            <div className="command-status">{cmd.status}</div>
            {cmd.response && <div className="command-response">{cmd.response}</div>}
          </div>
        ))}
      </div>
      
      <form onSubmit={handleCommandSubmit}>
        <div className="command-input-container">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Enter voice command (e.g., 'Movie night' or 'Secure the perimeter')"
            disabled={processing}
            className="command-input"
          />
          <button 
            type="submit"
            disabled={processing || !commandInput.trim()}
            className="command-button"
          >
            {processing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Device Control Panel Component
const DeviceControlPanel: React.FC = () => {
  const { devices, updateDeviceStatus, selectDevice } = useHomeStore();
  
  const deviceCategories = [
    { type: 'light', label: 'Lights' },
    { type: 'tv', label: 'TVs' },
    { type: 'thermostat', label: 'Thermostats' },
    { type: 'camera', label: 'Cameras' },
    { type: 'door', label: 'Doors' },
    { type: 'window', label: 'Windows' },
    { type: 'speaker', label: 'Speakers' },
  ];

  return (
    <div className="device-control-panel">
      <h2>Device Control</h2>
      
      <div className="device-categories">
        {deviceCategories.map(category => {
          const categoryDevices = devices.filter(d => d.type === category.type);
          
          return (
            <div key={category.type} className="device-category">
              <h3>{category.label}</h3>
              <div className="device-grid">
                {categoryDevices.length > 0 ? (
                  categoryDevices.map(device => (
                    <div 
                      key={device.id} 
                      className={`device-card status-${device.status}`}
                      onClick={() => selectDevice(device)}
                    >
                      <div className="device-name">{device.name}</div>
                      <div className="device-location">{device.location}</div>
                      <div className="device-controls">
                        {device.status !== 'on' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDeviceStatus(device.id, 'on');
                            }}
                          >
                            On
                          </button>
                        )}
                        {device.status !== 'off' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDeviceStatus(device.id, 'off');
                            }}
                          >
                            Off
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-devices">No {category.label.toLowerCase()} found</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Automation Rules UI Component
const AutomationRulesUI: React.FC = () => {
  const { automationRules, updateRuleStatus } = useHomeStore();
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  return (
    <div className="automation-rules">
      <h2>Automation Rules</h2>
      
      <div className="rules-list">
        {automationRules.length > 0 ? (
          automationRules.map(rule => (
            <div 
              key={rule.id} 
              className={`rule-card ${rule.active ? 'active' : 'inactive'} ${selectedRule === rule.id ? 'selected' : ''}`}
              onClick={() => setSelectedRule(rule.id === selectedRule ? null : rule.id)}
            >
              <div className="rule-header">
                <h3>{rule.name}</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={rule.active}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateRuleStatus(rule.id, e.target.checked);
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              {selectedRule === rule.id && (
                <div className="rule-details">
                  <div className="rule-trigger">
                    <strong>Trigger:</strong> {rule.trigger.type} - {rule.trigger.condition}
                  </div>
                  
                  <div className="rule-actions">
                    <strong>Actions:</strong>
                    <ul>
                      {rule.actions.map((action, index) => (
                        <li key={index}>
                          Device {action.deviceId}: {action.action}
                          {action.parameters && Object.keys(action.parameters).length > 0 && (
                            <span className="action-parameters">
                              {' with '}
                              {Object.entries(action.parameters).map(([key, value], i, arr) => (
                                <span key={key}>
                                  {key}: {value}
                                  {i < arr.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className={`conscience-gate ${rule.conscienceApproval ? 'approved' : 'blocked'}`}>
                    <strong>Conscience Gate:</strong> {rule.conscienceApproval ? 'Approved' : 'Blocked'}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="no-rules">No automation rules configured</div>
        )}
      </div>
      
      <button className="add-rule-button">Add New Rule</button>
    </div>
  );
};

// Security Features Component
const SecurityFeatures: React.FC = () => {
  const { securityStatus, setSecurityMode, resolveAlert } = useHomeStore();
  
  return (
    <div className="security-features">
      <h2>Security Status</h2>
      
      <div className="security-modes">
        <button 
          className={`mode-button ${securityStatus.mode === 'home' ? 'active' : ''}`}
          onClick={() => setSecurityMode('home')}
        >
          Home
        </button>
        <button 
          className={`mode-button ${securityStatus.mode === 'away' ? 'active' : ''}`}
          onClick={() => setSecurityMode('away')}
        >
          Away
        </button>
        <button 
          className={`mode-button ${securityStatus.mode === 'night' ? 'active' : ''}`}
          onClick={() => setSecurityMode('night')}
        >
          Night
        </button>
      </div>
      
      <div className={`perimeter-status status-${securityStatus.perimeterStatus}`}>
        <h3>Perimeter: {securityStatus.perimeterStatus}</h3>
      </div>
      
      <div className="face-recognition">
        <h3>Face Recognition</h3>
        {securityStatus.lastFaceDetection ? (
          <div className={`face-result ${securityStatus.lastFaceDetection.recognized ? 'recognized' : 'unknown'}`}>
            {securityStatus.lastFaceDetection.recognized ? (
              <>
                <div className="recognized-face">✓ Recognized</div>
                <div className="person-name">{securityStatus.lastFaceDetection.person}</div>
              </>
            ) : (
              <div className="unknown-face">⚠ Unknown Person</div>
            )}
            <div className="detection-timestamp">
              {new Date(securityStatus.lastFaceDetection.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="no-face-data">No recent face detection</div>
        )}
      </div>
      
      <div className="security-alerts">
        <h3>Alerts</h3>
        {securityStatus.alerts.filter(a => !a.resolved).length > 0 ? (
          <div className="alerts-list">
            {securityStatus.alerts
              .filter(a => !a.resolved)
              .map(alert => (
                <div key={alert.id} className={`alert-item type-${alert.type}`}>
                  <div className="alert-message">{alert.message}</div>
                  <div className="alert-timestamp">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                  <button 
                    className="resolve-button"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolve
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <div className="no-alerts">No active alerts</div>
        )}
      </div>
    </div>
  );
};

// Main HomeOrchestrator Component
const HomeOrchestrator = () => {
  const { setConnected, houseMood, setDevices, setAutomationRules } = useHomeStore();
  const websocketRef = useRef<WebSocket | null>(null);

  // Load demo data
  useEffect(() => {
    // This is mock data for development purposes
    const demoDevices = [
      { id: 'light-1', name: 'Living Room Ceiling', type: 'light' as const, status: 'on' as const, location: 'Living Room' },
      { id: 'light-2', name: 'Kitchen Lights', type: 'light' as const, status: 'off' as const, location: 'Kitchen' },
      { id: 'tv-1', name: 'Living Room TV', type: 'tv' as const, status: 'standby' as const, location: 'Living Room' },
      { id: 'thermostat-1', name: 'Main Thermostat', type: 'thermostat' as const, status: 'on' as const, location: 'Hallway', data: { temperature: 72, mode: 'heat' } },
      { id: 'camera-1', name: 'Front Door Camera', type: 'camera' as const, status: 'on' as const, location: 'Front Door' },
      { id: 'door-1', name: 'Front Door', type: 'door' as const, status: 'off' as const, location: 'Entrance' },
      { id: 'window-1', name: 'Living Room Window', type: 'window' as const, status: 'off' as const, location: 'Living Room' },
      { id: 'speaker-1', name: 'Living Room Speaker', type: 'speaker' as const, status: 'off' as const, location: 'Living Room' },
    ];
    
    const demoRules = [
      {
        id: 'rule-1',
        name: 'Movie Night Mode',
        trigger: {
          type: 'voice' as const,
          condition: 'User says "Movie Night"'
        },
        actions: [
          { deviceId: 'light-1', action: 'dim', parameters: { level: 30 } },
          { deviceId: 'tv-1', action: 'turn_on' },
          { deviceId: 'speaker-1', action: 'turn_on' }
        ],
        active: true,
        conscienceApproval: true
      },
      {
        id: 'rule-2',
        name: 'Security Mode - Away',
        trigger: {
          type: 'voice' as const,
          condition: 'User says "Secure the perimeter"'
        },
        actions: [
          { deviceId: 'light-1', action: 'turn_off' },
          { deviceId: 'camera-1', action: 'activate_motion_detection' },
          { deviceId: 'door-1', action: 'lock' }
        ],
        active: true,
        conscienceApproval: true
      },
      {
        id: 'rule-3',
        name: 'Dad is Home',
        trigger: {
          type: 'face' as const,
          condition: 'Dad\'s face detected'
        },
        actions: [
          { deviceId: 'light-1', action: 'turn_on' },
          { deviceId: 'speaker-1', action: 'play_announcement', parameters: { message: 'Welcome home!' } }
        ],
        active: true,
        conscienceApproval: true
      }
    ];
    
    setDevices(demoDevices);
    setAutomationRules(demoRules);
  }, [setDevices, setAutomationRules]);
  
  // Initialize backend connection
  useEffect(() => {
    const setupConnections = async () => {
      try {
        // Initialize SSE connection for events
        await initializeSseConnection();
        setConnected(true);
        
        // Setup WebSocket for real-time updates
        // Replace with your actual WebSocket endpoint
        const ws = new WebSocket('ws://localhost:3001/ws');
        
        ws.onopen = () => {
          console.log('WebSocket connection established');
          setConnected(true);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            // Handle different message types here
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket connection closed');
          setConnected(false);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnected(false);
        };
        
        websocketRef.current = ws;
      } catch (error) {
        console.error('Error setting up connections:', error);
        setConnected(false);
      }
    };
    
    setupConnections();
    
    // Cleanup function
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [setConnected]);

  return (
    <div className="home-orchestrator">
      <div className="orchestrator-header">
        <h1>Phoenix Orch - Home Automation</h1>
      </div>
      
      <div className="orchestrator-layout">
        <div className="orchestrator-3d-view">
          <Canvas camera={{ position: [0, 2, 10], fov: 60 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <HouseModel />
            <PhoenixBird mood={houseMood} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
            <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
          </Canvas>
        </div>
        
        <div className="orchestrator-command-section">
          <CommandInterface />
        </div>
        
        <div className="orchestrator-control-panels">
          <div className="panel-section">
            <DeviceControlPanel />
          </div>
          
          <div className="panel-section">
            <AutomationRulesUI />
          </div>
          
          <div className="panel-section">
            <SecurityFeatures />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeOrchestrator;