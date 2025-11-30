import { useState, useCallback, useRef, useEffect } from 'react';

interface ClickTimestamp {
  timestamp: number;
}

export const useTripleClick = (timeWindow: number = 1800) => {
  const [clicks, setClicks] = useState<ClickTimestamp[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetClicks = useCallback(() => {
    console.log('🔥 useTripleClick: Resetting clicks');
    setClicks([]);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    const now = Date.now();
    console.log('🔥 useTripleClick: Click registered at', now);
    
    setClicks(prevClicks => {
      const newClicks = [...prevClicks, { timestamp: now }];
      console.log('🔥 useTripleClick: Click count:', newClicks.length);
      
      // If we have 3 clicks, check if they're within the time window
      if (newClicks.length === 3) {
        const timeElapsed = newClicks[2].timestamp - newClicks[0].timestamp;
        console.log('🔥 useTripleClick: Time elapsed between clicks:', timeElapsed, 'ms');
        
        if (timeElapsed <= timeWindow) {
          console.log('🔥 useTripleClick: Triple-click detected!');
          // Let the isTripleClicked check handle this state before resetting
          return newClicks;
        }
        // If time window exceeded, start fresh with the latest click
        console.log('🔥 useTripleClick: Time window exceeded, starting fresh');
        return [{ timestamp: now }];
      }
      
      // Start/reset timeout to clear clicks if time window expires
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        console.log('🔥 useTripleClick: Time window expired, resetting clicks');
        resetClicks();
      }, timeWindow);
      
      return newClicks;
    });
  }, [timeWindow, resetClicks]);

  const isTripleClicked = clicks.length === 3 && 
    (clicks[2].timestamp - clicks[0].timestamp) <= timeWindow;

  // Reset clicks after detecting a triple click
  useEffect(() => {
    if (isTripleClicked) {
      setTimeout(resetClicks, 0);
    }
  }, [isTripleClicked, resetClicks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    handleClick,
    isTripleClicked,
    resetClicks
  };
};