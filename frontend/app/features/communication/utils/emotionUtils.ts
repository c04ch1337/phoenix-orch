import { invoke } from '@tauri-apps/api/tauri';

/**
 * Represents the set of basic emotions detected by the engine
 */
export type BasicEmotion = 
  | 'Joy' 
  | 'Anger' 
  | 'Sadness' 
  | 'Fear' 
  | 'Disgust' 
  | 'Surprise' 
  | 'Neutral';

/**
 * Represents the source of emotion data
 */
export type EmotionSource = 'Face' | 'Voice' | 'BrainSignals' | 'Fusion';

/**
 * Frontend-friendly structure representing the current emotional state
 */
export interface EmotionState {
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Dominant emotion detected */
  dominant_emotion: string;
  
  /** Confidence score for the dominant emotion (0.0-1.0) */
  confidence: number;
  
  /** Full vector of emotion probabilities 
   * [joy, anger, sadness, fear, disgust, surprise, neutral]
   */
  emotion_vector: number[];
  
  /** Valence, arousal and dominance values */
  valence_arousal: number[]; // [valence, arousal, dominance]
  
  /** Primary source that contributed most to this analysis */
  primary_source: string;
  
  /** Whether this is in mock mode or real mode */
  mock_mode: boolean;
}

/**
 * Frontend-friendly structure representing a point in the emotion timeline
 */
export interface EmotionPoint {
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Dominant emotion at this point */
  dominant_emotion: string;
  
  /** Emotion vector at this point */
  emotion_vector: number[];
  
  /** Valence and arousal values at this point */
  valence_arousal: number[];
}

/**
 * Maps emotions to their corresponding colors
 */
export const EMOTION_COLORS: Record<BasicEmotion, string> = {
  Joy: '#FFD700', // Gold
  Anger: '#DC143C', // Crimson
  Sadness: '#4169E1', // RoyalBlue
  Fear: '#9932CC', // DarkOrchid
  Disgust: '#32CD32', // LimeGreen
  Surprise: '#FF8C00', // DarkOrange
  Neutral: '#A9A9A9' // DarkGrey
};

/**
 * Fetches the current emotional state from the backend
 */
export async function getCurrentEmotion(): Promise<EmotionState> {
  try {
    return await invoke<EmotionState>('get_current_emotion');
  } catch (error) {
    console.error('Error fetching current emotion:', error);
    throw error;
  }
}

/**
 * Fetches the emotion timeline from the backend
 */
export async function getEmotionTimeline(): Promise<EmotionPoint[]> {
  try {
    return await invoke<EmotionPoint[]>('get_emotion_timeline');
  } catch (error) {
    console.error('Error fetching emotion timeline:', error);
    throw error;
  }
}

/**
 * Calculates a color for the emotion orb based on the emotion vector
 */
export function calculateOrbColor(emotionVector: number[]): string {
  if (!emotionVector || emotionVector.length < 7) {
    return EMOTION_COLORS.Neutral;
  }
  
  // Find the dominant emotion
  const emotions: BasicEmotion[] = ['Joy', 'Anger', 'Sadness', 'Fear', 'Disgust', 'Surprise', 'Neutral'];
  const dominantIndex = emotionVector.reduce(
    (maxIndex, value, index, array) => value > array[maxIndex] ? index : maxIndex, 
    0
  );
  const dominantEmotion = emotions[dominantIndex] as BasicEmotion;
  
  return EMOTION_COLORS[dominantEmotion];
}

/**
 * Gets pulse rate based on arousal (intensity)
 * @param arousal Value between -1 and 1
 * @returns Pulse rate in seconds
 */
export function getPulseRate(arousal: number): number {
  // Map arousal from [-1, 1] to [3, 0.5] seconds
  // High arousal = fast pulse, low arousal = slow or no pulse
  return Math.max(0.5, 3 - (arousal + 1) * 1.25);
}

/**
 * Calculates a brightness (glow intensity) based on the confidence
 * @param confidence Value between 0 and 1
 * @returns CSS brightness filter value
 */
export function getGlowIntensity(confidence: number): number {
  // Map confidence from [0, 1] to [1, 2.5]
  return 1 + confidence * 1.5;
}

/**
 * Formats a date string for display in the timeline
 */
export function formatTimeDisplay(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

/**
 * Creates a simplified description of the emotional state
 */
export function getEmotionDescription(emotionState: EmotionState): string {
  const dominantEmotion = emotionState.dominant_emotion;
  const valence = emotionState.valence_arousal[0]; // -1 to 1
  const arousal = emotionState.valence_arousal[1]; // -1 to 1
  
  let intensity = 'moderate';
  if (emotionState.confidence > 0.8) intensity = 'strong';
  else if (emotionState.confidence < 0.4) intensity = 'mild';
  
  let valenceTerm = '';
  if (valence > 0.5) valenceTerm = 'positive';
  else if (valence < -0.5) valenceTerm = 'negative';
  
  let arousalTerm = '';
  if (arousal > 0.5) arousalTerm = 'energetic';
  else if (arousal < -0.5) arousalTerm = 'calm';
  
  let description = `Dad is feeling ${intensity} ${dominantEmotion.toLowerCase()}`;
  
  if (valenceTerm && arousalTerm) {
    description += ` (${valenceTerm} and ${arousalTerm})`;
  } else if (valenceTerm) {
    description += ` (${valenceTerm})`;
  } else if (arousalTerm) {
    description += ` (${arousalTerm})`;
  }
  
  return description;
}