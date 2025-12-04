'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getEmotionTimeline, 
  EMOTION_COLORS, 
  calculateOrbColor,
  formatTimeDisplay,
  type EmotionPoint 
} from '../utils/emotionUtils';

interface EmotionTimelineProps {
  // Optional className for additional styling
  className?: string;
  // Function to call when a timeline point is selected
  onPointSelected?: (point: EmotionPoint) => void;
  // Height of the timeline (default: 140px)
  height?: number;
  // Initial zoom level (default: 1)
  initialZoom?: number;
}

export const EmotionTimeline: React.FC<EmotionTimelineProps> = ({ 
  className,
  onPointSelected,
  height = 140,
  initialZoom = 1
}) => {
  // State for timeline data
  const [timelineData, setTimelineData] = useState<EmotionPoint[]>([]);
  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for hover/selected point
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  // State for zoom and pan
  const [zoom, setZoom] = useState(initialZoom);
  const [panOffset, setPanOffset] = useState(0);
  
  // Refs for canvas and container
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  
  // Fetch data on component mount
  useEffect(() => {
    fetchTimelineData();
    
    // Set up periodic refresh (every 15 seconds)
    const interval = setInterval(fetchTimelineData, 15000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Function to draw the timeline
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timelineData.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate visible data range based on zoom and pan
    const visibleCount = Math.floor(timelineData.length / zoom);
    const startIndex = Math.max(0, Math.min(
      timelineData.length - visibleCount,
      Math.floor(panOffset * (timelineData.length - visibleCount))
    ));
    const endIndex = Math.min(timelineData.length, startIndex + visibleCount);
    const visibleData = timelineData.slice(startIndex, endIndex);
    
    // Timeline dimensions
    const padding = 20;
    const timelineHeight = canvas.height - padding * 2;
    const timelineWidth = canvas.width - padding * 2;
    const pointSpacing = timelineWidth / (visibleData.length - 1 || 1);
    
    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines (5 divisions)
    for (let i = 0; i <= 5; i++) {
      const y = padding + (timelineHeight * i / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }
    
    // Time divisions (5 vertical lines)
    for (let i = 0; i <= 5; i++) {
      const x = padding + (timelineWidth * i / 5);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, canvas.height - padding);
      ctx.stroke();
      
      // Add time labels if data exists
      if (visibleData.length > 0 && i < 5) {
        const timeIndex = Math.floor(i * (visibleData.length - 1) / 5);
        const time = formatTimeDisplay(visibleData[timeIndex].timestamp);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(time, x, canvas.height - 5);
      }
    }
    
    // Draw emotion intensity lines for each emotion
    const emotions: [string, number][] = [
      ['Joy', 0],
      ['Anger', 1],
      ['Sadness', 2],
      ['Fear', 3],
      ['Disgust', 4],
      ['Surprise', 5],
      ['Neutral', 6]
    ];
    
    emotions.forEach(([emotion, index]) => {
      const color = EMOTION_COLORS[emotion as keyof typeof EMOTION_COLORS];
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      visibleData.forEach((point, i) => {
        const x = padding + i * pointSpacing;
        // Flip the y-coordinate (0 at bottom, 1 at top)
        const y = padding + timelineHeight - (point.emotion_vector[index] * timelineHeight);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    });
    
    // Draw brain activity spikes
    // We'll use valence+arousal as a simple approximation of brain activity
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    visibleData.forEach((point, i) => {
      const x = padding + i * pointSpacing;
      // Use absolute values of valence & arousal as a rough proxy for brain activity
      const brainActivity = Math.abs(point.valence_arousal[0]) + Math.abs(point.valence_arousal[1]);
      // Scale to 0-1 range and flip for drawing
      const y = padding + timelineHeight - (brainActivity / 2 * timelineHeight);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // Draw spike markers for high brain activity moments
      if (brainActivity > 1.0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    ctx.stroke();
    
    // Draw timeline points (colored circles for each data point)
    visibleData.forEach((point, i) => {
      const x = padding + i * pointSpacing;
      // Use dominant emotion to position the dot vertically
      const emotionIndex = ['Joy', 'Anger', 'Sadness', 'Fear', 'Disgust', 'Surprise', 'Neutral']
        .indexOf(point.dominant_emotion);
      const yPosition = padding + timelineHeight * 0.5;
      
      // Draw colored circle
      ctx.fillStyle = calculateOrbColor(point.emotion_vector);
      ctx.beginPath();
      ctx.arc(x, yPosition, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw highlight for hovered/selected point
      if (i + startIndex === hoveredPointIndex || i + startIndex === selectedPointIndex) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, yPosition, 7, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw vertical time indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, canvas.height - padding);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }, [timelineData, hoveredPointIndex, selectedPointIndex, zoom, panOffset]);
  
  // Draw timeline whenever dependencies change
  useEffect(() => {
    drawTimeline();
  }, [drawTimeline]);
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        drawTimeline();
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [drawTimeline]);
  
  // Handle mouse movement on the timeline
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !timelineData.length) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const visibleCount = Math.floor(timelineData.length / zoom);
    const startIndex = Math.max(0, Math.min(
      timelineData.length - visibleCount,
      Math.floor(panOffset * (timelineData.length - visibleCount))
    ));
    
    // Calculate which point is closest to mouse position
    const pointWidth = (canvas.width - 40) / (Math.min(timelineData.length, visibleCount) - 1 || 1);
    const pointIndex = Math.round((x - 20) / pointWidth);
    
    if (pointIndex >= 0 && pointIndex < visibleCount && startIndex + pointIndex < timelineData.length) {
      setHoveredPointIndex(startIndex + pointIndex);
    } else {
      setHoveredPointIndex(null);
    }
  };
  
  // Handle mouse click on the timeline
  const handleClick = () => {
    if (hoveredPointIndex !== null && timelineData[hoveredPointIndex]) {
      setSelectedPointIndex(hoveredPointIndex);
      if (onPointSelected) {
        onPointSelected(timelineData[hoveredPointIndex]);
      }
    }
  };
  
  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoveredPointIndex(null);
  };
  
  // Handle zoom controls
  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.5, 5));
  };
  
  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.5, 1));
  };
  
  // Handle pan controls
  const handlePanLeft = () => {
    setPanOffset(Math.max(panOffset - 0.1, 0));
  };
  
  const handlePanRight = () => {
    setPanOffset(Math.min(panOffset + 0.1, 1));
  };
  
  // Early return for loading state
  if (isLoading) {
    return (
      <div 
        className={`relative w-full h-${height} bg-gray-900 rounded-md flex items-center justify-center ${className || ''}`}
      >
        <div className="text-white opacity-60">Loading timeline data...</div>
      </div>
    );
  }
  
  // Early return for error state
  if (error || !timelineData.length) {
    return (
      <div 
        className={`relative w-full h-${height} bg-gray-900 rounded-md flex items-center justify-center ${className || ''}`}
      >
        <div className="text-white opacity-60">
          {error || "No timeline data available"}
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-gray-900 rounded-md ${className || ''}`}
      style={{ height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        height={height}
        className="w-full"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Controls */}
      <div className="absolute bottom-2 right-2 flex items-center space-x-2">
        <button 
          className="text-white bg-gray-700 hover:bg-gray-600 h-6 w-6 flex items-center justify-center rounded" 
          onClick={handleZoomIn}
          title="Zoom In"
        >
          +
        </button>
        <button 
          className="text-white bg-gray-700 hover:bg-gray-600 h-6 w-6 flex items-center justify-center rounded" 
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          -
        </button>
        <button 
          className="text-white bg-gray-700 hover:bg-gray-600 h-6 w-6 flex items-center justify-center rounded" 
          onClick={handlePanLeft}
          title="Pan Left"
        >
          ←
        </button>
        <button 
          className="text-white bg-gray-700 hover:bg-gray-600 h-6 w-6 flex items-center justify-center rounded" 
          onClick={handlePanRight}
          title="Pan Right"
        >
          →
        </button>
      </div>
      
      {/* Legend */}
      <div className="absolute top-2 right-2 flex items-center space-x-2 text-xs">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
          <span className="text-white">Brain Activity</span>
        </div>
        {Object.entries(EMOTION_COLORS).slice(0, 3).map(([emotion, color]) => (
          <div key={emotion} className="flex items-center">
            <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }}></div>
            <span className="text-white">{emotion}</span>
          </div>
        ))}
        <div className="cursor-pointer text-white underline" title="Joy, Anger, Sadness, Fear, Disgust, Surprise, Neutral">
          +4
        </div>
      </div>
      
      {/* Hover tooltip */}
      {hoveredPointIndex !== null && timelineData[hoveredPointIndex] && (
        <div 
          className="absolute bg-black bg-opacity-80 text-white text-xs p-2 rounded-md z-10 pointer-events-none"
          style={{
            left: `${hoveredPointIndex * 100 / timelineData.length}%`,
            transform: 'translateX(-50%)',
            top: '25px'
          }}
        >
          <div className="font-bold">
            {timelineData[hoveredPointIndex].dominant_emotion}
          </div>
          <div>
            {new Date(timelineData[hoveredPointIndex].timestamp).toLocaleTimeString()}
          </div>
          <div className="flex gap-1 mt-1">
            {timelineData[hoveredPointIndex].emotion_vector.slice(0, 3).map((value, i) => {
              const emotionName = ["Joy", "Anger", "Sadness"][i];
              return (
                <div key={emotionName} className="flex-1">
                  <div className="h-2 bg-gray-700 rounded-sm overflow-hidden">
                    <div 
                      className="h-full"
                      style={{
                        width: `${value * 100}%`, 
                        backgroundColor: EMOTION_COLORS[emotionName as keyof typeof EMOTION_COLORS]
                      }}
                    ></div>
                  </div>
                  <div className="text-center">{(value * 100).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmotionTimeline;