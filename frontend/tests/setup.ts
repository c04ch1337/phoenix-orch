/**
 * Test setup for the Web Speech API mocks
 */
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Create a simple event emitter functionality
class EventEmitter {
  private listeners: Record<string, Function[]> = {};
  
  on(event: string, handler: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
    return this;
  }
  
  off(event: string, handler: Function) {
    if (!this.listeners[event]) return this;
    this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    return this;
  }
  
  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return false;
    this.listeners[event].forEach(handler => handler(...args));
    return true;
  }
  
  removeAllListeners(event?: string) {
    if (event) {
      delete this.listeners[event];
    } else {
      Object.keys(this.listeners).forEach(key => delete this.listeners[key]);
    }
    return this;
  }
}

// SpeechRecognition mock
class SpeechRecognitionMock extends EventEmitter {
  // Properties
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  maxAlternatives = 1;
  
  // Event handlers
  onstart: ((event?: Event) => void) | null = null;
  onend: ((event?: Event) => void) | null = null;
  onerror: ((event?: Event) => void) | null = null;
  onresult: ((event?: Event) => void) | null = null;
  
  // Methods
  start = vi.fn(function(this: SpeechRecognitionMock) {
    if (typeof this.onstart === 'function') this.onstart();
  });
  
  stop = vi.fn(function(this: SpeechRecognitionMock) {
    if (typeof this.onend === 'function') this.onend();
  });
  
  abort = vi.fn();
}

// Speech synthesis utterance mock
class SpeechSynthesisUtteranceMock extends EventEmitter {
  // Properties
  text: string;
  lang = 'en-US';
  pitch = 1;
  rate = 1;
  volume = 1;
  voice = null;
  
  // Event handlers
  onstart: ((event?: Event) => void) | null = null;
  onend: ((event?: Event) => void) | null = null;
  onerror: ((event?: Event) => void) | null = null;
  
  constructor(text = '') {
    super();
    this.text = text;
  }
}

// SpeechSynthesis mock object as EventTarget
const speechSynthesisMock = {
  // Properties
  pending: false,
  speaking: false,
  paused: false,
  onvoiceschanged: null as ((event?: Event) => void) | null,
  
  // Methods
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => []),
  
  // Standard event methods
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
} as SpeechSynthesis;

// Add event emitter to speechSynthesis
const speechSynthesisEmitter = new EventEmitter();
(speechSynthesisMock as any).on = speechSynthesisEmitter.on.bind(speechSynthesisEmitter);
(speechSynthesisMock as any).off = speechSynthesisEmitter.off.bind(speechSynthesisEmitter);
(speechSynthesisMock as any).emit = speechSynthesisEmitter.emit.bind(speechSynthesisEmitter);
(speechSynthesisMock as any).removeAllListeners = speechSynthesisEmitter.removeAllListeners.bind(speechSynthesisEmitter);

// Type definitions for Web Speech API
if (typeof window !== 'undefined') {
  // Setup global objects
  Object.defineProperty(window, 'SpeechRecognition', {
    value: SpeechRecognitionMock,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(window, 'webkitSpeechRecognition', {
    value: SpeechRecognitionMock,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: SpeechSynthesisUtteranceMock,
    writable: true,
    configurable: true
  });
  
  Object.defineProperty(window, 'speechSynthesis', {
    value: speechSynthesisMock,
    writable: true,
    configurable: true
  });
} else {
  // If window doesn't exist (Node.js environment)
  (global as any).window = {};
  (global as any).SpeechRecognition = SpeechRecognitionMock;
  (global as any).webkitSpeechRecognition = SpeechRecognitionMock;
  (global as any).SpeechSynthesisUtterance = SpeechSynthesisUtteranceMock;
  (global as any).speechSynthesis = speechSynthesisMock;
}

// Jest compatibility layer for tests using Jest API
(global as any).jest = {
  fn: vi.fn,
  mock: vi.fn,
  spyOn: vi.spyOn
};

// Add console message to verify setup is executed
console.log('Web Speech API mocks initialized');