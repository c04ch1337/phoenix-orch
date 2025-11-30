import { WebSocket } from 'ws';
import { mockServer } from './mocks/server';

describe('WebSocket Testing Framework', () => {
  let client: WebSocket;

  beforeEach((done) => {
    client = new WebSocket('ws://localhost:5001');
    client.on('open', () => {
      done();
    });
  });

  afterEach((done) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
    mockServer.clearMessageLog();
    done();
  });

  afterAll((done) => {
    mockServer.close();
    done();
  });

  it('establishes connection successfully', () => {
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it('sends and receives messages', (done) => {
    const testMessage = { type: 'test', content: 'Hello Server' };
    
    mockServer.on('message', (message) => {
      expect(message).toEqual(testMessage);
      
      // Server responds
      const response = { type: 'response', content: 'Hello Client' };
      mockServer.broadcast(response);
    });

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message).toEqual({ type: 'response', content: 'Hello Client' });
      done();
    });

    client.send(JSON.stringify(testMessage));
  });

  it('handles disconnection', (done) => {
    mockServer.on('disconnect', () => {
      expect(client.readyState).toBe(WebSocket.CLOSED);
      done();
    });

    client.close();
  });

  it('maintains message log', (done) => {
    const testMessage = { type: 'test', content: 'Test Message' };

    mockServer.on('message', () => {
      const log = mockServer.getMessageLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(testMessage);
      done();
    });

    client.send(JSON.stringify(testMessage));
  });
});