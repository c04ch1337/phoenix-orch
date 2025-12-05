import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Flame, Menu, X, Settings, Terminal, Home, Search, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/phoenix-nav.css'; // Import our custom Phoenix styling
import KeyboardTooltip from '../common/KeyboardTooltip';
import { KeyboardShortcuts, HotKeyEvents } from '../../utils/hotkeys';
import { useHotKeys } from '../../context/HotKeyContext';

// Interface for the breadcrumb props
interface BreadcrumbProps {
  paths: Array<{
    name: string;
    path: string;
  }>;
}

// Performance optimized Breadcrumb component
const PhoenixBreadcrumb = memo<BreadcrumbProps>(({ paths }) => {
  // State to track which link has active hover effect
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Performance optimized particle effect using CSS instead of DOM manipulation
  const handleMouseEnter = useCallback((index: number) => {
    setHoverIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="breadcrumb-container flex items-center relative py-2 overflow-hidden"
      style={{ contain: 'content' }} // Improve paint performance
    >
      {paths.map((item, index) => (
        <React.Fragment key={item.path}>
          <Link
            to={item.path}
            className="text-gray-300 hover:text-white transition-colors duration-300 relative"
            aria-label={`Navigate to ${item.name}`}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
            style={{ willChange: hoverIndex === index ? 'transform, opacity' : 'auto' }}
          >
            <span className="z-10 relative">{item.name}</span>
            {/* CSS-based Phoenix trail effect */}
            <div className={`phoenix-trail ${hoverIndex === index ? 'phoenix-trail-active' : ''}`}>
              {/* Trail rendered via CSS */}
            </div>
            {/* CSS-based particles */}
            {hoverIndex === index && (
              <div className="phoenix-particles-container" aria-hidden="true">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="phoenix-css-particle"
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      left: `${50 + (Math.random() * 10) - 5}%`
                    }}
                  />
                ))}
              </div>
            )}
          </Link>
          
          {index < paths.length - 1 && (
            <div className="mx-2 flex items-center">
              <Flame className="h-3 w-3 text-phoenix-blood phoenix-pulse" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
});

PhoenixBreadcrumb.displayName = 'PhoenixBreadcrumb';

// Main Phoenix Navigation Component
const PhoenixNavBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{name: string, path: string}>>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { getShortcutLabel } = useHotKeys();
  
  // Load sidebar state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('phoenix-sidebar-state');
    if (savedState) {
      setSidebarOpen(savedState === 'open');
    }
  }, []);

  // Save sidebar state to localStorage when state changes
  useEffect(() => {
    localStorage.setItem('phoenix-sidebar-state', isSidebarOpen ? 'open' : 'closed');
  }, [isSidebarOpen]);

  // Generate breadcrumbs based on current location
  useEffect(() => {
    const generateBreadcrumbs = () => {
      const paths = location.pathname.split('/').filter(Boolean);
      
      if (paths.length === 0) {
        setBreadcrumbs([{ name: 'Home', path: '/' }]);
        return;
      }
      
      const breadcrumbsArray = [{ name: 'Home', path: '/' }];
      
      paths.forEach((path, index) => {
        const url = `/${paths.slice(0, index + 1).join('/')}`;
        breadcrumbsArray.push({
          name: path.charAt(0).toUpperCase() + path.slice(1),
          path: url,
        });
      });
      
      setBreadcrumbs(breadcrumbsArray);
    };
    
    generateBreadcrumbs();
  }, [location]);
  
  // Listen for global search hotkey event
  useEffect(() => {
    const handleGlobalSearch = () => {
      setShowSearch(true);
    };
    
    const handleCommandPalette = () => {
      setShowCommandPalette(true);
    };
    
    window.addEventListener(HotKeyEvents.GLOBAL_SEARCH_ACTIVATED, handleGlobalSearch);
    window.addEventListener(HotKeyEvents.COMMAND_PALETTE_OPENED, handleCommandPalette);
    
    return () => {
      window.removeEventListener(HotKeyEvents.GLOBAL_SEARCH_ACTIVATED, handleGlobalSearch);
      window.removeEventListener(HotKeyEvents.COMMAND_PALETTE_OPENED, handleCommandPalette);
    };
  }, []);

  // Toggle sidebar state
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Handle keyboard accessibility for navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  }, []);

  // Navigation links configuration
  const navLinks = [
    { 
      name: 'Home', 
      path: '/', 
      icon: <Home className="h-5 w-5" />,
      highlight: 'bg-gray-700 hover:bg-gray-600'
    },
    { 
      name: 'Ember Unit', 
      path: '/ember', 
      icon: <Flame className="h-5 w-5 text-phoenix-blood" />,
      highlight: 'bg-phoenix-deep hover:bg-phoenix-dried border-l-4 border-phoenix-blood'
    },
    { 
      name: 'Cipher Guard', 
      path: '/cipher', 
      icon: <svg className="h-5 w-5 text-cyan-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>,
      highlight: 'bg-cyan-900/30 hover:bg-cyan-900/50 border-l-4 border-cyan-500'
    },
    { 
      name: 'WeaverMaster', 
      path: '/weaver', 
      icon: <svg className="h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4h16v16H4V4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 4l16 16M4 20L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>,
      highlight: 'bg-gray-700 hover:bg-gray-600'
    },
    { 
      name: 'Console', 
      path: '/console', 
      icon: <Terminal className="h-5 w-5 text-green-500" />,
      highlight: 'bg-gray-700 hover:bg-gray-600'
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: <Settings className="h-5 w-5 text-gray-400" />,
      highlight: 'bg-gray-700 hover:bg-gray-600'
    }
  ];

  // Check if a link is active
  const isActive = (path: string) => {
    return location.pathname === path || 
           (path !== '/' && location.pathname.startsWith(path));
  };

  return (
    <>
      {/* Skip to main content link - hidden visually but accessible to screen readers and keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-black focus:text-white focus:outline-none focus:ring-2 focus:ring-phoenix-blood"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      {/* Top bar with logo and toggle button */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-black border-b border-gray-800 z-40 flex items-center justify-between px-4">
        <div className="flex items-center">
          <KeyboardTooltip shortcut="alt+s" description="Toggle sidebar">
            <button
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="sidebar-toggle mr-4 p-1.5 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-phoenix-blood"
              onClick={toggleSidebar}
              onKeyDown={(e) => handleKeyDown(e, toggleSidebar)}
              tabIndex={0}
            >
              {isSidebarOpen ? (
                <X className="h-5 w-5 text-gray-300" />
              ) : (
                <Menu className="h-5 w-5 text-gray-300" />
              )}
            </button>
          </KeyboardTooltip>
          
          <div className="flex items-center">
            {/* Replace Framer Motion with optimized CSS animation */}
            <div
              className="phoenix-flame-container mr-2"
              style={{
                willChange: 'transform',
                animation: 'phoenixFlameRock 3s ease-in-out infinite',
                transformStyle: 'preserve-3d'
              }}
            >
              <Flame className="h-6 w-6 text-phoenix-blood phoenix-flame" />
            </div>
            <h1 className="text-xl font-bold tracking-wider" style={{ contain: 'content' }}>
              <span className="text-white">PHOENIX</span>{' '}
              <span className="text-phoenix-blood">ORCH</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center">
          <KeyboardTooltip shortcut={KeyboardShortcuts.GLOBAL_SEARCH} description="Global Search">
            <button
              className="p-1.5 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-phoenix-blood mr-2"
              aria-label="Global Search"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-5 w-5 text-gray-300" />
            </button>
          </KeyboardTooltip>
          
          <KeyboardTooltip shortcut={KeyboardShortcuts.COMMAND_PALETTE} description="Command Palette">
            <button
              className="p-1.5 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-phoenix-blood mr-2"
              aria-label="Command Palette"
              onClick={() => setShowCommandPalette(true)}
            >
              <Command className="h-5 w-5 text-gray-300" />
            </button>
          </KeyboardTooltip>
        </div>
        
        {/* Breadcrumbs */}
        <div className="hidden md:block" aria-live="polite" role="navigation" aria-label="Breadcrumb navigation">
          <PhoenixBreadcrumb paths={breadcrumbs} />
        </div>
      </header>
      
      {/* Sidebar - Optimized with CSS transitions instead of Framer Motion */}
      <div className="sidebar-container">
        <nav
          className={`fixed top-14 left-0 bottom-0 w-64 bg-black border-r border-gray-800 z-30 overflow-y-auto custom-scrollbar phoenix-sidebar sidebar-transition ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
          style={{
            willChange: 'transform',
            transition: 'transform 0.3s ease-in-out',
            transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            contain: 'layout style paint'
          }}
          aria-label="Main Navigation"
          aria-hidden={!isSidebarOpen}
          aria-expanded={isSidebarOpen}
        >
            <div className="py-4">
              {navLinks.map((link) => {
                // Determine special classes based on route
                let specialClass = '';
                if (link.name === 'Ember Unit') specialClass = 'nav-item-ember';
                if (link.name === 'Cipher Guard') specialClass = 'nav-item-cipher';
                
                // Get the appropriate shortcut key based on link name
                let shortcutKey = '';
                switch (link.name) {
                  case 'Ember Unit':
                    shortcutKey = KeyboardShortcuts.EMBER_UNIT;
                    break;
                  case 'Cipher Guard':
                    shortcutKey = KeyboardShortcuts.CIPHER_GUARD;
                    break;
                  case 'WeaverMaster':
                    shortcutKey = KeyboardShortcuts.WEAVER_MASTER;
                    break;
                  case 'Console':
                    shortcutKey = KeyboardShortcuts.CONSOLE;
                    break;
                  default:
                    shortcutKey = '';
                }
                
                return (
                  <KeyboardTooltip
                    key={link.path}
                    shortcut={shortcutKey}
                    position="right"
                  >
                    <Link
                      to={link.path}
                      className={`nav-item flex items-center px-4 py-3 my-1 text-gray-300 mx-2 rounded-md transition-colors duration-300
                        ${link.highlight}
                        ${specialClass}
                        ${isActive(link.path) ? 'nav-item-active !bg-opacity-70 text-white' : 'bg-opacity-0'}`
                      }
                      aria-current={isActive(link.path) ? "page" : undefined}
                    >
                      <span className="mr-3">{link.icon}</span>
                      <span>{link.name}</span>
                      {shortcutKey && (
                        <span className="ml-auto text-xs text-gray-500 font-mono">
                          {getShortcutLabel(shortcutKey)}
                        </span>
                      )}
                      {isActive(link.path) && (
                        <div
                          className="active-indicator ml-2 w-1.5 h-1.5 rounded-full bg-white"
                          style={{
                            willChange: 'transform, opacity',
                            animation: 'pulseIndicator 1.5s ease-in-out infinite',
                            contain: 'strict'
                          }}
                        />
                      )}
                    </Link>
                  </KeyboardTooltip>
                );
              })}
            </div>
          </nav>
      </div>
      
      {/* Mobile breadcrumbs - shown only on small screens */}
      <div className="md:hidden fixed top-14 left-0 right-0 bg-black border-b border-gray-800 z-20 px-4"
           aria-live="polite"
           role="navigation"
           aria-label="Mobile breadcrumb navigation">
        <PhoenixBreadcrumb paths={breadcrumbs} />
      </div>
      
      {/* Main content padding to accommodate fixed navbar, with ID for skip link target */}
      <div
        id="main-content"
        tabIndex={-1}
        className={`pt-14 md:pt-14 transition-all duration-300 sidebar-transition ${
          isSidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        {/* This div is empty, it just handles the main content padding */}
      </div>
    </>
  );
};

// Add CSS animations for optimized performance
const cssAnimations = `
@keyframes phoenixFlameRock {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(8deg); }
  50% { transform: rotate(0deg); }
  75% { transform: rotate(-8deg); }
  100% { transform: rotate(0deg); }
}

@keyframes pulseIndicator {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

/* CSS-based particle system */
.phoenix-css-particle {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: rgba(220, 38, 38, 0.7);
  pointer-events: none;
  animation: particleFade 1.2s ease-out forwards;
  will-change: transform, opacity;
}

@keyframes particleFade {
  0% { transform: translateY(0) scale(0.5); opacity: 0.8; }
  100% { transform: translateY(-20px) scale(0); opacity: 0; }
}

.phoenix-trail-active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height:. 2px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  animation: trailPulse 1s ease-in-out infinite;
  will-change: opacity, transform;
}

@keyframes trailPulse {
  0% { opacity: 0.3; transform: scaleX(0.8); }
  50% { opacity: 0.8; transform: scaleX(1); }
  100% { opacity: 0.3; transform: scaleX(0.8); }
}

.sidebar-closed {
  transform: translateX(-100%);
}

.sidebar-open {
  transform: translateX(0);
}
`;

// Add style tag to inject optimized animations
const PhoenixNavBarWithStyles: React.FC = () => {
  return (
    <>
      <style>{cssAnimations}</style>
      <PhoenixNavBar />
    </>
  );
};

// Memoize the entire component to prevent unnecessary re-renders
export default memo(PhoenixNavBarWithStyles);