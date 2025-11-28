import { io, Socket } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5001';

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ['websocket', 'polling'],
});

export interface ChatMessage {
  id: string;
  type: 'user' | 'phoenix';
  content: string;
  timestamp: number;
  conscience?: 'reptilian' | 'mammalian' | 'neocortex';
}

export function connectSocket() {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export function sendMessage(content: string) {
  socket.emit('message', { 
    type: 'chat', 
    content,
    timestamp: Date.now()
  });
}

export function onMessage(callback: (msg: ChatMessage) => void) {
  socket.on('message', callback);
  return () => socket.off('message', callback);
}

export function onConnect(callback: () => void) {
  socket.on('connect', callback);
  return () => socket.off('connect', callback);
}

export function onDisconnect(callback: () => void) {
  socket.on('disconnect', callback);
  return () => socket.off('disconnect', callback);
}

export function onTyping(callback: (isTyping: boolean) => void) {
  socket.on('typing', callback);
  return () => socket.off('typing', callback);
}

export function getConnectionStatus(): 'connected' | 'disconnected' {
  return socket.connected ? 'connected' : 'disconnected';
}