// Define the ChatMessage interface directly to avoid import issues
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'phoenix';
  content: string;
  timestamp: number;
}

interface ChatMessageDisplayProps {
  message: ChatMessage;
}

export default function ChatMessageDisplay({ message }: ChatMessageDisplayProps) {
  return (
    <div className="text-center italic border border-red-700 p-4 max-w-md mx-auto my-2">
      <p>{message.content}</p>
      <p className="text-xs mt-2">{new Date(message.timestamp).toISOString()}</p>
    </div>
  );
}