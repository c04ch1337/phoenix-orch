import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);
import userEvent from '@testing-library/user-event';
import ChatWindow from '../features/chat/components/ChatWindow';
import { performanceRunner } from './performance/setup';
import { memoryLeakDetector } from './utils/memory-leak';
import { withResilience } from './utils/retry';

describe('ChatWindow', () => {
  const mockMessages = [
    {
      id: '1',
      type: 'user' as const,
      content: 'Hello',
      timestamp: Date.now() - 1000
    },
    {
      id: '2',
      type: 'phoenix' as const,
      content: 'Hi there!',
      timestamp: Date.now()
    }
  ];

  const mockOnSendMessage = jest.fn();

  // Basic Rendering and Functionality Tests
  describe('Basic Functionality', () => {
    it('renders messages correctly', () => {
      render(
        <ChatWindow
          messages={mockMessages}
          onSendMessage={mockOnSendMessage}
          isTyping={false}
        />
      );

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('handles message submission', async () => {
      const user = userEvent.setup();
      render(
        <ChatWindow
          messages={mockMessages}
          onSendMessage={mockOnSendMessage}
          isTyping={false}
        />
      );

      const input = screen.getByPlaceholderText(/Command The Ashen Guard/i);
      await user.type(input, 'New message');
      await user.click(screen.getByRole('button', { name: '' }));

      expect(mockOnSendMessage).toHaveBeenCalledWith('New message');
      expect(input).toHaveValue('');
    });

    it('shows typing indicator when isTyping is true', () => {
      render(
        <ChatWindow
          messages={mockMessages}
          onSendMessage={mockOnSendMessage}
          isTyping={true}
        />
      );

      const typingIndicator = screen.getByText('🔥 PHOENIX');
      expect(typingIndicator).toBeInTheDocument();
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('renders efficiently with many messages', async () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        type: i % 2 === 0 ? 'user' : 'phoenix',
        content: `Message ${i}`,
        timestamp: Date.now() - (1000 * i)
      })) as typeof mockMessages;

      const metrics = await performanceRunner.measurePerformance({
        name: 'ChatWindow Large Message List',
        component: (
          <ChatWindow
            messages={manyMessages}
            onSendMessage={mockOnSendMessage}
            isTyping={false}
          />
        ),
        expectations: {
          renderTime: 100, // 100ms threshold
          memoryUsage: 10 * 1024 * 1024 // 10MB threshold
        }
      });

      expect(metrics.renderTime).toBeLessThan(100);
      expect(metrics.memoryUsage).toBeLessThan(10 * 1024 * 1024);
    });
  });

  // Memory Leak Tests
  describe('Memory Management', () => {
    it('does not leak memory during message updates', async () => {
      const testResult = await memoryLeakDetector.detectMemoryLeak(
        <ChatWindow
          messages={mockMessages}
          onSendMessage={mockOnSendMessage}
          isTyping={false}
        />,
        async ({ unmount }) => {
          // Simulate message updates
          for (let i = 0; i < 10; i++) {
            render(
              <ChatWindow
                messages={[...mockMessages, {
                  id: `new-${i}`,
                  type: 'user',
                  content: `New message ${i}`,
                  timestamp: Date.now()
                }]}
                onSendMessage={mockOnSendMessage}
                isTyping={false}
              />
            );
            await new Promise(resolve => setTimeout(resolve, 100));
            unmount();
          }
        }
      );

      expect(testResult.hasLeak).toBe(false);
      if (testResult.hasLeak) {
        console.error(memoryLeakDetector.generateMemoryReport(testResult));
      }
    });
  });

  // Resilient Integration Tests
  describe('Integration', () => {
    it('handles message sending with retry policy', async () => {
      const flakySendMessage = jest.fn().mockImplementation(async (message: string) => {
        if (Math.random() < 0.5) throw new Error('Network error');
        return { success: true };
      });

      const resilientSendMessage = (message: string) =>
        withResilience(
          () => flakySendMessage(message),
          { maxAttempts: 3, initialDelay: 100, backoffFactor: 2 }
        );

      render(
        <ChatWindow
          messages={mockMessages}
          onSendMessage={resilientSendMessage}
          isTyping={false}
        />
      );

      const input = screen.getByPlaceholderText(/Command The Ashen Guard/i);
      await userEvent.type(input, 'Test message');
      await userEvent.click(screen.getByRole('button', { name: '' }));

      await waitFor(() => {
        expect(flakySendMessage).toHaveBeenCalledWith('Test message');
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('meets accessibility standards', async () => {
      const { container } = render(
        <ChatWindow
          messages={mockMessages}
          onSendMessage={mockOnSendMessage}
          isTyping={false}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <ChatWindow
          messages={mockMessages}
          onSendMessage={mockOnSendMessage}
          isTyping={false}
        />
      );

      const input = screen.getByPlaceholderText(/Command The Ashen Guard/i);
      await user.tab();
      expect(input).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockOnSendMessage).not.toHaveBeenCalled(); // Empty input

      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');
      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });
  });
});