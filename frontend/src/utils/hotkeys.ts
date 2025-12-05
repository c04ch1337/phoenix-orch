import Mousetrap from 'mousetrap';
import { NavigateFunction } from 'react-router-dom';

/**
 * Navigation route mapping for keyboard shortcuts
 */
export enum NavigationRoutes {
  EMBER = '/ember',
  CIPHER = '/cipher',
  WEAVER = '/weaver',
  CONSOLE = '/console',
}

export enum KeyboardShortcuts {
  EMBER_UNIT = 'ctrl+1',
  CIPHER_GUARD = 'ctrl+2',
  WEAVER_MASTER = 'ctrl+3',
  CONSOLE = 'ctrl+`',
  GLOBAL_SEARCH = 'ctrl+/',
  COMMAND_PALETTE = 'ctrl+k',
  NAVIGATE_BACK = 'alt+left',
  NAVIGATE_FORWARD = 'alt+right',
}

/**
 * Custom event types for keyboard shortcuts
 */
export enum HotKeyEvents {
  GLOBAL_SEARCH_ACTIVATED = 'global-search-activated',
  COMMAND_PALETTE_OPENED = 'command-palette-opened',
}

/**
 * Mapping of keyboard shortcuts to their human-readable descriptions
 */
export const ShortcutDescriptions: Record<string, string> = {
  [KeyboardShortcuts.EMBER_UNIT]: 'Navigate to Ember Unit',
  [KeyboardShortcuts.CIPHER_GUARD]: 'Navigate to Cipher Guard',
  [KeyboardShortcuts.WEAVER_MASTER]: 'Navigate to WeaverMaster',
  [KeyboardShortcuts.CONSOLE]: 'Navigate to Console',
  [KeyboardShortcuts.GLOBAL_SEARCH]: 'Activate global search',
  [KeyboardShortcuts.COMMAND_PALETTE]: 'Open command palette',
  [KeyboardShortcuts.NAVIGATE_BACK]: 'Navigate back',
  [KeyboardShortcuts.NAVIGATE_FORWARD]: 'Navigate forward',
};

/**
 * Initialize navigation keyboard shortcuts
 * @param navigate - The React Router navigate function
 * @returns An object with methods to bind and unbind shortcuts
 */
export const initNavigationShortcuts = (navigate: NavigateFunction) => {
  const bindNavigationShortcuts = () => {
    // Navigation shortcuts
    Mousetrap.bind(KeyboardShortcuts.EMBER_UNIT, () => {
      navigate(NavigationRoutes.EMBER);
      return false; // Prevent default browser behavior
    });
    
    Mousetrap.bind(KeyboardShortcuts.CIPHER_GUARD, () => {
      navigate(NavigationRoutes.CIPHER);
      return false;
    });
    
    Mousetrap.bind(KeyboardShortcuts.WEAVER_MASTER, () => {
      navigate(NavigationRoutes.WEAVER);
      return false;
    });
    
    Mousetrap.bind(KeyboardShortcuts.CONSOLE, () => {
      navigate(NavigationRoutes.CONSOLE);
      return false;
    });
    
    // Browser history navigation
    Mousetrap.bind(KeyboardShortcuts.NAVIGATE_BACK, () => {
      navigate(-1); // Go back
      return false;
    });
    
    Mousetrap.bind(KeyboardShortcuts.NAVIGATE_FORWARD, () => {
      navigate(1); // Go forward
      return false;
    });
  };

  const unbindNavigationShortcuts = () => {
    Mousetrap.unbind([
      KeyboardShortcuts.EMBER_UNIT,
      KeyboardShortcuts.CIPHER_GUARD,
      KeyboardShortcuts.WEAVER_MASTER,
      KeyboardShortcuts.CONSOLE,
      KeyboardShortcuts.NAVIGATE_BACK,
      KeyboardShortcuts.NAVIGATE_FORWARD,
    ]);
  };

  return {
    bindNavigationShortcuts,
    unbindNavigationShortcuts,
  };
};

/**
 * Initialize feature-specific keyboard shortcuts
 * @returns An object with methods to bind and unbind shortcuts
 */
export const initFeatureShortcuts = () => {
  const bindFeatureShortcuts = () => {
    // Global search
    Mousetrap.bind(KeyboardShortcuts.GLOBAL_SEARCH, () => {
      const event = new CustomEvent(HotKeyEvents.GLOBAL_SEARCH_ACTIVATED);
      window.dispatchEvent(event);
      return false;
    });
    
    // Command palette
    Mousetrap.bind(KeyboardShortcuts.COMMAND_PALETTE, () => {
      const event = new CustomEvent(HotKeyEvents.COMMAND_PALETTE_OPENED);
      window.dispatchEvent(event);
      return false;
    });
  };

  const unbindFeatureShortcuts = () => {
    Mousetrap.unbind([
      KeyboardShortcuts.GLOBAL_SEARCH,
      KeyboardShortcuts.COMMAND_PALETTE,
    ]);
  };

  return {
    bindFeatureShortcuts,
    unbindFeatureShortcuts,
  };
};

/**
 * Register a custom keyboard shortcut
 * @param key - The key combination to bind
 * @param callback - The function to execute when the shortcut is triggered
 * @returns A function to unregister the shortcut
 */
export const registerCustomShortcut = (
  key: string,
  callback: (e: KeyboardEvent, combo: string) => boolean | void
) => {
  Mousetrap.bind(key, callback);
  
  // Return function to unbind
  return () => {
    Mousetrap.unbind(key);
  };
};

/**
 * Get a formatted representation of a keyboard shortcut for display
 * @param shortcut - The shortcut string (e.g., 'ctrl+1')
 * @returns Formatted shortcut for display (e.g., 'Ctrl+1')
 */
export const formatShortcutForDisplay = (shortcut: string): string => {
  return shortcut
    .split('+')
    .map(part => {
      if (part === 'ctrl') return 'Ctrl';
      if (part === 'alt') return 'Alt';
      if (part === 'shift') return 'Shift';
      if (part === 'left') return '←';
      if (part === 'right') return '→';
      if (part === '`') return '`';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('+');
};