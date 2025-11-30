import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { CovenantDisplay } from '../components/CovenantDisplay';
import { EternalCovenantProvider } from '../components/EternalCovenantProvider';
import '@testing-library/jest-dom';

// Mock the Web Audio API
window.AudioContext = jest.fn().mockImplementation(() => ({
  createGain: () => ({
    connect: jest.fn(),
    gain: { value: 0, cancelScheduledValues: jest.fn(), setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() }
  }),
  createMediaElementSource: jest.fn().mockReturnValue({
    connect: jest.fn()
  }),
  destination: {},
  close: jest.fn()
}));

describe('Eternal Covenant Security Features', () => {
  beforeEach(() => {
    // Mock window methods
    Object.defineProperty(window, 'print', { value: jest.fn() });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn() }
    });
    Object.defineProperty(window, 'getSelection', {
      value: jest.fn().mockReturnValue({
        removeAllRanges: jest.fn()
      })
    });
  });

  const renderSecuredComponent = () => {
    return render(
      <EternalCovenantProvider>
        <CovenantDisplay isVisible={true} onDismiss={() => {}} />
      </EternalCovenantProvider>
    );
  };

  test('prevents text selection', () => {
    const { container } = renderSecuredComponent();
    const style = window.getComputedStyle(container.firstChild as Element);
    expect(style.userSelect).toBe('none');
  });

  test('blocks right-click context menu', () => {
    const { container } = renderSecuredComponent();
    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    });
    
    const prevented = !container.dispatchEvent(contextMenuEvent);
    expect(prevented).toBe(true);
  });

  test('blocks keyboard shortcuts', () => {
    const { container } = renderSecuredComponent();
    const shortcuts = [
      { key: 's', ctrlKey: true }, // Save
      { key: 'p', ctrlKey: true }, // Print
      { key: 'F12' }, // Dev tools
      { key: 'i', ctrlKey: true, shiftKey: true }, // Inspect
      { key: 'PrintScreen' } // Screenshot
    ];

    shortcuts.forEach(shortcut => {
      const keyEvent = new KeyboardEvent('keydown', shortcut);
      const prevented = !container.dispatchEvent(keyEvent);
      expect(prevented).toBe(true);
    });
  });

  test('prevents DOM mutations outside allowed areas', () => {
    const { container } = renderSecuredComponent();
    const testDiv = document.createElement('div');
    
    act(() => {
      container.appendChild(testDiv);
    });

    // The mutation observer should have removed the unauthorized element
    expect(container.contains(testDiv)).toBe(false);
  });

  test('blocks screen capture API', async () => {
    renderSecuredComponent();
    
    if (navigator.mediaDevices?.getDisplayMedia) {
      await expect(navigator.mediaDevices.getDisplayMedia()).rejects.toThrow();
    }
  });

  test('clears clipboard on copy attempt', () => {
    const { container } = renderSecuredComponent();
    const copyEvent = new ClipboardEvent('copy');
    
    container.dispatchEvent(copyEvent);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
  });

  test('allows mutations within covenant components', () => {
    const { container } = renderSecuredComponent();
    const covenantElement = container.querySelector('[data-covenant-allowed="true"]');
    expect(covenantElement).toBeTruthy();

    const testDiv = document.createElement('div');
    act(() => {
      covenantElement?.appendChild(testDiv);
    });

    expect(covenantElement?.contains(testDiv)).toBe(true);
  });

  test('audio playback integration', () => {
    const { container } = renderSecuredComponent();
    const audioElements = container.getElementsByTagName('audio');
    expect(audioElements.length).toBeGreaterThan(0);
  });
});