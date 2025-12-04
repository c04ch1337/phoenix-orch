// This file loads before the test and sets up global mocks specifically for ecosystem dominance test

import { vi } from 'vitest';

// Create a complete mock of WebSocket
class MockWebSocket {
  onopen: any = null;
  onmessage: any = null;
  onclose: any = null;
  onerror: any = null;
  send = vi.fn();
  close = vi.fn();
  readyState = 1; // OPEN
  
  // Implement the 'on' method directly with mock
  on = vi.fn().mockImplementation((event: string, callback: Function) => {
    if (event === 'open') this.onopen = callback;
    if (event === 'message') this.onmessage = callback;
    if (event === 'close') this.onclose = callback;
    if (event === 'error') this.onerror = callback;
    return this; // Allow chaining
  });
  
  constructor() {
    // Simulate connection
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  addEventListener = vi.fn((event, callback) => {
    // Store callback based on event type
    if (event === 'open') this.onopen = callback;
    if (event === 'message') this.onmessage = callback;
    if (event === 'close') this.onclose = callback;
    if (event === 'error') this.onerror = callback;
  });
  
  removeEventListener = vi.fn();
}

// Define static members
Object.defineProperties(MockWebSocket, {
  CONNECTING: { value: 0 },
  OPEN: { value: 1 },
  CLOSING: { value: 2 },
  CLOSED: { value: 3 }
});

// Override global WebSocket
global.WebSocket = MockWebSocket as any;

// Mock console.error to hide React warnings
const originalError = console.error;
console.error = function (...args) {
  // Filter out specific warnings
  if (
    typeof args[0] === 'string' && 
    (args[0].includes('WebSocket') || 
     args[0].includes('Invalid prop') ||
     args[0].includes('Failed prop type') ||
     args[0].includes('React does not recognize'))
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Clean up mocks
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}));