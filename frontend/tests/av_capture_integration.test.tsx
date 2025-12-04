/**
 * AV Capture Integration Tests for Frontend
 * 
 * These tests verify the frontend integration with the AV capture system,
 * focusing on memory theater, timeline, search, and playback functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemoryTheater from '../src/pages/MemoryTheater';
import type { Segment, PrivacyAwareSegment } from '../src/types';

// Mock types and data for Tauri integration
type MockInvokeFn = jest.MockedFunction<typeof import('@tauri-apps/api/tauri').invoke>;

// Mock Tauri API
jest.mock('@tauri-apps/api/tauri', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn().mockResolvedValue(() => {}),
}));

// Mock data for testing
const mockTimeline: Segment[] = [
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
      transcription: 'This is a test transcription with important information about the Phoenix project.',
      is_silence: false
    },
    video: {
      id: 'video-1',
      timestamp: new Date().toISOString(),
      duration: 120.5,
      width: 1920,
      height: 1080,
      fps: 30.0,
      codec: 'VP9',
      file_path: 'mock/path/video.webm',
      has_webcam: true
    }
  },
  {
    id: 'segment-2',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    duration: 45.2,
    is_important: false,
    audio: {
      id: 'audio-2',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      duration: 45.2,
      sample_rate: 48000,
      channels: 1,
      bit_depth: 16,
      file_path: 'mock/path/audio2.opus',
      transcription: 'Meeting notes discussing the vector search functionality and conscience gate integration.',
      is_silence: false
    }
  },
  {
    id: 'segment-3',
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    duration: 60.0,
    is_important: true,
    audio: {
      id: 'audio-3',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      duration: 60.0,
      sample_rate: 48000,
      channels: 2,
      bit_depth: 16,
      file_path: 'mock/path/audio3.opus',
      transcription: 'Testing the voice command "Phoenix stop recording" to ensure it works properly.',
      is_silence: false
    }
  }
];

const mockPrivacyTimeline: PrivacyAwareSegment[] = mockTimeline.map(segment => ({
  segment,
  contains_redactions: segment.id === 'segment-1',
  redaction_types: segment.id === 'segment-1' ? ['ChildFace'] : [],
  has_original_available: segment.id === 'segment-1'
}));

const mockVectorSearchResults = [
  {
    segment_id: 'segment-3',
    score: 0.92,
    text: 'Testing the voice command "Phoenix stop recording" to ensure it works properly.',
    start_time: 10.5,
    end_time: 15.2
  },
  {
    segment_id: 'segment-2',
    score: 0.78,
    text: 'Meeting notes discussing the vector search functionality and conscience gate integration.',
    start_time: 5.0,
    end_time: 12.3
  }
];

describe('MemoryTheater AV Capture Integration', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders MemoryTheater component correctly', async () => {
    (jest.requireMock('@tauri-apps/api/tauri').invoke as MockInvokeFn).mockResolvedValue(mockTimeline);
    
    render(<MemoryTheater />);
    
    // Check that the component renders with title
    expect(screen.getByText('Memory Theater')).toBeInTheDocument();
    
    // Check that timeline data is loaded
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Verify key elements exist
    expect(screen.getByText(/Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Search/i)).toBeInTheDocument();
    expect(screen.getByText(/Player/i)).toBeInTheDocument();
  });

  test('timeline view displays recorded segments', async () => {
    (jest.requireMock('@tauri-apps/api/tauri').invoke as MockInvokeFn).mockResolvedValue(mockTimeline);
    
    render(<MemoryTheater />);
    
    // Wait for timeline data to load
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Check that timeline segments are displayed
    await waitFor(() => {
      // Check for segments in timeline
      expect(screen.getByText(/120\.5/)).toBeInTheDocument(); // Duration of first segment
      expect(screen.getByText(/45\.2/)).toBeInTheDocument(); // Duration of second segment 
      expect(screen.getByText(/60\.0/)).toBeInTheDocument(); // Duration of third segment
    });
    
    // Check that segments show proper metadata (audio/video indicators)
    const audioIndicators = screen.getAllByText(/Audio/i);
    expect(audioIndicators.length).toBeGreaterThanOrEqual(3); // All segments have audio
    
    const videoIndicators = screen.getAllByText(/Video/i);
    expect(videoIndicators.length).toBeGreaterThanOrEqual(1); // First segment has video
  });

  test('vector search finds specific phrases', async () => {
    (jest.requireMock('@tauri-apps/api/tauri').invoke as MockInvokeFn).mockImplementation((command, args) => {
      if (command === 'av_get_timeline') {
        return Promise.resolve(mockTimeline);
      } else if (command === 'av_search_vector') {
        return Promise.resolve(mockVectorSearchResults);
      }
      return Promise.resolve(null);
    });
    
    render(<MemoryTheater />);
    
    // Wait for timeline to load
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Find search input and type search query
    const searchInput = screen.getByPlaceholderText(/Search for memories/i) || screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'voice command Phoenix stop' } });
    
    // Submit search form
    const searchButton = screen.getByRole('button', { name: /Search/i }) || 
                         screen.getByText(/Search/i);
    fireEvent.click(searchButton);
    
    // Verify that vector search is called with correct params
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_search_vector', { 
        query: 'voice command Phoenix stop',
        limit: expect.any(Number)
      });
    });
    
    // Verify search results are displayed
    await waitFor(() => {
      expect(screen.getByText(/Phoenix stop recording/i)).toBeInTheDocument();
      expect(screen.getByText(/92%/i)).toBeInTheDocument(); // Search score for first result
    });
  });

  test('playback features for audio and video content', async () => {
    (jest.requireMock('@tauri-apps/api/tauri').invoke as MockInvokeFn).mockImplementation((command, args) => {
      if (command === 'av_get_timeline') {
        return Promise.resolve(mockTimeline);
      } else if (command === 'av_get_segment') {
        // Return detailed segment data when requested
        const segmentId = args?.segment_id;
        return Promise.resolve(mockTimeline.find(s => s.id === segmentId));
      }
      return Promise.resolve(null);
    });
    
    render(<MemoryTheater />);
    
    // Wait for timeline to load
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Find and click on first segment (with both audio and video)
    const segments = screen.getAllByText(/Duration/i) || 
                     screen.getAllByText(/120\.5/);
    
    fireEvent.click(segments[0]);
    
    // Verify segment details are requested
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_segment', { 
        segment_id: 'segment-1'
      });
    });
    
    // Check that player controls are displayed
    await waitFor(() => {
      // Look for playback controls
      expect(screen.getByText(/Play/i) || screen.getByRole('button', { name: /Play/i })).toBeInTheDocument();
      expect(screen.getByText(/Pause/i) || screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
    });
    
    // Verify transcription is shown
    expect(screen.getByText(/This is a test transcription/i)).toBeInTheDocument();
    
    // Test play button functionality (mocked)
    const playButton = screen.getByText(/Play/i) || screen.getByRole('button', { name: /Play/i });
    fireEvent.click(playButton);
    
    // Verify media playback is triggered
    // In a real implementation, this would check that audio/video elements are playing
  });

  test('integration with Tauri commands for redaction management', async () => {
    // Mock implementation for privacy-aware timeline and redaction controls
    (jest.requireMock('@tauri-apps/api/tauri').invoke as MockInvokeFn).mockImplementation((command, args) => {
      if (command === 'av_get_timeline') {
        return Promise.resolve(mockTimeline);
      } else if (command === 'av_get_privacy_timeline') {
        return Promise.resolve(mockPrivacyTimeline);
      } else if (command === 'av_get_segment_with_auth') {
        // Return the segment if dad password matches
        const segmentId = args?.segment_id;
        const dadPassword = args?.dad_password;
        
        if (dadPassword === 'correct_password') {
          return Promise.resolve(mockTimeline.find(s => s.id === segmentId));
        } else {
          return Promise.reject(new Error('Invalid password'));
        }
      }
      return Promise.resolve(null);
    });
    
    render(<MemoryTheater />);
    
    // Wait for timeline and privacy data to load
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Check for redaction indicators in the timeline (needs appropriate UI elements in component)
    await waitFor(() => {
      const redactionIndicators = screen.getAllByText(/Redacted/i) || 
                                  screen.getAllByText(/Privacy Protected/i);
      expect(redactionIndicators.length).toBeGreaterThanOrEqual(1);
    });
    
    // Find and click on redacted segment
    const segments = screen.getAllByText(/120\.5/);
    fireEvent.click(segments[0]);
    
    // Look for dad override authentication flow
    const authButton = screen.getByText(/View Original/i) || 
                       screen.getByText(/Dad Override/i) ||
                       screen.getByRole('button', { name: /Override/i });
    
    // Test authentication process
    fireEvent.click(authButton);
    
    // Enter password in dialog
    const passwordInput = screen.getByPlaceholderText(/Password/i) || 
                          screen.getByRole('textbox', { name: /Password/i });
    
    fireEvent.change(passwordInput, { target: { value: 'correct_password' } });
    
    // Submit password
    const submitButton = screen.getByText(/Submit/i) || 
                         screen.getByRole('button', { name: /Submit/i });
    fireEvent.click(submitButton);
    
    // Verify authentication attempt
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_segment_with_auth', {
        segment_id: 'segment-1',
        dad_password: 'correct_password'
      });
    });
  });

  test('transcription accuracy verification', async () => {
    (jest.requireMock('@tauri-apps/api/tauri').invoke as MockInvokeFn).mockImplementation((command, args) => {
      if (command === 'av_get_timeline') {
        return Promise.resolve(mockTimeline);
      } else if (command === 'av_get_transcription_stats') {
        // Mock transcription accuracy statistics
        return Promise.resolve({
          total_segments: 3,
          transcribed_segments: 3,
          total_words: 456,
          accuracy: 0.986, // 98.6% accuracy
          verification_method: 'human_validation',
          last_verified_date: new Date().toISOString()
        });
      }
      return Promise.resolve(null);
    });
    
    render(<MemoryTheater />);
    
    // Wait for timeline to load
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Find and click on transcription stats or info button
    const statsButton = screen.getByText(/Transcription Stats/i) || 
                        screen.getByText(/Stats/i) ||
                        screen.getByRole('button', { name: /Stats/i });
    
    fireEvent.click(statsButton);
    
    // Verify stats are requested and displayed
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_transcription_stats');
    });
    
    // Check accuracy display
    await waitFor(() => {
      expect(screen.getByText(/98.6%/)).toBeInTheDocument();
    });
  });

  test('cross-platform compatibility indicators', async () => {
    (jest.requireMock('@tauri-apps/api/tauri').invoke as MockInvokeFn).mockImplementation((command, args) => {
      if (command === 'av_get_timeline') {
        return Promise.resolve(mockTimeline);
      } else if (command === 'av_get_platform_compatibility') {
        return Promise.resolve({
          current_platform: 'windows',
          is_compatible_with: {
            windows: true,
            macos: true, 
            linux: true
          },
          platform_specific_features: {
            windows: ['hardware_acceleration', 'direct_show_integration'],
            macos: ['core_audio', 'avfoundation'],
            linux: ['pipewire', 'alsa_support']
          }
        });
      }
      return Promise.resolve(null);
    });
    
    render(<MemoryTheater />);
    
    // Wait for timeline to load
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_timeline');
    });
    
    // Find and click on compatibility info button
    const compatButton = screen.getByText(/Compatibility/i) || 
                         screen.getByRole('button', { name: /Platform/i });
    
    fireEvent.click(compatButton);
    
    // Verify compatibility info is requested and displayed
    await waitFor(() => {
      expect(jest.requireMock('@tauri-apps/api/tauri').invoke).toHaveBeenCalledWith('av_get_platform_compatibility');
    });
    
    // Check that compatibility information is displayed
    await waitFor(() => {
      expect(screen.getByText(/Windows/i)).toBeInTheDocument();
      expect(screen.getByText(/macOS/i)).toBeInTheDocument();
      expect(screen.getByText(/Linux/i)).toBeInTheDocument();
      expect(screen.getByText(/Compatible/i)).toBeInTheDocument();
    });
  });
});