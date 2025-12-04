/**
 * Main layout component for the application
 * Provides the primary structure for all pages
 *
 * Features:
 * - Simplified version to fix path resolution issues
 */

import React from 'react';
import { Outlet } from 'react-router-dom';

export default function MainLayout() {
  return (
    <div className="h-screen w-screen bg-black text-white font-mono overflow-hidden relative">
      {/* Main content area */}
      <main className="flex-1 relative">
        <Outlet />
      </main>
    </div>
  );
}