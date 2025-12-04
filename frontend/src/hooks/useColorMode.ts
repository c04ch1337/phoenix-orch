import { useState, useEffect } from 'react';

type ColorMode = 'light' | 'dark';

interface ColorModeHook {
  colorMode: ColorMode;
  toggleColorMode: () => void;
}

/**
 * Custom hook for managing light/dark mode.
 * - Checks system preference
 * - Saves preference to localStorage
 * - Provides a toggle function
 * - Applies appropriate CSS classes to the document
 */
export function useColorMode(): ColorModeHook {
  const [colorMode, setColorMode] = useState<ColorMode>('light');
  
  useEffect(() => {
    // Check for system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setColorMode('dark');
    }
    
    // Check for saved preference
    const savedMode = localStorage.getItem('colorMode') as ColorMode | null;
    if (savedMode) {
      setColorMode(savedMode);
    }
  }, []);
  
  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('colorMode', colorMode);
    
    // Apply to document
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [colorMode]);
  
  const toggleColorMode = () => {
    setColorMode(prev => prev === 'dark' ? 'light' : 'dark');
  };
  
  return { colorMode, toggleColorMode };
}