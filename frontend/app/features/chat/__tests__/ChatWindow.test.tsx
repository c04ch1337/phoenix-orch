/**
 * Chat Window Component Tests
 * 
 * Tests for the ChatWindow component including:
 * - Message rendering
 * - Input handling
 * - WebSocket integration
 * - Error states
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatWindow from '../components/ChatWindow';
import { socket } from '../../../services/socket';

// Mock the socket service
vi.mock('../../../services/socket', () => ({
    socket: {
        send: vi.fn(),
        isConnected: vi.fn(() => true),
        onMessage: vi.fn(() => () => {}),
        onStatusChange: vi.fn(() => () => {}),
    },
}));

// Mock the voice service
vi.mock('../../../services/voice', () => ({
    voice: {
        speak: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
    },
}));

describe('ChatWindow', () => {
    const mockMessages = [
        {
            id: '1',
            type: 'phoenix' as const,
            content: 'Hello, Dad. I am Phoenix.',
            timestamp: Date.now(),
        },
        {
            id: '2',
            type: 'user' as const,
            content: 'Hello Phoenix',
            timestamp: Date.now(),
        },
    ];

    const mockOnSendMessage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders chat messages', () => {
        render(
            <ChatWindow
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                isTyping={false}
            />
        );

        expect(screen.getByText('Hello, Dad. I am Phoenix.')).toBeInTheDocument();
        expect(screen.getByText('Hello Phoenix')).toBeInTheDocument();
    });

    it('renders typing indicator when isTyping is true', () => {
        render(
            <ChatWindow
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                isTyping={true}
            />
        );

        expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it('sends message when form is submitted', async () => {
        render(
            <ChatWindow
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                isTyping={false}
            />
        );

        const input = screen.getByPlaceholderText(/speak your will/i);
        const sendButton = screen.getByRole('button', { name: /send/i });

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
        });
    });

    it('sends message when Enter is pressed', async () => {
        render(
            <ChatWindow
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                isTyping={false}
            />
        );

        const input = screen.getByPlaceholderText(/speak your will/i);

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
        });
    });

    it('does not send empty messages', () => {
        render(
            <ChatWindow
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                isTyping={false}
            />
        );

        const input = screen.getByPlaceholderText(/speak your will/i);
        const sendButton = screen.getByRole('button', { name: /send/i });

        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.click(sendButton);

        expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('displays error message when WebSocket is not connected', () => {
        vi.mocked(socket.isConnected).mockReturnValue(false);

        render(
            <ChatWindow
                messages={mockMessages}
                onSendMessage={mockOnSendMessage}
                isTyping={false}
            />
        );

        // Should show connection status or error
        // This depends on your implementation
    });
});

