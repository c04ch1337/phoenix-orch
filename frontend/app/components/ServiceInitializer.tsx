'use client';

import { useEffect, useCallback, useState } from 'react';
// WebSocket removed - using SSE only
import { telemetry } from '@/services/telemetry';
import { agent } from '@/services/agent';
import { voice } from '@/services/voice';

interface ServiceInitializerProps {
  onConnectionChange?: (connected: boolean) => void;
  onVoiceStatusChange?: (enabled: boolean, listening: boolean) => void;
}

export default function ServiceInitializer({
  onConnectionChange,
  onVoiceStatusChange
}: ServiceInitializerProps) {
  // Track voice enabled state locally since the service doesn't provide a way to check
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Handle voice toggle from global event
  const handleToggleVoice = useCallback(() => {
    if (voiceEnabled) {
      voice.disable();
      setVoiceEnabled(false);
      if (onVoiceStatusChange) {
        onVoiceStatusChange(false, isListening);
      }
    } else {
      voice.enable();
      setVoiceEnabled(true);
      if (onVoiceStatusChange) {
        onVoiceStatusChange(true, isListening);
      }
    }
  }, [voiceEnabled, isListening, onVoiceStatusChange]);

  // Handle listening toggle from global event
  const handleToggleListening = useCallback(() => {
    if (!voiceEnabled) {
      voice.enable();
      setVoiceEnabled(true);
    }
    
    voice.toggleListening();
    // The actual listening state will be updated through the voice.onStatusChange callback
  }, [voiceEnabled]);

  useEffect(() => {
    // Initialize SSE connections only
    console.log('🔥 Initializing SSE connections...');
    telemetry.connect();
    
    // Check backend connection via health endpoint
    const checkConnection = async () => {
      try {
        const response = await fetch('http://localhost:5001/health');
        const connected = response.ok;
        if (onConnectionChange) {
          onConnectionChange(connected);
        }
      } catch {
        if (onConnectionChange) {
          onConnectionChange(false);
        }
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    // Subscribe to voice status changes
    const voiceUnsubscribe = voice.onStatusChange((status) => {
      setIsListening(status.listening);
      if (onVoiceStatusChange) {
        onVoiceStatusChange(voiceEnabled, status.listening);
      }
    });

    // Add event listeners for voice controls
    window.addEventListener('toggle-voice', handleToggleVoice);
    window.addEventListener('toggle-listening', handleToggleListening);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      voiceUnsubscribe();
      telemetry.disconnect();
      window.removeEventListener('toggle-voice', handleToggleVoice);
      window.removeEventListener('toggle-listening', handleToggleListening);
    };
  }, [onConnectionChange, onVoiceStatusChange, voiceEnabled, handleToggleVoice, handleToggleListening]);

  // This component does not render anything
  return null;
}