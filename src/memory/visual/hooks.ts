/**
 * Phoenix Marie Memory Architecture - Visual Indicator Hooks
 * 
 * React hooks for integrating with the mode system and managing
 * visual indicator state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { EventEmitter } from 'events';
import {
  ModeType,
  ModeState,
  AuthenticationMethod,
  AuthenticationResult,
  ModeSwitchEvent
} from '../modes/types';
import {
  getModeManager,
  getModeSwitcher,
  ModeChangeEvent,
  ModeSwitchProgress,
  getCurrentMode,
  isInPersonalMode,
  isInProfessionalMode
} from '../modes';
import { AccessEntity } from '../types';
import {
  UseModeStateReturn,
  ModeIndicatorState,
  AuthenticationState,
  IndicatorPosition,
  ModeStatistics,
  DEFAULT_INDICATOR_POSITION
} from './types';

/**
 * Hook for mode state management
 */
export function useModeState(): UseModeStateReturn {
  const [mode, setMode] = useState<ModeType>(getCurrentMode());
  const [state, setState] = useState<ModeState | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [timeInMode, setTimeInMode] = useState(0);
  const [authState, setAuthState] = useState<AuthenticationState | null>(null);
  
  const modeStartTimeRef = useRef<Date>(new Date());
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize mode manager and switcher
  useEffect(() => {
    const manager = getModeManager();
    const switcher = getModeSwitcher();

    // Set initial state
    setMode(manager.getCurrentMode());
    setState(manager.getCurrentState());
    setAuthenticated(manager.isAuthenticated());

    // Listen to mode changes
    const handleModeChange = (event: ModeChangeEvent) => {
      setMode(event.newMode);
      setState(manager.getCurrentState());
      setAuthenticated(event.authenticated);
      modeStartTimeRef.current = new Date();
      setTimeInMode(0);
    };

    // Listen to switch progress
    const handleSwitchProgress = (progress: ModeSwitchProgress) => {
      setTransitioning(progress.status === 'in_progress');
      
      if (progress.status === 'authenticating') {
        setAuthState({
          required: true,
          inProgress: true,
          method: progress.authenticationMethod as 'neuralink' | 'face-voice',
          progress: progress.progress,
          attemptsRemaining: progress.details?.attemptsRemaining
        });
      } else if (progress.status === 'completed' || progress.status === 'failed') {
        setAuthState(null);
        setTransitioning(false);
      }
    };

    // Listen to authentication events
    const handleAuthSuccess = (result: AuthenticationResult) => {
      setAuthenticated(true);
      setAuthState(null);
    };

    const handleAuthFailure = (result: AuthenticationResult) => {
      setAuthState(prev => ({
        ...prev!,
        error: result.failureReason,
        attemptsRemaining: result.attemptsRemaining
      }));
    };

    // Subscribe to events
    manager.on('modeChanged', handleModeChange);
    manager.on('authenticationSuccess', handleAuthSuccess);
    manager.on('authenticationFailure', handleAuthFailure);
    switcher.on('switchProgress', handleSwitchProgress);

    // Update time in mode
    timeUpdateIntervalRef.current = setInterval(() => {
      setTimeInMode(Date.now() - modeStartTimeRef.current.getTime());
    }, 1000);

    return () => {
      manager.off('modeChanged', handleModeChange);
      manager.off('authenticationSuccess', handleAuthSuccess);
      manager.off('authenticationFailure', handleAuthFailure);
      switcher.off('switchProgress', handleSwitchProgress);
      
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  // Request mode switch
  const requestModeSwitch = useCallback(async (toMode: ModeType) => {
    const switcher = getModeSwitcher();
    
    try {
      await switcher.switchMode({
        toMode,
        entity: AccessEntity.Phoenix,
        reason: 'User requested mode switch via visual indicator'
      });
    } catch (error) {
      console.error('Mode switch failed:', error);
      throw error;
    }
  }, []);

  // Cancel authentication
  const cancelAuthentication = useCallback(() => {
    const switcher = getModeSwitcher();
    switcher.cancelSwitch();
    setAuthState(null);
    setTransitioning(false);
  }, []);

  // Get statistics
  const getStatistics = useCallback((): ModeStatistics => {
    const manager = getModeManager();
    const stats = manager.getStatistics();
    
    return {
      personalModeTime: stats.modeUsage[ModeType.Personal],
      professionalModeTime: stats.modeUsage[ModeType.Professional],
      switchesToday: stats.totalTransitions,
      averageSessionTime: stats.averageTransitionTime
    };
  }, []);

  return {
    mode,
    state: state!,
    authenticated,
    transitioning,
    timeInMode,
    requestModeSwitch,
    cancelAuthentication,
    getStatistics
  };
}

/**
 * Hook for managing indicator position
 */
export function useIndicatorPosition(
  defaultPosition: IndicatorPosition = DEFAULT_INDICATOR_POSITION
): {
  position: IndicatorPosition;
  updatePosition: (position: IndicatorPosition) => void;
  resetPosition: () => void;
} {
  const STORAGE_KEY = 'phoenix-mode-indicator-position';
  
  // Load saved position
  const loadPosition = (): IndicatorPosition => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load indicator position:', error);
    }
    return defaultPosition;
  };

  const [position, setPosition] = useState<IndicatorPosition>(loadPosition);

  // Save position to localStorage
  const updatePosition = useCallback((newPosition: IndicatorPosition) => {
    setPosition(newPosition);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPosition));
    } catch (error) {
      console.error('Failed to save indicator position:', error);
    }
  }, []);

  // Reset to default position
  const resetPosition = useCallback(() => {
    updatePosition(defaultPosition);
  }, [defaultPosition, updatePosition]);

  return {
    position,
    updatePosition,
    resetPosition
  };
}

/**
 * Hook for managing indicator visibility and minimize state
 */
export function useIndicatorVisibility(
  defaultMinimized: boolean = false
): {
  visible: boolean;
  minimized: boolean;
  toggleMinimize: () => void;
  show: () => void;
  hide: () => void;
} {
  const STORAGE_KEY = 'phoenix-mode-indicator-minimized';
  
  // Load saved minimize state
  const loadMinimized = (): boolean => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load minimize state:', error);
    }
    return defaultMinimized;
  };

  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(loadMinimized);

  // Toggle minimize state
  const toggleMinimize = useCallback(() => {
    const newState = !minimized;
    setMinimized(newState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to save minimize state:', error);
    }
  }, [minimized]);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  return {
    visible,
    minimized,
    toggleMinimize,
    show,
    hide
  };
}

/**
 * Hook for formatting time duration
 */
export function useFormattedTime(milliseconds: number): string {
  const [formatted, setFormatted] = useState('');

  useEffect(() => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let result = '';
    if (days > 0) {
      result = `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      result = `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      result = `${minutes}m ${seconds % 60}s`;
    } else {
      result = `${seconds}s`;
    }

    setFormatted(result);
  }, [milliseconds]);

  return formatted;
}

/**
 * Hook for managing drag behavior
 */
export function useDraggable(
  elementRef: React.RefObject<HTMLElement>,
  onDragEnd: (position: { x: number; y: number }) => void
): {
  isDragging: boolean;
  dragOffset: { x: number; y: number };
} {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const elementStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only drag from the header area
      const target = e.target as HTMLElement;
      if (!target.closest('.flame-indicator-header')) return;

      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      
      const rect = element.getBoundingClientRect();
      elementStartRef.current = { x: rect.left, y: rect.top };
      
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      
      setDragOffset({ x: deltaX, y: deltaY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;

      setIsDragging(false);
      
      const finalX = elementStartRef.current.x + dragOffset.x;
      const finalY = elementStartRef.current.y + dragOffset.y;
      
      onDragEnd({ x: finalX, y: finalY });
      setDragOffset({ x: 0, y: 0 });
    };

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [elementRef, isDragging, dragOffset, onDragEnd]);

  return {
    isDragging,
    dragOffset
  };
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: {
  toggleMode?: string;
  minimize?: string;
  showTooltip?: string;
}, handlers: {
  onToggleMode?: () => void;
  onMinimize?: () => void;
  onShowTooltip?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Build key combination string
      let combo = '';
      if (ctrl) combo += 'ctrl+';
      if (shift) combo += 'shift+';
      if (alt) combo += 'alt+';
      combo += key;

      // Check shortcuts
      if (shortcuts.toggleMode === combo && handlers.onToggleMode) {
        e.preventDefault();
        handlers.onToggleMode();
      } else if (shortcuts.minimize === combo && handlers.onMinimize) {
        e.preventDefault();
        handlers.onMinimize();
      } else if (shortcuts.showTooltip === combo && handlers.onShowTooltip) {
        e.preventDefault();
        handlers.onShowTooltip();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, handlers]);
}

/**
 * Combined hook for complete indicator state
 */
export function useModeIndicator(): {
  state: ModeIndicatorState;
  actions: {
    requestModeSwitch: (toMode: ModeType) => Promise<void>;
    cancelAuthentication: () => void;
    toggleMinimize: () => void;
    updatePosition: (position: IndicatorPosition) => void;
    resetPosition: () => void;
  };
  helpers: {
    formattedTime: string;
    statistics: ModeStatistics;
  };
} {
  const modeState = useModeState();
  const { position, updatePosition, resetPosition } = useIndicatorPosition();
  const { visible, minimized, toggleMinimize } = useIndicatorVisibility();
  const formattedTime = useFormattedTime(modeState.timeInMode);

  // Build complete state
  const state: ModeIndicatorState = {
    currentMode: modeState.mode,
    transitioning: modeState.transitioning,
    transitionProgress: 0, // TODO: Get from switch progress
    authState: null, // TODO: Get from mode state
    timeInMode: modeState.timeInMode,
    lastSwitch: modeState.state?.lastTransition,
    visible,
    minimized,
    position
  };

  return {
    state,
    actions: {
      requestModeSwitch: modeState.requestModeSwitch,
      cancelAuthentication: modeState.cancelAuthentication,
      toggleMinimize,
      updatePosition,
      resetPosition
    },
    helpers: {
      formattedTime,
      statistics: modeState.getStatistics()
    }
  };
}