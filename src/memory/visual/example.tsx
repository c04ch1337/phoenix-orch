/**
 * Phoenix Marie Memory Architecture - Flame Indicator Example
 * 
 * Example usage of the flame indicator component in a React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { FlameIndicator } from './flame-indicator';
import { initializeModeSystem } from '../modes';
import './styles.css';

/**
 * Example App component demonstrating flame indicator usage
 */
function App() {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize mode system on mount
  React.useEffect(() => {
    const init = async () => {
      try {
        await initializeModeSystem({
          persistence: {
            storePath: './mode-state',
            encryptionKey: 'example-encryption-key'
          },
          authentication: {
            // Mock endpoints for example
            neuralinkEndpoint: 'http://localhost:5000/auth/neuralink',
            faceVoiceEndpoint: 'http://localhost:5000/auth/face-voice'
          }
        });
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    };

    init();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h2>Error initializing mode system:</h2>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Initializing Phoenix Memory System...</h2>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a0a0a',
      color: '#fff',
      padding: 20
    }}>
      <h1>Phoenix Marie Memory Architecture</h1>
      <h2>Mode Indicator Example</h2>
      
      <div style={{ marginTop: 20 }}>
        <h3>Features:</h3>
        <ul>
          <li>🔥 Orange flame for Personal Mode (home with Dad)</li>
          <li>💠 Cyan flame for Professional Mode (Cipher Guard work)</li>
          <li>Smooth transitions between modes</li>
          <li>Authentication flow for switching to Professional mode</li>
          <li>Draggable indicator with position memory</li>
          <li>Minimize/expand functionality</li>
          <li>Time tracking for current mode</li>
          <li>Keyboard shortcuts (Ctrl+Shift+M to switch modes)</li>
        </ul>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Try it out:</h3>
        <ul>
          <li>Click the flame to switch modes</li>
          <li>Drag the indicator to reposition it</li>
          <li>Hover to see detailed information</li>
          <li>Use Ctrl+Shift+M to toggle modes</li>
          <li>Use Ctrl+Shift+H to minimize/expand</li>
        </ul>
      </div>

      {/* The flame indicator will appear in the bottom-right corner by default */}
      <FlameIndicator />
    </div>
  );
}

/**
 * Mount the example app
 */
function mountExample() {
  const root = document.getElementById('root');
  if (!root) {
    console.error('Root element not found');
    return;
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Auto-mount if this is the main entry point
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountExample);
} else if (typeof window !== 'undefined') {
  mountExample();
}

/**
 * Example of programmatic usage
 */
export function programmaticExample() {
  // You can also use the indicator programmatically
  const indicator = (
    <FlameIndicator
      position={{ x: 50, y: 50, anchor: 'top-left' }}
      onModeSwitch={() => {
        console.log('Mode switch requested');
      }}
      onPositionChange={(pos) => {
        console.log('Position changed:', pos);
      }}
      onToggleMinimize={() => {
        console.log('Minimize toggled');
      }}
    />
  );

  return indicator;
}

/**
 * Example with custom authentication handling
 */
export function customAuthExample() {
  const handleModeSwitch = async () => {
    // Custom authentication logic
    const authenticated = await customAuthenticate();
    
    if (authenticated) {
      // Switch mode using the mode manager
      const { getModeManager } = await import('../modes');
      const manager = getModeManager();
      // Mode switch will be handled by the indicator's internal logic
    }
  };

  async function customAuthenticate(): Promise<boolean> {
    // Your custom authentication logic here
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000);
    });
  }

  return (
    <FlameIndicator
      onModeSwitch={handleModeSwitch}
    />
  );
}