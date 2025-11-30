import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoenixConsole } from '../../src/components/PhoenixConsole';
import { axe } from 'jest-axe';
import { performanceRunner } from '../performance/setup';
import { memoryLeakDetector } from '../utils/memory-leak';

// Mock framer-motion to avoid animation-related issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}));

describe('PhoenixConsole', () => {
  const mockOnClose = jest.fn();
  const mockOnCommand = jest.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onCommand: mockOnCommand,
    history: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Basic Rendering Tests
  describe('Rendering', () => {
    it('renders when open', () => {
      render(<PhoenixConsole {...defaultProps} />);
      expect(screen.getByText('PHOENIX CORE REPL')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<PhoenixConsole {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('PHOENIX CORE REPL')).not.toBeInTheDocument();
    });

    it('shows initial banner', () => {
      render(<PhoenixConsole {...defaultProps} />);
      expect(screen.getByText(/PHOENIX ORCH CLI \[Version 1\.0\.0\]/)).toBeInTheDocument();
      expect(screen.getByText(/Type 'help' for available commands/)).toBeInTheDocument();
    });
  });

  // Command Handling Tests
  describe('Command Handling', () => {
    it('handles help command', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await userEvent.type(input, 'help{enter}');
      
      expect(screen.getByText(/COMMANDS:/)).toBeInTheDocument();
      expect(screen.getByText(/set user \[name\]/)).toBeInTheDocument();
    });

    it('handles clear command', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await userEvent.type(input, 'help{enter}');
      expect(screen.getByText(/COMMANDS:/)).toBeInTheDocument();
      
      await userEvent.type(input, 'clear{enter}');
      expect(screen.queryByText(/COMMANDS:/)).not.toBeInTheDocument();
    });

    it('handles exit command', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await userEvent.type(input, 'exit{enter}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('forwards phoenix commands to parent', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await userEvent.type(input, 'phoenix status check{enter}');
      expect(mockOnCommand).toHaveBeenCalledWith('status', ['check']);
    });

    it('allows omitting phoenix prefix', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await userEvent.type(input, 'status check{enter}');
      expect(mockOnCommand).toHaveBeenCalledWith('status', ['check']);
    });
  });

  // Interaction Tests
  describe('User Interactions', () => {
    it('focuses input on open', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveFocus();
      });
    });

    it('closes on escape key', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes on X button click', () => {
      render(<PhoenixConsole {...defaultProps} />);
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('maintains command history', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await userEvent.type(input, 'status{enter}');
      expect(screen.getByText('phoenix> status')).toBeInTheDocument();
    });
  });

  // History Display Tests
  describe('History Display', () => {
    it('displays parent history', () => {
      const history = ['Response 1', 'Response 2'];
      render(<PhoenixConsole {...defaultProps} history={history} />);
      
      history.forEach(line => {
        expect(screen.getByText(line)).toBeInTheDocument();
      });
    });

    it('scrolls to bottom on new history', async () => {
      const scrollIntoViewMock = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(<PhoenixConsole {...defaultProps} />);
      rerender(<PhoenixConsole {...defaultProps} history={['New response']} />);

      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('renders efficiently with large history', async () => {
      const largeHistory = Array.from({ length: 100 }, (_, i) => `Response ${i}`);
      
      const metrics = await performanceRunner.measurePerformance({
        name: 'PhoenixConsole Large History',
        component: <PhoenixConsole {...defaultProps} history={largeHistory} />,
        expectations: {
          renderTime: 100,
          memoryUsage: 5 * 1024 * 1024 // 5MB
        }
      });

      expect(metrics.renderTime).toBeLessThan(100);
      expect(metrics.memoryUsage).toBeLessThan(5 * 1024 * 1024);
    });

    it('does not leak memory on repeated opens/closes', async () => {
      const testResult = await memoryLeakDetector.detectMemoryLeak(
        <PhoenixConsole {...defaultProps} />,
        async ({ unmount }) => {
          for (let i = 0; i < 10; i++) {
            render(<PhoenixConsole {...defaultProps} />);
            await userEvent.type(screen.getByRole('textbox'), `command ${i}{enter}`);
            unmount();
          }
        }
      );

      expect(testResult.hasLeak).toBe(false);
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('meets accessibility standards', async () => {
      const { container } = render(<PhoenixConsole {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      render(<PhoenixConsole {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      // Input should be focused by default
      expect(input).toHaveFocus();

      // Can close with keyboard
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});