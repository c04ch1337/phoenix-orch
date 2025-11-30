import { useState, useEffect, useRef } from 'react';

interface CounterAnimationOptions {
  duration?: number;
  easingFn?: (t: number) => number;
}

const defaultEasing = (t: number): number => {
  // Ease out cubic
  return 1 - Math.pow(1 - t, 3);
};

export const useCounterAnimation = (
  targetValue: number,
  { duration = 1000, easingFn = defaultEasing }: CounterAnimationOptions = {}
) => {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const startValueRef = useRef(targetValue);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (targetValue === displayValue) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easedProgress = easingFn(progress);
      
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * easedProgress;
      setDisplayValue(Math.round(currentValue * 10) / 10);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startTimeRef.current = null;
      }
    };

    startValueRef.current = displayValue;
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [targetValue, duration, easingFn]);

  return displayValue;
};