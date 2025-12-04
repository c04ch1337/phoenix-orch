import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { debounce } from 'lodash';
import { useColorMode } from '../hooks/useColorMode';
import './MemoryTheater.css';

// TypeScript interfaces matching the Rust backend
interface AudioSegment {
  id: string;
  timestamp: string;
  duration: number;
  sample_rate: number;
  channels: number;
  bit_depth: number;
  file_path: string;
  transcription?: string;
  is_silence: boolean;
}

interface VideoSegment {
  id: string;
  timestamp: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  file_path: string;
  has_webcam: boolean;
}

interface Segment {
  id: string;
  timestamp: string;
  duration: number;
  audio?: AudioSegment;
  video?: VideoSegment;
  is_important: boolean;
}

interface SensitiveContentType {
  type: 'ChildFace' | 'MedicalDocument' | 'Password' | 'PII' | 'Financial' | 'Custom';
  customName?: string;
}

interface PrivacyAwareSegment {
  segment: Segment;
  contains_redactions: boolean;
  redaction_types: SensitiveContentType[];
  has_original_available: boolean;
}

interface AVCommandResponse {
  success: boolean;
  message: string;
  segment_id?: string;
}

// Search and timeline interfaces
interface SearchResult {
  segmentId: string;
  timestamp: number;
  score: number;
  text: string;
}

interface TimelineState {
  segments: Segment[];
  loading: boolean;
  error: string | null;
  currentTime: number;
  scale: number;
}

// Component props for subcomponents
interface TimelinePanelProps {
  timeline: TimelineState;
  onSegmentSelect: (segment: Segment) => void;
  currentSegment?: Segment;
}

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  volume: number;
  togglePictureInPicture: () => void;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  recentQueries: string[];
}

// Main MemoryTheater component
const MemoryTheater: React.FC = () => {
  // State for timeline data
  const [timeline, setTimeline] = useState<TimelineState>({
    segments: [],
    loading: false,
    error: null,
    currentTime: 0,
    scale: 1,
  });

  // Player state
  const [currentSegment, setCurrentSegment] = useState<Segment | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  // UI state
  const { colorMode, toggleColorMode } = useColorMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load timeline data on component mount
  useEffect(() => {
    loadTimeline();
    
    // Listen for real-time updates to timeline
    const unlisten = listen<Segment>('new-segment', (event) => {
      setTimeline(prev => ({
        ...prev,
        segments: [...prev.segments, event.payload]
      }));
    });

    return () => {
      unlisten.then(unsubscribe => unsubscribe());
    };
  }, []);

  // Fetch timeline data from the backend
  const loadTimeline = async () => {
    setTimeline(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const segments: Segment[] = await invoke('av_get_timeline');
      
      setTimeline(prev => ({
        ...prev,
        segments,
        loading: false,
      }));
    } catch (err) {
      setTimeline(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      }));
    }
  };

  // Segment selection handler
  const handleSegmentSelect = useCallback((segment: Segment) => {
    setCurrentSegment(segment);
    setCurrentTime(0);
    setIsPlaying(false);
    
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Playback controls
  const handlePlay = useCallback(() => {
    if (videoRef.current && currentSegment?.video) {
      videoRef.current.play();
    } else if (audioRef.current && currentSegment?.audio) {
      audioRef.current.play();
    }
    
    setIsPlaying(true);
  }, [currentSegment]);

  const handlePause = useCallback(() => {
    if (videoRef.current && videoRef.current.paused === false) {
      videoRef.current.pause();
    }
    
    if (audioRef.current && audioRef.current.paused === false) {
      audioRef.current.pause();
    }
    
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    if (videoRef.current) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    }
  }, []);

  // Vector search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    try {
      // This would call a vector search API or Tauri command
      // For now, we'll simulate with a simple text search on transcriptions
      const results: SearchResult[] = await simulateVectorSearch(query, timeline.segments);
      
      setSearchResults(results);
      
      // Save query to recent searches
      if (!recentQueries.includes(query)) {
        setRecentQueries(prev => [query, ...prev.slice(0, 4)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  }, [timeline.segments, recentQueries]);

  // Debounce search to avoid too many calls
  const debouncedSearch = useCallback((query: string) => {
    const debouncedFn = debounce((q: string) => {
      performSearch(q);
    }, 500);
    debouncedFn(query);
  }, [performSearch]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Simulate vector search by looking at transcriptions
  // In a real app, this would be replaced with actual vector search
  const simulateVectorSearch = async (query: string, segments: Segment[]): Promise<SearchResult[]> => {
    // Wait a bit to simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const lowerQuery = query.toLowerCase();
    
    // Search through transcriptions
    return segments
      .filter(segment => segment.audio?.transcription)
      .flatMap(segment => {
        const transcript = segment.audio?.transcription?.toLowerCase() || '';
        if (transcript.includes(lowerQuery)) {
          // Calculate a simple relevance score
          const score = (transcript.match(new RegExp(lowerQuery, 'g')) || []).length / transcript.length;
          
          // Create a result with context
          const index = transcript.indexOf(lowerQuery);
          const start = Math.max(0, index - 50);
          const end = Math.min(transcript.length, index + query.length + 50);
          const text = '...' + transcript.substring(start, end) + '...';
          
          return {
            segmentId: segment.id,
            timestamp: index / transcript.length * segment.duration, // Approximate timestamp
            score: score * 100, // Scale to percentage
            text
          };
        }
        return [];
      })
      .sort((a, b) => b.score - a.score);
  };

  return (
    <div className={`memory-theater ${colorMode === 'dark' ? 'dark' : 'light'}`}>
      <header className="theater-header">
        <h1>Memory Theater</h1>
        <div className="controls">
          <button onClick={toggleColorMode}>
            {colorMode === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
          <button onClick={() => loadTimeline()}>Refresh</button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search for memories... (e.g. 'Jump to when Dad said I love you')"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="search-input"
          />
          <button 
            className="search-button"
            onClick={() => performSearch(searchQuery)}
            disabled={isSearching}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {/* Recent searches */}
        {recentQueries.length > 0 && (
          <div className="recent-searches">
            <span>Recent: </span>
            {recentQueries.map((query, index) => (
              <button 
                key={index} 
                onClick={() => {
                  setSearchQuery(query);
                  performSearch(query);
                }}
                className="recent-query"
              >
                {query}
              </button>
            ))}
          </div>
        )}
        
        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Results ({searchResults.length})</h3>
            <ul className="results-list">
              {searchResults.map((result, index) => (
                <li 
                  key={index}
                  onClick={() => {
                    // Find and select the segment
                    const segment = timeline.segments.find(s => s.id === result.segmentId);
                    if (segment) {
                      handleSegmentSelect(segment);
                      // Seek to the approximate timestamp
                      setTimeout(() => handleSeek(result.timestamp), 100);
                    }
                  }}
                  className="result-item"
                >
                  <div className="result-score">{result.score.toFixed(1)}%</div>
                  <div className="result-content">
                    <div className="result-text" dangerouslySetInnerHTML={{ 
                      __html: result.text.replace(
                        new RegExp(searchQuery, 'gi'),
                        match => `<mark>${match}</mark>`
                      )
                    }} />
                    <div className="result-time">
                      at {formatTime(result.timestamp)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="theater-content">
        {/* Media Player */}
        <div className="player-container">
          {currentSegment ? (
            <>
              {currentSegment.video ? (
                <video
                  ref={videoRef}
                  src={currentSegment.video.file_path}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onEnded={() => setIsPlaying(false)}
                  className="video-player"
                />
              ) : currentSegment.audio ? (
                <div className="audio-player-wrapper">
                  <div className="audio-waveform">
                    {/* Placeholder for waveform - would use a library like wavesurfer.js */}
                    <div className="waveform-placeholder"></div>
                  </div>
                  <audio
                    ref={audioRef}
                    src={currentSegment.audio.file_path}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onEnded={() => setIsPlaying(false)}
                    className="audio-player"
                  />
                </div>
              ) : (
                <div className="empty-player">No media available</div>
              )}

              {/* Transcription display */}
              {currentSegment.audio?.transcription && (
                <div className="transcription-panel">
                  <h3>Transcription</h3>
                  <div className="transcription-text">
                    {currentSegment.audio.transcription}
                  </div>
                </div>
              )}

              {/* Playback controls */}
              <div className="playback-controls">
                <button onClick={isPlaying ? handlePause : handlePlay}>
                  {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                </button>
                
                <input
                  type="range"
                  min={0}
                  max={currentSegment.duration}
                  value={currentTime}
                  step={0.1}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="seek-slider"
                />
                
                <div className="time-display">
                  {formatTime(currentTime)} / {formatTime(currentSegment.duration)}
                </div>
                
                <div className="volume-control">
                  <label htmlFor="volume">🔊</label>
                  <input
                    id="volume"
                    type="range"
                    min={0}
                    max={1}
                    value={volume}
                    step={0.05}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="volume-slider"
                  />
                </div>
                
                {currentSegment.video && (
                  <button onClick={togglePictureInPicture} className="pip-button">
                    PiP
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="empty-player-placeholder">
              <h2>Select a segment from the timeline to play</h2>
            </div>
          )}
        </div>

        {/* Timeline View */}
        <div className="timeline-container">
          <h2>Timeline</h2>
          
          {timeline.loading ? (
            <div className="loading">Loading timeline...</div>
          ) : timeline.error ? (
            <div className="error">Error: {timeline.error}</div>
          ) : timeline.segments.length === 0 ? (
            <div className="empty-timeline">
              <p>No recordings available.</p>
            </div>
          ) : (
            <>
              {/* Timeline controls */}
              <div className="timeline-controls">
                <button onClick={() => setTimeline(prev => ({ ...prev, scale: prev.scale * 1.5 }))}>
                  Zoom In
                </button>
                <button onClick={() => setTimeline(prev => ({ ...prev, scale: prev.scale / 1.5 }))}>
                  Zoom Out
                </button>
                <select 
                  onChange={(e) => {
                    const newSegments = [...timeline.segments];
                    
                    switch (e.target.value) {
                      case 'date':
                        newSegments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        break;
                      case 'duration':
                        newSegments.sort((a, b) => b.duration - a.duration);
                        break;
                      case 'importance':
                        newSegments.sort((a, b) => (b.is_important ? 1 : 0) - (a.is_important ? 1 : 0));
                        break;
                    }
                    
                    setTimeline(prev => ({ ...prev, segments: newSegments }));
                  }}
                >
                  <option value="date">Sort by Date</option>
                  <option value="duration">Sort by Duration</option>
                  <option value="importance">Sort by Importance</option>
                </select>
              </div>
              
              {/* Timeline segments */}
              <div 
                className="timeline-scroll" 
                style={{ width: `${timeline.segments.length * 200 * timeline.scale}px` }}
              >
                <div className="time-markers">
                  {timeline.segments.map((segment, index) => (
                    <div key={`marker-${segment.id}`} className="time-marker">
                      {formatDate(segment.timestamp)}
                    </div>
                  ))}
                </div>
                
                <div className="segments-container">
                  {timeline.segments.map((segment) => (
                    <div 
                      key={segment.id}
                      className={`segment-item ${currentSegment?.id === segment.id ? 'active' : ''} ${segment.is_important ? 'important' : ''}`}
                      style={{ 
                        width: `${Math.max(100, segment.duration * 10 * timeline.scale)}px`,
                      }}
                      onClick={() => handleSegmentSelect(segment)}
                    >
                      {segment.video && (
                        <div className="segment-thumbnail">
                          {/* In a real app, this would be a thumbnail from the video */}
                          <div className="video-thumbnail-placeholder">
                            <span role="img" aria-label="video">🎬</span>
                          </div>
                        </div>
                      )}
                      
                      {segment.audio && !segment.video && (
                        <div className="segment-waveform">
                          {/* In a real app, this would be a mini waveform */}
                          <div className="waveform-thumbnail-placeholder">
                            <span role="img" aria-label="audio">🔊</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="segment-info">
                        <div className="segment-time">{formatDuration(segment.duration)}</div>
                        <div className="segment-date">{formatDate(segment.timestamp)}</div>
                        {segment.audio?.transcription && (
                          <div className="segment-transcription-preview">
                            {truncateText(segment.audio.transcription, 50)}
                          </div>
                        )}
                      </div>
                      
                      {/* Indicator for redactions */}
                      {segment.is_important && (
                        <div className="segment-important-marker" title="Important Memory">
                          <span role="img" aria-label="important">⭐</span>
                        </div>
                      )}
                      
                      {/* Search match indicator would be added here when a segment matches search */}
                      {searchResults.some(r => r.segmentId === segment.id) && (
                        <div className="segment-search-match" title="Matches Search">
                          <span role="img" aria-label="search match">🔍</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Utility functions
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
};


export default MemoryTheater;