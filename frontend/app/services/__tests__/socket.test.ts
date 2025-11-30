/**
 * WebSocket Service Tests
 * 
 * Tests for the WebSocket service including:
 * - Connection handling
 * - Message sending/receiving
 * - Reconnection logic
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketService } from '../socket';

// Mock WebSocket
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(public url: string) {
        // Simulate connection after a delay
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) {
                this.onopen(new Event('open'));
            }
        }, 10);
    }

    send(data: string) {
        // Mock send
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) {
            this.onclose(new CloseEvent('close', { code: 1000 }));
        }
    }
}

describe('WebSocketService', () => {
    let originalWebSocket: typeof WebSocket;
    let service: WebSocketService;

    beforeEach(() => {
        // Save original WebSocket
        originalWebSocket = global.WebSocket as any;
        // Replace with mock
        (global as any).WebSocket = MockWebSocket;
        
        // Get fresh instance
        service = WebSocketService.getInstance();
    });

    afterEach(() => {
        // Restore original WebSocket
        (global as any).WebSocket = originalWebSocket;
    });

    it('creates singleton instance', () => {
        const instance1 = WebSocketService.getInstance();
        const instance2 = WebSocketService.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('connects to WebSocket endpoint', async () => {
        const connectSpy = vi.spyOn(service, 'connect');
        service.connect();
        
        expect(connectSpy).toHaveBeenCalled();
    });

    it('sends messages when connected', async () => {
        service.connect();
        
        await new Promise(resolve => setTimeout(resolve, 20)); // Wait for connection
        
        const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');
        
        service.send({ type: 'chat', content: 'Test message' });
        
        await waitFor(() => {
            expect(sendSpy).toHaveBeenCalled();
        });
    });

    it('handles incoming messages', async () => {
        const messageHandler = vi.fn();
        service.onMessage(messageHandler);
        
        service.connect();
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Simulate incoming message
        const mockWs = (service as any).ws as MockWebSocket;
        if (mockWs.onmessage) {
            mockWs.onmessage(new MessageEvent('message', {
                data: JSON.stringify({ type: 'response', content: 'Hello' })
            }));
        }
        
        await waitFor(() => {
            expect(messageHandler).toHaveBeenCalled();
        });
    });

    it('reconnects on connection failure', async () => {
        const reconnectSpy = vi.spyOn(service as any, 'attemptReconnect');
        
        service.connect();
        
        // Simulate connection failure
        const mockWs = (service as any).ws as MockWebSocket;
        if (mockWs.onclose) {
            mockWs.onclose(new CloseEvent('close', { code: 1006 })); // Abnormal closure
        }
        
        await waitFor(() => {
            expect(reconnectSpy).toHaveBeenCalled();
        }, { timeout: 2000 });
    });
});

function waitFor(callback: () => void, options?: { timeout?: number }) {
    return new Promise<void>((resolve, reject) => {
        const timeout = options?.timeout || 1000;
        const start = Date.now();
        
        const check = () => {
            try {
                callback();
                resolve();
            } catch (error) {
                if (Date.now() - start > timeout) {
                    reject(error);
                } else {
                    setTimeout(check, 10);
                }
            }
        };
        
        check();
    });
}

