import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom';

// Set up mocks before importing components
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn().mockResolvedValue({ 
    response: 'Mocked response', 
    warnings: [], 
    toolOutputs: [] 
  })
}));

// Basic WebSocket stub to avoid errors
class MockWebSocket {
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}
// @ts-expect-error - Mocking WebSocket for tests
global.WebSocket = MockWebSocket;

// Basic DOM mocks
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock console.error to suppress React warnings
const originalError = console.error;
console.error = function(...args) {
  if (typeof args[0] === 'string' && 
      (args[0].includes('Warning') || 
       args[0].includes('React does not recognize') || 
       args[0].includes('Invalid prop'))) {
    return;
  }
  originalError.apply(console, args);
};

// Import components after our mocks
import { CipherGuard } from '../app/features/cipher-guard/components/CipherGuard';
import { EmberUnit } from '../app/features/ember-unit/components/EmberUnit';

// Actual tests
describe('CipherGuard Component', () => {
  it('should render with the conscience gate message', () => {
    const { container } = render(<CipherGuard />);
    expect(container).toBeTruthy();
    // Look for text that should be present
    expect(screen.getByText(/Cipher Guard active/i)).toBeInTheDocument();
  });
});

describe('EmberUnit Component', () => {
  it('should have a working HITM override button', () => {
    const { container } = render(<EmberUnit />);
    expect(container).toBeTruthy();
    // Test for the override button exists
    const overrideBtn = screen.getByRole('button', { 
      name: /HITM override|ACTIVATE DAD OVERRIDE/i 
    });
    expect(overrideBtn).toBeInTheDocument();
  });
});