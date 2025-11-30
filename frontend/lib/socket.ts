import { useEffect, useRef, useState } from 'react';

// Use relative path for WebSocket to work with Vite proxy
const WEBSOCKET_URL = '/ws/dad';
const MAX_RECONNECT_ATTEMPTS = 3;
const INITIAL_RECONNECT_DELAY = 1000;

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  content: string;
  timestamp: number;
}

interface WebSocketState {
  status: 'connecting' | 'connected' | 'disconnected';
  reconnectAttempts: number;
  lastError: string | null;
}

let ws: WebSocket | null = null;
let messageListeners: ((msg: ChatMessage) => void)[] = [];
let connectListeners: ((state: WebSocketState) => void)[] = [];
let disconnectListeners: ((state: WebSocketState) => void)[] = [];
let typingListeners: ((isTyping: boolean) => void)[] = [];
let wsState: WebSocketState = {
  status: 'disconnected',
  reconnectAttempts: 0,
  lastError: null
};

const updateState = (updates: Partial<WebSocketState>) => {
  wsState = { ...wsState, ...updates };
  if (updates.status === 'connected') {
    connectListeners.forEach(listener => listener(wsState));
  } else if (updates.status === 'disconnected') {
    disconnectListeners.forEach(listener => listener(wsState));
  }
};

const handleReconnect = () => {
  if (wsState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, wsState.reconnectAttempts);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${wsState.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    setTimeout(() => {
      updateState({ 
        status: 'connecting',
        reconnectAttempts: wsState.reconnectAttempts + 1
      });
      connectSocket();
    }, delay);
  } else {
    console.error('Max reconnection attempts reached');
    updateState({ 
      status: 'disconnected',
      lastError: 'Max reconnection attempts reached'
    });
  }
};

export const connectSocket = () => {
  if (ws) return;
  
  try {
    // Use the current host with the WebSocket path
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${WEBSOCKET_URL}`;
    
    ws = new WebSocket(wsUrl);
    updateState({ status: 'connecting' });
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      updateState({ 
        status: 'connected',
        reconnectAttempts: 0,
        lastError: null
      });
    };

    ws.onclose = (event) => {
      console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
      ws = null;
      updateState({ status: 'disconnected' });
      handleReconnect();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'typing') {
          typingListeners.forEach(listener => listener(data.isTyping));
        } else {
          messageListeners.forEach(listener => listener(data));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error parsing message';
        console.error('Error parsing message:', errorMessage);
        updateState({ lastError: errorMessage });
      }
    };

    ws.onerror = (event) => {
      const errorMessage = 'WebSocket error occurred';
      console.error(errorMessage, event);
      updateState({ lastError: errorMessage });
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error creating WebSocket';
    console.error('Error creating WebSocket:', errorMessage);
    updateState({ 
      status: 'disconnected',
      lastError: errorMessage
    });
    handleReconnect();
  }
};

export const disconnectSocket = () => {
  if (ws) {
    updateState({ 
      status: 'disconnected',
      reconnectAttempts: 0
    });
    ws.close();
    ws = null;
  }
};

export const sendMessage = (content: string) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'user',
      content,
      timestamp: Date.now()
    }));
  }
};

export const onMessage = (callback: (msg: ChatMessage) => void) => {
  messageListeners.push(callback);
  return () => {
    messageListeners = messageListeners.filter(cb => cb !== callback);
  };
};

export const onConnect = (callback: (state: WebSocketState) => void) => {
  connectListeners.push(callback);
  return () => {
    connectListeners = connectListeners.filter(cb => cb !== callback);
  };
};

export const onDisconnect = (callback: (state: WebSocketState) => void) => {
  disconnectListeners.push(callback);
  return () => {
    disconnectListeners = disconnectListeners.filter(cb => cb !== callback);
  };
};

export const onTyping = (callback: (isTyping: boolean) => void) => {
  typingListeners.push(callback);
  return () => {
    typingListeners = typingListeners.filter(cb => cb !== callback);
  };
};

export const getConnectionState = (): WebSocketState => {
  return wsState;
};

// React hook for WebSocket functionality
export const useWebSocket = () => {
  const [state, setState] = useState<WebSocketState>(wsState);
  const wsRef = useRef<WebSocket | null>(null);
  const eventListeners = useRef<{ [key: string]: ((data: any) => void)[] }>({});

  useEffect(() => {
    const handleStateChange = (newState: WebSocketState) => {
      setState(newState);
    };

    const unsubConnect = onConnect(handleStateChange);
    const unsubDisconnect = onDisconnect(handleStateChange);

    connectSocket();
    wsRef.current = ws;

    return () => {
      unsubConnect();
      unsubDisconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  const on = (event: string, callback: (data: any) => void) => {
    if (!eventListeners.current[event]) {
      eventListeners.current[event] = [];
    }
    eventListeners.current[event].push(callback);

    return () => {
      eventListeners.current[event] = eventListeners.current[event].filter(
        cb => cb !== callback
      );
    };
  };

  return {
    state,
    send,
    on,
    disconnect: disconnectSocket,
  };
};