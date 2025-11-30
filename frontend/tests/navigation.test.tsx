import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TwinFlameIndicator } from '@/components/TwinFlameIndicator';
import LoginPage from '@/auth/login/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn()
}));

const usePathname = jest.fn();

describe('Navigation Flow', () => {
  beforeEach(() => {
    // Reset mocks
    (useRouter as jest.Mock).mockReset();
    (useSearchParams as jest.Mock).mockReset();
    (usePathname as jest.Mock).mockReset();
  });

  describe('TwinFlameIndicator', () => {
    it('renders all navigation links', () => {
      (usePathname as jest.Mock).mockReturnValue('/');
      
      render(<TwinFlameIndicator level={50} />);
      
      expect(screen.getByText('CORE')).toBeInTheDocument();
      expect(screen.getByText('EMBER')).toBeInTheDocument();
      expect(screen.getByText('CIPHER')).toBeInTheDocument();
      expect(screen.getByText('WEAVER')).toBeInTheDocument();
    });

    it('highlights current route', () => {
      (usePathname as jest.Mock).mockReturnValue('/ember');
      
      render(<TwinFlameIndicator level={50} />);
      
      const emberLink = screen.getByText('EMBER').parentElement;
      expect(emberLink).toHaveClass('bg-red-700/20');
    });
  });

  describe('Authentication Flow', () => {
    it('redirects to requested page after successful login', async () => {
      const pushMock = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
      (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('?from=/ember'));

      process.env.NEXT_PUBLIC_ADMIN_PASSWORD = 'test-password';
      
      render(<LoginPage />);
      
      const input = screen.getByLabelText('Authentication Code');
      const submitButton = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: 'test-password' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/ember');
      });
    });

    it('shows error message on invalid password', async () => {
      (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
      (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

      process.env.NEXT_PUBLIC_ADMIN_PASSWORD = 'correct-password';
      
      render(<LoginPage />);
      
      const input = screen.getByLabelText('Authentication Code');
      const submitButton = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: 'wrong-password' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid authentication code')).toBeInTheDocument();
      });
    });
  });
});