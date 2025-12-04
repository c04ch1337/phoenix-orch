import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutonomySlider from '../AutonomySlider';

// Mock the API service
jest.mock('../../../services/api', () => ({
  invokeAgent: jest.fn().mockImplementation(() => Promise.resolve({}))
}));

import { invokeAgent } from '../../../services/api';

describe('AutonomySlider Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with default values', () => {
    render(<AutonomySlider userId="test-user" />);
    
    // Check that the component rendered
    expect(screen.getByText(/Autonomy Control/i)).toBeInTheDocument();
    expect(screen.getByText(/Planning Only/i)).toBeInTheDocument();
    
    // Default to level 0
    expect(screen.getByText(/Level 0/i)).toBeInTheDocument();
    
    // Planning mode by default
    expect(screen.getByText(/Planning Mode/i)).toBeInTheDocument();
  });

  test('renders with custom initial values', () => {
    render(<AutonomySlider userId="test-user" initialLevel={5} initialFastMode={true} />);
    
    // Check level 5 is displayed
    expect(screen.getByText(/Level 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Medium/i)).toBeInTheDocument();
    
    // Fast mode should be enabled
    expect(screen.getByText(/Fast Mode/i)).toBeInTheDocument();
  });

  test('updates autonomy level when slider changes', async () => {
    render(<AutonomySlider userId="test-user" />);
    
    // Simulate changing the slider
    // Note: Direct slider changes are hard to test, so we'll test the API call instead
    const handleSliderChange = jest.spyOn(React, 'useState').mock.results[0].value[1];
    handleSliderChange(7);
    
    // Wait for the API call to be made
    await waitFor(() => {
      expect(invokeAgent).toHaveBeenCalledWith('set_autonomy_level', {
        userId: 'test-user',
        level: 7,
      });
    });
  });

  test('fast mode command button works', async () => {
    render(<AutonomySlider userId="test-user" taskId="task-123" />);
    
    // Find the "Fast Mode This Task" button and click it
    const button = screen.getByText(/Fast Mode This Task/i);
    fireEvent.click(button);
    
    // Wait for the API call to be made
    await waitFor(() => {
      expect(invokeAgent).toHaveBeenCalledWith('process_fast_mode_command', {
        commandText: 'Phoenix, fast mode this task',
        taskId: 'task-123',
        userId: 'test-user',
      });
    });
  });
});