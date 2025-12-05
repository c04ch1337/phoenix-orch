import { useEffect, useState } from 'react';

/**
 * Hook to detect keyboard navigation and manage focus styles
 * 
 * This hook adds a "keyboard-mode" class to the body when keyboard navigation is detected
 * and removes it when mouse navigation is detected.
 * 
 * @returns An object with isKeyboardMode boolean
 */
export function useKeyboardMode() {
  const [isKeyboardMode, setIsKeyboardMode] = useState<boolean>(false);
  
  useEffect(() => {
    // Function to handle keyboard navigation detection
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only consider Tab key presses as keyboard navigation
      if (event.key === 'Tab') {
        if (!isKeyboardMode) {
          setIsKeyboardMode(true);
          document.body.classList.add('keyboard-mode');
        }
      }
    };
    
    // Function to handle mouse navigation detection
    const handleMouseDown = () => {
      if (isKeyboardMode) {
        setIsKeyboardMode(false);
        document.body.classList.remove('keyboard-mode');
      }
    };
    
    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    
    // Initial setup - detect if user has keyboard navigation preference
    // Check for system level preference for reducing motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Users who prefer reduced motion often rely more on keyboard navigation
      setIsKeyboardMode(true);
      document.body.classList.add('keyboard-mode');
    }
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      document.body.classList.remove('keyboard-mode');
    };
  }, [isKeyboardMode]);
  
  return { isKeyboardMode };
}

/**
 * Adds keyboard focus styles to an element
 * 
 * @param element - The element to add focus styles to
 * @param color - Optional color for the focus ring
 */
export function addFocusStyles(element: HTMLElement, color?: string) {
  if (color) {
    element.style.setProperty('--phoenix-focus-color', color);
  }
  element.classList.add('focus-visible');
}

/**
 * Removes keyboard focus styles from an element
 * 
 * @param element - The element to remove focus styles from
 */
export function removeFocusStyles(element: HTMLElement) {
  element.classList.remove('focus-visible');
  element.style.removeProperty('--phoenix-focus-color');
}