export { default as SubconsciousPanel } from './components/SubconsciousPanel';
export { useSubconsciousStream } from './hooks/useSubconsciousStream';

/**
 * Phoenix Subconscious Module
 * 
 * This module provides components and hooks for connecting to the Phoenix
 * Subconscious loop system via Server-Sent Events.
 * 
 * The main components are:
 * - SubconsciousPanel: Displays the latest thought from the Phoenix Subconscious
 * 
 * The main hooks are: 
 * - useSubconsciousStream: Connects to the SSE endpoint and provides real-time events
 */