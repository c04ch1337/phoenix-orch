import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export class MockWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;
  private messageLog: any[];

  constructor(port: number = 5001) {
    super();
    this.wss = new WebSocketServer({ port });
    this.clients = new Set();
    this.messageLog = [];

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      this.emit('connection', ws);

      ws.addListener('message', (message: Buffer) => {
        const parsedMessage = JSON.parse(message.toString());
        this.messageLog.push(parsedMessage);
        this.emit('message', parsedMessage);
      });

      ws.addListener('close', () => {
        this.clients.delete(ws);
        this.emit('disconnect');
      });
    });
  }

  public broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  public getMessageLog() {
    return this.messageLog;
  }

  public clearMessageLog() {
    this.messageLog = [];
  }

  public close() {
    this.wss.close();
    this.clients.clear();
    this.messageLog = [];
  }
}

export const mockServer = new MockWebSocketServer();