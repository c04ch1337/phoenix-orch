import { useRef, useEffect, useState, useCallback, RefObject } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';

interface KeyboardNavigationOptions {
  containerRef: RefObject<HTMLElement>;
  selector: string;
  wrap?: boolean; // Whether to wrap around when reaching the end
  orientation?: 'horizontal' | 'vertical' | 'both';
  autoInit?: boolean; // Whether to automatically initialize
  disabled?: boolean; // Whether keyboard navigation is disabled
  onSelect?: (element: HTMLElement) => void; // Callback when an element is selected
}

/**
 * Hook for managing keyboard navigation within a container
 * 
 * This hook allows for accessible keyboard navigation through elements
 * matching a selector within a container. It supports both horizontal and
 * vertical navigation as well as wrapping around when reaching the end.
 */
export function useKeyboardNavigation({
  containerRef,
  selector,
  wrap = true,
  orientation = 'both',
  autoInit = false,
  disabled = false,
  onSelect,
}: KeyboardNavigationOptions) {
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [elements, setElements] = useState<HTMLElement[]>([]);
  const { preferences } = useAccessibility();

  // Initialize the elements list
  const init = useCallback(() => {
    if (!containerRef.current) return;
    
    const elementList = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector)
    );
    
    setElements(elementList);
    
    // If autoInit is true, set the first element as current
    if (autoInit && elementList.length > 0) {
      setCurrentIndex(0);
    }
  }, [containerRef, selector, autoInit]);
  
  // Update elements when the container or selector changes
  useEffect(() => {
    init();
    
    // Create a mutation observer to watch for changes in the DOM
    const observer = new MutationObserver(init);
    
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true
      });
    }
    
    return () => observer.disconnect();
  }, [containerRef, selector, init]);

  // Navigates to a specific index
  const navigateTo = (index: number) => {
    if (disabled || elements.length === 0) return;
    
    if (index < 0) {
      index = wrap ? elements.length - 1 : 0;
    }
    
    if (index >= elements.length) {
      index = wrap ? 0 : elements.length - 1;
    }
    
    setCurrentIndex(index);
    
    // Focus the element
    if (elements[index]) {
      elements[index].focus();
      
      // Call onSelect callback if provided
      if (onSelect) {
        onSelect(elements[index]);
      }
    }
  };

  // Navigate to the next element
  const navigateNext = () => {
    navigateTo(currentIndex + 1);
  };

  // Navigate to the previous element
  const navigatePrev = () => {
    navigateTo(currentIndex - 1);
  };

  // Navigate to the element above (for vertical orientation)
  const navigateUp = () => {
    if (orientation === 'horizontal') return;
    navigateTo(currentIndex - 1);
  };

  // Navigate to the element below (for vertical orientation)
  const navigateDown = () => {
    if (orientation === 'horizontal') return;
    navigateTo(currentIndex + 1);
  };

  // Navigate to the element to the left (for horizontal orientation)
  const navigateLeft = () => {
    if (orientation === 'vertical') return;
    navigateTo(currentIndex - 1);
  };

  // Navigate to the element to the right (for horizontal orientation)
  const navigateRight = () => {
    if (orientation === 'vertical') return;
    navigateTo(currentIndex + 1);
  };

  // Reset the current index
  const reset = () => {
    setCurrentIndex(-1);
  };

  // Set up keyboard event listeners
  useEffect(() => {
    // Skip if keyboard navigation is disabled or the container isn't rendered yet
    if (disabled || !containerRef.current) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if modifiers are pressed
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      
      // Only handle navigation keys
      switch (e.key) {
        case 'ArrowRight':
          if (orientation === 'vertical') return;
          e.preventDefault();
          navigateRight();
          break;
        case 'ArrowLeft':
          if (orientation === 'vertical') return;
          e.preventDefault();
          navigateLeft();
          break;
        case 'ArrowDown':
          if (orientation === 'horizontal') return;
          e.preventDefault();
          navigateDown();
          break;
        case 'ArrowUp':
          if (orientation === 'horizontal') return;
          e.preventDefault();
          navigateUp();
          break;
        // Allow Tab for normal navigation
        case 'Tab':
          break;
        // Home goes to first element
        case 'Home':
          e.preventDefault();
          navigateTo(0);
          break;
        // End goes to last element
        case 'End':
          e.preventDefault();
          navigateTo(elements.length - 1);
          break;
        default:
          return;
      }
    };

    const handleFocus = () => {
      // If no element is selected, select the first one on container focus
      if (currentIndex === -1 && elements.length > 0) {
        navigateTo(0);
      }
    };

    containerRef.current.addEventListener('keydown', handleKeyDown);
    containerRef.current.addEventListener('focus', handleFocus);

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('keydown', handleKeyDown);
        containerRef.current.removeEventListener('focus', handleFocus);
      }
    };
  }, [
    containerRef.current,
    elements,
    currentIndex,
    orientation,
    disabled,
    preferences.keyboardMode
  ]);

  return {
    currentIndex,
    elements,
    navigateNext,
    navigatePrev,
    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    navigateTo,
    reset,
    init,
  };
}