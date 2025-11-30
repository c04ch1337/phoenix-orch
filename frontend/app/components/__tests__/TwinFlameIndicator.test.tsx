import React from 'react';
import { render, screen } from '@testing-library/react';
import { TwinFlameIndicator } from '../TwinFlameIndicator';
import '@testing-library/jest-dom';

// Mock the WebSocket hook
jest.mock('../../lib/socket', () => ({
  useWebSocket: (channel: string, callback: Function) => {
    // Mock implementation
  },
}));

describe('TwinFlameIndicator', () => {
  const defaultProps = {
    primaryTeam: 'ember' as const,
    emberConscienceLevel: 3,
    cipherConscienceLevel: 4,
    isHandoverReady: false,
  };

  it('renders with correct team labels', () => {
    render(<TwinFlameIndicator {...defaultProps} />);
    
    expect(screen.getByText('PRIMARY: Ember Unit')).toBeInTheDocument();
    expect(screen.getByText('SHADOW: Cipher Guard')).toBeInTheDocument();
  });

  it('displays correct number of filled dots for conscience levels', () => {
    render(<TwinFlameIndicator {...defaultProps} />);
    
    const emberDots = screen.getByTestId('ember-conscience-dots').querySelectorAll('[role="presentation"]');
    const cipherDots = screen.getByTestId('cipher-conscience-dots').querySelectorAll('[role="presentation"]');
    
    expect(emberDots).toHaveLength(5);
    expect(cipherDots).toHaveLength(5);
    
    // Check filled dots count matches conscience levels
    const filledEmberDots = Array.from(emberDots).filter(dot => 
      window.getComputedStyle(dot).background.includes('rgb(0, 255, 0)')
    );
    const filledCipherDots = Array.from(cipherDots).filter(dot => 
      window.getComputedStyle(dot).background.includes('rgb(0, 255, 0)')
    );
    
    expect(filledEmberDots).toHaveLength(defaultProps.emberConscienceLevel);
    expect(filledCipherDots).toHaveLength(defaultProps.cipherConscienceLevel);
  });

  it('shows ready tag when handover is ready', () => {
    render(<TwinFlameIndicator {...defaultProps} isHandoverReady={true} />);
    
    expect(screen.getByTestId('handover-ready-tag')).toBeInTheDocument();
    expect(screen.getByText('(ready)')).toBeInTheDocument();
  });

  it('does not show ready tag when handover is not ready', () => {
    render(<TwinFlameIndicator {...defaultProps} />);
    
    expect(screen.queryByTestId('handover-ready-tag')).not.toBeInTheDocument();
    expect(screen.queryByText('(ready)')).not.toBeInTheDocument();
  });

  it('applies correct styles when cipher is primary team', () => {
    render(<TwinFlameIndicator {...defaultProps} primaryTeam="cipher" />);
    
    const emberRow = screen.getByText('PRIMARY: Ember Unit').closest('div');
    const cipherRow = screen.getByText('SHADOW: Cipher Guard').closest('div');
    
    expect(emberRow).toHaveStyle({ opacity: '0.8' });
    expect(cipherRow).toHaveStyle({ opacity: '1' });
  });

  it('has proper accessibility attributes', () => {
    render(<TwinFlameIndicator {...defaultProps} />);
    
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Twin Flame Status');
    expect(screen.getByTestId('ember-conscience-dots'))
      .toHaveAttribute('aria-label', 'Ember conscience level: 3');
    expect(screen.getByTestId('cipher-conscience-dots'))
      .toHaveAttribute('aria-label', 'Cipher conscience level: 4');
  });
});