import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import PhoenixNavBar from './PhoenixNavBar';
import { HotKeyProvider } from '../../context/HotKeyContext';
import { useKeyboardMode } from '../../hooks/useKeyboardMode';
import '../../styles/keyboard-focus.css';

interface MainLayoutProps {
  children?: ReactNode;
}

/**
 * Main layout component that wraps all routes
 * Provides consistent layout structure with PhoenixNavBar
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // Initialize keyboard navigation detection
  useKeyboardMode();
  
  return (
    <HotKeyProvider>
      <div className="app-container min-h-screen bg-phoenix-void text-white flex flex-col">
        {/* Phoenix Navigation Bar */}
        <PhoenixNavBar />
      
      {/* Main Content Area */}
      <main className="flex-grow pt-16 md:pt-14 transition-all duration-300">
        <div className="container mx-auto px-4 py-6">
          {children || <Outlet />}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="app-footer border-t border-gray-800 py-4 px-6 text-center text-gray-500">
        <p className="text-sm">
          <span className="text-white">PHOENIX</span>{' '}
          <span className="text-phoenix-blood">ORCH</span>{' '}
          &copy; 2025
        </p>
      </footer>
      </div>
    </HotKeyProvider>
  );
};

export default MainLayout;