import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PhoenixAvatar from '../../components/PhoenixAvatar';
import { Flame } from 'lucide-react';
import '@testing-library/jest-dom';

// Mock Lucide React component
vi.mock('lucide-react', () => ({
  Flame: vi.fn(() => <div data-testid="flame-icon" />)
}));

describe('PhoenixAvatar', () => {
  it('renders with default props', () => {
    render(<PhoenixAvatar status="awake" />);
    expect(screen.getByText('Phoenix Marie')).toBeInTheDocument();
    expect(screen.getByText('Awake')).toBeInTheDocument();
    expect(screen.getByTestId('flame-icon')).toBeInTheDocument();
  });

  it('renders different sizes', () => {
    const { rerender } = render(<PhoenixAvatar status="awake" size="sm" />);
    const avatarContainer = screen.getByTestId('flame-icon').parentElement;
    expect(avatarContainer).toHaveClass('w-16 h-16');

    rerender(<PhoenixAvatar status="awake" size="md" />);
    expect(avatarContainer).toHaveClass('w-32 h-32');

    rerender(<PhoenixAvatar status="awake" size="lg" />);
    expect(avatarContainer).toHaveClass('w-48 h-48');
  });

  it('shows correct status colors and animations', () => {
    const { rerender } = render(<PhoenixAvatar status="awake" />);
    expect(screen.getByText('Awake')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-green-500', 'animate-pulse');
    expect(screen.getByTestId('flame-icon')).toHaveClass('animate-pulse');

    rerender(<PhoenixAvatar status="dreaming" />);
    expect(screen.getByText('Dreaming')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-[#FFD23F]');
    expect(screen.getByTestId('flame-icon')).toHaveClass('opacity-80');

    rerender(<PhoenixAvatar status="offline" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-zinc-600');
    expect(screen.getByTestId('flame-icon')).toHaveClass('opacity-50');
  });

  it('applies breathing animation when mounted and active', () => {
    const originalNow = vi.getRealSystemTime();
    vi.useFakeTimers({now: originalNow});
    const { container } = render(<PhoenixAvatar status="awake" />);
    
    // Initially, no animation
    const avatarCircle = container.querySelector('.rounded-full');
    expect(avatarCircle).not.toHaveClass('animate-[breathe_4s_ease-in-out_infinite]');
    
    // After mount effect
    vi.runAllTimers();
    expect(avatarCircle).toHaveClass('animate-[breathe_4s_ease-in-out_infinite]');
    
    vi.useRealTimers();
  });
});