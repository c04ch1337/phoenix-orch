import { expect } from 'vitest';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Set up basic DOM environment mocks
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
}));

// Mock window.matchMedia
global.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Suppress console errors
const originalConsoleError = console.error;
console.error = function(...args) {
  if (typeof args[0] === 'string' && 
      (args[0].includes('WebSocket') || 
       args[0].includes('prop') || 
       args[0].includes('React does not recognize'))) {
    return;
  }
  originalConsoleError.apply(console, args);
};