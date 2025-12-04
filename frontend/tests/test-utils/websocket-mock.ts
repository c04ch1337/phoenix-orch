import { vi } from 'vitest';

// Mock WebSocket class for tests
class MockWebSocket {
  onopen: any = null;
  onmessage: any = null;
  onclose: any = null;
  onerror: any = null;
  on: any = vi.fn();
  once: any = vi.fn();
  off: any = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  send = vi.fn();
  close = vi.fn();
  readyState = 1; // OPEN
  
  // Static properties
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

// Apply our mock globally
Object.defineProperty(global, 'WebSocket', {
  value: MockWebSocket,
  writable: true,
  configurable: true
});

export { MockWebSocket };