"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { UserRole, PhoenixContext } from '../types/global';

/**
 * Interface for the Phoenix context store
 * Extends the base context with actions to modify the state
 */
interface PhoenixContextStore extends PhoenixContext {
  // User actions
  setUser: (user: PhoenixContext['user']) => void;
  updateUserRole: (role: UserRole) => void;
  updateUserPermissions: (permissions: string[]) => void;
  setUserLastActive: (timestamp: string) => void;
  
  // Settings actions
  updateSettings: (settings: Partial<PhoenixContext['settings']>) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setNotifications: (enabled: boolean) => void;
  setConscienceLevel: (level: number) => void;
  
  // Runtime actions
  updateRuntime: (runtime: Partial<PhoenixContext['runtime']>) => void;
  setFeature: (featureName: string, enabled: boolean) => void;
  
  // Subconscious actions
  updateSubconscious: (subconscious: Partial<PhoenixContext['subconscious']>) => void;
  toggleSubconscious: () => void;
  incrementEventsProcessed: () => void;
  setLastEventTimestamp: (timestamp: string | null) => void;
  
  // SSE related actions
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

/**
 * Interface for Server-Sent Events message
 */
interface SSEMessage {
  type: string;
  payload: any;
}

// Singleton store instance
let store: PhoenixContextStore | null = null;
let listeners: Array<() => void> = [];

// Initial state
const initialState: PhoenixContext = {
  user: {
    id: '',
    name: '',
    role: UserRole.VIEWER,
    permissions: [],
    lastActive: new Date().toISOString(),
  },
  settings: {
    theme: 'system',
    notifications: true,
    telemetry: true,
    conscienceLevel: 3,
  },
  runtime: {
    version: '1.0.0',
    environment: 'development',
    features: {},
    startTime: new Date().toISOString(),
  },
  subconscious: {
    active: false,
    eventsProcessed: 0,
    lastEventTimestamp: null,
  }
};

/**
 * Handle incoming SSE messages
 * 
 * @param message - The message received from the server
 * @param storeInstance - The PhoenixContextStore instance to update
 */
function handleSSEMessage(message: SSEMessage, storeInstance: PhoenixContextStore): void {
  switch (message.type) {
    case 'user':
      storeInstance.setUser(message.payload);
      break;
    case 'settings':
      storeInstance.updateSettings(message.payload);
      break;
    case 'runtime':
      storeInstance.updateRuntime(message.payload);
      break;
    case 'subconscious-event':
      storeInstance.incrementEventsProcessed();
      storeInstance.setLastEventTimestamp(new Date().toISOString());
      break;
    case 'feature-toggle':
      if (typeof message.payload === 'object' && message.payload !== null) {
        const { name, enabled } = message.payload;
        storeInstance.setFeature(name, enabled);
      }
      break;
    default:
      console.warn('🔥 Phoenix SSE: Unknown message type', message.type);
  }
}

/**
 * Create a singleton store to manage Phoenix application context
 * 
 * This implementation uses a simple state management pattern until Zustand is installed.
 * To use Zustand, install it with: `npm install zustand`
 */
function createStore(): PhoenixContextStore {
  // Return existing instance if already created
  if (store) {
    return store;
  }

  // State holder
  let state: PhoenixContext = { ...initialState };
  
  // Connection status
  let isConnected = false;
  
  // Notify all listeners when state changes
  const notify = () => {
    listeners.forEach(listener => listener());
  };

  // Store implementation
  store = {
    ...initialState,
    isConnected,
    
    // User actions
    setUser: (user) => {
      state.user = user;
      store!.user = user;
      notify();
    },
    
    updateUserRole: (role) => {
      state.user.role = role;
      store!.user.role = role;
      notify();
    },
    
    updateUserPermissions: (permissions) => {
      state.user.permissions = permissions;
      store!.user.permissions = permissions;
      notify();
    },
    
    setUserLastActive: (timestamp) => {
      state.user.lastActive = timestamp;
      store!.user.lastActive = timestamp;
      notify();
    },
    
    // Settings actions
    updateSettings: (settings) => {
      state.settings = { ...state.settings, ...settings };
      store!.settings = { ...store!.settings, ...settings };
      notify();
    },
    
    setTheme: (theme) => {
      state.settings.theme = theme;
      store!.settings.theme = theme;
      notify();
    },
    
    setNotifications: (enabled) => {
      state.settings.notifications = enabled;
      store!.settings.notifications = enabled;
      notify();
    },
    
    setConscienceLevel: (level) => {
      state.settings.conscienceLevel = level;
      store!.settings.conscienceLevel = level;
      notify();
    },
    
    // Runtime actions
    updateRuntime: (runtime) => {
      state.runtime = { ...state.runtime, ...runtime };
      store!.runtime = { ...store!.runtime, ...runtime };
      notify();
    },
    
    setFeature: (featureName, enabled) => {
      state.runtime.features[featureName] = enabled;
      store!.runtime.features[featureName] = enabled;
      notify();
    },
    
    // Subconscious actions
    updateSubconscious: (subconscious) => {
      state.subconscious = { ...state.subconscious, ...subconscious };
      store!.subconscious = { ...store!.subconscious, ...subconscious };
      notify();
    },
    
    toggleSubconscious: () => {
      state.subconscious.active = !state.subconscious.active;
      store!.subconscious.active = state.subconscious.active;
      notify();
    },
    
    incrementEventsProcessed: () => {
      state.subconscious.eventsProcessed++;
      store!.subconscious.eventsProcessed = state.subconscious.eventsProcessed;
      notify();
    },
    
    setLastEventTimestamp: (timestamp) => {
      state.subconscious.lastEventTimestamp = timestamp;
      store!.subconscious.lastEventTimestamp = timestamp;
      notify();
    },
    
    // SSE connection methods
    connect: () => {
      if (typeof window === 'undefined') return;
      
      const url = new URL('/api/sse', window.location.origin);
      const eventSource = new EventSource(url.toString());
      
      eventSource.onopen = () => {
        console.log('🔥 Phoenix SSE: Connected');
        isConnected = true;
        store!.isConnected = true;
        notify();
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEMessage;
          handleSSEMessage(data, store!);
        } catch (error) {
          console.error('🔥 Phoenix SSE: Failed to parse message', error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('🔥 Phoenix SSE: Error', error);
        eventSource.close();
        isConnected = false;
        store!.isConnected = false;
        notify();
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => store!.connect(), 3000);
      };
      
      // Save the EventSource in a global variable to access it in disconnect()
      (window as any).__phoenixEventSource = eventSource;
    },
    
    disconnect: () => {
      if (typeof window === 'undefined') return;
      
      const eventSource = (window as any).__phoenixEventSource as EventSource | undefined;
      if (eventSource) {
        eventSource.close();
        delete (window as any).__phoenixEventSource;
        isConnected = false;
        store!.isConnected = false;
        notify();
      }
    }
  };

  // Return the store
  return store;
}

/**
 * Hook to use the Phoenix application context
 * 
 * This hook provides access to the global Phoenix context including:
 * - User information (id, name, role, permissions)
 * - Application settings (theme, notifications, conscienceLevel)
 * - Runtime information (version, environment, features)
 * - Subconscious status (active, eventsProcessed)
 * 
 * It also handles synchronization with the backend using SSE (Server-Sent Events)
 * and provides methods to update the context.
 * 
 * @returns The Phoenix context store with all state and actions
 * 
 * @example
 * ```tsx
 * // In a component:
 * const phoenix = usePhoenixContext();
 * 
 * // Access state
 * console.log(phoenix.user.name);
 * console.log(phoenix.settings.theme);
 * 
 * // Update state
 * phoenix.setTheme('dark');
 * phoenix.toggleSubconscious();
 * 
 * // Using with React components
 * return (
 *   <div>
 *     <h1>Welcome {phoenix.user.name}</h1>
 *     {phoenix.subconscious.active && (
 *       <p>Subconscious active: {phoenix.subconscious.eventsProcessed} events processed</p>
 *     )}
 *   </div>
 * );
 * ```
 */
export function usePhoenixContext(): PhoenixContextStore {
  // Create the store if it doesn't exist
  const storeInstance = createStore();
  
  // Force re-render on state change
  const [, setUpdateFlag] = useState(0);
  
  // Listen for changes to force re-renders
  useEffect(() => {
    const listener = () => setUpdateFlag(prev => prev + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);
  
  const initializedRef = useRef(false);
  
  useEffect(() => {
    // Connect to SSE on first render
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      // Only connect if we're in the browser
      if (typeof window !== 'undefined') {
        storeInstance.connect();
      }
      
      // Update the user's last active timestamp
      storeInstance.setUserLastActive(new Date().toISOString());
      
      // Cleanup on unmount
      return () => {
        storeInstance.disconnect();
      };
    }
  }, [storeInstance]);
  
  // Update last active timestamp when user interacts with the page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateLastActive = () => {
        storeInstance.setUserLastActive(new Date().toISOString());
      };
      
      window.addEventListener('click', updateLastActive);
      window.addEventListener('keydown', updateLastActive);
      window.addEventListener('mousemove', updateLastActive);
      
      return () => {
        window.removeEventListener('click', updateLastActive);
        window.removeEventListener('keydown', updateLastActive);
        window.removeEventListener('mousemove', updateLastActive);
      };
    }
  }, [storeInstance]);
  
  return storeInstance;
}

export default usePhoenixContext;

// Add a note in comments on how to migrate to Zustand:
/**
 * TODO: Migrate to Zustand when ready
 * 
 * 1. Install Zustand: npm install zustand
 * 2. Replace the custom store implementation with a proper Zustand store:
 * 
 * ```ts
 * import { create } from 'zustand';
 * 
 * export const usePhoenixStore = create<PhoenixContextStore>((set) => ({
 *   // Initial state
 *   ...initialState,
 *   isConnected: false,
 *   
 *   // Actions
 *   setUser: (user) => set((state) => ({ ...state, user })),
 *   // ... other actions
 * }));
 * 
 * export function usePhoenixContext() {
 *   // The zustand state is already reactive
 *   const store = usePhoenixStore();
 *   // ... rest of implementation
 *   return store;
 * }
 * ```
 */