import { useState, useEffect, useCallback } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';

/**
 * Hook for managing reduced motion preferences
 * 
 * This hook provides helpers for respecting user preferences regarding 
 * animations and motion. It checks both the application preference and
 * the system-level preference (prefers-reduced-motion media query).
 * 
 * @returns An object with various helpers for handling reduced motion
 */
export function useReducedMotion() {
  const { preferences } = useAccessibility();
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  
  // Check if motion should be reduced based on either app or system preference
  const shouldReduceMotion = preferences.reducedMotion || systemReducedMotion;
  
  // Check for system-level reduced motion preference
  useEffect(() => {
    // Check initial state
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemReducedMotion(mediaQuery.matches);
    
    // Setup listener for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemReducedMotion(event.matches);
    };
    
    // Add listener (with browser compatibility check)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }
    
    // Clean up
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);
  
  // Get appropriate animation duration based on preference
  const getDuration = useCallback((fullDuration: number, reducedDuration: number = 0) => {
    return shouldReduceMotion ? reducedDuration : fullDuration;
  }, [shouldReduceMotion]);
  
  // Get an alternative animation name based on preference
  const getAnimationName = useCallback((fullAnimation: string, reducedAnimation: string = 'none') => {
    return shouldReduceMotion ? reducedAnimation : fullAnimation;
  }, [shouldReduceMotion]);
  
  // Helper to conditionally apply animation class
  const getAnimationClass = useCallback((fullAnimationClass: string, reducedAnimationClass: string = '') => {
    return shouldReduceMotion ? reducedAnimationClass : fullAnimationClass;
  }, [shouldReduceMotion]);
  
  // Build animation style based on preference
  const getAnimationStyle = useCallback((properties: {
    name?: string;
    reducedName?: string;
    duration?: number;
    reducedDuration?: number;
    delay?: number;
    reducedDelay?: number;
    timingFunction?: string;
    reducedTimingFunction?: string;
    iterationCount?: number | string;
    reducedIterationCount?: number | string;
    direction?: string;
    reducedDirection?: string;
    fillMode?: string;
    reducedFillMode?: string;
  }) => {
    if (shouldReduceMotion && properties.reducedName === 'none') {
      return { animation: 'none' };
    }
    
    const name = getAnimationName(
      properties.name || 'none', 
      properties.reducedName || properties.name || 'none'
    );
    
    const duration = getDuration(
      properties.duration || 0,
      properties.reducedDuration || 0
    );
    
    const delay = getDuration(
      properties.delay || 0,
      properties.reducedDelay || 0
    );
    
    const timingFunction = shouldReduceMotion
      ? properties.reducedTimingFunction || 'linear'
      : properties.timingFunction || 'ease';
    
    const iterationCount = shouldReduceMotion
      ? properties.reducedIterationCount || 1
      : properties.iterationCount || 1;
    
    const direction = shouldReduceMotion
      ? properties.reducedDirection || 'normal'
      : properties.direction || 'normal';
    
    const fillMode = shouldReduceMotion
      ? properties.reducedFillMode || 'none'
      : properties.fillMode || 'none';
    
    return {
      animationName: name,
      animationDuration: `${duration}ms`,
      animationDelay: `${delay}ms`,
      animationTimingFunction: timingFunction,
      animationIterationCount: iterationCount,
      animationDirection: direction,
      animationFillMode: fillMode,
    };
  }, [shouldReduceMotion, getAnimationName, getDuration]);
  
  // Build transition style based on preference
  const getTransitionStyle = useCallback((properties: {
    property?: string;
    duration?: number;
    reducedDuration?: number;
    delay?: number;
    reducedDelay?: number;
    timingFunction?: string;
    reducedTimingFunction?: string;
  }) => {
    if (shouldReduceMotion) {
      // If duration is 0, effectively no transition
      if ((properties.reducedDuration || 0) === 0) {
        return { transition: 'none' };
      }
    }
    
    const property = properties.property || 'all';
    
    const duration = getDuration(
      properties.duration || 300,
      properties.reducedDuration || 0
    );
    
    const delay = getDuration(
      properties.delay || 0,
      properties.reducedDelay || 0
    );
    
    const timingFunction = shouldReduceMotion
      ? properties.reducedTimingFunction || 'linear'
      : properties.timingFunction || 'ease';
    
    return {
      transitionProperty: property,
      transitionDuration: `${duration}ms`,
      transitionDelay: `${delay}ms`,
      transitionTimingFunction: timingFunction,
    };
  }, [shouldReduceMotion, getDuration]);
  
  return {
    shouldReduceMotion,
    systemReducedMotion,
    getDuration,
    getAnimationName,
    getAnimationClass,
    getAnimationStyle,
    getTransitionStyle,
  };
}