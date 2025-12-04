/**
 * Type definitions for Phoenix AV Capture system
 */

// Segment data structures

export interface AudioSegment {
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

export interface VideoSegment {
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

export interface Segment {
  id: string;
  timestamp: string;
  duration: number;
  is_important: boolean;
  audio?: AudioSegment;
  video?: VideoSegment;
}

// Privacy-aware segments with redaction metadata

export type RedactionType = 'ChildFace' | 'MedicalDocument' | 'Password' | 'PII' | 'Financial' | string;

export interface PrivacyAwareSegment {
  segment: Segment;
  contains_redactions: boolean;
  redaction_types: RedactionType[];
  has_original_available: boolean;
}

// Vector search types

export interface VectorSearchResult {
  segment_id: string;
  score: number;
  text: string;
  start_time: number;
  end_time: number;
}

// Platform compatibility information

export interface PlatformCompatibility {
  current_platform: 'windows' | 'macos' | 'linux';
  is_compatible_with: {
    windows: boolean;
    macos: boolean;
    linux: boolean;
  };
  platform_specific_features: {
    windows: string[];
    macos: string[];
    linux: string[];
  };
}

// Transcription statistics

export interface TranscriptionStats {
  total_segments: number;
  transcribed_segments: number;
  total_words: number;
  accuracy: number;
  verification_method: string;
  last_verified_date: string;
}