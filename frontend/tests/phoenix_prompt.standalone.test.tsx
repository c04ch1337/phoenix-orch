/**
 * PhoenixPrompt Component Test - Standalone version
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
import { PhoenixPrompt } from '../src/components/PhoenixPrompt';

// Mock Tauri's invoke function before importing it
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Import the mocked function to use in tests
import { invoke } from '@tauri-apps/api/tauri';

// Basic DOM matchers (not relying on jest-dom)
const isInDocument = (element: HTMLElement | null): boolean => {
  return element !== null && document.contains(element);
};

const hasValue = (element: HTMLInputElement | null, value: string): boolean => {
  return element !== null && element.value === value;
};

const isDisabled = (element: HTMLElement | null): boolean => {
  return element !== null && element.hasAttribute('disabled');
};

describe('PhoenixPrompt', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = ''; // Clear previous renders
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
    const submitButton = screen.getByRole('button', { name: '' });
    await userEvent.click(submitButton);
    
    // Verify invoke was called with the correct message
    expect(invoke).toHaveBeenCalledWith('invoke_orchestrator_task', {
      goal: 'Who are you?'
    });
    
    // Verify the response is displayed in the UI
    await waitFor(() => {
      const element = screen.getByText('I am Phoenix, your orchestrator assistant.');
      expect(element).not.toBeNull();
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
    const submitButton = screen.getByRole('button', { name: '' });
    await userEvent.click(submitButton);
    
    // Verify loading indicator appears
    const thinkingText = screen.getByText('is thinking...');
    expect(thinkingText).not.toBeNull();
    
    // Verify response eventually appears
    await waitFor(() => {
      const responseElement = screen.getByText('Response after delay');
      expect(responseElement).not.toBeNull();
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
    const submitButton = screen.getByRole('button', { name: '' });
    await userEvent.click(submitButton);
    
    // Verify error is displayed
    await waitFor(() => {
      const errorLabel = screen.getByText('ERROR');
      expect(errorLabel).not.toBeNull();
      const errorElements = screen.getAllByText(/error/i);
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });

  it('clears input after sending message', async () => {
    vi.mocked(invoke).mockResolvedValue({
      success: true,
      response: "Response received"
    });
    
    render(<PhoenixPrompt />);
    
    // Type a message
    const input = screen.getByPlaceholderText(/type your message/i) as HTMLInputElement;
    await userEvent.type(input, 'Test message');
    
    // Submit the form
    const submitButton = screen.getByRole('button', { name: '' });
    await userEvent.click(submitButton);
    
    // Check that input was cleared
    await waitFor(() => {
      expect(input.value).toBe('');
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
    const input = screen.getByPlaceholderText(/type your message/i) as HTMLInputElement;
    await userEvent.type(input, 'Test message');
    const submitButton = screen.getByRole('button', { name: '' });
    await userEvent.click(submitButton);
    
    // Verify input and button are disabled during processing
    expect(input.hasAttribute('disabled')).toBe(true);
    expect(submitButton.hasAttribute('disabled')).toBe(true);
    
    // Wait for the response to complete
    await waitFor(() => {
      const responseElement = screen.getByText('Response after delay');
      expect(responseElement).not.toBeNull();
    });
    
    // Verify input and button are re-enabled
    expect(input.hasAttribute('disabled')).toBe(false);
    expect(submitButton.hasAttribute('disabled')).toBe(false);
  });
});