'use client';

import React, { useState } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Flame, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { PhoenixLogo } from "@app/components/PhoenixLogo";
import { PhoenixContextPanel } from "../features/system";
import { ClientInitialization } from "@app/components/ClientInitialization";
import { TwinFlameWrapper } from "@app/components/TwinFlameWrapper";
import MatrixRain from "@app/components/MatrixRain";
import "@app/globals.css";

// Import services (client-side only)
import dynamic from 'next/dynamic';

// Dynamically import services to avoid SSR issues
const ServiceInitializer = dynamic(
  () => import('./components/ServiceInitializer'),
  { ssr: false }
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Phoenix Orchestrator",
  description: "The Ashen Guard - Eternal Vigilance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // App-wide state can be defined here and passed down via context if needed
  const [isConnected, setIsConnected] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-phoenix-void text-white font-rajdhani h-screen w-screen overflow-hidden`}
      >
        {/* Phoenix background effect */}
        <div className="fixed inset-0 z-0">
          <MatrixRain intensity={0.6} speed={1.2} />
        </div>
        
        {/* Client-side initialization and services */}
        <ClientInitialization />
        <ServiceInitializer
          onConnectionChange={setIsConnected}
          onVoiceStatusChange={(enabled, listening) => {
            setVoiceEnabled(enabled);
            setIsListening(listening);
          }}
        />
        
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
          </div>
        </header>
        
        {/* Main content wrapper */}
        <div className="relative z-10 flex-1 flex h-[calc(100vh-64px)]">
          <TwinFlameWrapper />
          <PhoenixLogo className="fixed bottom-4 left-4 z-50" />
          
          {/* Render page content */}
          {children}
        </div>
      </body>
    </html>
  );
}
