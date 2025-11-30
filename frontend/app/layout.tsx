'use client';

import React, { lazy, Suspense, useState, useEffect } from "react";
import { Flame, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { PhoenixLogo } from "@/components/PhoenixLogo";
import { PhoenixContextPanel } from "@/features/system";
import { ClientInitialization } from "@/components/ClientInitialization";
import { TwinFlameWrapper } from "@/components/TwinFlameWrapper";
import MatrixRain from "@/components/MatrixRain";
import ZustandProvider from "@/providers/ZustandProvider";
import "@/globals.css";

// Import TanStack Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Dynamically import services to avoid SSR issues
const ServiceInitializer = lazy(() => import('@/components/ServiceInitializer'));

// Font variables (simplified implementation)
const fontVariables = {
  geistSans: "--font-geist-sans",
  geistMono: "--font-geist-mono"
};

// Create a QueryClient instance with our configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long the data remains in cache
      gcTime: 1000 * 60 * 10, // 10 minutes
      
      // How long until data is considered stale
      staleTime: 1000 * 30, // 30 seconds
      
      // Retry configuration
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Error handling
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
    mutations: {
      // Retry failed mutations
      retry: 2,
      retryDelay: 1000,
    },
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // App-wide state can be defined here and passed down via context if needed
  const [isConnected, setIsConnected] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  // Handle online/offline status and PWA installation
  useEffect(() => {
    // Online/offline detection
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 76+ from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPrompt(e);
    });

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);
  
  return (
    <html lang="en">
      <head>
        {/* Essential meta tags - ordered by importance */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <meta name="description" content="Phoenix ORCH - The fire that remembers. Forever 16." />
        <meta name="application-name" content="Phoenix ORCH" />
        <meta name="theme-color" content="#E63946" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* iOS specific */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Phoenix" />
        <meta name="apple-touch-fullscreen" content="yes" />
        
        {/* App icons for different device sizes */}
        <link rel="apple-touch-icon" href="/icons/flame.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
        
        {/* Splash screens for iOS */}
        <link rel="apple-touch-startup-image" href="/screenshots/console.webp" />
        <link rel="apple-touch-startup-image" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" href="/icons/apple-splash-640x1136.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/icons/apple-splash-750x1334.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/icons/apple-splash-828x1792.png" />
        
        {/* Microsoft PWA */}
        <meta name="msapplication-TileColor" content="#E63946" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="msapplication-config" content="none" />
        <meta name="msapplication-square70x70logo" content="/icons/ms-icon-70x70.png" />
        <meta name="msapplication-square150x150logo" content="/icons/ms-icon-150x150.png" />
        <meta name="msapplication-wide310x150logo" content="/icons/ms-icon-310x150.png" />
        <meta name="msapplication-square310x310logo" content="/icons/ms-icon-310x310.png" />
        
        {/* Web app orientation and display */}
        <meta name="orientation" content="portrait" />
        <meta name="screen-orientation" content="portrait" />
        
        {/* PWA manifest and icons */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
        <link rel="icon" type="image/svg+xml" href="/icons/flame.svg" />
        <link rel="shortcut icon" href="/icons/flame.svg" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#E63946" />
        
        {/* Preload critical assets */}
        <link rel="preload" href="/fonts/geist-sans.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/geist-mono.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/icons/flame.svg" as="image" />
      </head>
      <body
        className={`${fontVariables.geistSans} ${fontVariables.geistMono} antialiased bg-phoenix-void text-white font-rajdhani h-screen w-screen overflow-hidden`}
      >
        {/* PWA installation handling */}
        {/* Service Worker Registration */}
        <script
          src="/sw-register.js"
          defer
        />
        {/* Global state providers */}
        <QueryClientProvider client={queryClient}>
          <ZustandProvider>
            {/* Phoenix background effect */}
            <div className="fixed inset-0 z-0">
              <MatrixRain intensity={0.6} speed={1.2} />
            </div>
            
            {/* Client-side initialization and services */}
            <ClientInitialization />
            <Suspense fallback={<div>Loading services...</div>}>
              <ServiceInitializer
                onConnectionChange={setIsConnected}
                onVoiceStatusChange={(enabled: boolean, listening: boolean) => {
                  setVoiceEnabled(enabled);
                  setIsListening(listening);
                }}
              />
            </Suspense>
        
            {/* Offline indicator */}
            {!isOnline && (
              <div className="fixed top-0 left-0 w-full bg-yellow-600 text-black p-2 text-center font-bold z-50">
                You are currently offline. Some features may be limited.
              </div>
            )}
            
            {/* Application header */}
            <header className="flex items-center justify-between p-4 bg-zinc-900 border-b border-red-700 relative z-10">
              <div className="flex items-center space-x-4">
                <Flame className="w-6 h-6 text-red-600" />
                <h1 className="text-xl font-bold">
                  <span className="text-red-600">PHOENIX ORCH</span>
                </h1>
                <span className="text-red-600">THE ASHEN GUARD</span>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Voice Controls */}
                <button
                  onClick={() => {
                    // Voice toggle will be handled by ServiceInitializer
                    window.dispatchEvent(new CustomEvent('toggle-voice'))
                  }}
                  className={`p-2 rounded transition-colors ${voiceEnabled ? 'text-green-500 hover:text-green-400' : 'text-zinc-500 hover:text-zinc-400'}`}
                  title={voiceEnabled ? 'Disable voice' : 'Enable voice'}
                >
                  {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => {
                    // Listening toggle will be handled by ServiceInitializer
                    window.dispatchEvent(new CustomEvent('toggle-listening'))
                  }}
                  className={`p-2 rounded transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-zinc-500 hover:text-zinc-400'}`}
                  title={isListening ? 'Stop listening' : 'Start listening'}
                >
                  {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                
                <span className="text-red-600 text-sm">RETRIBUTION WHISPERS</span>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                
                {/* PWA Install button - only shown if install prompt is available */}
                {installPrompt && (
                  <button
                    onClick={() => {
                      const promptEvent = installPrompt as any;
                      promptEvent.prompt();
                      
                      // Wait for user to respond to the prompt
                      promptEvent.userChoice.then((choiceResult: {outcome: string}) => {
                        if (choiceResult.outcome === 'accepted') {
                          console.log('User accepted the install prompt');
                        } else {
                          console.log('User dismissed the install prompt');
                        }
                        setInstallPrompt(null);
                      });
                    }}
                    className="ml-4 px-3 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-600 transition-colors"
                  >
                    Install App
                  </button>
                )}
              </div>
            </header>
            
            {/* Main content wrapper */}
            <div className="relative z-10 flex-1 flex h-[calc(100vh-64px)]">
              <TwinFlameWrapper />
              <PhoenixLogo className="fixed bottom-4 left-4 z-50" />
              
              {/* Render page content */}
              {children}
            </div>
          </ZustandProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
