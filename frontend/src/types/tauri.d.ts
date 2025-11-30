/**
 * Type definitions for Tauri API
 * This allows TypeScript to recognize Tauri invocations even without installing @tauri-apps
 */

declare module '@tauri-apps/api/tauri' {
  /**
   * Invoke a Tauri command
   */
  export function invoke<T>(command: string, args?: any): Promise<T>;
}

declare module '@tauri-apps/api' {
  export { invoke } from '@tauri-apps/api/tauri';
  
  /**
   * Listen to an event from the backend
   */
  export function listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void>;
  
  /**
   * Emit an event to the backend
   */
  export function emit(event: string, payload?: any): Promise<void>;
}