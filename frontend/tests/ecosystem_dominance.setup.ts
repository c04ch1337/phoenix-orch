/**
 * Ecosystem Commands Test Setup
 * 
 * This file provides isolated setup for ecosystem commands testing.
 * It's designed to be imported directly into the test file rather than
 * through Vitest's automatic setup mechanism.
 */

import { vi } from 'vitest';

// This function initializes required browser APIs for ecosystem tests
export const setupEcosystemTest = () => {
  // We don't need to skip setup.ts anymore since we provide our own implementations
  console.log('Ecosystem test setup initialized');

  // Mock necessary browser APIs to prevent errors
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }

  // Mock IntersectionObserver
  if (typeof global.IntersectionObserver === 'undefined') {
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }

  // Mock Web Speech API
  class EventEmitter {
    private listeners: Record<string, Array<(event: any) => void>> = {};

    addEventListener(event: string, callback: (event: any) => void) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }

    removeEventListener(event: string, callback: (event: any) => void) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    dispatchEvent(event: any) {
      const eventType = event.type || 'unknown';
      if (!this.listeners[eventType]) return true;
      this.listeners[eventType].forEach(callback => callback(event));
      return true;
    }

    // Support 'on' style event handlers
    on(event: string, callback: (event: any) => void) {
      this.addEventListener(event, callback);
    }
  }

  // Mock SpeechRecognition
  class SpeechRecognitionMock extends EventEmitter {
    continuous = false;
    interimResults = false;
    lang = 'en-US';
    maxAlternatives = 1;
    
    constructor() {
      super();
      this.start = vi.fn();
      this.stop = vi.fn();
      this.abort = vi.fn();
    }

    start = () => {};
    stop = () => {};
    abort = () => {};
  }

  // Mock SpeechSynthesisUtterance
  class SpeechSynthesisUtteranceMock extends EventEmitter {
    text: string;
    lang = 'en-US';
    pitch = 1;
    rate = 1;
    volume = 1;
    voice: null | any = null;
    
    // Add required event handlers to match SpeechSynthesisUtterance interface
    onboundary: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
    onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
    onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
    onmark: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
    onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
    onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
    onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
    
    constructor(text: string = '') {
      super();
      this.text = text;
    }
  }

  // Mock SpeechSynthesis
  const speechSynthesisMock = {
    speaking: false,
    paused: false,
    pending: false,
    
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    
    // Add required event handler to match SpeechSynthesis interface
    onvoiceschanged: null as ((this: SpeechSynthesis, ev: Event) => any) | null,
  };

  // Add Web Speech API to global/window
  if (typeof global.SpeechRecognition === 'undefined' &&
      typeof global.webkitSpeechRecognition === 'undefined') {
    global.SpeechRecognition = SpeechRecognitionMock;
    global.webkitSpeechRecognition = SpeechRecognitionMock;
    global.SpeechSynthesisUtterance = SpeechSynthesisUtteranceMock;
    global.speechSynthesis = speechSynthesisMock;

    console.log('Web Speech API mocks initialized in ecosystem test setup');
  }

  // Mock window.matchMedia if needed
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // Return cleanup function
  return () => {
    // Restore mocks when needed
    vi.restoreAllMocks();
  };
};

export default setupEcosystemTest;