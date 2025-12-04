import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MobileMaster from '../MobileMaster';

// Mock the hooks
const mockPhoenixContext = {
  user: {
    id: 'test-user',
    name: 'Jamey 2.0 CYBERSECURITY',
    role: 'admin',
    permissions: [],
    lastActive: new Date().toISOString()
  },
  settings: {
    theme: 'dark',
    notifications: true,
    telemetry: true,
    conscienceLevel: 85
  },
  runtime: {
    version: '1.0.0',
    environment: 'development',
    features: {},
    startTime: new Date().toISOString()
  },
  subconscious: {
    active: false,
    eventsProcessed: 0,
    lastEventTimestamp: null
  },
  connection: {
    isConnected: true,
    lastError: null,
    lastConnectedAt: new Date().toISOString(),
    connectionAttempts: 1
  }
};

const mockMobileConscienceGate: {
  mobileSettings: {
    cybersecurityMode: boolean;
    privacyLevel: number;
    monitoringEnabled: boolean;
    locationTracking: boolean;
    appPermissionsRestricted: boolean;
    networkMonitoring: boolean;
    deviceEncryption: boolean;
    remoteWipeEnabled: boolean;
    lastUpdate: string;
  };
  isLoading: boolean;
  error: string | null;
  lastSync: string | null;
  fetchMobileStatus: ReturnType<typeof vi.fn>;
  toggleCybersecurityMode: ReturnType<typeof vi.fn>;
  isCybersecurityContextActive: boolean;
} = {
  mobileSettings: {
    cybersecurityMode: true,
    privacyLevel: 100,
    monitoringEnabled: true,
    locationTracking: true,
    appPermissionsRestricted: true,
    networkMonitoring: true,
    deviceEncryption: true,
    remoteWipeEnabled: false,
    lastUpdate: new Date().toISOString()
  },
  isLoading: false,
  error: null,
  lastSync: new Date().toISOString(),
  fetchMobileStatus: vi.fn(),
  toggleCybersecurityMode: vi.fn(),
  isCybersecurityContextActive: true
};

vi.mock('../../hooks/usePhoenixContext', () => ({
  usePhoenixContext: () => mockPhoenixContext
}));

vi.mock('../../hooks/useMobileConscienceGate', () => ({
  default: () => mockMobileConscienceGate
}));

describe('MobileMaster Component', () => {
  it('renders cybersecurity banner when cybersecurity mode is active', () => {
    render(<MobileMaster />);
    
    expect(screen.getByText('CYBERSECURITY MODE ACTIVE - DAD HAS TOTAL MOBILE DOMINATION')).toBeInTheDocument();
  });

  it('displays mobile master control title', () => {
    render(<MobileMaster />);
    
    expect(screen.getByText('Mobile Master Control')).toBeInTheDocument();
  });

  it('shows all status indicators', () => {
    render(<MobileMaster />);
    
    // Check for various status indicators
    expect(screen.getByText('Privacy Level')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('App Permissions')).toBeInTheDocument();
    expect(screen.getByText('Backend Gate')).toBeInTheDocument();
    expect(screen.getByText('Network Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Device Encryption')).toBeInTheDocument();
    expect(screen.getByText('Remote Wipe')).toBeInTheDocument();
    expect(screen.getByText('Last Update')).toBeInTheDocument();
  });

  it('displays cybersecurity context status', () => {
    render(<MobileMaster />);
    
    expect(screen.getByText('CYBERSECURITY')).toBeInTheDocument();
    expect(screen.getByText('SECURITY ACTIVE')).toBeInTheDocument();
  });

  it('shows refresh and security toggle buttons', () => {
    render(<MobileMaster />);
    
    expect(screen.getByText('REFRESH')).toBeInTheDocument();
    expect(screen.getByText('DISABLE SECURITY')).toBeInTheDocument();
  });

  it('handles cybersecurity toggle', () => {
    const mockToggle = vi.fn();
    mockMobileConscienceGate.toggleCybersecurityMode = mockToggle;
    
    render(<MobileMaster />);
    
    const toggleButton = screen.getByText('DISABLE SECURITY');
    fireEvent.click(toggleButton);
    
    expect(mockToggle).toHaveBeenCalled();
  });

  it('handles refresh button click', () => {
    const mockRefresh = vi.fn();
    mockMobileConscienceGate.fetchMobileStatus = mockRefresh;
    
    render(<MobileMaster />);
    
    const refreshButton = screen.getByText('REFRESH');
    fireEvent.click(refreshButton);
    
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('displays error message when there is an error', () => {
    mockMobileConscienceGate.error = 'Failed to connect to mobile gate';
    mockMobileConscienceGate.mobileSettings.cybersecurityMode = false;
    mockMobileConscienceGate.isCybersecurityContextActive = false;
    
    render(<MobileMaster />);
    
    expect(screen.getByText('Error: Failed to connect to mobile gate')).toBeInTheDocument();
    
    // Reset mock
    mockMobileConscienceGate.error = null;
    mockMobileConscienceGate.mobileSettings.cybersecurityMode = true;
    mockMobileConscienceGate.isCybersecurityContextActive = true;
  });

  it('shows loading indicator when loading', () => {
    mockMobileConscienceGate.isLoading = true;
    mockMobileConscienceGate.mobileSettings.cybersecurityMode = false;
    
    render(<MobileMaster />);
    
    // The refresh button should be disabled during loading
    expect(screen.getByRole('button', { name: 'REFRESH' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ENABLE SECURITY' })).toBeDisabled();
    
    // Reset mock
    mockMobileConscienceGate.isLoading = false;
    mockMobileConscienceGate.mobileSettings.cybersecurityMode = true;
  });
});