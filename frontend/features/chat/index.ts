export { default as ChatWindow } from './components/ChatWindow';
export { default as ChatMessageDisplay } from './components/ChatMessageDisplay';

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: number;
}