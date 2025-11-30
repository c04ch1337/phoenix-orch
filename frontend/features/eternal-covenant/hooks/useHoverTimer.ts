import { useEffect, useRef, useCallback } from 'react';
import { useEternalCovenant } from '../components/EternalCovenantProvider';

const HOVER_THRESHOLD = 7000; // 7 seconds in milliseconds

export const useHoverTimer = () => {
  const { state, updateHoverState, activateCovenant } = useEternalCovenant();
  const hoverStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const updateHoverDuration = useCallback(() => {
    if (!hoverStartRef.current || !state.isHovering) return;

    const currentDuration = Date.now() - hoverStartRef.current;
    
    // If we've reached the threshold, activate the covenant
    if (currentDuration >= HOVER_THRESHOLD && !state.isCovenantActive) {
      activateCovenant();
      return;
    }

    // Continue animation frame loop
    animationFrameRef.current = requestAnimationFrame(updateHoverDuration);
  }, [state.isHovering, state.isCovenantActive, activateCovenant]);

  const handleMouseEnter = useCallback(() => {
    hoverStartRef.current = Date.now();
    updateHoverState(true);
    animationFrameRef.current = requestAnimationFrame(updateHoverDuration);
  }, [updateHoverState, updateHoverDuration]);

  const handleMouseLeave = useCallback(() => {
    hoverStartRef.current = null;
    updateHoverState(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [updateHoverState]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    handleMouseEnter,
    handleMouseLeave,
    isHovering: state.isHovering
  };
};