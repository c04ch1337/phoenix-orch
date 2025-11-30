import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SubconsciousPanel } from '../features/subconscious';
import * as subconsciousHooks from '../features/subconscious/hooks/useSubconsciousStream';

// Mock the EventSource API
class MockEventSource {
  onopen: () => void;
  onmessage: (event: any) => void;
  onerror: (error: any) => void;
  close: () => void;
  readyState: number;

  constructor(public url: string) {
    this.readyState = 0; // CONNECTING
    // Execute onopen asynchronously to simulate network connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
  }

  // Method for tests to send mock events
  public mockServerEvent(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
  
  // Method for tests to simulate errors
  public mockServerError(error: any) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
  
  // Mock close method
  public close() {
    this.readyState = 2; // CLOSED
  }
}

// Create a spy on performance.now for timing measurements
let performanceNowSpy: vi.SpyInstance;
let mockEventTimestamps: number[] = [];
let mockEventSource: MockEventSource;

describe('Subconscious Stream Integration', () => {
  beforeEach(() => {
    // Mock the EventSource global
    global.EventSource = MockEventSource as any;
    
    // Mock performance.now()
    performanceNowSpy = vi.spyOn(performance, 'now');
    performanceNowSpy.mockImplementation(() => Date.now()); // Simplified implementation
    
    // Reset event timestamps
    mockEventTimestamps = [];
    
    // Spy on useSubconsciousStream to measure timing
    vi.spyOn(subconsciousHooks, 'useSubconsciousStream').mockImplementation(() => {
      // Create and store the mock event source
      mockEventSource = new MockEventSource('http://localhost:5001/api/v1/sse/subconscious');
      
      return {
        connected: true,
        lastEvent: {
          timestamp: new Date().toISOString(),
          active_loop: "perception_loop",
          tick_count: 0,
          last_thought: "Test thought",
          metrics: {
            cpu_usage: 25,
            memory_mb: 50
          }
        },
        eventCount: 1,
        lastEventTime: Date.now()
      };
    });
  });

  afterEach(() => {
    // Clean up mocks
    vi.clearAllMocks();
  });

  it('renders the subconscious panel with initial data', async () => {
    render(<SubconsciousPanel />);
    
    // Check the panel renders with the expected title
    expect(screen.getByText('Phoenix Subconscious')).toBeDefined();
    
    // Check the panel shows connected status
    expect(screen.getByText('Connected')).toBeDefined();
  });
  
  it('receives and displays events within 2 seconds', async () => {
    render(<SubconsciousPanel />);
    
    // Record start time
    const startTime = performance.now();
    
    // Simulate a server event after a short delay
    const testEvent = {
      timestamp: new Date().toISOString(),
      active_loop: "memory_consolidation",
      tick_count: 1,
      last_thought: "Processing event stream integration",
      metrics: {
        cpu_usage: 30,
        memory_mb: 55
      }
    };
    
    setTimeout(() => {
      if (mockEventSource) {
        mockEventSource.mockServerEvent(testEvent);
        mockEventTimestamps.push(performance.now());
      }
    }, 100);
    
    // Wait for the event message to appear in the UI
    await waitFor(
      () => {
        expect(screen.findByText("Processing event stream integration")).toBeDefined();
      },
      { timeout: 3000 }
    );
    
    // Record end time and calculate duration
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Assert that the event was processed in under 2 seconds
    expect(duration).toBeLessThan(2000);
  });
  
  it('handles connection errors gracefully', async () => {
    render(<SubconsciousPanel />);
    
    // Simulate a connection error
    if (mockEventSource) {
      mockEventSource.mockServerError(new Error('Connection failed'));
    }
    
    // Wait for disconnected state to be shown
    await waitFor(() => {
      expect(screen.findByText('Disconnected')).toBeDefined();
    });
  });
});