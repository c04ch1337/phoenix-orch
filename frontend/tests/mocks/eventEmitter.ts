import { vi } from 'vitest';

/**
 * Mock implementation of the EventEmitter class for testing
 */
export class MockEventEmitter {
  private handlers: Record<string, Function[]> = {};

  /**
   * Register an event handler
   */
  on(event: string, handler: Function): this {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
    return this;
  }

  /**
   * Remove an event handler
   */
  off(event: string, handler: Function): this {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
    return this;
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): boolean {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(...args));
      return true;
    }
    return false;
  }
}

// Create vitest mock functions
MockEventEmitter.prototype.on = vi.fn(MockEventEmitter.prototype.on);
MockEventEmitter.prototype.off = vi.fn(MockEventEmitter.prototype.off);
MockEventEmitter.prototype.emit = vi.fn(MockEventEmitter.prototype.emit);

export default MockEventEmitter;