/**
 * Phoenix Marie Memory Architecture - Visual Indicators Export
 * 
 * Central export point for all visual mode indicator components.
 */

// Types
export * from './types';

// Hooks
export {
  useModeState,
  useIndicatorPosition,
  useIndicatorVisibility,
  useFormattedTime,
  useDraggable,
  useKeyboardShortcuts,
  useModeIndicator
} from './hooks';

// Components
export { FlameIndicator, default as FlameIndicatorComponent } from './flame-indicator';

// Re-export commonly used types
export type {
  FlameIndicatorProps,
  ModeIndicatorState,
  IndicatorPosition,
  FlameAnimation,
  ModeTooltipContent,
  FlameVisualConfig,
  UseModeStateReturn
} from './types';

// Export default configuration
export { DEFAULT_FLAME_CONFIG, DEFAULT_INDICATOR_POSITION } from './types';