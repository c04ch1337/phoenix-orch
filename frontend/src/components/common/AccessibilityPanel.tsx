import React, { useState } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Moon, Sun, Eye, Zap, Keyboard, VolumeX, Volume2 } from 'lucide-react';

interface AccessibilityPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({
  isOpen = false,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(isOpen);
  const {
    preferences,
    toggleColorMode,
    toggleHighContrastMode,
    toggleReducedMotion,
    toggleKeyboardMode,
    toggleScreenReaderHints
  } = useAccessibility();

  const handleTogglePanel = () => {
    setIsVisible(!isVisible);
  };

  const handleClosePanel = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  // Toggle button component for accessibility options
  const ToggleButton: React.FC<{
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    icon: React.ReactNode;
    activeIcon?: React.ReactNode;
  }> = ({ label, description, enabled, onToggle, icon, activeIcon }) => {
    return (
      <div className="flex items-center justify-between py-3 border-b border-gray-700">
        <div className="flex items-center">
          <div className="text-xl mr-3">
            {enabled && activeIcon ? activeIcon : icon}
          </div>
          <div>
            <div className="font-medium">{label}</div>
            <div className="text-sm text-gray-400">{description}</div>
          </div>
        </div>
        <button
          onClick={onToggle}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            enabled 
              ? 'bg-phoenix-orange focus-visible:outline-phoenix-orange' 
              : 'bg-gray-700 focus-visible:outline-white'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          <span className="sr-only">{enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Accessibility quick toggle button (always visible) */}
      <button
        onClick={handleTogglePanel}
        aria-label={isVisible ? "Close accessibility options" : "Open accessibility options"}
        className="fixed bottom-4 right-4 z-40 bg-gray-900 text-white p-3 rounded-full shadow-lg hover:bg-gray-800 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-phoenix-orange"
      >
        <Eye className="w-5 h-5" />
        <span className="sr-only">Accessibility Options</span>
      </button>

      {/* Accessibility panel (toggleable) */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="a11y-panel-title"
        className={`fixed inset-y-0 right-0 z-50 w-80 bg-gray-900 shadow-xl text-white transform transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 id="a11y-panel-title" className="text-lg font-bold">Accessibility Options</h2>
            <button 
              onClick={handleClosePanel}
              aria-label="Close accessibility panel"
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-1">
              <ToggleButton
                label="Dark Mode"
                description="Reduce eye strain with darker colors"
                enabled={preferences.colorMode === 'dark'}
                onToggle={toggleColorMode}
                icon={<Sun className="text-yellow-400" />}
                activeIcon={<Moon className="text-blue-300" />}
              />
              
              <ToggleButton
                label="High Contrast"
                description="Increase contrast for better readability"
                enabled={preferences.highContrastMode}
                onToggle={toggleHighContrastMode}
                icon={<Eye className="text-gray-400" />}
                activeIcon={<Eye className="text-phoenix-orange" />}
              />
              
              <ToggleButton
                label="Reduce Motion"
                description="Decrease animations and movement"
                enabled={preferences.reducedMotion}
                onToggle={toggleReducedMotion}
                icon={<Zap className="text-gray-400" />}
                activeIcon={<Zap className="text-phoenix-orange" />}
              />
              
              <ToggleButton
                label="Keyboard Navigation"
                description="Enhanced focus indicators for keyboard users"
                enabled={preferences.keyboardMode}
                onToggle={toggleKeyboardMode}
                icon={<Keyboard className="text-gray-400" />}
                activeIcon={<Keyboard className="text-phoenix-orange" />}
              />
              
              <ToggleButton
                label="Screen Reader Hints"
                description="Additional context for screen reader users"
                enabled={preferences.screenReaderHints}
                onToggle={toggleScreenReaderHints}
                icon={<VolumeX className="text-gray-400" />}
                activeIcon={<Volume2 className="text-phoenix-orange" />}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-700 mt-4">
            <p className="text-xs text-gray-400">
              Phoenix Orch complies with WCAG 2.2 AA standards for web accessibility.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AccessibilityPanel;