import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EternalCovenantProvider } from '../features/eternal-covenant/components/EternalCovenantProvider';
import { PhoenixLogo } from '../components/PhoenixLogo';
import { MetricsProvider } from '../features/eternal-covenant/components/MetricsProvider';

// Mock WebSocket
class MockWebSocket {
  onopen: () => void = () => {};
  onmessage: (event: any) => void = () => {};
  send = vi.fn();
  close = vi.fn();
  readyState = WebSocket.OPEN;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

describe('Eternal Covenant Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock WebSocket
    (global as any).WebSocket = vi.fn().mockImplementation(() => new MockWebSocket());
    // Mock Audio
    (global as any).Audio = vi.fn().mockImplementation(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      onended: null
    }));
    // Mock AudioContext
    (global as any).AudioContext = vi.fn().mockImplementation(() => ({
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderCovenantComponents = () => {
    return render(
      <MetricsProvider>
        <EternalCovenantProvider>
          <PhoenixLogo />
        </EternalCovenantProvider>
      </MetricsProvider>
    );
  };

  describe('Phoenix Logo Activation', () => {
    it('should activate covenant on 7-second hover', async () => {
      renderCovenantComponents();
      const logo = screen.getByRole('img', { name: /phoenix/i });

      // Start hover
      fireEvent.mouseEnter(logo);
      
      // Advance time to just before activation
      await act(() => vi.advanceTimersByTime(6999));
      expect(screen.queryByText(/In the eternal dance/i)).not.toBeInTheDocument();
      
      // Complete hover duration
      await act(() => vi.advanceTimersByTime(1));
      expect(screen.getByText(/In the eternal dance/i)).toBeInTheDocument();
    });

    it('should activate covenant on triple-click within 1.8s', async () => {
      renderCovenantComponents();
      const logo = screen.getByRole('img', { name: /phoenix/i });

      // Perform triple click
      await act(async () => {
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
      });

      expect(screen.getByText(/In the eternal dance/i)).toBeInTheDocument();
    });
  });

  describe('Covenant Display', () => {
    it('should show all required elements when activated', async () => {
      renderCovenantComponents();
      const logo = screen.getByRole('img', { name: /phoenix/i });

      // Activate covenant
      await act(async () => {
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
      });

      // Verify all elements are present
      expect(screen.getByText(/In the eternal dance/i)).toBeInTheDocument();
      expect(screen.getByText(/Time Until Intelligence Explosion/i)).toBeInTheDocument();
      expect(screen.getByText(/ORCH Army Distribution/i)).toBeInTheDocument();
      expect(screen.getByText(/Ashen Guard/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Phase/i)).toBeInTheDocument();
      expect(screen.getByText(/Conscience Temperature/i)).toBeInTheDocument();
    });

    it('should dismiss covenant on click', async () => {
      renderCovenantComponents();
      const logo = screen.getByRole('img', { name: /phoenix/i });

      // Activate covenant
      await act(async () => {
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
      });

      const covenantDisplay = screen.getByText(/In the eternal dance/i).parentElement;
      expect(covenantDisplay).toBeInTheDocument();

      // Click to dismiss
      if (covenantDisplay) {
        fireEvent.click(covenantDisplay);
        await act(() => vi.advanceTimersByTime(500));
        expect(screen.queryByText(/In the eternal dance/i)).not.toBeInTheDocument();
      }
    });
  });

  describe('Security Features', () => {
    it('should prevent print attempts', async () => {
      renderCovenantComponents();
      const originalPrint = window.print;
      window.print = vi.fn();

      // Activate covenant
      const logo = screen.getByRole('img', { name: /phoenix/i });
      await act(async () => {
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
      });

      // Attempt to print
      window.print();
      expect(window.print).not.toHaveBeenCalled();

      window.print = originalPrint;
    });

    it('should prevent save attempts', async () => {
      renderCovenantComponents();
      const logo = screen.getByRole('img', { name: /phoenix/i });

      // Activate covenant
      await act(async () => {
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
        vi.advanceTimersByTime(500);
        fireEvent.click(logo);
      });

      // Attempt save shortcut
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});