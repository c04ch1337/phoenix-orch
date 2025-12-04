import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestratorConsole } from '../OrchestratorConsole';

describe('OrchestratorConsole Component', () => {
  const mockMessages = [
    { id: '1', content: 'echo hello', type: 'command', timestamp: '2025-11-30T12:00:00Z' },
    { id: '2', content: 'Hello, user!', type: 'response', timestamp: '2025-11-30T12:00:01Z' },
    { id: '3', content: 'This action is not recommended', type: 'warning', timestamp: '2025-11-30T12:00:02Z' },
    { id: '4', content: 'Reading file contents...', type: 'tool-output', timestamp: '2025-11-30T12:00:03Z' },
  ];

  const mockConscienceWarnings = [
    'Potential security risk detected',
    'Command may have unintended side effects'
  ];

  const mockSendCommand = vi.fn();
  const mockToggleCommandOverride = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with all props', () => {
    render(
      <OrchestratorConsole
        messages={mockMessages}
        isThinking={false}
        conscienceGateActive={true}
        conscienceWarnings={mockConscienceWarnings}
        commandOverride={{ active: false, prefix: 'Dad override:' }}
        onSendCommand={mockSendCommand}
        onToggleCommandOverride={mockToggleCommandOverride}
      />
    );

    // Verify component renders with data-testid
    expect(screen.getByTestId('orchestrator-console')).toBeInTheDocument();

    // Check for conscience gate message
    expect(screen.getByText('Conscience Gate Active')).toBeInTheDocument();

    // Check for warnings
    expect(screen.getByText('Potential security risk detected')).toBeInTheDocument();
    expect(screen.getByText('Command may have unintended side effects')).toBeInTheDocument();

    // Check messages are displayed
    expect(screen.getByText('echo hello')).toBeInTheDocument();
    expect(screen.getByText('Hello, user!')).toBeInTheDocument();
    expect(screen.getByText('This action is not recommended')).toBeInTheDocument();
    expect(screen.getByText('Reading file contents...')).toBeInTheDocument();
  });

  it('shows thinking indicator when isThinking is true', () => {
    render(
      <OrchestratorConsole
        messages={[]}
        isThinking={true}
        onSendCommand={mockSendCommand}
      />
    );

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('applies ember glow class when streaming response', () => {
    render(
      <OrchestratorConsole
        messages={mockMessages}
        isThinking={false}
        isStreamingResponse={true}
        onSendCommand={mockSendCommand}
      />
    );

    // Check if response panel has the ember-glow class
    expect(screen.getByTestId('response-panel')).toHaveClass('ember-glow');
  });

  it('sends command when form is submitted', async () => {
    render(
      <OrchestratorConsole
        messages={[]}
        isThinking={false}
        onSendCommand={mockSendCommand}
      />
    );

    // Type in a command
    const input = screen.getByPlaceholderText('Enter command...');
    await userEvent.type(input, 'test command');

    // Submit the form
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.submit(input.closest('form')!);

    // Check if the command was sent
    expect(mockSendCommand).toHaveBeenCalledWith('test command');
  });

  it('prefixes commands with override when command override is active', async () => {
    render(
      <OrchestratorConsole
        messages={[]}
        isThinking={false}
        commandOverride={{ active: true, prefix: 'Dad override:' }}
        onSendCommand={mockSendCommand}
        onToggleCommandOverride={mockToggleCommandOverride}
      />
    );

    // Type in a command
    const input = screen.getByPlaceholderText('Enter command...');
    await userEvent.type(input, 'test command');

    // Submit the form
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.submit(input.closest('form')!);

    // Check if the command was sent with the prefix
    expect(mockSendCommand).toHaveBeenCalledWith('Dad override: test command');
  });

  it('toggles command override when button is clicked', async () => {
    render(
      <OrchestratorConsole
        messages={[]}
        isThinking={false}
        commandOverride={{ active: false, prefix: 'Dad override:' }}
        onSendCommand={mockSendCommand}
        onToggleCommandOverride={mockToggleCommandOverride}
      />
    );

    // Find and click the override button
    const overrideButton = screen.getByRole('button', { name: /HITM override/i });
    await userEvent.click(overrideButton);

    // Check if the toggle function was called
    expect(mockToggleCommandOverride).toHaveBeenCalled();
  });
});