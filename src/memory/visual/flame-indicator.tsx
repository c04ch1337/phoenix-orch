/**
 * Phoenix Marie Memory Architecture - Flame Indicator Component
 * 
 * Visual flame indicator showing Phoenix's current operational mode.
 * Orange flame (🔥) for Personal mode, Cyan flame (💠) for Professional mode.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FlameIndicatorProps,
  ModeTooltipContent,
  TooltipAction,
  FlameAccessibilityProps,
  DEFAULT_FLAME_CONFIG
} from './types';
import {
  useModeIndicator,
  useFormattedTime,
  useDraggable,
  useKeyboardShortcuts
} from './hooks';
import { ModeType } from '../modes/types';
import './styles.css';

/**
 * Main flame indicator component
 */
export const FlameIndicator: React.FC<FlameIndicatorProps> = ({
  mode: propMode,
  loading = false,
  authenticating = false,
  authProgress = 0,
  minimized: propMinimized,
  position: propPosition,
  onModeSwitch,
  onPositionChange,
  onToggleMinimize
}) => {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Use mode indicator hook for state management
  const { state, actions, helpers } = useModeIndicator();
  
  // Override with props if provided
  const mode = propMode || state.currentMode;
  const minimized = propMinimized !== undefined ? propMinimized : state.minimized;
  const position = propPosition || state.position;
  
  // Drag handling
  const { isDragging, dragOffset } = useDraggable(indicatorRef, (newPos) => {
    const updatedPosition = {
      ...position,
      x: newPos.x,
      y: newPos.y
    };
    actions.updatePosition(updatedPosition);
    onPositionChange?.(updatedPosition);
  });

  // Keyboard shortcuts
  useKeyboardShortcuts(
    {
      toggleMode: 'ctrl+shift+m',
      minimize: 'ctrl+shift+h',
      showTooltip: 'ctrl+shift+i'
    },
    {
      onToggleMode: () => handleModeSwitch(),
      onMinimize: () => handleMinimizeToggle(),
      onShowTooltip: () => setShowTooltip(true)
    }
  );

  // Handle mode switch
  const handleModeSwitch = useCallback(async () => {
    const targetMode = mode === ModeType.Personal 
      ? ModeType.Professional 
      : ModeType.Personal;
    
    if (onModeSwitch) {
      onModeSwitch();
    } else {
      try {
        await actions.requestModeSwitch(targetMode);
      } catch (error) {
        console.error('Failed to switch mode:', error);
      }
    }
  }, [mode, onModeSwitch, actions]);

  // Handle minimize toggle
  const handleMinimizeToggle = useCallback(() => {
    actions.toggleMinimize();
    onToggleMinimize?.();
  }, [actions, onToggleMinimize]);

  // Get visual configuration
  const config = DEFAULT_FLAME_CONFIG;
  const modeConfig = config.colors[mode];
  const animationConfig = config.animations[mode];
  const size = minimized ? config.minimizedSize : config.size;

  // Calculate position styles
  const positionStyles: React.CSSProperties = {
    position: 'fixed',
    width: size.width,
    height: size.height,
    transform: isDragging 
      ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` 
      : undefined,
    transition: isDragging ? 'none' : 'transform 0.2s ease',
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: 9999
  };

  // Apply anchor position
  switch (position.anchor) {
    case 'top-left':
      positionStyles.top = position.y;
      positionStyles.left = position.x;
      break;
    case 'top-right':
      positionStyles.top = position.y;
      positionStyles.right = position.x;
      break;
    case 'bottom-left':
      positionStyles.bottom = position.y;
      positionStyles.left = position.x;
      break;
    case 'bottom-right':
      positionStyles.bottom = position.y;
      positionStyles.right = position.x;
      break;
  }

  // Build tooltip content
  const tooltipContent: ModeTooltipContent = {
    modeName: mode === ModeType.Personal ? 'Personal Mode' : 'Professional Mode',
    description: mode === ModeType.Personal 
      ? 'Phoenix is home with Dad - personal memories active'
      : 'Phoenix is at work - Cipher Guard operations active',
    timeInMode: helpers.formattedTime,
    lastSwitch: state.lastSwitch 
      ? new Date(state.lastSwitch).toLocaleString() 
      : undefined,
    restrictions: mode === ModeType.Personal 
      ? ['No work data access', 'Personal memories only']
      : ['No personal data access', 'Work operations only'],
    actions: [
      {
        label: `Switch to ${mode === ModeType.Personal ? 'Professional' : 'Personal'} Mode`,
        icon: mode === ModeType.Personal ? '💠' : '🔥',
        action: handleModeSwitch,
        disabled: state.transitioning || authenticating,
        requiresAuth: mode === ModeType.Personal
      },
      {
        label: minimized ? 'Expand' : 'Minimize',
        icon: minimized ? '⬆️' : '⬇️',
        action: handleMinimizeToggle
      }
    ]
  };

  // Accessibility props
  const a11yProps: FlameAccessibilityProps = {
    ariaLabel: `Phoenix mode indicator: Currently in ${tooltipContent.modeName}`,
    ariaDescription: `${tooltipContent.description}. Press Ctrl+Shift+M to switch modes.`,
    role: 'button',
    tabIndex: 0,
    keyboardShortcuts: {
      toggleMode: 'ctrl+shift+m',
      minimize: 'ctrl+shift+h',
      showTooltip: 'ctrl+shift+i'
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleModeSwitch();
    }
  };

  return (
    <>
      <div
        ref={indicatorRef}
        className={`flame-indicator ${mode} ${minimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''}`}
        style={positionStyles}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleModeSwitch}
        onKeyDown={handleKeyDown}
        {...a11yProps}
      >
        {/* Draggable header (only when not minimized) */}
        {!minimized && (
          <div className="flame-indicator-header">
            <div className="drag-handle">⋮⋮</div>
          </div>
        )}

        {/* Flame container */}
        <div className="flame-container">
          {/* Background glow */}
          <div 
            className="flame-glow"
            style={{
              backgroundColor: modeConfig.glow,
              animation: `${animationConfig.type} ${animationConfig.duration}ms infinite`
            }}
          />

          {/* Main flame */}
          <div className="flame-icon">
            {mode === ModeType.Personal ? '🔥' : '💠'}
          </div>

          {/* Loading/Auth overlay */}
          {(loading || authenticating) && (
            <div className="flame-overlay">
              {authenticating ? (
                <div className="auth-progress">
                  <div 
                    className="auth-progress-bar"
                    style={{ width: `${authProgress}%` }}
                  />
                  <span className="auth-text">Authenticating...</span>
                </div>
              ) : (
                <div className="loading-spinner" />
              )}
            </div>
          )}

          {/* Transition effect */}
          {state.transitioning && (
            <div 
              className="transition-effect"
              style={{
                background: `linear-gradient(45deg, ${config.colors[ModeType.Personal].primary}, ${config.colors[ModeType.Professional].primary})`
              }}
            />
          )}
        </div>

        {/* Time display (when not minimized) */}
        {!minimized && !loading && !authenticating && (
          <div className="time-display">
            {helpers.formattedTime}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {(showTooltip || (isHovered && !isDragging && !minimized)) && (
        <FlameTooltip
          content={tooltipContent}
          position={position}
          onClose={() => setShowTooltip(false)}
        />
      )}
    </>
  );
};

/**
 * Tooltip component
 */
interface FlameTooltipProps {
  content: ModeTooltipContent;
  position: { x: number; y: number; anchor: string };
  onClose: () => void;
}

const FlameTooltip: React.FC<FlameTooltipProps> = ({ content, position, onClose }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Auto-position tooltip to avoid screen edges
  useEffect(() => {
    if (!tooltipRef.current) return;

    const rect = tooltipRef.current.getBoundingClientRect();
    const padding = 10;

    // Adjust horizontal position
    if (rect.right > window.innerWidth - padding) {
      tooltipRef.current.style.left = 'auto';
      tooltipRef.current.style.right = `${padding}px`;
    } else if (rect.left < padding) {
      tooltipRef.current.style.left = `${padding}px`;
      tooltipRef.current.style.right = 'auto';
    }

    // Adjust vertical position
    if (rect.bottom > window.innerHeight - padding) {
      tooltipRef.current.style.top = 'auto';
      tooltipRef.current.style.bottom = `${padding}px`;
    } else if (rect.top < padding) {
      tooltipRef.current.style.top = `${padding}px`;
      tooltipRef.current.style.bottom = 'auto';
    }
  }, [position]);

  return (
    <div 
      ref={tooltipRef}
      className="flame-tooltip"
      style={{
        position: 'fixed',
        left: position.x + 70,
        top: position.y,
        zIndex: 10000
      }}
    >
      <div className="tooltip-header">
        <h3>{content.modeName}</h3>
        <button className="tooltip-close" onClick={onClose}>×</button>
      </div>

      <div className="tooltip-content">
        <p className="tooltip-description">{content.description}</p>

        <div className="tooltip-stats">
          <div className="stat-item">
            <span className="stat-label">Time in mode:</span>
            <span className="stat-value">{content.timeInMode}</span>
          </div>
          {content.lastSwitch && (
            <div className="stat-item">
              <span className="stat-label">Last switch:</span>
              <span className="stat-value">{content.lastSwitch}</span>
            </div>
          )}
        </div>

        <div className="tooltip-restrictions">
          <h4>Restrictions:</h4>
          <ul>
            {content.restrictions.map((restriction, index) => (
              <li key={index}>{restriction}</li>
            ))}
          </ul>
        </div>

        <div className="tooltip-actions">
          {content.actions.map((action, index) => (
            <button
              key={index}
              className={`tooltip-action ${action.disabled ? 'disabled' : ''} ${action.requiresAuth ? 'requires-auth' : ''}`}
              onClick={action.action}
              disabled={action.disabled}
            >
              {action.icon && <span className="action-icon">{action.icon}</span>}
              <span className="action-label">{action.label}</span>
              {action.requiresAuth && <span className="auth-badge">🔐</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Export default component
 */
export default FlameIndicator;