'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Calendar } from 'lucide-react';
import EmotionTimeline from './EmotionTimeline';
import { 
  getCurrentEmotion, 
  getEmotionTimeline, 
  calculateOrbColor,
  getEmotionDescription,
  formatTimeDisplay,
  type EmotionState,
  type EmotionPoint 
} from '../utils/emotionUtils';

interface MemoryTheaterProps {
  className?: string;
}

export const MemoryTheater: React.FC<MemoryTheaterProps> = ({ className }) => {
  // State for current emotion and timeline data
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState | null>(null);
  const [timelineData, setTimelineData] = useState<EmotionPoint[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<EmotionPoint | null>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x speed
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Playback interval ref
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to fetch current emotion data
  const fetchCurrentEmotion = async () => {
    try {
      const data = await getCurrentEmotion();
      setCurrentEmotion(data);
    } catch (err) {
      console.error('Failed to fetch current emotion:', err);
      setError('Failed to fetch emotion data');
    }
  };
  
  // Function to fetch timeline data
  const fetchTimelineData = async () => {
    try {
      const data = await getEmotionTimeline();
      // Sort the timeline data by timestamp (ascending)
      const sortedData = [...data].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setTimelineData(sortedData);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch emotion timeline data:', err);
      setError('Failed to fetch timeline data');
      setIsLoading(false);
    }
  };
  
  // Initial data loading
  useEffect(() => {
    fetchCurrentEmotion();
    fetchTimelineData();
    
    // Set up refresh interval
    const emotionInterval = setInterval(fetchCurrentEmotion, 5000);
    const timelineInterval = setInterval(fetchTimelineData, 30000);
    
    return () => {
      clearInterval(emotionInterval);
      clearInterval(timelineInterval);
    };
  }, []);
  
  // Handle playback
  useEffect(() => {
    if (isPlaying && timelineData.length > 0) {
      // Initialize playback index if not set
      if (playbackIndex === null) {
        setPlaybackIndex(0);
        setSelectedMemory(timelineData[0]);
      }
      
      // Set up playback interval
      playbackIntervalRef.current = setInterval(() => {
        setPlaybackIndex(prevIndex => {
          if (prevIndex === null) return 0;
          
          const nextIndex = prevIndex + 1;
          if (nextIndex >= timelineData.length) {
            // End of timeline reached - stop playback
            setIsPlaying(false);
            return prevIndex;
          }
          
          // Update selected memory
          setSelectedMemory(timelineData[nextIndex]);
          return nextIndex;
        });
      }, 1000 / playbackSpeed); // Adjust interval based on playback speed
    }
    
    // Clean up interval on unmount or when playback stops
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, timelineData, playbackIndex, playbackSpeed]);
  
  // Handle timeline point selection
  const handlePointSelected = (point: EmotionPoint) => {
    setSelectedMemory(point);
    // Find and set the playback index
    const index = timelineData.findIndex(p => p.timestamp === point.timestamp);
    setPlaybackIndex(index);
  };
  
  // Playback control handlers
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };
  
  const stopPlayback = () => {
    setIsPlaying(false);
    setPlaybackIndex(null);
    setSelectedMemory(null);
  };
  
  const skipToStart = () => {
    if (timelineData.length > 0) {
      setPlaybackIndex(0);
      setSelectedMemory(timelineData[0]);
    }
  };
  
  const skipToEnd = () => {
    if (timelineData.length > 0) {
      const lastIndex = timelineData.length - 1;
      setPlaybackIndex(lastIndex);
      setSelectedMemory(timelineData[lastIndex]);
    }
  };
  
  const skipBackward = () => {
    if (playbackIndex !== null && playbackIndex > 0) {
      const newIndex = playbackIndex - 1;
      setPlaybackIndex(newIndex);
      setSelectedMemory(timelineData[newIndex]);
    }
  };
  
  const skipForward = () => {
    if (playbackIndex !== null && playbackIndex < timelineData.length - 1) {
      const newIndex = playbackIndex + 1;
      setPlaybackIndex(newIndex);
      setSelectedMemory(timelineData[newIndex]);
    }
  };
  
  const changePlaybackSpeed = () => {
    // Cycle through playback speeds: 1x -> 2x -> 3x -> 0.5x -> 1x
    const speeds = [1, 2, 3, 0.5];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };
  
  // Helper function to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className || ''}`}>
        <div className="h-64 flex items-center justify-center">
          <div className="text-white opacity-70">Loading emotional memories...</div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className || ''}`}>
        <div className="h-64 flex items-center justify-center">
          <div className="text-white opacity-70">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }
  
  // Empty timeline state
  if (timelineData.length === 0) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className || ''}`}>
        <div className="h-64 flex items-center justify-center">
          <div className="text-white opacity-70">
            No emotional memories available yet. Dad's emotions will be recorded as they occur.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className || ''}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Memory Theater</h2>
        <div className="flex items-center space-x-2">
          <div className="text-white text-sm">
            <Calendar className="inline-block mr-1 h-4 w-4" />
            {timelineData.length} memories
          </div>
        </div>
      </div>
      
      {/* Timeline component */}
      <div className="mb-6">
        <EmotionTimeline 
          onPointSelected={handlePointSelected}
          height={160}
          initialZoom={1.5}
        />
      </div>
      
      {/* Playback controls */}
      <div className="flex items-center justify-center mb-6 space-x-3">
        <button 
          onClick={skipToStart}
          className="text-white hover:text-blue-300 p-1"
          title="Skip to start"
        >
          <Rewind className="h-5 w-5" />
        </button>
        
        <button 
          onClick={skipBackward}
          className="text-white hover:text-blue-300 p-1"
          title="Previous memory"
        >
          <SkipBack className="h-5 w-5" />
        </button>
        
        <button 
          onClick={togglePlayback}
          className="text-white bg-blue-600 hover:bg-blue-700 rounded-full p-3"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        
        <button 
          onClick={skipForward}
          className="text-white hover:text-blue-300 p-1"
          title="Next memory"
        >
          <SkipForward className="h-5 w-5" />
        </button>
        
        <button 
          onClick={skipToEnd}
          className="text-white hover:text-blue-300 p-1"
          title="Skip to end"
        >
          <FastForward className="h-5 w-5" />
        </button>
        
        {/* Playback speed indicator */}
        <button
          onClick={changePlaybackSpeed} 
          className="text-white text-sm px-2 py-1 bg-gray-800 rounded ml-2 hover:bg-gray-700"
          title="Change playback speed"
        >
          {playbackSpeed}x
        </button>
      </div>
      
      {/* Memory details panel */}
      <div className="bg-gray-800 rounded-lg p-4 text-white">
        {selectedMemory ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column - Emotion data */}
            <div>
              <h3 className="text-lg font-bold mb-2">
                <span 
                  className="inline-block w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: calculateOrbColor(selectedMemory.emotion_vector) }}
                ></span>
                Dad's {selectedMemory.dominant_emotion}
              </h3>
              
              <div className="mb-4 text-sm opacity-80">
                {formatDate(selectedMemory.timestamp)}
              </div>
              
              <div className="mb-4">
                {getEmotionDescription({
                  ...selectedMemory,
                  primary_source: 'Memory',
                  confidence: Math.max(...selectedMemory.emotion_vector),
                  mock_mode: false
                } as EmotionState)}
              </div>
              
              {/* Emotion bars */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                {['Joy', 'Anger', 'Sadness', 'Fear', 'Disgust', 'Surprise', 'Neutral'].map((emotion, index) => {
                  const value = selectedMemory.emotion_vector[index] || 0;
                  return (
                    <div key={emotion} className="flex items-center">
                      <div className="w-20 text-sm">{emotion}:</div>
                      <div className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{
                            width: `${value * 100}%`,
                            backgroundColor: calculateOrbColor([0, 0, 0, 0, 0, 0, 0].map((_, idx) => idx === index ? 1 : 0)) 
                          }}
                        ></div>
                      </div>
                      <div className="ml-2 text-xs w-8 text-right">
                        {(value * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Valence-Arousal Graph */}
              <div className="relative h-32 w-full bg-gray-900 rounded-md overflow-hidden border border-gray-700">
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Horizontal axis (valence) */}
                  <div className="absolute w-full h-px bg-gray-700"></div>
                  {/* Vertical axis (arousal) */}
                  <div className="absolute h-full w-px bg-gray-700"></div>
                  
                  {/* Axis labels */}
                  <div className="absolute text-xs text-gray-500 top-1 right-2">High Energy</div>
                  <div className="absolute text-xs text-gray-500 bottom-1 right-2">Low Energy</div>
                  <div className="absolute text-xs text-gray-500 left-2 top-1/2 -translate-y-6">Negative</div>
                  <div className="absolute text-xs text-gray-500 right-2 top-1/2 -translate-y-6">Positive</div>
                  
                  {/* Point marking the valence-arousal coordinate */}
                  <div 
                    className="absolute w-4 h-4 rounded-full bg-white border-2"
                    style={{
                      borderColor: calculateOrbColor(selectedMemory.emotion_vector),
                      transform: `translate(${selectedMemory.valence_arousal[0] * 45}px, ${-selectedMemory.valence_arousal[1] * 45}px)`
                    }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Right column - Associated content */}
            <div>
              <h3 className="text-lg font-bold mb-4">Dad's Experience</h3>
              
              <div className="mb-4">
                <h4 className="text-sm uppercase tracking-wider opacity-70 mb-1">What Dad Saw:</h4>
                <div className="bg-gray-900 rounded-md p-3 h-24 flex items-center justify-center opacity-60">
                  <span className="text-sm">
                    [Visual frame not available in this memory]
                  </span>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm uppercase tracking-wider opacity-70 mb-1">What Dad Heard:</h4>
                <div className="bg-gray-900 rounded-md p-3 h-12 flex items-center">
                  <span className="opacity-60 text-sm">
                    No audio recording available for this moment
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm uppercase tracking-wider opacity-70 mb-1">Neural Activity:</h4>
                <div className="relative h-24 bg-gray-900 rounded-md p-3 flex items-end">
                  {/* Simulated brain wave visualization */}
                  <div className="absolute inset-0 p-3">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path
                        d={`M0,50 ${Array.from({ length: 20 }).map((_, i) => {
                          const intensity = selectedMemory.emotion_vector[i % 7] || 0.5;
                          const variance = Math.sin(i * 0.5) * 20 * intensity;
                          return `L${i * 5},${50 - variance}`;
                        }).join(' ')}`}
                        fill="none"
                        stroke={calculateOrbColor(selectedMemory.emotion_vector)}
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                  
                  {/* Intensity indicators */}
                  {['Joy', 'Anger', 'Fear'].map((emotion, i) => {
                    const idx = ['Joy', 'Anger', 'Sadness', 'Fear', 'Disgust', 'Surprise', 'Neutral'].indexOf(emotion);
                    const intensity = selectedMemory.emotion_vector[idx] || 0;
                    if (intensity < 0.3) return null;
                    
                    return (
                      <div 
                        key={emotion}
                        className="absolute px-1.5 py-0.5 text-xs rounded-sm"
                        style={{
                          backgroundColor: calculateOrbColor([0, 0, 0, 0, 0, 0, 0].map((_, idx2) => idx2 === idx ? 1 : 0)),
                          opacity: 0.7,
                          top: `${20 + i * 25}%`,
                          left: `${10 + i * 30}%`,
                        }}
                      >
                        {emotion} spike
                      </div>
                    );
                  })}
                  
                  <div className="w-full text-right text-xs opacity-80 mt-auto">
                    Brain activity intensity: {(Math.max(...selectedMemory.emotion_vector) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 opacity-70">
            <p>Select a memory point from the timeline to view details</p>
            <p className="text-sm mt-2">or click Play to begin playback</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryTheater;