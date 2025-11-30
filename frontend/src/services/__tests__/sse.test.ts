/**
 * Tests for SSE Service
 * Priority 1: Critical path testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sseService, { useSSE } from '../sse';
import { renderHook, waitFor } from '@testing-library/react';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// Mock EventSource for testing (acceptable use of type override for test environment)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).EventSource = MockEventSource;

describe('SSEService', () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sseService.closeAll();
  });

  describe('Connection Management', () => {
    it('creates EventSource when connect is called', () => {
      sseService.connect('http://localhost:5001/sse', 'test-stream');
      
      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.instances[0].url).toBe('http://localhost:5001/sse');
    });

    it('closes existing connection when connecting with same streamId', () => {
      sseService.connect('http://localhost:5001/sse', 'test-stream');
      const firstInstance = MockEventSource.instances[0];
      
      sseService.connect('http://localhost:5001/sse', 'test-stream');
      
      expect(firstInstance.readyState).toBe(2); // CLOSED
      expect(MockEventSource.instances).toHaveLength(2);
    });

    it('closes connection when close is called', () => {
      sseService.connect('http://localhost:5001/sse', 'test-stream');
      const instance = MockEventSource.instances[0];
      
      sseService.close('test-stream');
      
      expect(instance.readyState).toBe(2); // CLOSED
    });
  });

  describe('Message Handling', () => {
    it('parses and validates valid SSE messages', async () => {
      const callback = vi.fn();
      sseService.subscribe('test-stream', callback);
      sseService.connect('http://localhost:5001/sse', 'test-stream');
      
      const instance = MockEventSource.instances[0];
      const validMessage = {
        id: '123',
        type: 'system',
        timestamp: Date.now(),
        status: 'online',
        message: 'Connected',
      };
      
      await waitFor(() => {
        if (instance.onmessage) {
          instance.onmessage({
            data: JSON.stringify(validMessage),
          } as MessageEvent);
        }
      });

      await waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });

    it('rejects invalid SSE messages', async () => {
      const callback = vi.fn();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      sseService.subscribe('test-stream', callback);
      sseService.connect('http://localhost:5001/sse', 'test-stream');
      
      const instance = MockEventSource.instances[0];
      const invalidMessage = { invalid: 'data' };
      
      await waitFor(() => {
        if (instance.onmessage) {
          instance.onmessage({
            data: JSON.stringify(invalidMessage),
          } as MessageEvent);
        }
      });

      await waitFor(() => {
        expect(consoleWarn).toHaveBeenCalled();
      });

      consoleWarn.mockRestore();
    });
  });

  describe('Reconnection', () => {
    it('attempts reconnection on error with exponential backoff', async () => {
      vi.useFakeTimers();
      
      sseService.connect('http://localhost:5001/sse', 'test-stream');
      const instance = MockEventSource.instances[0];
      
      if (instance.onerror) {
        instance.onerror(new Event('error'));
      }
      
      // Fast-forward time to trigger reconnection
      vi.advanceTimersByTime(2000);
      
      // Should have attempted reconnection
      expect(MockEventSource.instances.length).toBeGreaterThan(1);
      
      vi.useRealTimers();
    });
  });

  describe('useSSE Hook', () => {
    it('subscribes to messages and updates state', async () => {
      const { result } = renderHook(() => useSSE('test-stream'));
      
      result.current.connect('http://localhost:5001/sse');
      
      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });
    });

    it('disconnects when disconnect is called', async () => {
      const { result } = renderHook(() => useSSE('test-stream'));
      
      result.current.connect('http://localhost:5001/sse');
      
      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });
      
      result.current.disconnect();
      
      await waitFor(() => {
        expect(result.current.connected).toBe(false);
      });
    });
  });
});
