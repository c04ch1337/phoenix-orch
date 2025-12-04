import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

// Mock components for different pages
const MockFileExplorer = () => <div data-testid="file-explorer-page">File Explorer</div>;
const MockSettings = () => <div data-testid="settings-page">Settings</div>;

// Mock the CipherGuard and EmberUnit page components
vi.mock('../app/cipher/page', () => ({
  default: () => <div data-testid="cipher-guard-page">CipherGuard</div>
}));

vi.mock('../app/ember/page', () => ({
  default: () => <div data-testid="ember-unit-page">EmberUnit</div>
}));

// Mock Tauri invoke function
const mockInvokeResponse = {
  result: 'Command executed successfully',
  status: 'success'
};

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn().mockImplementation(() => Promise.resolve(mockInvokeResponse))
}));

// Import our component after mocks
import { UniversalOrchestratorBar } from '../app/components/UniversalOrchestratorBar';
import { invoke } from '@tauri-apps/api/tauri';

// Mock window.matchMedia for testing animations
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Helper function to create a test container with UniversalOrchestratorBar and a specific page content
const renderWithOrchestrator = (PageComponent: React.FC) => {
  return render(
    <>
      <PageComponent />
      <UniversalOrchestratorBar />
    </>
  );
};

// Helper function to simulate keyboard shortcuts
const pressCtrlBacktick = () => {
  const event = new KeyboardEvent('keydown', {
    key: '`',
    code: 'Backquote',
    ctrlKey: true,
    bubbles: true
  });
  document.dispatchEvent(event);
};

describe('UniversalOrchestratorBar Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any DOM manipulations
    document.body.innerHTML = '';
  });

  describe('Presence on different pages', () => {
    it('should be present on FileExplorer page', () => {
      renderWithOrchestrator(MockFileExplorer);
      expect(screen.getByText('PHOENIX ORCHESTRATOR')).toBeInTheDocument();
    });

    it('should be present on CipherGuard page', () => {
      renderWithOrchestrator(() => <div data-testid="cipher-guard-page">CipherGuard</div>);
      expect(screen.getByText('PHOENIX ORCHESTRATOR')).toBeInTheDocument();
      expect(screen.getByTestId('cipher-guard-page')).toBeInTheDocument();
    });

    it('should be present on EmberUnit page', () => {
      renderWithOrchestrator(() => <div data-testid="ember-unit-page">EmberUnit</div>);
      expect(screen.getByText('PHOENIX ORCHESTRATOR')).toBeInTheDocument();
      expect(screen.getByTestId('ember-unit-page')).toBeInTheDocument();
    });

    it('should be present on Settings page', () => {
      renderWithOrchestrator(MockSettings);
      expect(screen.getByText('PHOENIX ORCHESTRATOR')).toBeInTheDocument();
    });
  });

  describe('Keyboard shortcut functionality', () => {
    it('should open console when Ctrl+` is pressed', () => {
      renderWithOrchestrator(MockFileExplorer);
      
      // Initially console is closed
      expect(screen.queryByPlaceholderText('Enter your goal...')).not.toBeInTheDocument();
      
      // Simulate Ctrl+` keypress
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Console should now be open
      expect(screen.getByPlaceholderText('Enter your goal...')).toBeInTheDocument();
    });

    it('should close console when Ctrl+` is pressed again', () => {
      renderWithOrchestrator(MockFileExplorer);
      
      // First open the console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Verify it's open
      expect(screen.getByPlaceholderText('Enter your goal...')).toBeInTheDocument();
      
      // Press Ctrl+` again
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Console should now be closed
      expect(screen.queryByPlaceholderText('Enter your goal...')).not.toBeInTheDocument();
    });

    it('should close console when Escape key is pressed', () => {
      renderWithOrchestrator(MockFileExplorer);
      
      // First open the console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Verify it's open
      expect(screen.getByPlaceholderText('Enter your goal...')).toBeInTheDocument();
      
      // Press Escape
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      
      // Console should now be closed
      expect(screen.queryByPlaceholderText('Enter your goal...')).not.toBeInTheDocument();
    });

    it('should work on all pages consistently', () => {
      // Test on CipherGuard
      const { unmount } = renderWithOrchestrator(() => <div data-testid="cipher-guard-page">CipherGuard</div>);
      
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      expect(screen.getByPlaceholderText('Enter your goal...')).toBeInTheDocument();
      unmount();
      
      // Test on EmberUnit
      renderWithOrchestrator(() => <div data-testid="ember-unit-page">EmberUnit</div>);
      
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      expect(screen.getByPlaceholderText('Enter your goal...')).toBeInTheDocument();
    });
  });

  describe('Slide-up animation', () => {
    it('should apply height transition classes when toggled', () => {
      renderWithOrchestrator(MockFileExplorer);
      
      // Get the orchestrator bar element
      const orchestratorBar = screen.getByText('PHOENIX ORCHESTRATOR').closest('div');
      expect(orchestratorBar).toBeInTheDocument();
      
      // Initially the bar is collapsed (h-12)
      expect(orchestratorBar).toHaveClass('h-12');
      expect(orchestratorBar).not.toHaveClass('h-screen');
      
      // Open the console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Should now be expanded (h-screen)
      expect(orchestratorBar).toHaveClass('h-screen');
      expect(orchestratorBar).not.toHaveClass('h-12');
      
      // Close the console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Should be collapsed again
      expect(orchestratorBar).toHaveClass('h-12');
      expect(orchestratorBar).not.toHaveClass('h-screen');
    });

    it('should have appropriate transition properties', () => {
      renderWithOrchestrator(MockFileExplorer);
      
      const orchestratorBar = screen.getByText('PHOENIX ORCHESTRATOR').closest('div');
      expect(orchestratorBar).toHaveClass('transition-all');
      expect(orchestratorBar).toHaveClass('duration-300');
      expect(orchestratorBar).toHaveClass('ease-in-out');
    });
  });

  describe('Command execution', () => {
    it('should send command to invoke_orchestrator_task', async () => {
      renderWithOrchestrator(MockFileExplorer);
      
      // Open console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Type a command
      const inputField = screen.getByPlaceholderText('Enter your goal...');
      await userEvent.type(inputField, 'test command');
      
      // Submit the form
      const submitButton = screen.getByRole('button', { name: /Send/i });
      await userEvent.click(submitButton);
      
      // Check if Tauri invoke was called with correct parameters
      expect(invoke).toHaveBeenCalledWith('invoke_orchestrator_task', { goal: 'test command' });
    });

    it('should work consistently across different pages', async () => {
      // Test on CipherGuard
      const { unmount } = renderWithOrchestrator(() => <div data-testid="cipher-guard-page">CipherGuard</div>);
      
      // Open console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Type and submit
      const inputField = screen.getByPlaceholderText('Enter your goal...');
      await userEvent.type(inputField, 'cipher test');
      const submitButton = screen.getByRole('button', { name: /Send/i });
      await userEvent.click(submitButton);
      
      expect(invoke).toHaveBeenCalledWith('invoke_orchestrator_task', { goal: 'cipher test' });
      unmount();
      
      // Reset mock
      vi.clearAllMocks();
      
      // Test on EmberUnit
      renderWithOrchestrator(() => <div data-testid="ember-unit-page">EmberUnit</div>);
      
      // Open console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Type and submit
      const emberInputField = screen.getByPlaceholderText('Enter your goal...');
      await userEvent.type(emberInputField, 'ember test');
      const emberSubmitButton = screen.getByRole('button', { name: /Send/i });
      await userEvent.click(emberSubmitButton);
      
      expect(invoke).toHaveBeenCalledWith('invoke_orchestrator_task', { goal: 'ember test' });
    });
  });

  describe('Result display', () => {
    it('should display command results after execution', async () => {
      renderWithOrchestrator(MockFileExplorer);
      
      // Open console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Type a command
      const inputField = screen.getByPlaceholderText('Enter your goal...');
      await userEvent.type(inputField, 'test result display');
      
      // Submit the form
      const submitButton = screen.getByRole('button', { name: /Send/i });
      await userEvent.click(submitButton);
      
      // Wait for simulated streaming to complete
      await act(async () => {
        // Skip ahead in time to complete the streaming
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
      
      // Check if the result is displayed
      expect(screen.getByText('Command executed successfully')).toBeInTheDocument();
    });

    it('should handle error states', async () => {
      // Override mock to return an error
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Test error'));
      
      renderWithOrchestrator(MockFileExplorer);
      
      // Open console
      act(() => {
        fireEvent.keyDown(document, { key: '`', ctrlKey: true });
      });
      
      // Type a command
      const inputField = screen.getByPlaceholderText('Enter your goal...');
      await userEvent.type(inputField, 'error command');
      
      // Submit the form
      const submitButton = screen.getByRole('button', { name: /Send/i });
      await userEvent.click(submitButton);
      
      // Wait for error handling
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      // Check if the error is displayed
      expect(screen.getByText(/Error: Test error/i)).toBeInTheDocument();
    });
  });
});