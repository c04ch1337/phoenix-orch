import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModelSelector, { ModelType } from '../../src/components/model/ModelSelector';
import { AgentType } from '../../src/components/agent/AgentCard';

// Mock task for testing
const mockTask = {
  id: 'task-123',
  title: 'Test Task',
  agentType: AgentType.EmberUnit,
};

// Mock agent for testing
const mockAgentId = 'agent-456';
const mockAgentType = AgentType.CipherGuard;

describe('ModelSelector Component', () => {
  test('renders correctly with task context', () => {
    render(<ModelSelector selectedTask={mockTask} />);
    
    // Check if component renders with task title
    expect(screen.getByText(/Test Task/i)).toBeInTheDocument();
    
    // Should default to DeepSeekCoder for EmberUnit
    expect(screen.getByText(/DeepSeek-Coder-V2/i)).toBeInTheDocument();
  });
  
  test('renders correctly with agent context', () => {
    render(<ModelSelector selectedAgentId={mockAgentId} selectedAgentType={mockAgentType} />);
    
    // Check if component shows agent type info
    expect(screen.getByText(/Agent Type: CipherGuard/i)).toBeInTheDocument();
    
    // Should default to Claude 3.5 for CipherGuard
    expect(screen.getByText(/Claude 3.5/i)).toBeInTheDocument();
  });
  
  test('allows changing model selection', async () => {
    const handleModelChange = jest.fn();
    
    render(
      <ModelSelector 
        selectedTask={mockTask} 
        onModelChange={handleModelChange}
      />
    );
    
    // Open the select dropdown
    fireEvent.mouseDown(screen.getByLabelText(/Model/i));
    
    // Select a different model (Gemini 3 Pro)
    const geminiOption = screen.getByText(/Gemini 3 Pro/i);
    fireEvent.click(geminiOption);
    
    // Check model info is updated
    expect(screen.getByText(/Gemini 3 Pro/i)).toBeInTheDocument();
    
    // Click save button
    const saveButton = screen.getByText(/Save Model Selection/i);
    fireEvent.click(saveButton);
    
    // Verify the callback was called with correct params
    await waitFor(() => {
      expect(handleModelChange).toHaveBeenCalledWith(
        ModelType.Gemini3Pro,
        'task-123',
        undefined
      );
    });
  });
  
  test('shows model information dialog', () => {
    render(<ModelSelector selectedTask={mockTask} />);
    
    // Click the info button
    const infoButton = screen.getByRole('button', { name: /View model information/i });
    fireEvent.click(infoButton);
    
    // Check if dialog is shown with model info
    expect(screen.getByText(/Model Information/i)).toBeInTheDocument();
    expect(screen.getByText(/DeepSeek-Coder-V2/i)).toBeInTheDocument();
    expect(screen.getByText(/Claude 3.5/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini 3 Pro/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Llama 3.1 70B/i)).toBeInTheDocument();
  });
  
  test('shows loading state', () => {
    render(<ModelSelector selectedTask={mockTask} isLoading={true} />);
    
    // Should show loading state in the save button
    expect(screen.getByText(/Saving/i)).toBeInTheDocument();
    
    // Save button should be disabled
    const saveButton = screen.getByText(/Saving/i);
    expect(saveButton).toBeDisabled();
  });
  
  test('shows advanced settings dialog', () => {
    render(<ModelSelector selectedTask={mockTask} />);
    
    // Get the model info area
    const modelDisplayArea = screen.getByText(/DeepSeek-Coder-V2/i).closest('div');
    
    // Find and click the settings icon (advanced settings)
    const settingsButton = modelDisplayArea.querySelector('button');
    fireEvent.click(settingsButton);
    
    // Check if advanced settings dialog is shown
    expect(screen.getByText(/Advanced Model Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Advanced parameter configuration/i)).toBeInTheDocument();
  });
});