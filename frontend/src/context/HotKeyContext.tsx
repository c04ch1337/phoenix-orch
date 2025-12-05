import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  initNavigationShortcuts,
  initFeatureShortcuts,
  registerCustomShortcut,
  KeyboardShortcuts,
  ShortcutDescriptions,
  formatShortcutForDisplay,
} from '../utils/hotkeys';

// Define the shape of our context
interface HotKeyContextType {
  registerShortcut: (key: string, callback: (e: KeyboardEvent, combo: string) => boolean | void) => () => void;
  getShortcutLabel: (shortcut: string) => string;
  getShortcutDescription: (shortcut: string) => string;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  shortcutList: Array<{ key: string; description: string; label: string }>;
}

// Create the context with default values
const HotKeyContext = createContext<HotKeyContextType>({
  registerShortcut: () => () => {},
  getShortcutLabel: () => '',
  getShortcutDescription: () => '',
  isEnabled: true,
  setEnabled: () => {},
  shortcutList: [],
});

// Custom hook to use the context
export const useHotKeys = () => useContext(HotKeyContext);

interface HotKeyProviderProps {
  children: ReactNode;
}

export const HotKeyProvider: React.FC<HotKeyProviderProps> = ({ children }) => {
  const [isEnabled, setEnabled] = useState<boolean>(true);
  const [customShortcuts, setCustomShortcuts] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  // Initialize navigation shortcuts when component mounts
  useEffect(() => {
    if (!isEnabled) return;

    const { bindNavigationShortcuts, unbindNavigationShortcuts } = initNavigationShortcuts(navigate);
    const { bindFeatureShortcuts, unbindFeatureShortcuts } = initFeatureShortcuts();

    // Bind all global shortcuts
    bindNavigationShortcuts();
    bindFeatureShortcuts();

    // Clean up when component unmounts
    return () => {
      unbindNavigationShortcuts();
      unbindFeatureShortcuts();
    };
  }, [navigate, isEnabled]);

  // Register a custom shortcut
  const registerShortcut = (
    key: string,
    callback: (e: KeyboardEvent, combo: string) => boolean | void
  ) => {
    if (!isEnabled) return () => {};

    const unregister = registerCustomShortcut(key, callback);

    // Update the list of custom shortcuts
    setCustomShortcuts((prev) => ({ ...prev, [key]: 'Custom shortcut' }));

    // Return a function to unregister the shortcut
    return () => {
      unregister();
      setCustomShortcuts((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    };
  };

  // Get the formatted label for a shortcut (e.g., 'Ctrl+1')
  const getShortcutLabel = useCallback((shortcut: string) => {
    return formatShortcutForDisplay(shortcut);
  }, []);

  // Get the description for a shortcut (e.g., 'Navigate to Ember Unit')
  const getShortcutDescription = useCallback((shortcut: string) => {
    return (
      ShortcutDescriptions[shortcut] ||
      customShortcuts[shortcut] ||
      'Custom shortcut'
    );
  }, [customShortcuts]);

  // Create a list of all available shortcuts
  const shortcutList = React.useMemo(() => {
    const defaultShortcuts = Object.values(KeyboardShortcuts).map(shortcut => ({
      key: shortcut,
      description: getShortcutDescription(shortcut),
      label: getShortcutLabel(shortcut),
    }));

    const userShortcuts = Object.keys(customShortcuts).map(shortcut => ({
      key: shortcut,
      description: customShortcuts[shortcut],
      label: getShortcutLabel(shortcut),
    }));

    return [...defaultShortcuts, ...userShortcuts];
  }, [customShortcuts, getShortcutDescription, getShortcutLabel]);

  // Provide the context values to children
  const contextValue: HotKeyContextType = {
    registerShortcut,
    getShortcutLabel,
    getShortcutDescription,
    isEnabled,
    setEnabled,
    shortcutList,
  };

  return (
    <HotKeyContext.Provider value={contextValue}>
      {children}
    </HotKeyContext.Provider>
  );
};