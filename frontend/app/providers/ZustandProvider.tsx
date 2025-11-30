'use client';

import { create } from 'zustand';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  PhoenixContext,
  UserRole,
  SubconsciousEvent,
  SubconsciousEventType,
  SubconsciousSource,
  SubconsciousPriority
} from '../types/global';

// Define store slices
interface UserSlice {
  user: PhoenixContext['user'];
  setUser: (user: PhoenixContext['user']) => void;
  updateUserRole: (role: UserRole) => void;
  updateUserPermissions: (permissions: string[]) => void;
  setUserLastActive: (timestamp: string) => void;
}

interface SettingsSlice {
  settings: PhoenixContext['settings'];
  updateSettings: (settings: Partial<PhoenixContext['settings']>) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setNotifications: (enabled: boolean) => void;
  setConscienceLevel: (level: number) => void;
}

interface RuntimeSlice {
  runtime: PhoenixContext['runtime'];
  updateRuntime: (runtime: Partial<PhoenixContext['runtime']>) => void;
  setFeature: (featureName: string, enabled: boolean) => void;
}

interface SubconsciousSlice {
  subconscious: PhoenixContext['subconscious'];
  updateSubconscious: (subconscious: Partial<PhoenixContext['subconscious']>) => void;
  toggleSubconscious: () => void;
  incrementEventsProcessed: () => void;
  setLastEventTimestamp: (timestamp: string | null) => void;
}

// For SSE connection status
interface ConnectionSlice {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

// For subconscious events management
interface EventsSlice {
  events: SubconsciousEvent[];
  processEvent: (event: SubconsciousEvent) => SubconsciousEvent;
  emitEvent: (options: EmitEventOptions) => SubconsciousEvent;
  getRecentEvents: (limit?: number) => SubconsciousEvent[];
  clearEvents: () => void;
}

// For subconscious tick system
interface TickSlice {
  tickCount: number;
  tickInterval: number;
  setTickInterval: (interval: number) => void;
  addTickListener: (listener: TickListener) => string;
  removeTickListener: (listenerId: string) => boolean;
}

// Helper types
interface EmitEventOptions {
  type: SubconsciousEventType;
  source: SubconsciousSource;
  data: Record<string, unknown>;
  priority?: SubconsciousPriority;
  relatedEvents?: string[];
  processingMetadata?: {
    confidenceScore?: number;
    interpreter?: string;
  };
}

type TickListener = (tickCount: number, deltaTime: number) => void;

// Combined store type
export type PhoenixStore = 
  UserSlice & 
  SettingsSlice & 
  RuntimeSlice & 
  SubconsciousSlice & 
  ConnectionSlice & 
  EventsSlice & 
  TickSlice;

// Initial state from existing Phoenix context
const initialState: Omit<PhoenixContext, 'user' | 'settings' | 'runtime' | 'subconscious'> & {
  user: PhoenixContext['user'];
  settings: PhoenixContext['settings'];
  runtime: PhoenixContext['runtime'];
  subconscious: PhoenixContext['subconscious'];
  events: SubconsciousEvent[];
  isConnected: boolean;
  tickCount: number;
  tickInterval: number;
} = {
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
  },
  events: [],
  isConnected: false,
  tickCount: 0,
  tickInterval: 100
};

/**
 * Interface for Server-Sent Events message
 */
interface SSEMessage {
  type: string;
  payload: any;
}

/**
 * Create the Zustand store with all the necessary slices
 */
export const usePhoenixStore = create<PhoenixStore>((set, get) => ({
  // Initial state
  ...initialState,
  
  // User slice
  setUser: (user) => set({ user }),
  updateUserRole: (role) => set((state) => ({
    user: { ...state.user, role }
  })),
  updateUserPermissions: (permissions) => set((state) => ({
    user: { ...state.user, permissions }
  })),
  setUserLastActive: (timestamp) => set((state) => ({
    user: { ...state.user, lastActive: timestamp }
  })),
  
  // Settings slice
  updateSettings: (settings) => set((state) => ({
    settings: { ...state.settings, ...settings }
  })),
  setTheme: (theme) => set((state) => ({
    settings: { ...state.settings, theme }
  })),
  setNotifications: (enabled) => set((state) => ({
    settings: { ...state.settings, notifications: enabled }
  })),
  setConscienceLevel: (level) => set((state) => ({
    settings: { ...state.settings, conscienceLevel: level }
  })),
  
  // Runtime slice
  updateRuntime: (runtime) => set((state) => ({
    runtime: { ...state.runtime, ...runtime }
  })),
  setFeature: (featureName, enabled) => set((state) => ({
    runtime: {
      ...state.runtime,
      features: {
        ...state.runtime.features,
        [featureName]: enabled
      }
    }
  })),
  
  // Subconscious slice
  updateSubconscious: (subconscious) => set((state) => ({
    subconscious: { ...state.subconscious, ...subconscious }
  })),
  toggleSubconscious: () => set((state) => ({
    subconscious: { ...state.subconscious, active: !state.subconscious.active }
  })),
  incrementEventsProcessed: () => set((state) => ({
    subconscious: {
      ...state.subconscious,
      eventsProcessed: state.subconscious.eventsProcessed + 1
    }
  })),
  setLastEventTimestamp: (timestamp) => set((state) => ({
    subconscious: { ...state.subconscious, lastEventTimestamp: timestamp }
  })),
  
  // Connection slice
  connect: () => {
    if (typeof window === 'undefined') return;
    
    const url = new URL('/api/sse', window.location.origin);
    const eventSource = new EventSource(url.toString());
    
    eventSource.onopen = () => {
      console.log('🔥 Phoenix SSE: Connected');
      set({ isConnected: true });
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEMessage;
        handleSSEMessage(data, get());
      } catch (error) {
        console.error('🔥 Phoenix SSE: Failed to parse message', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('🔥 Phoenix SSE: Error', error);
      eventSource.close();
      set({ isConnected: false });
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => get().connect(), 3000);
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
      set({ isConnected: false });
    }
  },
  
  // Events slice
  events: [],
  processEvent: (event) => {
    // Increment event counters
    get().incrementEventsProcessed();
    get().setLastEventTimestamp(event.timestamp);
    
    // Update events array
    set((state) => ({
      events: [event, ...state.events].slice(0, 1000) // Keep only the last 1000 events
    }));
    
    return event;
  },
  emitEvent: (options) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const startTime = performance.now();
    
    // Create the base event
    const event: SubconsciousEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: nowIso,
      type: options.type,
      source: options.source,
      data: options.data as Record<string, any>,
      priority: options.priority || 'medium',
      processed: false,
      relatedEvents: options.relatedEvents || []
    };
    
    // Calculate processing time
    const processingTime = performance.now() - startTime;
    
    // Create the processed event with properly defined processingMetadata
    const processedEvent: SubconsciousEvent = {
      ...event,
      processed: true,
      processingMetadata: {
        detectionTime: nowIso,
        processingTime,
        confidenceScore: options.processingMetadata?.confidenceScore || 0.5,
        interpreter: options.processingMetadata?.interpreter || 'default'
      }
    };
    
    return get().processEvent(processedEvent);
  },
  getRecentEvents: (limit = 50) => {
    return get().events.slice(0, Math.min(limit, get().events.length));
  },
  clearEvents: () => set({ events: [] }),
  
  // Tick slice
  tickCount: 0,
  tickInterval: 100,
  setTickInterval: (interval) => {
    if (interval < 16) {
      console.warn('Tick interval cannot be less than 16ms (60fps)');
      interval = 16;
    }
    set({ tickInterval: interval });
  },
  addTickListener: (listener) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    // Note: This implementation will need to be enhanced in a real component
    // that manages the tick listeners in a ref
    return id;
  },
  removeTickListener: (listenerId) => {
    // Note: This implementation will need to be enhanced in a real component
    // that manages the tick listeners in a ref
    return true;
  }
}));

/**
 * Handle incoming SSE messages
 * 
 * @param message - The message received from the server
 * @param store - The PhoenixStore instance to update
 */
function handleSSEMessage(message: SSEMessage, store: PhoenixStore): void {
  switch (message.type) {
    case 'user':
      store.setUser(message.payload);
      break;
    case 'settings':
      store.updateSettings(message.payload);
      break;
    case 'runtime':
      store.updateRuntime(message.payload);
      break;
    case 'subconscious-event':
      store.incrementEventsProcessed();
      store.setLastEventTimestamp(new Date().toISOString());
      break;
    case 'feature-toggle':
      if (typeof message.payload === 'object' && message.payload !== null) {
        const { name, enabled } = message.payload;
        store.setFeature(name, enabled);
      }
      break;
    default:
      console.warn('🔥 Phoenix SSE: Unknown message type', message.type);
  }
}

// Create a React context for the Phoenix store
type ZustandContextType = {
  store: ReturnType<typeof usePhoenixStore>;
} | null;

const ZustandContext = createContext<ZustandContextType>(null);

// Export a hook for using the Phoenix store within components
export function usePhoenix() {
  const context = useContext(ZustandContext);
  if (!context) {
    throw new Error('usePhoenix must be used within a ZustandProvider');
  }
  return context.store;
}

// Helper hook to access the Phoenix store with reactive state
export function usePhoenixContext() {
  // Get the active user from the store
  const user = usePhoenixStore((state) => state.user);
  const settings = usePhoenixStore((state) => state.settings);
  const runtime = usePhoenixStore((state) => state.runtime);
  const subconscious = usePhoenixStore((state) => state.subconscious);
  const isConnected = usePhoenixStore((state) => state.isConnected);
  
  // Get the setters
  const setUser = usePhoenixStore((state) => state.setUser);
  const updateUserRole = usePhoenixStore((state) => state.updateUserRole);
  const updateUserPermissions = usePhoenixStore((state) => state.updateUserPermissions);
  const setUserLastActive = usePhoenixStore((state) => state.setUserLastActive);
  
  const updateSettings = usePhoenixStore((state) => state.updateSettings);
  const setTheme = usePhoenixStore((state) => state.setTheme);
  const setNotifications = usePhoenixStore((state) => state.setNotifications);
  const setConscienceLevel = usePhoenixStore((state) => state.setConscienceLevel);
  
  const updateRuntime = usePhoenixStore((state) => state.updateRuntime);
  const setFeature = usePhoenixStore((state) => state.setFeature);
  
  const updateSubconscious = usePhoenixStore((state) => state.updateSubconscious);
  const toggleSubconscious = usePhoenixStore((state) => state.toggleSubconscious);
  const incrementEventsProcessed = usePhoenixStore((state) => state.incrementEventsProcessed);
  const setLastEventTimestamp = usePhoenixStore((state) => state.setLastEventTimestamp);
  
  const connect = usePhoenixStore((state) => state.connect);
  const disconnect = usePhoenixStore((state) => state.disconnect);
  
  return {
    user,
    settings,
    runtime,
    subconscious,
    isConnected,
    setUser,
    updateUserRole,
    updateUserPermissions,
    setUserLastActive,
    updateSettings,
    setTheme,
    setNotifications,
    setConscienceLevel,
    updateRuntime,
    setFeature,
    updateSubconscious,
    toggleSubconscious,
    incrementEventsProcessed,
    setLastEventTimestamp,
    connect,
    disconnect
  };
}

// Helper hook to use the subconscious functionality from the store
export function useSubconscious() {
  const subconscious = usePhoenixStore((state) => state.subconscious);
  const toggleSubconscious = usePhoenixStore((state) => state.toggleSubconscious);
  const updateSubconscious = usePhoenixStore((state) => state.updateSubconscious);
  const incrementEventsProcessed = usePhoenixStore((state) => state.incrementEventsProcessed);
  const setLastEventTimestamp = usePhoenixStore((state) => state.setLastEventTimestamp);
  
  const events = usePhoenixStore((state) => state.events);
  const processEvent = usePhoenixStore((state) => state.processEvent);
  const emitEvent = usePhoenixStore((state) => state.emitEvent);
  const getRecentEvents = usePhoenixStore((state) => state.getRecentEvents);
  const clearEvents = usePhoenixStore((state) => state.clearEvents);
  
  const tickCount = usePhoenixStore((state) => state.tickCount);
  const tickInterval = usePhoenixStore((state) => state.tickInterval);
  const setTickInterval = usePhoenixStore((state) => state.setTickInterval);
  const addTickListener = usePhoenixStore((state) => state.addTickListener);
  const removeTickListener = usePhoenixStore((state) => state.removeTickListener);
  
  // Initialize tick system if needed
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      // Add tick functionality here if needed
    }
  }, [initialized]);
  
  return {
    isActive: subconscious.active,
    eventsProcessed: subconscious.eventsProcessed,
    lastEventTimestamp: subconscious.lastEventTimestamp,
    toggleActive: toggleSubconscious,
    activate: () => updateSubconscious({ active: true }),
    deactivate: () => updateSubconscious({ active: false }),
    
    // Event methods
    subscribe: () => "subscription-id", // This would need more implementation
    unsubscribe: () => true, // This would need more implementation
    emitEvent,
    getRecentEvents,
    clearEvents,
    
    // Tick methods
    tickCount,
    tickInterval,
    setTickInterval,
    addTickListener,
    removeTickListener
  };
}

// ZustandProvider component
interface ZustandProviderProps {
  children: ReactNode;
}

export function ZustandProvider({ children }: ZustandProviderProps) {
  // Initialize the store for the client
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    // Connect to SSE on first render in browser
    if (typeof window !== 'undefined' && !ready) {
      setReady(true);
      
      // Connect to SSE
      usePhoenixStore.getState().connect();
      
      // Update the user's last active timestamp
      usePhoenixStore.getState().setUserLastActive(new Date().toISOString());
      
      // Setup user activity tracking
      const updateLastActive = () => {
        usePhoenixStore.getState().setUserLastActive(new Date().toISOString());
      };
      
      window.addEventListener('click', updateLastActive);
      window.addEventListener('keydown', updateLastActive);
      window.addEventListener('mousemove', updateLastActive);
      
      return () => {
        // Cleanup on unmount
        usePhoenixStore.getState().disconnect();
        window.removeEventListener('click', updateLastActive);
        window.removeEventListener('keydown', updateLastActive);
        window.removeEventListener('mousemove', updateLastActive);
      };
    }
  }, [ready]);
  
  return (
    <ZustandContext.Provider value={{ store: usePhoenixStore }}>
      {children}
    </ZustandContext.Provider>
  );
}

// Default export of the provider
export default ZustandProvider;