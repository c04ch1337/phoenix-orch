import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DefenseDashboard } from '../components/DefenseDashboard';
import { useWebSocket } from '../../../lib/socket';
import { act } from 'react-dom/test-utils';

// Mock the WebSocket hook
jest.mock('../../../lib/socket', () => ({
  useWebSocket: jest.fn(),
}));

describe('DefenseDashboard', () => {
  const mockSocket = {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
  };
  
  // Store the message handler outside for easier access
  let messageHandler: (message: string) => void;

  beforeEach(() => {
    // Reset mocks
    mockSocket.on.mockReset();
    mockSocket.send.mockReset();
    mockSocket.close.mockReset();
    
    // Setup the useWebSocket mock
    (useWebSocket as jest.Mock).mockReturnValue(mockSocket);
    
    // Setup the message handler capture
    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'message') {
        messageHandler = callback;
      }
      return mockSocket;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial dashboard state', () => {
    render(<DefenseDashboard />);
    
    expect(screen.getByText('Cipher Guard Defense Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Active Threats')).toBeInTheDocument();
    expect(screen.getByText('System Metrics')).toBeInTheDocument();
    expect(screen.getByText('Evidence Gallery')).toBeInTheDocument();
  });

  it('handles incoming threat detection', async () => {
    const mockThreat = {
      type: 'ThreatDetected',
      data: {
        id: '123',
        severity: 'high',
        description: 'Test threat',
        timestamp: new Date().toISOString(),
        source: 'test',
      },
    };

    render(<DefenseDashboard />);
    
    // Simulate WebSocket message
    act(() => {
      messageHandler(JSON.stringify(mockThreat));
    });

    await waitFor(() => {
      expect(screen.getByText('Test threat')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });
  });

  it('handles incident updates', async () => {
    const mockIncident = {
      type: 'IncidentUpdate',
      data: {
        id: '456',
        threat: {
          id: '123',
          severity: 'high',
          description: 'Test threat',
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        status: 'analyzing',
        actions_taken: ['Containment initiated'],
        evidence: [],
        timestamp: new Date().toISOString(),
      },
    };

    act(() => {
      messageHandler(JSON.stringify(mockIncident));
    });

    await waitFor(() => {
      expect(screen.getByText('Containment initiated')).toBeInTheDocument();
    });
  });

  it('handles metrics updates', async () => {
    const mockMetrics = {
      type: 'MetricsUpdate',
      data: {
        cpu_usage: 45,
        memory_usage: 60,
        active_connections: 12,
        threats_detected: 5,
        incidents_resolved: 3,
      },
    };

    act(() => {
      messageHandler(JSON.stringify(mockMetrics));
    });

    await waitFor(() => {
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  it('handles response actions', async () => {
    const mockExecute = jest.fn();
    
    // Define the test data first
    const mockIncident = {
      type: 'IncidentUpdate',
      data: {
        id: '456',
        threat: {
          id: '123',
          severity: 'high',
          description: 'Test threat',
          timestamp: new Date().toISOString(),
          source: 'test',
        },
        status: 'analyzing',
        actions_taken: [],
        evidence: [],
        timestamp: new Date().toISOString(),
      },
    };

    act(() => {
      messageHandler(JSON.stringify(mockIncident));
    });

    // Select incident and execute action
    await waitFor(() => {
      const select = screen.getByLabelText('Select Incident');
      fireEvent.change(select, { target: { value: '456' } });
    });

    const containButton = screen.getByText('Network Isolation');
    fireEvent.click(containButton);

    expect(mockExecute).toHaveBeenCalledWith('456', 'isolate');
  });

  it('handles evidence display', async () => {
    const mockEvidence = {
      type: 'EvidenceCollected',
      data: {
        id: '789',
        incident_id: '456',
        data_type: 'Log',
        content: 'Test evidence content',
        timestamp: new Date().toISOString(),
        hash: 'abc123',
      },
    };

    act(() => {
      messageHandler(JSON.stringify(mockEvidence));
    });

    await waitFor(() => {
      expect(screen.getByText('Test evidence content')).toBeInTheDocument();
      expect(screen.getByText('abc123')).toBeInTheDocument();
    });
  });

  it('handles system status updates', async () => {
    const mockStatus = {
      type: 'SystemStatus',
      data: {
        status: 'operational',
        active_monitors: 5,
        active_defenders: 3,
        threat_level: 'normal',
      },
    };

    act(() => {
      messageHandler(JSON.stringify(mockStatus));
    });

    await waitFor(() => {
      expect(screen.getByText('System Operational')).toBeInTheDocument();
    });
  });
});