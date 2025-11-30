import React from 'react';
import { render, screen, act } from '@testing-library/react';
import PerformanceMonitor from '../../src/components/PerformanceMonitor';
import { performanceMonitor } from '../../src/services/performance';

// Mock the performance monitor
jest.mock('../../src/services/performance', () => ({
  performanceMonitor: {
    initialize: jest.fn(),
    getAverageMetric: jest.fn(),
  }
}));

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset mock implementations
    (performanceMonitor.getAverageMetric as jest.Mock).mockImplementation((name) => {
      switch (name) {
        case 'LCP':
          return 1500; // Good LCP value
        case 'FID':
          return 80;   // Good FID value
        case 'CLS':
          return 0.05; // Good CLS value
        case 'TTFB':
          return 400;  // Good TTFB value
        case 'FCP':
          return 1200; // Good FCP value
        case 'memory-usage':
          return 30_000_000; // Good memory usage
        default:
          return 0;
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('initializes performance monitoring on mount', () => {
    render(<PerformanceMonitor />);
    expect(performanceMonitor.initialize).toHaveBeenCalled();
  });

  it('displays all performance metrics', () => {
    render(<PerformanceMonitor />);
    
    // Advance timers to trigger first metrics update
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Check if all metrics are displayed
    expect(screen.getByText('LCP')).toBeInTheDocument();
    expect(screen.getByText('FID')).toBeInTheDocument();
    expect(screen.getByText('CLS')).toBeInTheDocument();
    expect(screen.getByText('TTFB')).toBeInTheDocument();
    expect(screen.getByText('FCP')).toBeInTheDocument();
  });

  it('formats metric values correctly', () => {
    render(<PerformanceMonitor />);
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Check formatted values
    expect(screen.getByText('1500 ms')).toBeInTheDocument();  // LCP
    expect(screen.getByText('80 ms')).toBeInTheDocument();    // FID
    expect(screen.getByText('0.050')).toBeInTheDocument();    // CLS
    expect(screen.getByText('30.0 MB')).toBeInTheDocument();  // Memory
  });

  it('updates metrics periodically', () => {
    render(<PerformanceMonitor />);
    
    expect(performanceMonitor.getAverageMetric).toHaveBeenCalledTimes(0);
    
    // First update
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(performanceMonitor.getAverageMetric).toHaveBeenCalled();
    
    // Second update
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(performanceMonitor.getAverageMetric).toHaveBeenCalledTimes(12); // 6 metrics × 2 updates
  });

  it('applies correct color classes based on thresholds', () => {
    // Mock poor performance values
    (performanceMonitor.getAverageMetric as jest.Mock).mockImplementation((name) => {
      switch (name) {
        case 'LCP':
          return 3000; // Poor LCP value
        case 'FID':
          return 150;  // Poor FID value
        default:
          return 0;
      }
    });

    render(<PerformanceMonitor />);
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Check for red color class on poor metrics
    const poorMetrics = screen.getAllByText(/[0-9.]+ ms/);
    expect(poorMetrics.some(metric => 
      metric.className.includes('text-red-500')
    )).toBe(true);
  });
});