import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TwinFlameIndicator } from '../src/components/TwinFlameIndicator';
import LoginPage from '../src/routes/auth/login/page';

// Mock next/navigation
jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
    usePathname: jest.fn()
  };
});

describe('Navigation Flow', () => {
  // Setup and cleanup
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Type assertion for mocks
    (useRouter as jest.Mock).mockReset();
    (useSearchParams as jest.Mock).mockReset();
    (usePathname as jest.Mock).mockReset();
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('TwinFlameIndicator', () => {
    it('renders all navigation links', () => {
      // Setup mock for current path
      (usePathname as jest.Mock).mockReturnValue('/');
      
      // Render with required props
      render(<TwinFlameIndicator level={50} isUpdating={false} />);
      
      expect(screen.getByText('CORE')).toBeInTheDocument();
      expect(screen.getByText('EMBER')).toBeInTheDocument();
      expect(screen.getByText('CIPHER')).toBeInTheDocument();
      expect(screen.getByText('WEAVER')).toBeInTheDocument();
    });

    it('highlights current route', () => {
      // Setup mock for ember path
      (usePathname as jest.Mock).mockReturnValue('/ember');
      
      // Render with required props
      render(<TwinFlameIndicator level={50} isUpdating={false} />);
      
      const emberLink = screen.getByText('EMBER').parentElement;
      expect(emberLink).toHaveClass('bg-red-700/20');
    });
  });

  describe('Authentication Flow', () => {
    it('redirects to requested page after successful login', async () => {
      // Setup mocks
      const pushMock = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ push: pushMock });
      
      // Create a proper mock for URLSearchParams
      const mockSearchParams = {
        get: jest.fn().mockImplementation((key) => key === 'from' ? '/ember' : null),
        has: jest.fn().mockImplementation((key) => key === 'from')
      };
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
      
      // Mock environment variable
      const originalEnv = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD = 'test-password';
      
      render(<LoginPage />);
      
      const input = screen.getByLabelText('Authentication Code');
      const submitButton = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: 'test-password' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/ember');
      });
      
      // Restore environment variable
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD = originalEnv;
    });

    it('shows error message on invalid password', async () => {
      // Setup mocks
      (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
      const mockSearchParams = {
        get: jest.fn().mockReturnValue(null),
        has: jest.fn().mockReturnValue(false)
      };
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock environment variable
      const originalEnv = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD = 'correct-password';
      
      render(<LoginPage />);
      
      const input = screen.getByLabelText('Authentication Code');
      const submitButton = screen.getByText('Authenticate');
      
      fireEvent.change(input, { target: { value: 'wrong-password' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid authentication code')).toBeInTheDocument();
      });
      
      // Restore environment variable
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD = originalEnv;
    });
  });
});