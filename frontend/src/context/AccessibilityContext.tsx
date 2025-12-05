import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define all the accessibility preferences we want to support
interface AccessibilityPreferences {
  // Color and contrast preferences
  colorMode: 'light' | 'dark';
  highContrastMode: boolean;
  
  // Motion preferences
  reducedMotion: boolean;
  
  // Input preferences
  keyboardMode: boolean;
  
  // Feedback preferences
  screenReaderHints: boolean;
}

// Define the context interface
interface AccessibilityContextType {
  preferences: AccessibilityPreferences;
  
  // Color and contrast functions
  toggleColorMode: () => void;
  toggleHighContrastMode: () => void;
  
  // Motion functions
  toggleReducedMotion: () => void;
  
  // Input functions
  toggleKeyboardMode: () => void;
  
  // Feedback functions
  toggleScreenReaderHints: () => void;
}

// Create the context with default values
const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

// Custom hook for using the accessibility context
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  // Initialize state with default values or from localStorage
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(() => {
    // Try to get saved preferences from localStorage
    const savedPreferences = localStorage.getItem('phoenix-a11y-preferences');
    if (savedPreferences) {
      try {
        return JSON.parse(savedPreferences);
      } catch {
        // If parsing fails, return defaults
      }
    }
    
    // Default preferences
    return {
      colorMode: 'light',
      highContrastMode: false,
      reducedMotion: false,
      keyboardMode: false,
      screenReaderHints: false,
    };
  });

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('phoenix-a11y-preferences', JSON.stringify(preferences));
  }, [preferences]);

  // Check system preferences on initial load
  useEffect(() => {
    // Check for system color scheme preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setPreferences(prev => ({ ...prev, colorMode: 'dark' }));
    }
    
    // Check for system reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPreferences(prev => ({ ...prev, reducedMotion: true }));
    }
    
    // Check for system high contrast preference (Windows only)
    if (window.matchMedia && window.matchMedia('(forced-colors: active)').matches) {
      setPreferences(prev => ({ ...prev, highContrastMode: true }));
    }
  }, []);

  // Apply preferences to document
  useEffect(() => {
    // Apply color mode
    if (preferences.colorMode === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    
    // Apply high contrast mode
    if (preferences.highContrastMode) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    
    // Apply reduced motion
    if (preferences.reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
    
    // Apply keyboard mode
    if (preferences.keyboardMode) {
      document.body.classList.add('keyboard-mode');
    } else {
      document.body.classList.remove('keyboard-mode');
    }
    
    // Apply screen reader hints
    if (preferences.screenReaderHints) {
      document.documentElement.classList.add('sr-hints');
    } else {
      document.documentElement.classList.remove('sr-hints');
    }
    
    // Set CSS variables for theme colors based on current modes
    const phoenixOrange = preferences.highContrastMode ? '#FF8C00' : '#F77F00';
    const phoenixCyan = preferences.highContrastMode ? '#00FFFF' : '#00CED1';
    
    document.documentElement.style.setProperty('--phoenix-focus-color', phoenixOrange);
    document.documentElement.style.setProperty('--phoenix-cyan', phoenixCyan);
  }, [preferences]);

  // Set up event listeners for keyboard and mouse navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setPreferences(prev => ({ ...prev, keyboardMode: true }));
      }
    };
    
    const handleMouseDown = () => {
      setPreferences(prev => ({ ...prev, keyboardMode: false }));
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Toggle functions
  const toggleColorMode = () => {
    setPreferences(prev => ({
      ...prev,
      colorMode: prev.colorMode === 'dark' ? 'light' : 'dark'
    }));
  };
  
  const toggleHighContrastMode = () => {
    setPreferences(prev => ({
      ...prev,
      highContrastMode: !prev.highContrastMode
    }));
  };
  
  const toggleReducedMotion = () => {
    setPreferences(prev => ({
      ...prev,
      reducedMotion: !prev.reducedMotion
    }));
  };
  
  const toggleKeyboardMode = () => {
    setPreferences(prev => ({
      ...prev,
      keyboardMode: !prev.keyboardMode
    }));
  };
  
  const toggleScreenReaderHints = () => {
    setPreferences(prev => ({
      ...prev,
      screenReaderHints: !prev.screenReaderHints
    }));
  };

  // Create context value
  const value = {
    preferences,
    toggleColorMode,
    toggleHighContrastMode,
    toggleReducedMotion,
    toggleKeyboardMode,
    toggleScreenReaderHints
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export default AccessibilityContext;