import React, { ReactNode, useState } from 'react';
import { useHotKeys } from '../../context/HotKeyContext';
import { KeyboardShortcuts } from '../../utils/hotkeys';

interface KeyboardTooltipProps {
  children: ReactNode;
  shortcut?: string | KeyboardShortcuts;
  description?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * A tooltip component that shows keyboard shortcut information
 * This component wraps any element and shows a tooltip when hovered
 */
const KeyboardTooltip: React.FC<KeyboardTooltipProps> = ({
  children,
  shortcut,
  description,
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const { getShortcutLabel, getShortcutDescription } = useHotKeys();
  
  // If no shortcut is provided, just render children without tooltip
  if (!shortcut) {
    return <>{children}</>;
  }

  // Get the formatted shortcut label and description
  const shortcutLabel = getShortcutLabel(shortcut);
  const shortcutDescription = description || getShortcutDescription(shortcut);

  // Define position classes for different tooltip positions
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {/* The actual content */}
      {children}
      
      {/* The tooltip */}
      {isVisible && (
        <div 
          role="tooltip"
          aria-hidden={!isVisible}
          className={`
            absolute z-50 px-3 py-2 text-sm 
            bg-gray-900 text-white rounded shadow-lg
            ${positionClasses[position]}
            flex flex-col items-center
            max-w-xs
            pointer-events-none
            transition-opacity duration-200
            border border-gray-700
          `}
        >
          {/* Keyboard shortcut label */}
          <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-xs mb-1">
            {shortcutLabel}
          </span>
          
          {/* Description */}
          {shortcutDescription && (
            <span className="text-xs text-gray-300">
              {shortcutDescription}
            </span>
          )}
          
          {/* Arrow pointing to the target element */}
          <div
            className={`
              absolute w-2 h-2 bg-gray-900
              transform rotate-45
              border-gray-700
              ${position === 'top' ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b border-r' : ''}
              ${position === 'right' ? 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-l border-t' : ''}
              ${position === 'bottom' ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l' : ''}
              ${position === 'left' ? 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-r border-b' : ''}
            `}
          />
        </div>
      )}
    </div>
  );
};

/**
 * A button component with an integrated keyboard shortcut tooltip
 */
export const KeyboardButton: React.FC<
  KeyboardTooltipProps & React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, shortcut, description, position, className = '', ...buttonProps }) => {
  return (
    <KeyboardTooltip 
      shortcut={shortcut} 
      description={description}
      position={position}
    >
      <button
        className={`
          px-4 py-2 rounded 
          bg-gray-800 hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
          transition-colors duration-200
          ${className}
        `}
        {...buttonProps}
      >
        {children}
      </button>
    </KeyboardTooltip>
  );
};

export default KeyboardTooltip;