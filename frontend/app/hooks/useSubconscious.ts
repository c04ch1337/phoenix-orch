"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import usePhoenixContext from './usePhoenixContext';
import { 
  SubconsciousEvent, 
  SubconsciousEventType, 
  SubconsciousSource,
  SubconsciousPriority 
} from '../types/global';

/**
 * Interface for event handlers that can be registered with the subconscious system
 */
interface SubconsciousEventHandler {
  id: string;
  eventTypes: SubconsciousEventType[] | null; // null means handle all event types
  handler: (event: SubconsciousEvent) => void;
  priority: number; // Higher numbers get called first
}

/**
 * Options for subscribing to subconscious events
 */
interface SubscribeOptions {
  eventTypes?: SubconsciousEventType[];
  priority?: number;
  id?: string;
}

/**
 * Options for emitting subconscious events
 */
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

/**
 * Loop tick listener function type
 */
type TickListener = (tickCount: number, deltaTime: number) => void;

/**
 * Return type for the useSubconscious hook
 */
interface UseSubconsciousReturn {
  // States
  isActive: boolean;
  eventsProcessed: number;
  lastEventTimestamp: string | null;
  tickCount: number;
  tickInterval: number;
  
  // Event management
  subscribe: (handler: (event: SubconsciousEvent) => void, options?: SubscribeOptions) => string;
  unsubscribe: (handlerId: string) => boolean;
  emitEvent: (options: EmitEventOptions) => SubconsciousEvent;
  getRecentEvents: (limit?: number) => SubconsciousEvent[];
  clearEvents: () => void;
  
  // Loop tick management
  setTickInterval: (interval: number) => void;
  addTickListener: (listener: TickListener) => string;
  removeTickListener: (listenerId: string) => boolean;
  
  // Subconscious control
  toggleActive: () => void;
  activate: () => void;
  deactivate: () => void;
}

/**
 * Custom hook for interacting with the Phoenix subconscious system.
 * 
 * This hook provides functionality to:
 * - Subscribe to and process subconscious events
 * - Manage the real-time loop ticks
 * - Control the subconscious system's active state
 * - Emit new events into the subconscious system
 * 
 * @returns An object containing state and methods to interact with the subconscious system
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     isActive,
 *     eventsProcessed,
 *     tickCount,
 *     emitEvent,
 *     subscribe,
 *     toggleActive
 *   } = useSubconscious();
 *   
 *   useEffect(() => {
 *     // Subscribe to specific types of subconscious events
 *     const handlerId = subscribe((event) => {
 *       console.log('Received event:', event);
 *     }, { eventTypes: [SubconsciousEventType.INSIGHT] });
 *     
 *     // Emit an event
 *     emitEvent({
 *       type: SubconsciousEventType.INSIGHT,
 *       source: SubconsciousSource.USER_INTERACTION,
 *       data: { message: 'User insight detected' },
 *       priority: 'medium'
 *     });
 *     
 *     return () => {
 *       // Clean up subscription on unmount
 *       unsubscribe(handlerId);
 *     };
 *   }, []);
 *   
 *   return (
 *     <div>
 *       <p>Subconscious system: {isActive ? 'Active' : 'Inactive'}</p>
 *       <p>Events processed: {eventsProcessed}</p>
 *       <p>Current tick: {tickCount}</p>
 *       <button onClick={toggleActive}>
 *         {isActive ? 'Deactivate' : 'Activate'} Subconscious
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSubconscious(): UseSubconsciousReturn {
  // Get the Phoenix context which contains the subconscious state
  const phoenix = usePhoenixContext();
  
  // Local state for managing events and tick system
  const [events, setEvents] = useState<SubconsciousEvent[]>([]);
  const [tickCount, setTickCount] = useState<number>(0);
  const [tickInterval, setTickIntervalState] = useState<number>(100); // 100ms default tick interval
  
  // Refs to store event handlers and tick listeners
  const eventHandlersRef = useRef<SubconsciousEventHandler[]>([]);
  const tickListenersRef = useRef<Map<string, TickListener>>(new Map());
  const lastTickTimeRef = useRef<number>(Date.now());
  const tickIntervalIdRef = useRef<NodeJS.Timeout | null>(null);
  
  // Maximum number of events to keep in memory
  const MAX_EVENTS = 1000;

  /**
   * Toggle the active state of the subconscious system
   */
  const toggleActive = useCallback(() => {
    phoenix.toggleSubconscious();
  }, [phoenix]);

  /**
   * Activate the subconscious system
   */
  const activate = useCallback(() => {
    if (!phoenix.subconscious.active) {
      phoenix.updateSubconscious({ active: true });
    }
  }, [phoenix]);

  /**
   * Deactivate the subconscious system
   */
  const deactivate = useCallback(() => {
    if (phoenix.subconscious.active) {
      phoenix.updateSubconscious({ active: false });
    }
  }, [phoenix]);

  /**
   * Set the interval for the real-time tick loop
   * @param interval - The new interval in milliseconds
   */
  const setTickInterval = useCallback((interval: number) => {
    if (interval < 16) {
      console.warn('Tick interval cannot be less than 16ms (60fps)');
      interval = 16;
    }
    
    setTickIntervalState(interval);
    
    // Reset the tick loop with the new interval
    if (tickIntervalIdRef.current) {
      clearInterval(tickIntervalIdRef.current);
      startTickLoop(interval);
    }
  }, []);

  /**
   * Process a new subconscious event
   * @param event - The event to process
   */
  const processEvent = useCallback((event: SubconsciousEvent) => {
    // Update global Phoenix context
    phoenix.incrementEventsProcessed();
    phoenix.setLastEventTimestamp(event.timestamp);
    
    // Update local state
    setEvents(prev => {
      const newEvents = [event, ...prev].slice(0, MAX_EVENTS);
      return newEvents;
    });
    
    // Process the event through all registered handlers, ordered by priority
    const handlers = [...eventHandlersRef.current]
      .sort((a, b) => b.priority - a.priority);
    
    for (const handler of handlers) {
      // Check if this handler should process this event type
      if (!handler.eventTypes || handler.eventTypes.includes(event.type)) {
        try {
          handler.handler(event);
        } catch (error) {
          console.error(`Error in subconscious event handler ${handler.id}:`, error);
        }
      }
    }
    
    return event;
  }, [phoenix]);

  /**
   * Generate a unique ID for handlers and listeners
   */
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  /**
   * Subscribe to subconscious events
   * @param handler - Function to call when an event is received
   * @param options - Subscription options
   * @returns A unique ID for the handler, used to unsubscribe
   */
  const subscribe = useCallback((
    handler: (event: SubconsciousEvent) => void, 
    options: SubscribeOptions = {}
  ): string => {
    const id = options.id || generateId();
    const eventTypes = options.eventTypes || null;
    const priority = options.priority || 0;
    
    eventHandlersRef.current.push({
      id,
      eventTypes,
      handler,
      priority
    });
    
    return id;
  }, [generateId]);

  /**
   * Unsubscribe from subconscious events
   * @param handlerId - The ID returned from subscribe
   * @returns True if a handler was removed, false otherwise
   */
  const unsubscribe = useCallback((handlerId: string): boolean => {
    const initialLength = eventHandlersRef.current.length;
    eventHandlersRef.current = eventHandlersRef.current.filter(
      handler => handler.id !== handlerId
    );
    return eventHandlersRef.current.length < initialLength;
  }, []);

  /**
   * Emit a new event into the subconscious system
   * @param options - Event options
   * @returns The created and processed event
   */
  const emitEvent = useCallback((options: EmitEventOptions): SubconsciousEvent => {
    const now = new Date();
    const nowIso = now.toISOString();
    const startTime = performance.now();
    
    // Create the base event
    const event: SubconsciousEvent = {
      id: generateId(),
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
    
    return processEvent(processedEvent);
  }, [generateId, processEvent]);

  /**
   * Get recent events from the event history
   * @param limit - Maximum number of events to return
   * @returns Array of recent events
   */
  const getRecentEvents = useCallback((limit = 50): SubconsciousEvent[] => {
    return events.slice(0, Math.min(limit, events.length));
  }, [events]);

  /**
   * Clear all stored events
   */
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  /**
   * Add a listener to the real-time tick loop
   * @param listener - Function to call on each tick
   * @returns A unique ID for the listener, used to remove it
   */
  const addTickListener = useCallback((listener: TickListener): string => {
    const id = generateId();
    tickListenersRef.current.set(id, listener);
    return id;
  }, [generateId]);

  /**
   * Remove a tick listener
   * @param listenerId - The ID returned from addTickListener
   * @returns True if a listener was removed, false otherwise
   */
  const removeTickListener = useCallback((listenerId: string): boolean => {
    return tickListenersRef.current.delete(listenerId);
  }, []);

  /**
   * Start the real-time tick loop
   * @param interval - The tick interval in milliseconds
   */
  const startTickLoop = useCallback((interval: number) => {
    // Clear any existing interval
    if (tickIntervalIdRef.current) {
      clearInterval(tickIntervalIdRef.current);
    }
    
    // Set the last tick time to now
    lastTickTimeRef.current = Date.now();
    
    // Start a new interval
    tickIntervalIdRef.current = setInterval(() => {
      // Only process ticks if the subconscious is active
      if (phoenix.subconscious.active) {
        const now = Date.now();
        const deltaTime = now - lastTickTimeRef.current;
        lastTickTimeRef.current = now;
        
        setTickCount(prev => prev + 1);
        
        // Notify all listeners
        tickListenersRef.current.forEach(listener => {
          try {
            listener(tickCount, deltaTime);
          } catch (error) {
            console.error('Error in tick listener:', error);
          }
        });
      }
    }, interval);
  }, [phoenix.subconscious.active, tickCount]);

  // Initialize and cleanup the tick loop
  useEffect(() => {
    startTickLoop(tickInterval);
    
    return () => {
      if (tickIntervalIdRef.current) {
        clearInterval(tickIntervalIdRef.current);
      }
    };
  }, [startTickLoop, tickInterval]);

  return {
    // State
    isActive: phoenix.subconscious.active,
    eventsProcessed: phoenix.subconscious.eventsProcessed,
    lastEventTimestamp: phoenix.subconscious.lastEventTimestamp,
    tickCount,
    tickInterval,
    
    // Event methods
    subscribe,
    unsubscribe,
    emitEvent,
    getRecentEvents,
    clearEvents,
    
    // Tick methods
    setTickInterval,
    addTickListener,
    removeTickListener,
    
    // Control methods
    toggleActive,
    activate,
    deactivate
  };
}

export default useSubconscious;