"use client";

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { usePhoenixStore } from './usePhoenixContext';
import { 
  SubconsciousEvent, 
  SubconsciousEventType, 
  SubconsciousSource,
  SubconsciousPriority,
  SubconsciousEventData,
  InsightEvent,
  WarningEvent,
  CriticalEvent,
  DiscoveryEvent,
  PatternEvent,
  AnomalyEvent,
  ConnectionEvent,
  SubconsciousProcessingMetadata
} from '../types/global';
import { create } from 'zustand';

/**
 * Subconscious events store interface
 * This extends the base Zustand store for subconscious event management
 */
interface SubconsciousEventsStore {
  // State
  events: SubconsciousEvent[];
  eventMap: Map<string, SubconsciousEvent>;
  priorityQueues: {
    [key in SubconsciousPriority]: string[];
  };
  
  // Actions
  addEvent: (event: SubconsciousEvent) => void;
  updateEvent: (id: string, updates: Partial<SubconsciousEvent>) => void;
  removeEvent: (id: string) => void;
  clearEvents: () => void;
}

/**
 * Create a Zustand store specifically for managing subconscious events
 * This provides more efficient state management than React's useState
 */
const useSubconsciousEventsStore = create<SubconsciousEventsStore>((set, get) => ({
  // Initial state
  events: [],
  eventMap: new Map(),
  priorityQueues: {
    low: [],
    medium: [],
    high: [],
    critical: []
  },
  
  // Actions
  addEvent: (event: SubconsciousEvent) => set(state => {
    const newEvents = [event, ...state.events].slice(0, 1000); // Limit to 1000 events
    const newEventMap = new Map(state.eventMap);
    newEventMap.set(event.id, event);
    
    // Update priority queue
    const newPriorityQueues = { ...state.priorityQueues };
    newPriorityQueues[event.priority] = [
      event.id,
      ...newPriorityQueues[event.priority]
    ].slice(0, 1000); // Limit each queue to 1000 ids
    
    return {
      events: newEvents,
      eventMap: newEventMap,
      priorityQueues: newPriorityQueues
    };
  }),
  
  updateEvent: (id: string, updates: Partial<SubconsciousEvent>) => {
    set(state => {
      const event = state.eventMap.get(id);
      if (!event) return state;
      
      // Create a type-safe updated event
      const updatedEvent = { ...event, ...updates } as SubconsciousEvent;
      
      // Create a new array with the updated event
      const newEvents = state.events.map(e => e.id === id ? updatedEvent : e);
      
      // Update the event map
      const newEventMap = new Map(state.eventMap);
      newEventMap.set(id, updatedEvent);
      
      // If priority changed, update priority queues
      if (updates.priority && updates.priority !== event.priority) {
        const newPriorityQueues = { ...state.priorityQueues };
        // Remove from old queue
        newPriorityQueues[event.priority] = newPriorityQueues[event.priority].filter(
          eventId => eventId !== id
        );
        // Add to new queue
        newPriorityQueues[updates.priority as SubconsciousPriority] = [
          id,
          ...newPriorityQueues[updates.priority as SubconsciousPriority]
        ];
        
        return {
          events: newEvents,
          eventMap: newEventMap,
          priorityQueues: newPriorityQueues
        };
      }
      
      return {
        events: newEvents,
        eventMap: newEventMap,
        priorityQueues: state.priorityQueues
      };
    });
  },
  
  removeEvent: (id: string) => set(state => {
    const event = state.eventMap.get(id);
    if (!event) return state;
    
    const newEvents = state.events.filter(e => e.id !== id);
    const newEventMap = new Map(state.eventMap);
    newEventMap.delete(id);
    
    // Remove from priority queue
    const newPriorityQueues = { ...state.priorityQueues };
    newPriorityQueues[event.priority] = newPriorityQueues[event.priority].filter(
      eventId => eventId !== id
    );
    
    return {
      events: newEvents,
      eventMap: newEventMap,
      priorityQueues: newPriorityQueues
    };
  }),
  
  clearEvents: () => set({
    events: [],
    eventMap: new Map(),
    priorityQueues: {
      low: [],
      medium: [],
      high: [],
      critical: []
    }
  })
}));

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
  eventTypes?: SubconsciousEventType[] | null;
  priority?: number;
  id?: string;
  inheritEvents?: boolean;
}

/**
 * Type-safe options for emitting specific subconscious event types
 * Uses events type interfaces from global.ts for each event type
 */
type EmitEventOptions<T extends SubconsciousEventType> = 
  T extends SubconsciousEventType.INSIGHT ? {
    type: T;
    source: SubconsciousSource;
    data: Omit<InsightEvent['data'], 'relatedConcepts'> & {
      relatedConcepts?: string[];
    };
    priority?: SubconsciousPriority;
    relatedEvents?: string[];
    processingMetadata?: Partial<SubconsciousProcessingMetadata>;
  } :
  T extends SubconsciousEventType.WARNING ? {
    type: T;
    source: SubconsciousSource;
    data: Omit<WarningEvent['data'], 'suggestions'> & {
      suggestions?: string[];
    };
    priority?: SubconsciousPriority;
    relatedEvents?: string[];
    processingMetadata?: Partial<SubconsciousProcessingMetadata>;
  } :
  T extends SubconsciousEventType.CRITICAL ? {
    type: T;
    source: SubconsciousSource;
    data: Omit<CriticalEvent['data'], 'recommendedActions' | 'timeToImpact'> & {
      recommendedActions: string[];
      timeToImpact?: number;
    };
    priority?: SubconsciousPriority;
    relatedEvents?: string[];
    processingMetadata?: Partial<SubconsciousProcessingMetadata>;
  } :
  T extends SubconsciousEventType.DISCOVERY ? {
    type: T;
    source: SubconsciousSource;
    data: Omit<DiscoveryEvent['data'], 'evidence'> & {
      evidence?: string[];
    };
    priority?: SubconsciousPriority;
    relatedEvents?: string[];
    processingMetadata?: Partial<SubconsciousProcessingMetadata>;
  } :
  T extends SubconsciousEventType.PATTERN ? {
    type: T;
    source: SubconsciousSource;
    data: Omit<PatternEvent['data'], 'contexts'> & {
      contexts?: string[];
    };
    priority?: SubconsciousPriority;
    relatedEvents?: string[];
    processingMetadata?: Partial<SubconsciousProcessingMetadata>;
  } :
  T extends SubconsciousEventType.ANOMALY ? {
    type: T;
    source: SubconsciousSource;
    data: AnomalyEvent['data'];
    priority?: SubconsciousPriority;
    relatedEvents?: string[];
    processingMetadata?: Partial<SubconsciousProcessingMetadata>;
  } :
  T extends SubconsciousEventType.CONNECTION ? {
    type: T;
    source: SubconsciousSource;
    data: ConnectionEvent['data'];
    priority?: SubconsciousPriority;
    relatedEvents?: string[];
    processingMetadata?: Partial<SubconsciousProcessingMetadata>;
  } : never;

/**
 * Type for real-time loop tick listener function
 */
type TickListener = (tickCount: number, deltaTime: number) => void;

/**
 * Configuration options for the subconscious event loop
 */
interface EventLoopConfig {
  /** Interval in milliseconds for the main event loop (default: 100ms) */
  tickInterval: number;
  /** Maximum events to process per tick (default: 10) */
  maxEventsPerTick: number;
  /** Whether to pause the event loop when the tab is not visible (default: true) */
  pauseWhenHidden: boolean;
  /** Maximum events to keep in memory (default: 1000) */
  maxEventsInMemory: number;
}

/**
 * Event inheritance configuration
 */
interface EventInheritanceConfig {
  /** Whether to enable event inheritance (default: true) */
  enabled: boolean;
  /** Maximum inheritance depth (default: 3) */
  maxDepth: number;
  /** Properties to inherit from parent events */
  inheritProperties: Array<keyof SubconsciousEvent>;
}

/**
 * Return type for the useSubconscious hook with improved type safety
 */
interface UseSubconsciousReturn {
  // States
  isActive: boolean;
  eventsProcessed: number;
  lastEventTimestamp: string | null;
  tickCount: number;
  
  // Event management with type safety
  subscribe: (
    handler: (event: SubconsciousEvent) => void,
    options?: SubscribeOptions
  ) => string;
  
  unsubscribe: (handlerId: string) => boolean;
  
  emitEvent: <T extends SubconsciousEventType>(
    options: EmitEventOptions<T>
  ) => SubconsciousEvent & { type: T };
  
  getRecentEvents: (
    options?: {
      limit?: number;
      eventTypes?: SubconsciousEventType[] | null;
      priority?: SubconsciousPriority | SubconsciousPriority[];
      processed?: boolean;
    }
  ) => SubconsciousEvent[];
  
  getEventById: (
    id: string,
    eventType?: SubconsciousEventType | null
  ) => SubconsciousEvent | undefined;
  
  clearEvents: () => void;
  
  // Loop configuration and management
  getLoopConfig: () => EventLoopConfig;
  setLoopConfig: (config: Partial<EventLoopConfig>) => void;
  addTickListener: (listener: TickListener) => string;
  removeTickListener: (listenerId: string) => boolean;
  
  // Inheritance configuration
  getInheritanceConfig: () => EventInheritanceConfig;
  setInheritanceConfig: (config: Partial<EventInheritanceConfig>) => void;
  
  // Subconscious control
  toggleActive: () => void;
  activate: () => void;
  deactivate: () => void;
  
  // Performance metrics
  metrics: {
    averageProcessingTime: number;
    eventsPerSecond: number;
    activeHandlers: number;
    memoryUsage: number;
  };
}

/**
 * Enhanced custom hook for interacting with the Phoenix subconscious system.
 * Provides type-safe event emission, subscription, and processing with robust
 * real-time event loop management and proper cleanup.
 * 
 * Key features:
 * - Fully type-safe event handling with TypeScript generics
 * - Zustand store integration for efficient state management
 * - Real-time event processing with configurable parameters
 * - Event prioritization and inheritance capabilities
 * - Thread-safe concurrent execution
 * - Comprehensive memory management and cleanup
 * 
 * @returns An object containing state and methods to interact with the subconscious system
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     isActive,
 *     eventsProcessed,
 *     emitEvent,
 *     subscribe,
 *     getRecentEvents,
 *     toggleActive
 *   } = useSubconscious();
 *   
 *   useEffect(() => {
 *     // Type-safe subscription to specific event types
 *     const handlerId = subscribe<SubconsciousEventType.INSIGHT>(
 *       (event) => {
 *         // TypeScript knows this is an INSIGHT event
 *         console.log('Received insight:', event.data.summary);
 *       }, 
 *       { eventTypes: [SubconsciousEventType.INSIGHT], priority: 5 }
 *     );
 *     
 *     // Type-safe event emission
 *     emitEvent<SubconsciousEventType.INSIGHT>({
 *       type: SubconsciousEventType.INSIGHT,
 *       source: SubconsciousSource.USER_INTERACTION,
 *       data: {
 *         summary: 'User insight detected', 
 *         description: 'Detailed insight information',
 *         confidence: 0.85
 *       },
 *       priority: 'high'
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
 *       <button onClick={toggleActive}>
 *         {isActive ? 'Deactivate' : 'Activate'} Subconscious
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSubconscious(): UseSubconsciousReturn {
  // Get the Phoenix store which contains the subconscious state
  const subconsciousState = usePhoenixStore((state) => state.subconscious);
  const { 
    toggleSubconscious, 
    incrementEventsProcessed, 
    setLastEventTimestamp,
    updateSubconscious
  } = usePhoenixStore((state) => ({
    toggleSubconscious: state.toggleSubconscious,
    incrementEventsProcessed: state.incrementEventsProcessed,
    setLastEventTimestamp: state.setLastEventTimestamp,
    updateSubconscious: state.updateSubconscious
  }));
  
  // Use the specialized subconscious events Zustand store
  const eventsStore = useSubconsciousEventsStore();
  
  // Loop configuration ref to avoid re-creating functions on config changes
  const loopConfigRef = useRef<EventLoopConfig>({
    tickInterval: 100,
    maxEventsPerTick: 10,
    pauseWhenHidden: true,
    maxEventsInMemory: 1000
  });
  
  // Event inheritance configuration
  const inheritanceConfigRef = useRef<EventInheritanceConfig>({
    enabled: true,
    maxDepth: 3,
    inheritProperties: ['source', 'priority', 'processingMetadata']
  });
  
  // Refs for event handlers, tick listeners, and internal state
  const eventHandlersRef = useRef<SubconsciousEventHandler[]>([]);
  const tickListenersRef = useRef<Map<string, TickListener>>(new Map());
  const pendingEventsRef = useRef<SubconsciousEvent[]>([]);
  const processingRef = useRef<boolean>(false);
  const lastTickTimeRef = useRef<number>(Date.now());
  const tickCountRef = useRef<number>(0);
  const tickIntervalIdRef = useRef<number | null>(null);
  const eventLoopIdRef = useRef<number | null>(null);
  const metricsRef = useRef({
    processingTimes: [] as number[],
    lastSecondEvents: 0,
    eventTimestamps: [] as number[],
  });
  
  /**
   * Generate a unique ID with high entropy for handlers and listeners
   */
  const generateId = useCallback((): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11)}`;
  }, []); // No dependencies needed for this utility function
  
  /**
   * Calculate and return current performance metrics
   */
  const getMetrics = useCallback(() => {
    const now = Date.now();
    
    // Clean up old metrics data
    metricsRef.current.processingTimes = metricsRef.current.processingTimes.slice(-100);
    metricsRef.current.eventTimestamps = metricsRef.current.eventTimestamps
      .filter(timestamp => now - timestamp < 1000);
    
    // Calculate metrics
    const averageProcessingTime = metricsRef.current.processingTimes.length > 0
      ? metricsRef.current.processingTimes.reduce((sum, time) => sum + time, 0)
        / metricsRef.current.processingTimes.length
      : 0;
    
    const eventsPerSecond = metricsRef.current.eventTimestamps.length;
    
    return {
      averageProcessingTime,
      eventsPerSecond,
      activeHandlers: eventHandlersRef.current.length,
      memoryUsage: eventsStore.events.length
    };
  }, [eventsStore.events.length]); // Only depends on the length of events array
  
  /**
   * Process a batch of events efficiently
   */
  const processEventBatch = useCallback(() => {
    if (processingRef.current || pendingEventsRef.current.length === 0) {
      return;
    }
    
    processingRef.current = true;
    
    try {
      // Process up to maxEventsPerTick events
      const eventsToProcess = pendingEventsRef.current.splice(
        0, 
        loopConfigRef.current.maxEventsPerTick
      );
      
      for (const event of eventsToProcess) {
        const startTime = performance.now();
        
        // Update global Phoenix store
        incrementEventsProcessed();
        setLastEventTimestamp(event.timestamp);
        
        // Add to the events store
        eventsStore.addEvent(event);
        
        // Process the event through all registered handlers, ordered by priority
        const handlers = [...eventHandlersRef.current]
          .sort((a, b) => b.priority - a.priority);
        
        for (const handler of handlers) {
          // Check if this handler should process this event type
          if (!handler.eventTypes || 
              (handler.eventTypes as SubconsciousEventType[]).includes(event.type)) {
            try {
              // Type assertion needed due to the dynamic nature of event handling
              (handler.handler as (event: SubconsciousEvent) => void)(event);
            } catch (error) {
              console.error(`Error in subconscious event handler ${handler.id}:`, error);
            }
          }
        }
        
        // Track metrics
        const processingTime = performance.now() - startTime;
        metricsRef.current.processingTimes.push(processingTime);
        metricsRef.current.eventTimestamps.push(Date.now());
      }
    } finally {
      processingRef.current = false;
    }
    
    // Schedule next batch if there are more events
    if (pendingEventsRef.current.length > 0 && subconsciousState.active) {
      eventLoopIdRef.current = window.requestAnimationFrame(processEventBatch);
    }
  }, [
    eventsStore,
    incrementEventsProcessed,
    setLastEventTimestamp,
    subconsciousState.active,
    loopConfigRef
  ]);
  
  /**
   * Handle a tick in the real-time loop
   */
  const handleTick = useCallback(() => {
    if (!subconsciousState.active) return;
    
    const now = Date.now();
    const deltaTime = now - lastTickTimeRef.current;
    lastTickTimeRef.current = now;
    tickCountRef.current++;
    
    // Notify all tick listeners
    tickListenersRef.current.forEach(listener => {
      try {
        listener(tickCountRef.current, deltaTime);
      } catch (error) {
        console.error('Error in tick listener:', error);
      }
    });
    
    // Process pending events
    if (pendingEventsRef.current.length > 0 && !processingRef.current) {
      processEventBatch();
    }
  }, [subconsciousState.active, processEventBatch, pendingEventsRef, processingRef]);
  
  /**
   * Start the real-time tick loop
   */
  const startTickLoop = useCallback(() => {
    // Clear any existing interval
    if (tickIntervalIdRef.current !== null) {
      window.clearInterval(tickIntervalIdRef.current);
      tickIntervalIdRef.current = null;
    }
    
    // Set the last tick time to now
    lastTickTimeRef.current = Date.now();
    
    // Start a new interval
    tickIntervalIdRef.current = window.setInterval(
      handleTick, 
      loopConfigRef.current.tickInterval
    );
  }, [handleTick, loopConfigRef, tickIntervalIdRef]);
  
  /**
   * Apply inheritance from parent events when creating a new event
   */
  const applyEventInheritance = useCallback(<T extends SubconsciousEventType>(
    newEvent: SubconsciousEvent & { type: T },
    relatedEvents?: readonly string[] | undefined,
    depth: number = 0
  ): SubconsciousEvent & { type: T } => {
    if (
      !inheritanceConfigRef.current.enabled || 
      !relatedEvents || 
      relatedEvents.length === 0 ||
      depth >= inheritanceConfigRef.current.maxDepth
    ) {
      return newEvent;
    }
    
    // Find parent events that exist in our store
    const parentEvents = relatedEvents
      .map(id => eventsStore.eventMap.get(id))
      .filter((event): event is SubconsciousEvent => !!event);
    
    if (parentEvents.length === 0) {
      return newEvent;
    }
    
    // Create a new event with inherited properties
    const inheritedEvent = { ...newEvent };
    
    // Apply inheritance for each property
    for (const property of inheritanceConfigRef.current.inheritProperties) {
      // Skip if the property is already set in the new event
      if (inheritedEvent[property] !== undefined) continue;
      
      // Find the first parent event with this property
      for (const parent of parentEvents) {
        if (parent[property] !== undefined) {
          // Special handling for processing metadata to merge rather than replace
          if (property === 'processingMetadata' && inheritedEvent.processingMetadata) {
            inheritedEvent.processingMetadata = {
              ...parent.processingMetadata,
              ...inheritedEvent.processingMetadata
            };
          } else {
            // @ts-expect-error - Dynamic property access is necessary for inheritance
            inheritedEvent[property] = parent[property];
          }
          break;
        }
      }
    }
    
    // Recursively apply inheritance from parent's related events
    let result = inheritedEvent as SubconsciousEvent & { type: T };
    for (const parent of parentEvents) {
      if (parent.relatedEvents && parent.relatedEvents.length > 0) {
        result = applyEventInheritance<T>(
          result,
          parent.relatedEvents,
          depth + 1
        );
      }
    }
    
    return result;
  }, [eventsStore.eventMap]);

  /**
   * Type-safe subscription to subconscious events
   * Uses generics to provide proper TypeScript inference
   */
  const subscribe = useCallback((
    handler: (event: SubconsciousEvent) => void,
    options: SubscribeOptions = {}
  ): string => {
    const id = options.id || generateId();
    const eventTypes = options.eventTypes || null;
    const priority = options.priority || 0;
    
    // Create the handler with proper type handling
    const typedHandler: SubconsciousEventHandler = {
      id,
      eventTypes: eventTypes, // Already correctly typed
      handler: handler,
      priority
    };
    
    eventHandlersRef.current.push(typedHandler);
    
    return id;
  }, [generateId]);
  
  /**
   * Unsubscribe from subconscious events
   */
  const unsubscribe = useCallback((handlerId: string): boolean => {
    const initialLength = eventHandlersRef.current.length;
    eventHandlersRef.current = eventHandlersRef.current.filter(
      handler => handler.id !== handlerId
    );
    return eventHandlersRef.current.length < initialLength;
  }, []);
  
  /**
   * Emit a new event into the subconscious system with type safety
   * Uses generics to provide proper TypeScript inference based on event type
   */
  const emitEvent = useCallback(<T extends SubconsciousEventType>(
    options: EmitEventOptions<T>
  ): SubconsciousEvent & { type: T } => {
    const now = new Date();
    const nowIso = now.toISOString();
    const startTime = performance.now();
    
    // Create the base event with proper type handling
    const baseEvent = {
      id: generateId(),
      timestamp: nowIso,
      type: options.type,
      source: options.source,
      priority: options.priority || 'medium',
      processed: false,
      data: options.data as Record<string, unknown>,
      relatedEvents: options.relatedEvents || [],
    };
    
    // Type cast to ensure compatibility
    const event = baseEvent as unknown as SubconsciousEvent & { type: T };
    
    // Calculate processing time
    const processingTime = performance.now() - startTime;
    
    // Add processing metadata
    const processedEvent: SubconsciousEvent & { type: T } = {
      ...event,
      processed: true,
      processingMetadata: {
        detectionTime: nowIso,
        processingTime,
        confidenceScore: options.processingMetadata?.confidenceScore || 0.5,
        interpreter: options.processingMetadata?.interpreter || 'default'
      }
    };
    
    // Apply event inheritance if enabled and relatedEvents are provided
    const finalEvent = applyEventInheritance<T>(
      processedEvent,
      options.relatedEvents
    );
    
    // Add to pending events for processing
    pendingEventsRef.current.push(finalEvent);
    
    // Trigger event processing if not already running
    if (!processingRef.current && subconsciousState.active) {
      eventLoopIdRef.current = window.requestAnimationFrame(processEventBatch);
    }
    
    return finalEvent;
  }, [generateId, applyEventInheritance, processEventBatch, subconsciousState.active, pendingEventsRef]);
  
  /**
   * Get recent events filtered by type, priority, or processing status
   * Uses generics for type-safe event filtering
   */
  const getRecentEvents = useCallback((
    options: {
      limit?: number;
      eventTypes?: SubconsciousEventType[] | null;
      priority?: SubconsciousPriority | SubconsciousPriority[];
      processed?: boolean;
    } = {}
  ): SubconsciousEvent[] => {
    const {
      limit = 50,
      eventTypes = null,
      priority,
      processed
    } = options;
    
    let filteredEvents = [...eventsStore.events];
    
    // Filter by event types if specified
    if (eventTypes) {
      filteredEvents = filteredEvents.filter(
        event => (eventTypes as SubconsciousEventType[]).includes(event.type)
      );
    }
    
    // Filter by priority if specified
    if (priority) {
      const priorities = Array.isArray(priority) ? priority : [priority];
      filteredEvents = filteredEvents.filter(
        event => priorities.includes(event.priority)
      );
    }
    
    // Filter by processed status if specified
    if (typeof processed === 'boolean') {
      filteredEvents = filteredEvents.filter(
        event => event.processed === processed
      );
    }
    
    // Return limited results
    return filteredEvents.slice(0, limit) as any;
  }, [eventsStore.events]); // eventsStore.events is the primary dependency
  
  /**
   * Get a specific event by ID with optional type checking
   */
  const getEventById = useCallback((
    id: string,
    eventType?: SubconsciousEventType | null
  ): SubconsciousEvent | undefined => {
    const event = eventsStore.eventMap.get(id);
    
    if (!event) {
      return undefined;
    }
    
    // If type parameter is provided, check if the event has the correct type
    if (eventType !== null && eventType !== undefined) {
      if (event.type !== eventType) {
        return undefined;
      }
    }
    
    return event;
  }, [eventsStore.eventMap]);
  
  /**
   * Clear all stored events
   */
  const clearEvents = useCallback(() => {
    eventsStore.clearEvents();
  }, [eventsStore]);
  
  /**
   * Get current event loop configuration
   */
  const getLoopConfig = useCallback((): EventLoopConfig => {
    return { ...loopConfigRef.current };
  }, []);
  
  /**
   * Update event loop configuration
   */
  const setLoopConfig = useCallback((config: Partial<EventLoopConfig>) => {
    const newConfig = { ...loopConfigRef.current, ...config };
    loopConfigRef.current = newConfig;
    
    // Restart tick loop if interval changed
    if (config.tickInterval && tickIntervalIdRef.current !== null) {
      startTickLoop();
    }
  }, [startTickLoop]);
  
  /**
   * Get current event inheritance configuration
   */
  const getInheritanceConfig = useCallback((): EventInheritanceConfig => {
    return { ...inheritanceConfigRef.current };
  }, []);
  
  /**
   * Update event inheritance configuration
   */
  const setInheritanceConfig = useCallback((config: Partial<EventInheritanceConfig>) => {
    inheritanceConfigRef.current = { ...inheritanceConfigRef.current, ...config };
  }, []);
  
  /**
   * Add a listener to the real-time tick loop
   */
  const addTickListener = useCallback((listener: TickListener): string => {
    const id = generateId();
    tickListenersRef.current.set(id, listener);
    return id;
  }, [generateId]);
  
  /**
   * Remove a tick listener
   */
  const removeTickListener = useCallback((listenerId: string): boolean => {
    return tickListenersRef.current.delete(listenerId);
  }, []);
  
  /**
   * Toggle the active state of the subconscious system
   */
  const toggleActive = useCallback(() => {
    toggleSubconscious();
  }, [toggleSubconscious]);
  
  /**
   * Activate the subconscious system
   */
  const activate = useCallback(() => {
    if (!subconsciousState.active) {
      updateSubconscious({ active: true });
    }
  }, [subconsciousState.active, updateSubconscious]);
  
  /**
   * Deactivate the subconscious system
   */
  const deactivate = useCallback(() => {
    if (subconsciousState.active) {
      updateSubconscious({ active: false });
    }
  }, [subconsciousState.active, updateSubconscious]);
  
  // Initialize and cleanup the tick loop
  useEffect(() => {
    startTickLoop();
    
    // Handle visibility changes for performance optimization
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // If tab is hidden and config says to pause when hidden
        if (loopConfigRef.current.pauseWhenHidden && tickIntervalIdRef.current !== null) {
          window.clearInterval(tickIntervalIdRef.current);
          tickIntervalIdRef.current = null;
        }
      } else if (loopConfigRef.current.pauseWhenHidden && tickIntervalIdRef.current === null) {
        // Resume when tab becomes visible again
        startTickLoop();
      }
    };
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up all resources on unmount
    return () => {
      // Clear intervals and animation frames
      if (tickIntervalIdRef.current !== null) {
        window.clearInterval(tickIntervalIdRef.current);
      }
      if (eventLoopIdRef.current !== null) {
        window.cancelAnimationFrame(eventLoopIdRef.current);
      }
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Clear any pending events
      pendingEventsRef.current = [];
    };
  }, [startTickLoop, loopConfigRef, tickIntervalIdRef]);
  
  // Calculate current metrics for return value
  const metrics = useMemo(() => getMetrics(), [getMetrics]); // Depends on the getMetrics function
  
  // The return type needs to be explicitly cast to handle complex generic types
  const hookReturn: UseSubconsciousReturn = {
    // State
    isActive: subconsciousState.active,
    eventsProcessed: subconsciousState.eventsProcessed,
    lastEventTimestamp: subconsciousState.lastEventTimestamp,
    tickCount: tickCountRef.current,
    
    // Event methods with type safety
    subscribe: subscribe as any,
    unsubscribe,
    emitEvent: emitEvent as any,
    getRecentEvents: getRecentEvents as any,
    getEventById: getEventById as any,
    clearEvents,
    
    // Loop configuration
    getLoopConfig,
    setLoopConfig,
    addTickListener,
    removeTickListener,
    
    // Inheritance configuration
    getInheritanceConfig,
    setInheritanceConfig,
    
    // Control methods
    toggleActive,
    activate,
    deactivate,
    
    // Performance metrics
    metrics
  };
  
  return hookReturn;
}

export default useSubconscious;