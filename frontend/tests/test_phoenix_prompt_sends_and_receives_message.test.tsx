/**
 * PhoenixPrompt Component Test
 * 
 * Tests that the PhoenixPrompt component correctly:
 * - Sends messages to the OrchestratorAgent
 * - Displays responses from the OrchestratorAgent
 * - Handles loading states and errors
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { PhoenixPrompt } from '../../frontend/src/components/PhoenixPrompt';

// Mock Tauri's invoke function
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Import the mocked function to use in tests
import { invoke } from '@tauri-apps/api/tauri';

describe('PhoenixPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends message to OrchestratorAgent and displays response', async () => {
    // Mock the successful response from OrchestratorAgent
    vi.mocked(invoke).mockResolvedValue({
      success: true,
      response: "I am Phoenix, your orchestrator assistant."
    });
    
    // Render component
    render(<PhoenixPrompt />);
    
    // Find input field and enter text
    const input = screen.getByPlaceholderText(/type your message/i);
    await userEvent.type(input, 'Who are you?');
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(submitButton);
    
    // Verify invoke was called with the correct message
    expect(invoke).toHaveBeenCalledWith('invoke_orchestrator_task', {
      goal: 'Who are you?'
    });
    
    // Verify the response is displayed in the UI
    await waitFor(() => {
      expect(screen.getByText('I am Phoenix, your orchestrator assistant.')).toBeDefined();
    });
  });

  it('displays loading state while waiting for response', async () => {
    // Setup a delayed response to test loading state
    vi.mocked(invoke).mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            response: "Response after delay"
          });
        }, 100);
      });
    });
    
    // Render the component
    render(<PhoenixPrompt />);
    
    // Submit a message
    const input = screen.getByPlaceholderText(/type your message/i);
    await userEvent.type(input, 'Test message');
    const submitButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(submitButton);
    
    // Verify loading indicator appears
    expect(screen.getByText('is thinking...')).toBeDefined();
    
    // Verify response eventually appears
    await waitFor(() => {
      expect(screen.getByText('Response after delay')).toBeDefined();
    });
  });

  it('handles errors from OrchestratorAgent', async () => {
    // Mock an error response
    vi.mocked(invoke).mockRejectedValue(new Error('Communication error'));
    
    // Render component
    render(<PhoenixPrompt />);
    
    // Submit a message
    const input = screen.getByPlaceholderText(/type your message/i);
    await userEvent.type(input, 'Error test');
    const submitButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(submitButton);
    
    // Verify error is displayed
    await waitFor(() => {
      expect(screen.getByText('ERROR')).toBeDefined();
      expect(screen.getAllByText(/error/i)[0]).toBeDefined();
    });
  });

  it('clears input after sending message', async () => {
    vi.mocked(invoke).mockResolvedValue({
      success: true,
      response: "Response received"
    });
    
    render(<PhoenixPrompt />);
    
    // Type a message
    const input = screen.getByPlaceholderText(/type your message/i);
    await userEvent.type(input, 'Test message');
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(submitButton);
    
    // Check that input was cleared
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('disables input and button while processing', async () => {
    // Setup a delayed response
    vi.mocked(invoke).mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            response: "Response after delay"
          });
        }, 100);
      });
    });
    
    render(<PhoenixPrompt />);
    
    // Submit a message
    const input = screen.getByPlaceholderText(/type your message/i);
    await userEvent.type(input, 'Test message');
    const submitButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(submitButton);
    
    // Verify input and button are disabled during processing
    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
    
    // Wait for the response to complete
    await waitFor(() => {
      expect(screen.getByText('Response after delay')).toBeDefined();
    });
    
    // Verify input and button are re-enabled
    expect(input).not.toBeDisabled();
    expect(submitButton).not.toBeDisabled();
  });
});