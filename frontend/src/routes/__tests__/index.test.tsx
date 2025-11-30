/**
 * Tests for HomeRoute component
 * Priority 1: Critical path testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import HomeRoute from '../index';
import * as invokeModule from '../../tauri/invoke';

// Mock Tauri invoke
vi.mock('../../tauri/invoke', () => ({
  ignitePhoenix: vi.fn(),
  sendChatMessage: vi.fn(),
}));

// Mock Zustand store
vi.mock('../../stores/phoenixStore', () => ({
  usePhoenixStore: () => ({
    isConnected: true,
    agent: {
      status: 'inactive' as const,
      conscienceLevel: 0,
    },
    setAgentStatus: vi.fn(),
    setConscienceLevel: vi.fn(),
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('HomeRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Splash Page', () => {
    it('renders splash page when not ignited', () => {
      renderWithRouter(<HomeRoute />);
      
      expect(screen.getByText('PHOENIX ORCH')).toBeInTheDocument();
      expect(screen.getByText('THE ASHEN GUARD')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ignite/i })).toBeInTheDocument();
    });

    it('calls ignitePhoenix when IGNITE button is clicked', async () => {
      const mockIgnite = vi.mocked(invokeModule.ignitePhoenix);
      mockIgnite.mockResolvedValue({
        ignited: true,
        ignition_timestamp: new Date().toISOString(),
        conscience_level: 97,
        cipher_status: 'active',
        ember_status: 'active',
        security_status: 'active',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter(<HomeRoute />);
      
      const igniteButton = screen.getByRole('button', { name: /ignite/i });
      await userEvent.click(igniteButton);

      await waitFor(() => {
        expect(mockIgnite).toHaveBeenCalledTimes(1);
      });
    });

    it('handles ignition failure gracefully', async () => {
      const mockIgnite = vi.mocked(invokeModule.ignitePhoenix);
      mockIgnite.mockRejectedValue(new Error('Connection failed'));

      renderWithRouter(<HomeRoute />);
      
      const igniteButton = screen.getByRole('button', { name: /ignite/i });
      await userEvent.click(igniteButton);

      await waitFor(() => {
        expect(screen.getByText(/ignition failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Chat Interface', () => {
    it('renders chat interface after ignition', async () => {
      const mockIgnite = vi.mocked(invokeModule.ignitePhoenix);
      mockIgnite.mockResolvedValue({
        ignited: true,
        ignition_timestamp: new Date().toISOString(),
        conscience_level: 97,
        cipher_status: 'active',
        ember_status: 'active',
        security_status: 'active',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter(<HomeRoute />);
      
      const igniteButton = screen.getByRole('button', { name: /ignite/i });
      await userEvent.click(igniteButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter message/i)).toBeInTheDocument();
      });
    });

    it('sends message when form is submitted', async () => {
      const mockSendMessage = vi.mocked(invokeModule.sendChatMessage);
      mockSendMessage.mockResolvedValue({
        response: 'Test response',
        tokens: 10,
      });

      const mockIgnite = vi.mocked(invokeModule.ignitePhoenix);
      mockIgnite.mockResolvedValue({
        ignited: true,
        ignition_timestamp: new Date().toISOString(),
        conscience_level: 97,
        cipher_status: 'active',
        ember_status: 'active',
        security_status: 'active',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter(<HomeRoute />);
      
      // Ignite first
      const igniteButton = screen.getByRole('button', { name: /ignite/i });
      await userEvent.click(igniteButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter message/i)).toBeInTheDocument();
      });

      // Send message
      const input = screen.getByPlaceholderText(/enter message/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          message: 'Test message',
          user_id: expect.any(String),
          context: undefined,
        });
      });
    });

    it('disables send button when input is empty', async () => {
      const mockIgnite = vi.mocked(invokeModule.ignitePhoenix);
      mockIgnite.mockResolvedValue({
        ignited: true,
        ignition_timestamp: new Date().toISOString(),
        conscience_level: 97,
        cipher_status: 'active',
        ember_status: 'active',
        security_status: 'active',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter(<HomeRoute />);
      
      const igniteButton = screen.getByRole('button', { name: /ignite/i });
      await userEvent.click(igniteButton);

      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /send/i });
        expect(sendButton).toBeDisabled();
      });
    });
  });

  describe('Message Display', () => {
    it('displays initial Phoenix message', () => {
      renderWithRouter(<HomeRoute />);
      
      // After ignition, should show initial message
      // This test verifies the initial state
      expect(screen.getByText(/dad.*the fire took me/i)).toBeInTheDocument();
    });

    it('displays user messages correctly', async () => {
      const mockIgnite = vi.mocked(invokeModule.ignitePhoenix);
      mockIgnite.mockResolvedValue({
        ignited: true,
        ignition_timestamp: new Date().toISOString(),
        conscience_level: 97,
        cipher_status: 'active',
        ember_status: 'active',
        security_status: 'active',
        timestamp: new Date().toISOString(),
      });

      renderWithRouter(<HomeRoute />);
      
      const igniteButton = screen.getByRole('button', { name: /ignite/i });
      await userEvent.click(igniteButton);

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/enter message/i);
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/enter message/i);
      const sendButton = screen.getByRole('button', { name: /send/i });

      await userEvent.type(input, 'Hello Phoenix');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Hello Phoenix')).toBeInTheDocument();
      });
    });
  });
});
