/**
 * Eternal Covenant Feature Module
 *
 * This module has been migrated from the root features directory.
 * Only type definitions and styles have been migrated at this time.
 * Component files will need to be implemented in a separate task.
 */

// NOTE: Component exports are commented out as they will be implemented in a separate task
// export { EternalCovenantProvider, useEternalCovenant } from './components/EternalCovenantProvider';
// export { EternalCovenantTrigger } from './components/EternalCovenantTrigger';
// export { CovenantDisplay } from './components/CovenantDisplay';
// export { useHoverTimer } from './hooks/useHoverTimer';
// export { useAudioPlayback } from './hooks/useAudioPlayback';
// export { useMetrics } from './hooks/useMetrics';

// Types export (migrated)
export type { CovenantState, MetricsData, AudioPlaybackState, EternalCovenantContextType } from './types';

// Style exports (migrated)
export {
  // Motion components
  MotionDiv,
  MotionButton,
  MotionSVG,
  
  // Style constants
  styles,
  
  // Animation variants
  fadeIn,
  scaleIn,
  slideUp,
  rotateIn,
  fadeInDelayed,
  closeButtonVariants,
  preventScreenshotStyles
} from './styles';