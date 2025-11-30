import { useCallback, useEffect, useRef } from 'react';
import { useEternalCovenant } from '../components/EternalCovenantProvider';

export const useAudioPlayback = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const initializeAudio = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/eternal-covenant/voice-message.mp3');
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      source.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      // Initial volume set to 0 for fade-in
      gainNodeRef.current.gain.value = 0;
    }
  }, []);

  const fadeAudio = useCallback((fadeIn: boolean) => {
    if (!gainNodeRef.current) return;

    const fadeTime = 2.0; // 2 seconds fade
    const gainNode = gainNodeRef.current;
    const currentTime = audioContextRef.current?.currentTime || 0;
    
    gainNode.gain.cancelScheduledValues(currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
    gainNode.gain.linearRampToValueAtTime(
      fadeIn ? 1.0 : 0.0,
      currentTime + fadeTime
    );
  }, []);

  const playAudio = useCallback(async () => {
    await initializeAudio();
    if (!audioRef.current || !audioContextRef.current) return;

    try {
      await audioContextRef.current.resume();
      await audioRef.current.play();
      fadeAudio(true);

      // Add whispered message after main audio
      audioRef.current.onended = () => {
        const whisperAudio = new Audio('/eternal-covenant/whisper-message.mp3');
        whisperAudio.volume = 0.3; // Quieter for whisper effect
        whisperAudio.play();
      };
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  }, [initializeAudio, fadeAudio]);

  const pauseAudio = useCallback(() => {
    if (!audioRef.current) return;
    
    fadeAudio(false);
    setTimeout(() => {
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    }, 2000); // Wait for fade-out
  }, [fadeAudio]);

  const updateAudioState = useCallback(() => {
    if (!audioRef.current) return;
    
    return {
      isPlaying: !audioRef.current.paused,
      currentTime: audioRef.current.currentTime,
      duration: audioRef.current.duration,
      isLoaded: audioRef.current.readyState === 4
    };
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioRef.current) {
        audioRef.current.remove();
      }
    };
  }, []);

  return {
    playAudio,
    pauseAudio,
    updateAudioState
  };
};