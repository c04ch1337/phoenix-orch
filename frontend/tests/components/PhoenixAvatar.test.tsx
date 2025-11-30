import React from 'react';
import { render, screen } from '@testing-library/react';
import PhoenixAvatar from '../../components/PhoenixAvatar';

describe('PhoenixAvatar', () => {
  it('renders with default props', () => {
    render(<PhoenixAvatar status="awake" />);
    expect(screen.getByText('Phoenix Marie')).toBeInTheDocument();
    expect(screen.getByText('Awake')).toBeInTheDocument();
  });

  it('renders different sizes', () => {
    const { rerender } = render(<PhoenixAvatar status="awake" size="sm" />);
    expect(screen.getByText('🔥').parentElement?.parentElement).toHaveClass('w-16 h-16');

    rerender(<PhoenixAvatar status="awake" size="md" />);
    expect(screen.getByText('🔥').parentElement?.parentElement).toHaveClass('w-32 h-32');

    rerender(<PhoenixAvatar status="awake" size="lg" />);
    expect(screen.getByText('🔥').parentElement?.parentElement).toHaveClass('w-48 h-48');
  });

  it('shows correct status colors', () => {
    const { rerender } = render(<PhoenixAvatar status="awake" />);
    expect(screen.getByText('Awake')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-green-500');

    rerender(<PhoenixAvatar status="dreaming" />);
    expect(screen.getByText('Dreaming')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-[#FFD700]');

    rerender(<PhoenixAvatar status="offline" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-gray-500');
  });
});