import React, { useEffect, useRef, useState } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';

interface FocusManagerProps {
  children: React.ReactNode;
  restoreFocus?: boolean;
  autoFocus?: boolean;
  focusFirst?: boolean;
  lockFocus?: boolean;
  returnFocus?: boolean;
  onEscape?: () => void;
  onEnter?: () => void;
  role?: React.AriaRole;
  'aria-label'?: string;
  className?: string;
}

/**
 * FocusManager component manages focus of its children and provides focus trapping
 * This is particularly useful for modals, dialogs, and other components that need to
 * maintain focus within them for accessibility reasons.
 */
export const FocusManager: React.FC<FocusManagerProps> = ({
  children,
  restoreFocus = true,
  autoFocus = false,
  focusFirst = false,
  lockFocus = false,
  returnFocus = true,
  onEscape,
  onEnter,
  role,
  'aria-label': ariaLabel,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { preferences } = useAccessibility();
  const [focusCounter, setFocusCounter] = useState(0);

  // Store the previously focused element when the component mounts
  useEffect(() => {
    if (restoreFocus || returnFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    return () => {
      // Return focus to the previously focused element when the component unmounts
      if (returnFocus && previousFocusRef.current && 'focus' in previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [restoreFocus, returnFocus]);

  // Auto-focus or focus the first focusable element when the component mounts
  useEffect(() => {
    if (!containerRef.current) return;
    
    if (autoFocus) {
      containerRef.current.focus();
    } else if (focusFirst) {
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [autoFocus, focusFirst]);

  // Handle keyboard events (Tab, Shift+Tab, Escape, Enter)
  useEffect(() => {
    if (!containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!lockFocus && !onEscape && !onEnter) return;

      // Handle Tab and Shift+Tab for focus trapping
      if (lockFocus && event.key === 'Tab') {
        const focusableElements = getFocusableElements(containerRef.current!);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // If Shift+Tab on first element, move to last element
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } 
        // If Tab on last element, move to first element
        else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }

      // Handle Escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
      }

      // Handle Enter key
      if (event.key === 'Enter' && onEnter) {
        event.preventDefault();
        onEnter();
      }
    };

    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyDown);
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [lockFocus, onEscape, onEnter]);

  // Function to find all focusable elements within a container
  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(container.querySelectorAll(selector))
      .filter((el) => {
        // Only include visible elements
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }) as HTMLElement[];
  };

  // Apply custom focus ring to all focusable elements within the container
  useEffect(() => {
    if (!containerRef.current || !preferences.keyboardMode) return;

    const handleFocusIn = () => {
      setFocusCounter((prev) => prev + 1);
    };

    const container = containerRef.current;
    container.addEventListener('focusin', handleFocusIn);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
    };
  }, [preferences.keyboardMode]);

  // Apply appropriate classes for keyboard mode
  const keyboardModeClass = preferences.keyboardMode ? 'keyboard-mode' : '';
  const highContrastClass = preferences.highContrastMode ? 'high-contrast' : '';
  
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role={role}
      aria-label={ariaLabel}
      className={`focus-container ${keyboardModeClass} ${highContrastClass} ${className || ''}`}
      data-focus-counter={focusCounter}
    >
      {children}
    </div>
  );
};

/**
 * FocusRing component adds a visible focus ring when an element is focused via keyboard
 * This provides visual feedback for keyboard navigation
 */
export const FocusRing: React.FC<{
  children: React.ReactElement;
  focusedClassName?: string;
  activeClassName?: string;
}> = ({ children, focusedClassName = 'focus-ring', activeClassName = 'active' }) => {
  const { preferences } = useAccessibility();
  const [isFocused, setIsFocused] = useState(false);
  const [isActive, setIsActive] = useState(false);
  
  // Clone the child element and add focus handlers
  const childWithHandlers = React.cloneElement(children, {
    onFocus: (e: React.FocusEvent) => {
      setIsFocused(true);
      if (children.props.onFocus) {
        children.props.onFocus(e);
      }
    },
    onBlur: (e: React.FocusEvent) => {
      setIsFocused(false);
      if (children.props.onBlur) {
        children.props.onBlur(e);
      }
    },
    onMouseDown: (e: React.MouseEvent) => {
      setIsActive(true);
      if (children.props.onMouseDown) {
        children.props.onMouseDown(e);
      }
    },
    onMouseUp: (e: React.MouseEvent) => {
      setIsActive(false);
      if (children.props.onMouseUp) {
        children.props.onMouseUp(e);
      }
    },
    className: `
      ${children.props.className || ''} 
      ${isFocused && preferences.keyboardMode ? focusedClassName : ''}
      ${isActive ? activeClassName : ''}
      ${preferences.highContrastMode ? 'focus-ring-high-contrast' : ''}
    `
  });
  
  return childWithHandlers;
};

export default FocusManager;