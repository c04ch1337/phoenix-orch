import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHoverTimer } from '../features/eternal-covenant/hooks/useHoverTimer';
import { useTripleClick } from '../features/eternal-covenant/hooks/useTripleClick';
import { useAudioPlayback } from '../features/eternal-covenant/hooks/useAudioPlayback';
import { useSecurityMeasures } from '../features/eternal-covenant/hooks/useSecurityMeasures';

describe('Eternal Covenant Core Features', () => {
  describe('Phoenix Logo Interactions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should detect hover for 7+ seconds', () => {
      const { result } = renderHook(() => useHoverTimer());
      
      result.current.handleMouseEnter();
      vi.advanceTimersByTime(7000);
      
      expect(result.current.isHovering).toBe(true);
    });

    it('should detect triple click within 1.8s window', () => {
      const { result } = renderHook(() => useTripleClick());
      
      result.current.handleClick(); // First click
      vi.advanceTimersByTime(500);
      result.current.handleClick(); // Second click
      vi.advanceTimersByTime(500);
      result.current.handleClick(); // Third click
      
      expect(result.current.isTripleClicked).toBe(true);
    });
  });

  describe('Voice Integration', () => {
    beforeEach(() => {
      // Mock Web Audio API
      global.AudioContext = vi.fn().mockImplementation(() => ({
        createGain: vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
        }),
        createMediaElementSource: vi.fn().mockReturnValue({
          connect: vi.fn()
        }),
        destination: {},
        currentTime: 0
      }));

      global.Audio = vi.fn().mockImplementation(() => ({
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        currentTime: 0,
        duration: 10,
        readyState: 4,
        paused: false
      }));
    });

    it('should handle audio playback with fade effects', async () => {
      const { result } = renderHook(() => useAudioPlayback());
      
      await result.current.playAudio();
      const audioState = result.current.updateAudioState();
      
      expect(audioState.isPlaying).toBe(true);
      expect(audioState.isLoaded).toBe(true);
    });

    it('should cleanup audio on dismiss', async () => {
      const { result } = renderHook(() => useAudioPlayback());
      
      await result.current.playAudio();
      result.current.pauseAudio();
      const audioState = result.current.updateAudioState();
      
      expect(audioState.isPlaying).toBe(false);
      expect(audioState.currentTime).toBe(0);
    });
  });

  describe('Security Features', () => {
    beforeEach(() => {
      global.navigator.clipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      } as any;
    });

    it('should prevent screenshots and screen recording', () => {
      renderHook(() => useSecurityMeasures());
      
      const mockEvent = new KeyboardEvent('keyup', { key: 'PrintScreen' });
      document.dispatchEvent(mockEvent);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
    });

    it('should block save-as functionality', () => {
      renderHook(() => useSecurityMeasures());
      
      const mockEvent = new KeyboardEvent('keydown', { 
        key: 's', 
        ctrlKey: true 
      });
      document.dispatchEvent(mockEvent);
      
      expect(mockEvent.defaultPrevented).toBe(true);
    });

    it('should prevent print dialog', () => {
      const originalPrint = window.print;
      window.print = vi.fn();
      
      renderHook(() => useSecurityMeasures());
      window.print();
      
      expect(window.print).not.toHaveBeenCalled();
      window.print = originalPrint;
    });
  });
});