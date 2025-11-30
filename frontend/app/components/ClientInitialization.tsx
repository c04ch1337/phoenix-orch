'use client';

import { useEffect } from 'react';

export const ClientInitialization = () => {
  useEffect(() => {
    // Initialize Web Speech API
    if ('speechSynthesis' in window) {
      speechSynthesis.getVoices();
    }

    // Register event for dynamic voice loading
    window.speechSynthesis?.addEventListener('voiceschanged', () => {
      speechSynthesis.getVoices();
    });

    // Handle offline mode gracefully
    window.addEventListener('offline', () => {
      console.log('🔥 Phoenix: Network lost - Entering offline mode');
    });

    window.addEventListener('online', () => {
      console.log('🔥 Phoenix: Network restored - Syncing state');
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('🔥 Phoenix ServiceWorker: Registered', registration);
        })
        .catch(error => {
          console.error('ServiceWorker registration failed:', error);
        });
    }

    // Log initialization
    console.log('🔥 Phoenix: Client initialization complete');
  }, []);

  return null;
};