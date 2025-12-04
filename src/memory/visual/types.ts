/**
 * Phoenix Marie Memory Architecture - Visual Indicator Types
 * 
 * Type definitions for the visual flame indicators that show
 * Phoenix's current operational mode (Personal/Professional).
 */

import { ModeType, ModeState, AuthenticationResult } from '../modes/types';
import { AccessEntity } from '../types';

/**
 * Flame indicator component props
 */
export interface FlameIndicatorProps {
  /** Current mode type */
  mode: ModeType;
  /** Whether the indicator is in a loading state */
  loading?: boolean;
  /** Whether authentication is in progress */
  authenticating?: boolean;
  /** Authentication progress (0-100) */
  authProgress?: number;
  /** Whether the indicator is minimized */
  minimized?: boolean;
  /** Position on screen */
  position?: IndicatorPosition;
  /** Click handler for mode switching */
  onModeSwitch?: () => void;
  /** Drag end handler for position updates */
  onPositionChange?: (position: IndicatorPosition) => void;
  /** Toggle minimize state */
  onToggleMinimize?: () => void;
}

/**
 * Position configuration for the indicator
 */
export interface IndicatorPosition {
  x: number;
  y: number;
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * Flame animation configuration
 */
export interface FlameAnimation {
  type: 'glow' | 'pulse' | 'flicker';
  duration: number; // milliseconds
  intensity: number; // 0-1
  color: string; // hex color
  secondaryColor?: string; // for gradients
}

/**
 * Mode indicator state
 */
export interface ModeIndicatorState {
  /** Current mode */
  currentMode: ModeType;
  /** Previous mode (for transitions) */
  previousMode?: ModeType;
  /** Whether currently transitioning */
  transitioning: boolean;
  /** Transition progress (0-1) */
  transitionProgress: number;
  /** Current authentication state */
  authState?: AuthenticationState;
  /** Time in current mode */
  timeInMode: number; // milliseconds
  /** Last mode switch timestamp */
  lastSwitch?: Date;
  /** Whether indicator is visible */
  visible: boolean;
  /** Whether indicator is minimized */
  minimized: boolean;
  /** Current position */
  position: IndicatorPosition;
}

/**
 * Authentication state for visual feedback
 */
export interface AuthenticationState {
  /** Whether authentication is required */
  required: boolean;
  /** Whether authentication is in progress */
  inProgress: boolean;
  /** Authentication method being used */
  method?: 'neuralink' | 'face-voice';
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if authentication failed */
  error?: string;
  /** Number of attempts remaining */
  attemptsRemaining?: number;
}

/**
 * Tooltip content for mode details
 */
export interface ModeTooltipContent {
  /** Current mode name */
  modeName: string;
  /** Mode description */
  description: string;
  /** Time spent in mode */
  timeInMode: string; // formatted string
  /** Last switch time */
  lastSwitch?: string; // formatted string
  /** Current restrictions */
  restrictions: string[];
  /** Available actions */
  actions: TooltipAction[];
}

/**
 * Actions available in tooltip
 */
export interface TooltipAction {
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  requiresAuth?: boolean;
}

/**
 * Flame visual configuration
 */
export interface FlameVisualConfig {
  /** Base size of the flame */
  size: {
    width: number;
    height: number;
  };
  /** Size when minimized */
  minimizedSize: {
    width: number;
    height: number;
  };
  /** Colors for each mode */
  colors: {
    [ModeType.Personal]: {
      primary: string;
      secondary: string;
      glow: string;
    };
    [ModeType.Professional]: {
      primary: string;
      secondary: string;
      glow: string;
    };
  };
  /** Animation configurations */
  animations: {
    [ModeType.Personal]: FlameAnimation;
    [ModeType.Professional]: FlameAnimation;
    transition: {
      duration: number;
      easing: string;
    };
  };
}

/**
 * Hook return type for mode state
 */
export interface UseModeStateReturn {
  /** Current mode */
  mode: ModeType;
  /** Full mode state */
  state: ModeState;
  /** Whether authenticated */
  authenticated: boolean;
  /** Whether transitioning */
  transitioning: boolean;
  /** Time in current mode */
  timeInMode: number;
  /** Request mode switch */
  requestModeSwitch: (toMode: ModeType) => Promise<void>;
  /** Cancel ongoing authentication */
  cancelAuthentication: () => void;
  /** Get mode statistics */
  getStatistics: () => ModeStatistics;
}

/**
 * Mode statistics for display
 */
export interface ModeStatistics {
  /** Total time in personal mode */
  personalModeTime: number;
  /** Total time in professional mode */
  professionalModeTime: number;
  /** Number of mode switches today */
  switchesToday: number;
  /** Average time per mode session */
  averageSessionTime: number;
}

/**
 * Accessibility props for flame indicator
 */
export interface FlameAccessibilityProps {
  /** ARIA label */
  ariaLabel: string;
  /** ARIA description */
  ariaDescription?: string;
  /** Role */
  role: 'button' | 'status';
  /** Whether focusable */
  tabIndex: number;
  /** Keyboard shortcuts */
  keyboardShortcuts?: {
    toggleMode?: string;
    minimize?: string;
    showTooltip?: string;
  };
}

/**
 * Flame indicator events
 */
export interface FlameIndicatorEvents {
  /** Mode switch requested */
  onModeSwitchRequest: (fromMode: ModeType, toMode: ModeType) => void;
  /** Authentication started */
  onAuthenticationStart: (method: string) => void;
  /** Authentication completed */
  onAuthenticationComplete: (result: AuthenticationResult) => void;
  /** Position changed */
  onPositionChange: (position: IndicatorPosition) => void;
  /** Minimize toggled */
  onMinimizeToggle: (minimized: boolean) => void;
  /** Tooltip shown */
  onTooltipShow: () => void;
  /** Tooltip hidden */
  onTooltipHide: () => void;
}

/**
 * Default visual configuration
 */
export const DEFAULT_FLAME_CONFIG: FlameVisualConfig = {
  size: {
    width: 60,
    height: 80
  },
  minimizedSize: {
    width: 32,
    height: 32
  },
  colors: {
    [ModeType.Personal]: {
      primary: '#FF6B35',
      secondary: '#FFB84D',
      glow: 'rgba(255, 107, 53, 0.6)'
    },
    [ModeType.Professional]: {
      primary: '#00D4FF',
      secondary: '#0099CC',
      glow: 'rgba(0, 212, 255, 0.6)'
    }
  },
  animations: {
    [ModeType.Personal]: {
      type: 'glow',
      duration: 3000,
      intensity: 0.8,
      color: '#FF6B35',
      secondaryColor: '#FFB84D'
    },
    [ModeType.Professional]: {
      type: 'pulse',
      duration: 2000,
      intensity: 1.0,
      color: '#00D4FF',
      secondaryColor: '#0099CC'
    },
    transition: {
      duration: 800,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }
};

/**
 * Default position configuration
 */
export const DEFAULT_INDICATOR_POSITION: IndicatorPosition = {
  x: 20,
  y: 20,
  anchor: 'bottom-right'
};