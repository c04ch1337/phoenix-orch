"use client";

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useEffect, useRef } from 'react';
import { 
  UserRole, 
  PhoenixContext, 
  ThemePreference, 
  Environment, 
  FeatureFlags 
} from '../types/global';
import { 
  useQuery, 
  useQueryClient, 
  QueryClient, 
  QueryClientProvider as TanStackQueryClientProvider
} from '@tanstack/react-query';

/**
 * Interface for the Phoenix context store
 * Extends the base context with actions to modify the state
 * and additional properties for managing connections
 */
interface PhoenixStore extends PhoenixContext {
  // Connection state
  connection: {
    /** Whether the SSE connection is established */
    isConnected: boolean;
    /** Last connection error if any */
    lastError: string | null;
    /** ISO timestamp of the last successful connection */
    lastConnectedAt: string | null;
    /** Number of connection attempts */
    connectionAttempts: number;
  };

  // User actions
  setUser: (user: Partial<PhoenixContext['user']>) => void;
  updateUserRole: (role: UserRole) => void;
  updateUserPermissions: (permissions: readonly string[]) => void;
  setUserLastActive: (timestamp: string) => void;
  
  // Settings actions
  updateSettings: (settings: Partial<PhoenixContext['settings']>) => void;
  setTheme: (theme: ThemePreference) => void;
  setNotifications: (enabled: boolean) => void;
  setTelemetry: (enabled: boolean) => void;
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
}

/**
 * Type-safe interface for SSE messages
 * Using discriminated union pattern for type safety
 */
type SSEMessage = 
  | UserMessage
  | SettingsMessage
  | RuntimeMessage
  | SubconsciousEventMessage
  | FeatureToggleMessage;

interface BaseSSEMessage {
  readonly id: string;
  readonly timestamp: string;
}

interface UserMessage extends BaseSSEMessage {
  readonly type: 'user';
  readonly payload: Partial<PhoenixContext['user']>;
}

interface SettingsMessage extends BaseSSEMessage {
  readonly type: 'settings';
  readonly payload: Partial<PhoenixContext['settings']>;
}

interface RuntimeMessage extends BaseSSEMessage {
  readonly type: 'runtime';
  readonly payload: Partial<PhoenixContext['runtime']>;
}

interface SubconsciousEventMessage extends BaseSSEMessage {
  readonly type: 'subconscious-event';
  readonly payload: {
    readonly id: string;
    readonly timestamp: string;
  };
}

interface FeatureToggleMessage extends BaseSSEMessage {
  readonly type: 'feature-toggle';
  readonly payload: {
    readonly name: string;
    readonly enabled: boolean;
  };
}

/**
 * Type guard to check if a message is a valid SSE message
 */
function isValidSSEMessage(message: unknown): message is SSEMessage {
  if (!message || typeof message !== 'object') return false;
  
  const msg = message as Record<string, unknown>;
  if (!msg.type || typeof msg.type !== 'string') return false;
  if (!msg.payload || typeof msg.payload !== 'object') return false;
  
  return ['user', 'settings', 'runtime', 'subconscious-event', 'feature-toggle'].includes(msg.type as string);
}

// Initial state matching the PhoenixContext interface
const initialState: PhoenixContext & { connection: PhoenixStore['connection'] } = {
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
    environment: 'development' as Environment,
    features: {} as FeatureFlags,
    startTime: new Date().toISOString(),
  },
  subconscious: {
    active: false,
    eventsProcessed: 0,
    lastEventTimestamp: null,
  },
  connection: {
    isConnected: false,
    lastError: null,
    lastConnectedAt: null,
    connectionAttempts: 0
  }
};

/**
 * Function to handle incoming SSE messages with type safety
 * 
 * @param message - The typed message received from the server
 * @param set - The Zustand setter function
 */
function handleSSEMessage(message: SSEMessage, set: (fn: (state: PhoenixStore) => Partial<PhoenixStore>) => void): void {
  switch (message.type) {
    case 'user':
      set((state) => ({
        user: {
          ...state.user,
          ...message.payload
        }
      }));
      break;
      
    case 'settings':
      set((state) => ({
        settings: {
          ...state.settings,
          ...message.payload
        }
      }));
      break;
      
    case 'runtime':
      set((state) => ({
        runtime: {
          ...state.runtime,
          ...message.payload
        }
      }));
      break;
      
    case 'subconscious-event':
      set((state) => ({
        subconscious: {
          ...state.subconscious,
          eventsProcessed: state.subconscious.eventsProcessed + 1,
          lastEventTimestamp: new Date().toISOString()
        }
      }));
      break;
      
    case 'feature-toggle': {
      const { name, enabled } = message.payload;
      set((state) => ({
        runtime: {
          ...state.runtime,
          features: {
            ...state.runtime.features,
            [name]: enabled
          }
        }
      }));
      break;
    }
  }
}

/**
 * Create the Zustand store with persistence
 * This store handles all the state management for the Phoenix application
 */
export const usePhoenixStore = create<PhoenixStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // User actions
      setUser: (userUpdate) => set((state) => ({
        user: { ...state.user, ...userUpdate }
      })),
      
      updateUserRole: (role) => set((state) => ({
        user: { ...state.user, role }
      })),
      
      updateUserPermissions: (permissions) => set((state) => ({
        user: { ...state.user, permissions }
      })),
      
      setUserLastActive: (timestamp) => set((state) => ({
        user: { ...state.user, lastActive: timestamp }
      })),
      
      // Settings actions
      updateSettings: (settingsUpdate) => set((state) => ({
        settings: { ...state.settings, ...settingsUpdate }
      })),
      
      setTheme: (theme) => set((state) => ({
        settings: { ...state.settings, theme }
      })),
      
      setNotifications: (enabled) => set((state) => ({
        settings: { ...state.settings, notifications: enabled }
      })),
      
      setTelemetry: (enabled) => set((state) => ({
        settings: { ...state.settings, telemetry: enabled }
      })),
      
      setConscienceLevel: (level) => set((state) => ({
        settings: { ...state.settings, conscienceLevel: level }
      })),
      
      // Runtime actions
      updateRuntime: (runtimeUpdate) => set((state) => ({
        runtime: { ...state.runtime, ...runtimeUpdate }
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
      
      // Subconscious actions
      updateSubconscious: (subconsciousUpdate) => set((state) => ({
        subconscious: { ...state.subconscious, ...subconsciousUpdate }
      })),
      
      toggleSubconscious: () => set((state) => ({
        subconscious: {
          ...state.subconscious,
          active: !state.subconscious.active
        }
      })),
      
      incrementEventsProcessed: () => set((state) => ({
        subconscious: {
          ...state.subconscious,
          eventsProcessed: state.subconscious.eventsProcessed + 1
        }
      })),
      
      setLastEventTimestamp: (timestamp) => set((state) => ({
        subconscious: {
          ...state.subconscious,
          lastEventTimestamp: timestamp
        }
      })),
      
      // SSE connection methods
      connect: () => {
        if (typeof window === 'undefined') return;
        
        // Get the current state
        const state = get();
        
        // Update connection state
        set((state) => ({
          connection: {
            ...state.connection,
            connectionAttempts: state.connection.connectionAttempts + 1
          }
        }));
        
        // Close any existing connection
        if ((window as any).__phoenixEventSource) {
          (window as any).__phoenixEventSource.close();
        }
        
        // Create a new connection
        const url = new URL('/api/sse', window.location.origin);
        const eventSource = new EventSource(url.toString());
        
        eventSource.onopen = () => {
          console.log('🔥 Phoenix SSE: Connected');
          set((state) => ({
            connection: {
              ...state.connection,
              isConnected: true,
              lastConnectedAt: new Date().toISOString(),
              lastError: null
            }
          }));
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (isValidSSEMessage(data)) {
              handleSSEMessage(data, set);
            } else {
              console.warn('🔥 Phoenix SSE: Invalid message format', data);
            }
          } catch (error) {
            console.error('🔥 Phoenix SSE: Failed to parse message', error);
            set((state) => ({
              connection: {
                ...state.connection,
                lastError: error instanceof Error ? error.message : String(error)
              }
            }));
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('🔥 Phoenix SSE: Error', error);
          eventSource.close();
          
          set((state) => ({
            connection: {
              ...state.connection,
              isConnected: false,
              lastError: error instanceof Error ? error.message : 'Connection error'
            }
          }));
          
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
          
          set((state) => ({
            connection: {
              ...state.connection,
              isConnected: false
            }
          }));
        }
      }
    }),
    {
      name: 'phoenix-storage',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist non-sensitive data that should survive page refreshes
      partialize: (state) => ({
        settings: state.settings,
        runtime: {
          environment: state.runtime.environment,
          features: state.runtime.features
        }
      }),
    }
  )
);

// Create a single QueryClient instance
let queryClient: QueryClient | null = null;

/**
 * Get the singleton QueryClient instance
 */
export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          retry: 2,
          refetchOnWindowFocus: false
        },
      },
    });
  }
  return queryClient;
}

/**
 * Type-safe selector hooks for extracting slices of the Phoenix store
 * These hooks optimize rendering by only triggering re-renders when
 * the selected state changes
 */
export const useUserState = () => usePhoenixStore((state) => state.user);
export const useSettingsState = () => usePhoenixStore((state) => state.settings);
export const useRuntimeState = () => usePhoenixStore((state) => state.runtime);
export const useSubconsciousState = () => usePhoenixStore((state) => state.subconscious);
export const useConnectionState = () => usePhoenixStore((state) => state.connection);

/**
 * Type-safe selector hooks for specific properties
 */
export const useUserRole = () => usePhoenixStore((state) => state.user.role);
export const useUserPermissions = () => usePhoenixStore((state) => state.user.permissions);
export const useTheme = () => usePhoenixStore((state) => state.settings.theme);
export const useConscienceLevel = () => usePhoenixStore((state) => state.settings.conscienceLevel);
export const useFeatureFlags = () => usePhoenixStore((state) => state.runtime.features);
export const useFeature = (featureName: string) => 
  usePhoenixStore((state) => state.runtime.features[featureName] ?? false);
export const useSubconsciousActive = () => usePhoenixStore((state) => state.subconscious.active);
export const useIsConnected = () => usePhoenixStore((state) => state.connection.isConnected);

/**
 * Selector hooks for store actions
 */
export const useUserActions = () => {
  const setUser = usePhoenixStore((state) => state.setUser);
  const updateUserRole = usePhoenixStore((state) => state.updateUserRole);
  const updateUserPermissions = usePhoenixStore((state) => state.updateUserPermissions);
  const setUserLastActive = usePhoenixStore((state) => state.setUserLastActive);
  
  return { setUser, updateUserRole, updateUserPermissions, setUserLastActive };
};

export const useSettingsActions = () => {
  const updateSettings = usePhoenixStore((state) => state.updateSettings);
  const setTheme = usePhoenixStore((state) => state.setTheme);
  const setNotifications = usePhoenixStore((state) => state.setNotifications);
  const setTelemetry = usePhoenixStore((state) => state.setTelemetry);
  const setConscienceLevel = usePhoenixStore((state) => state.setConscienceLevel);
  
  return { updateSettings, setTheme, setNotifications, setTelemetry, setConscienceLevel };
};

export const useRuntimeActions = () => {
  const updateRuntime = usePhoenixStore((state) => state.updateRuntime);
  const setFeature = usePhoenixStore((state) => state.setFeature);
  
  return { updateRuntime, setFeature };
};

export const useSubconsciousActions = () => {
  const updateSubconscious = usePhoenixStore((state) => state.updateSubconscious);
  const toggleSubconscious = usePhoenixStore((state) => state.toggleSubconscious);
  const incrementEventsProcessed = usePhoenixStore((state) => state.incrementEventsProcessed);
  const setLastEventTimestamp = usePhoenixStore((state) => state.setLastEventTimestamp);
  
  return { updateSubconscious, toggleSubconscious, incrementEventsProcessed, setLastEventTimestamp };
};

export const useConnectionActions = () => {
  const connect = usePhoenixStore((state) => state.connect);
  const disconnect = usePhoenixStore((state) => state.disconnect);
  
  return { connect, disconnect };
};

/**
 * Get a configured QueryClient provider component for the application
 */
export function getQueryProvider() {
  // Note: This approach avoids JSX in .ts files but still provides the React component
  const client = getQueryClient();
  
  // Create a non-JSX provider function that can be used in React components
  return function PhoenixQueryProvider(props: { children: React.ReactNode }) {
    return {
      type: TanStackQueryClientProvider,
      props: {
        client,
        children: props.children
      }
    };
  };
}

/**
 * Hook to fetch data from the Phoenix API with type safety
 * 
 * @example
 * const { data, isLoading, error } = usePhoenixQuery<UserProfile>('/api/users/me');
 */
export function usePhoenixQuery<T>(endpoint: string) {
  const queryClient = useQueryClient();
  
  return useQuery<T, Error>({
    queryKey: [endpoint],
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    }
  });
}

/**
 * Main hook to use the Phoenix application context
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
export function usePhoenixContext(): PhoenixStore {
  // Get the store instance
  const store = usePhoenixStore();
  const initializedRef = useRef(false);
  
  // Set up SSE connection
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      
      // Only connect if we're in the browser
      if (typeof window !== 'undefined') {
        store.connect();
        
        // Update the user's last active timestamp
        store.setUserLastActive(new Date().toISOString());
      }
    }
    
    // Cleanup on unmount
    return () => {
      store.disconnect();
    };
  }, [store]);
  
  // Update last active timestamp when user interacts with the page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateLastActive = () => {
      store.setUserLastActive(new Date().toISOString());
    };
    
    window.addEventListener('click', updateLastActive);
    window.addEventListener('keydown', updateLastActive);
    window.addEventListener('mousemove', updateLastActive);
    
    return () => {
      window.removeEventListener('click', updateLastActive);
      window.removeEventListener('keydown', updateLastActive);
      window.removeEventListener('mousemove', updateLastActive);
    };
  }, [store]); // store is needed for setUserLastActive
  
  return store;
}

export default usePhoenixContext;