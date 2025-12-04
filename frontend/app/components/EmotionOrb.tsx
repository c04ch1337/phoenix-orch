'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  calculateOrbColor, 
  getPulseRate, 
  getGlowIntensity, 
  getCurrentEmotion, 
  getEmotionDescription,
  type EmotionState
} from '../features/communication/utils/emotionUtils';

interface EmotionOrbProps {
  // Optional className for additional styling
  className?: string;
}

export const EmotionOrb: React.FC<EmotionOrbProps> = ({ className }) => {
  // State for the current emotion
  const [emotion, setEmotion] = useState<EmotionState | null>(null);
  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for showing tooltip on hover
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Ref for the polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to fetch current emotion data
  const fetchEmotionData = async () => {
    try {
      const data = await getCurrentEmotion();
      setEmotion(data);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch emotion data:', err);
      setError('Failed to fetch emotion data');
      setIsLoading(false);
    }
  };
  
  // Set up polling for emotion data
  useEffect(() => {
    // Fetch immediately on mount
    fetchEmotionData();
    
    // Set up polling every 3 seconds
    pollingIntervalRef.current = setInterval(fetchEmotionData, 3000);
    
    // Clean up interval on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);
  
  // Early return for loading state
  if (isLoading) {
    return (
      <div 
        className={`relative w-6 h-6 rounded-full bg-gray-400 animate-pulse ${className}`}
        title="Loading emotion data..."
      />
    );
  }
  
  // Early return for error state
  if (error || !emotion) {
    return (
      <div 
        className={`relative w-6 h-6 rounded-full bg-gray-700 border border-red-500 ${className}`} 
        title={error || "Failed to load emotion data"}
      />
    );
  }
  
  // Calculate visual properties based on emotion
  const orbColor = calculateOrbColor(emotion.emotion_vector);
  const pulseRate = getPulseRate(emotion.valence_arousal[1]); // Based on arousal
  const glowIntensity = getGlowIntensity(emotion.confidence);
  
  // Create animation style for pulsing effect
  const pulseAnimation = `pulse ${pulseRate}s ease-in-out infinite`;
  
  return (
    <div className="relative">
      {/* The emotion orb */}
      <div
        className={`relative w-6 h-6 rounded-full cursor-pointer transition-all duration-300 ${className}`}
        style={{
          backgroundColor: orbColor,
          animation: pulseAnimation,
          filter: `brightness(${glowIntensity})`,
          boxShadow: `0 0 10px ${orbColor}`
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={emotion.dominant_emotion}
      />
      
      {/* Tooltip with detailed emotion data */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white rounded-md shadow-lg z-50">
          <div className="text-sm font-bold mb-1">{emotion.dominant_emotion}</div>
          <div className="text-xs opacity-80 mb-2">{getEmotionDescription(emotion)}</div>
          
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>Confidence:</div>
            <div>{(emotion.confidence * 100).toFixed(0)}%</div>
            
            <div>Valence:</div>
            <div>{emotion.valence_arousal[0] > 0 ? 'Positive' : 'Negative'} ({emotion.valence_arousal[0].toFixed(1)})</div>
            
            <div>Arousal:</div>
            <div>{emotion.valence_arousal[1] > 0 ? 'Energetic' : 'Calm'} ({emotion.valence_arousal[1].toFixed(1)})</div>
            
            <div>Source:</div>
            <div>{emotion.primary_source}</div>
          </div>
          
          {/* Emotion vector visualization as small bars */}
          <div className="mt-2">
            <div className="text-xs mb-1">Emotion Intensities:</div>
            <div className="flex h-2 w-full gap-px">
              {['Joy', 'Anger', 'Sadness', 'Fear', 'Disgust', 'Surprise', 'Neutral'].map((emo, i) => (
                <div 
                  key={emo} 
                  className="h-full"
                  style={{
                    width: `${100 / 7}%`,
                    backgroundColor: calculateOrbColor([0, 0, 0, 0, 0, 0, 0].map((_, idx) => idx === i ? 1 : 0)),
                    transform: `scaleY(${emotion.emotion_vector[i]})`
                  }}
                  title={`${emo}: ${(emotion.emotion_vector[i] * 100).toFixed(0)}%`}
                />
              ))}
            </div>
          </div>
          
          <div className="mt-1 text-xs opacity-60 italic">
            Updated: {new Date(emotion.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmotionOrb;