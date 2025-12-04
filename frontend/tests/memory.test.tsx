import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemoryTheater from '../src/pages/MemoryTheater';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// Mock Tauri API
jest.mock('@tauri-apps/api/tauri', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn().mockResolvedValue(() => {}),
}));

// Mock data
const mockSegments = [
  {
    id: 'segment-1',
    timestamp: new Date().toISOString(),
    duration: 120.5,
    is_important: true,
    audio: {
      id: 'audio-1',
      timestamp: new Date().toISOString(),
      duration: 120.5,
      sample_rate: 48000,
      channels: 2,
      bit_depth: 16,
      file_path: 'mock/path/audio.opus',
      transcription: 'This is a test transcription with some words to search for.',
      is_silence: false
    }
  },
  {
    id: 'segment-2',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    duration: 45.2,
    is_important: false,
    video: {
      id: 'video-1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      duration: 45.2,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: 'VP9',
      file_path: 'mock/path/video.webm',
      has_webcam: true
    }
  }
];

describe('MemoryTheater', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Setup mocks
    (invoke as jest.Mock).mockResolvedValue(mockSegments);
  });

  test('renders correctly and loads timeline data', async () => {
    render(<MemoryTheater />);
    
    // Check that the component renders
    expect(screen.getByText('Memory Theater')).toBeInTheDocument();
    
    // Check that it calls the Tauri API to get timeline data
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Wait for segments to load
    await waitFor(() => {
      expect(screen.getByText(/120\.5/)).toBeInTheDocument(); // Duration of first segment
      expect(screen.getByText(/45\.2/)).toBeInTheDocument(); // Duration of second segment
    });
  });

  test('search functionality works', async () => {
    render(<MemoryTheater />);
    
    // Wait for segments to load
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Find the search input
    const searchInput = screen.getByPlaceholderText(/Search for memories/);
    
    // Type a search query
    fireEvent.change(searchInput, { target: { value: 'test transcription' } });
    
    // Wait for search results
    await waitFor(() => {
      // Check that search results appear (would be more specific in a real test)
      expect(screen.getByText(/Results/)).toBeInTheDocument();
    });
  });

  test('segment selection works', async () => {
    render(<MemoryTheater />);
    
    // Wait for segments to load
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Wait for segments to render
    await waitFor(() => {
      expect(screen.getByText(/120\.5/)).toBeInTheDocument();
    });
    
    // Find and click on a segment (this is a simplified test)
    const segments = screen.getAllByText(/Duration/);
    fireEvent.click(segments[0]);
    
    // Check that player displays the selection
    await waitFor(() => {
      // This would be more specific in a real test
      expect(screen.getByText(/Play/)).toBeInTheDocument();
      expect(screen.getByText(/Transcription/)).toBeInTheDocument();
    });
  });
});