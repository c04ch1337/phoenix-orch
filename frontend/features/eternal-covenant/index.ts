export { EternalCovenantProvider, useEternalCovenant } from './components/EternalCovenantProvider';
export { EternalCovenantTrigger } from './components/EternalCovenantTrigger';
export { CovenantDisplay } from './components/CovenantDisplay';
export { useHoverTimer } from './hooks/useHoverTimer';
export { useAudioPlayback } from './hooks/useAudioPlayback';
export { useMetrics } from './hooks/useMetrics';
export type { CovenantState, MetricsData, AudioPlaybackState, EternalCovenantContextType } from './types';

// Re-export motion components and styles
export {
  MotionDiv,
  MotionButton,
  MotionSVG,
  styles,
  fadeIn,
  scaleIn,
  slideUp,
  rotateIn,
  fadeInDelayed,
  closeButtonVariants,
  preventScreenshotStyles
} from './styles';