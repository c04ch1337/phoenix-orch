import { create } from 'zustand';

export interface Device {
  id: string;
  name: string;
  type: 'light' | 'tv' | 'thermostat' | 'camera' | 'door' | 'window' | 'speaker';
  status: 'on' | 'off' | 'standby';
  location: string;
  data?: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: {
    type: 'emotion' | 'voice' | 'schedule' | 'motion' | 'face';
    condition: string;
  };
  actions: {
    deviceId: string;
    action: string;
    parameters?: Record<string, any>;
  }[];
  active: boolean;
  conscienceApproval: boolean;
}

export interface SecurityStatus {
  mode: 'home' | 'away' | 'night';
  perimeterStatus: 'secured' | 'breached' | 'partial';
  lastFaceDetection: {
    timestamp: string;
    recognized: boolean;
    person?: string;
  } | null;
  alerts: {
    id: string;
    type: string;
    message: string;
    timestamp: string;
    resolved: boolean;
  }[];
}

export interface CommandHistory {
  id: string;
  command: string;
  timestamp: string;
  status: 'success' | 'partial' | 'failed' | 'pending';
  response?: string;
}

export interface HouseState {
  // Devices
  devices: Device[];
  selectedDevice: Device | null;
  setDevices: (devices: Device[]) => void;
  updateDeviceStatus: (id: string, status: Device['status'], data?: Record<string, any>) => void;
  selectDevice: (device: Device | null) => void;
  
  // Automation Rules
  automationRules: AutomationRule[];
  setAutomationRules: (rules: AutomationRule[]) => void;
  updateRuleStatus: (id: string, active: boolean) => void;
  
  // Security
  securityStatus: SecurityStatus;
  setSecurityMode: (mode: SecurityStatus['mode']) => void;
  addSecurityAlert: (alert: Omit<SecurityStatus['alerts'][0], 'id'>) => void;
  resolveAlert: (id: string) => void;
  
  // Commands
  commandHistory: CommandHistory[];
  addCommand: (command: string) => Promise<void>;
  
  // House mood
  houseMood: number; // 0-100 scale
  setHouseMood: (value: number) => void;
  
  // Connection status
  connected: boolean;
  setConnected: (status: boolean) => void;
}

export const useHomeStore = create<HouseState>((set, get) => ({
  // Devices state
  devices: [],
  selectedDevice: null,
  setDevices: (devices) => set({ devices }),
  updateDeviceStatus: (id, status, data) => set((state) => ({
    devices: state.devices.map(device => 
      device.id === id 
        ? { ...device, status, ...(data ? { data: { ...device.data, ...data } } : {}) }
        : device
    )
  })),
  selectDevice: (device) => set({ selectedDevice: device }),
  
  // Automation Rules
  automationRules: [],
  setAutomationRules: (rules) => set({ automationRules: rules }),
  updateRuleStatus: (id, active) => set((state) => ({
    automationRules: state.automationRules.map(rule => 
      rule.id === id ? { ...rule, active } : rule
    )
  })),
  
  // Security
  securityStatus: {
    mode: 'home',
    perimeterStatus: 'secured',
    lastFaceDetection: null,
    alerts: []
  },
  setSecurityMode: (mode) => set((state) => ({
    securityStatus: { ...state.securityStatus, mode }
  })),
  addSecurityAlert: (alert) => set((state) => ({
    securityStatus: {
      ...state.securityStatus,
      alerts: [
        ...state.securityStatus.alerts,
        { 
          id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          ...alert,
          resolved: false
        }
      ]
    }
  })),
  resolveAlert: (id) => set((state) => ({
    securityStatus: {
      ...state.securityStatus,
      alerts: state.securityStatus.alerts.map(alert => 
        alert.id === id ? { ...alert, resolved: true } : alert
      )
    }
  })),
  
  // Commands
  commandHistory: [],
  addCommand: async (command) => {
    const newCommand: CommandHistory = {
      id: `cmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      command,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    set((state) => ({
      commandHistory: [newCommand, ...state.commandHistory]
    }));
    
    try {
      // In the future, this will actually process the command through the backend
      // For now, we're just simulating a response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      set((state) => ({
        commandHistory: state.commandHistory.map(cmd => 
          cmd.id === newCommand.id 
            ? { ...cmd, status: 'success', response: 'Command processed successfully' }
            : cmd
        )
      }));
    } catch (error) {
      set((state) => ({
        commandHistory: state.commandHistory.map(cmd => 
          cmd.id === newCommand.id 
            ? { ...cmd, status: 'failed', response: `Error: ${error}` }
            : cmd
        )
      }));
    }
  },
  
  // House mood
  houseMood: 75,
  setHouseMood: (value) => set({ houseMood: Math.max(0, Math.min(100, value)) }),
  
  // Connection status
  connected: false,
  setConnected: (status) => set({ connected: status })
}));