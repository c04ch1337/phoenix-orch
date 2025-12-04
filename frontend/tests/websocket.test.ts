import { createWebSocketClient } from '../lib/socket';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Create a complete mock WebSocket that satisfies the WebSocket interface
interface MockWebSocket {
  send: Mock;
  close: Mock;
  readyState: number;
  onopen: ((this: WebSocket, ev: Event) => any) | null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null;
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null;
  onerror: ((this: WebSocket, ev: Event) => any) | null;
  addEventListener: Mock;
  removeEventListener: Mock;
  dispatchEvent: Mock;
  CONNECTING: number;
  OPEN: number;
  CLOSING: number;
  CLOSED: number;
  url: string;
  protocol: string;
  extensions: string;
  bufferedAmount: number;
  binaryType: BinaryType;
}

describe('WebSocket Client', () => {
  const mockWebSocket: MockWebSocket = {
    send: vi.fn(),
    close: vi.fn(),
    readyState: WebSocket.OPEN,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
    url: '',
    protocol: '',
    extensions: '',
    bufferedAmount: 0,
    binaryType: 'blob',
  };

  // Mock the WebSocket constructor
  window.WebSocket = vi.fn().mockImplementation(() => mockWebSocket) as any;

  let client: ReturnType<typeof createWebSocketClient>;

  beforeEach(() => {
    client = createWebSocketClient('ws://localhost:5001');
    client.connect();
  });

  afterEach(() => {
    client.disconnect();
    vi.clearAllMocks();
  });

  it('establishes connection successfully', () => {
    expect(window.WebSocket).toHaveBeenCalledWith('ws://localhost:5001');
  });

  it('sends messages correctly', () => {
    const message = { type: 'test', content: 'Hello Server' };
    client.send(message);
    expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  it('handles received messages', () => {
    const message = { type: 'test', content: 'Test Message' };
    const mockMessageHandler = vi.fn();
    
    client.on('message', mockMessageHandler);
    
    // Simulate receiving a message
    const event = new MessageEvent('message', {
      data: JSON.stringify(message)
    });
    mockWebSocket.onmessage?.call(mockWebSocket as WebSocket, event);

    expect(mockMessageHandler).toHaveBeenCalledWith(message);
  });

  it('maintains message log', () => {
    const message = { type: 'test', content: 'Test Message' };
    
    // Simulate receiving a message
    const event = new MessageEvent('message', {
      data: JSON.stringify(message)
    });
    mockWebSocket.onmessage?.call(mockWebSocket as unknown as WebSocket, event);

    const log = client.getMessageLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual(message);
  });

  it('handles disconnection', () => {
    const mockDisconnectHandler = vi.fn();
    client.on('disconnected', mockDisconnectHandler);
    
    // Simulate connection close
    const closeEvent = new CloseEvent('close');
    mockWebSocket.onclose?.call(mockWebSocket, closeEvent);
    
    expect(mockDisconnectHandler).toHaveBeenCalled();
  });
});