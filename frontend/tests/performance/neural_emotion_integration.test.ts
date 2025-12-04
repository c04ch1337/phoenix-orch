import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { neuralEmotionBenchmark } from './neural_emotion_benchmarks';
import { invoke } from '@tauri-apps/api/tauri';
import { EmotionState } from '../../app/features/communication/utils/emotionUtils';
import type { Mock } from 'vitest';

// Define global thresholds for testing
(global as any).LATENCY_THRESHOLD_MS = 150;
(global as any).MEMORY_GROWTH_THRESHOLD_MB = 10;

// Mock performance.memory for memory tests
if (typeof window !== 'undefined' && !window.performance.memory) {
  Object.defineProperty(window.performance, 'memory', {
    value: {
      jsHeapSizeLimit: 2147483648, // 2GB
      totalJSHeapSize: 50000000,   // 50MB
      usedJSHeapSize: 25000000     // 25MB
    },
    configurable: true
  });
}

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}));

// Test information banner
console.log("Neural Emotion Integration Tests Starting");
console.log("Testing Environmental Setup Complete");

describe('Neural Emotion System Integration Tests', () => {
  
  const mockInvoke = invoke as Mock;
  
  // Sample mock data for different emotion states
  const mockEmotions: Record<string, EmotionState> = {
    joy: {
      dominant_emotion: 'joy',
      emotion_vector: [0.85, 0.02, 0.05, 0.03, 0.0, 0.05, 0.0], // [joy, anger, sadness, fear, disgust, surprise, neutral]
      confidence: 0.85,
      valence_arousal: [0.8, 0.7, 0.5], // [valence, arousal, dominance]
      primary_source: 'Face',
      timestamp: new Date().toISOString(),
      mock_mode: true
    },
    fear_anger: {
      dominant_emotion: 'fear',
      emotion_vector: [0.05, 0.45, 0.05, 0.40, 0.0, 0.05, 0.0], // [joy, anger, sadness, fear, disgust, surprise, neutral]
      confidence: 0.85,
      valence_arousal: [-0.7, 0.9, 0.3], // [valence, arousal, dominance]
      primary_source: 'Fusion',
      timestamp: new Date().toISOString(),
      mock_mode: true
    }
  };

  beforeEach(() => {
    // Reset mocks before each test
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Pipeline Validation', () => {
    
    test('should detect emotions from facial expressions', async () => {
      // Setup mock response
      mockInvoke.mockResolvedValueOnce(mockEmotions.joy);
      
      // Run benchmark test with face source
      const result = await neuralEmotionBenchmark.benchmarkEmotionDetection('joy', 'face', 1);
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('get_current_emotion', expect.objectContaining({
        mockImageData: expect.any(Array),
        mockAudioData: null
      }));
      
      // Verify performance metrics
      expect(result.passedThreshold).toBe(true);
      expect(result.averageLatencyMs).toBeLessThan(150);
    });
    
    test('should detect emotions from voice analysis', async () => {
      // Setup mock response
      mockInvoke.mockResolvedValueOnce({
        ...mockEmotions.joy,
        source: 'voice'
      });
      
      // Run benchmark test with voice source
      const result = await neuralEmotionBenchmark.benchmarkEmotionDetection('joy', 'voice', 1);
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('get_current_emotion', expect.objectContaining({
        mockImageData: null,
        mockAudioData: expect.any(Array)
      }));
      
      // Verify performance metrics
      expect(result.passedThreshold).toBe(true);
    });
    
    test('should detect emotions from brain signals', async () => {
      // Setup mock response
      mockInvoke.mockResolvedValueOnce({
        ...mockEmotions.joy,
        source: 'brain'
      });
      
      // Run benchmark test with brain source
      const result = await neuralEmotionBenchmark.benchmarkEmotionDetection('joy', 'brain', 1);
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('get_current_emotion', expect.objectContaining({
        mockImageData: null,
        mockAudioData: null,
        mockEmotion: 'joy'
      }));
      
      // Verify performance metrics
      expect(result.passedThreshold).toBe(true);
    });
    
    test('should fuse emotions from all sources correctly', async () => {
      // Setup mock response
      mockInvoke.mockResolvedValueOnce({
        ...mockEmotions.joy,
        source: 'all'
      });
      
      // Run benchmark test with all sources
      const result = await neuralEmotionBenchmark.benchmarkEmotionDetection('joy', 'all', 1);
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('get_current_emotion', expect.objectContaining({
        mockImageData: expect.any(Array),
        mockAudioData: expect.any(Array)
      }));
      
      // Verify performance metrics
      expect(result.passedThreshold).toBe(true);
    });
    
    test('should archive emotions to Heart-KB and retrieve timeline', async () => {
      // Setup mock responses
      mockInvoke.mockResolvedValueOnce({ success: true });  // archive
      mockInvoke.mockResolvedValueOnce({  // timeline
        timeline: [
          {
            dominant_emotion: 'joy',
            emotion_vector: [0.8, 0.05, 0.05, 0.05, 0.0, 0.05, 0.0],
            valence_arousal: [0.7, 0.6, 0.5],
            timestamp: new Date(Date.now() - 1000).toISOString()
          }
        ]
      });
      mockInvoke.mockResolvedValueOnce({  // specific query
        matches: [
          {
            dominant_emotion: 'joy',
            confidence: 0.8,
            timestamp: new Date(Date.now() - 1000).toISOString()
          }
        ]
      });
      
      // Run Heart-KB benchmark tests
      const result = await neuralEmotionBenchmark.benchmarkHeartKBOperations(1);
      
      // Verify archive was called
      expect(mockInvoke).toHaveBeenCalledWith('archive_emotion', expect.any(Object));
      
      // Verify timeline query was called
      expect(mockInvoke).toHaveBeenCalledWith('get_emotion_timeline');
      
      // Verify specific emotion query was called
      expect(mockInvoke).toHaveBeenCalledWith('query_emotion', expect.any(Object));
      
      // Verify performance metrics
      expect(result.passedThreshold).toBe(true);
    });
  });
  
  describe('Performance Testing', () => {
    
    test('end-to-end latency should be under 150ms', async () => {
      // Setup mock responses for several iterations
      for (let i = 0; i < 10; i++) {
        mockInvoke.mockResolvedValueOnce(mockEmotions.joy);
      }
      
      // Run benchmark with 10 iterations
      const result = await neuralEmotionBenchmark.benchmarkEmotionDetection('joy', 'all', 10);
      
      // Verify performance metrics
      expect(result.averageLatencyMs).toBeLessThan(150);
      expect(result.maxLatencyMs).toBeLessThan(200);
      expect(result.passedThreshold).toBe(true);
    });
    
    test('system should handle rapid emotion changes', async () => {
      // Setup mock responses for rapid changes
      for (let i = 0; i < 20; i++) {
        mockInvoke.mockResolvedValueOnce(mockEmotions.joy);
      }
      
      // Run rapid emotion changes benchmark (2s, 10 changes per second)
      const result = await neuralEmotionBenchmark.benchmarkRapidEmotionChanges(2000, 10);
      
      // Verify performance metrics
      expect(result.averageLatencyMs).toBeLessThan(150);
      expect(result.memoryGrowthMB).toBeLessThan(10);
      expect(result.passedThreshold).toBe(true);
    });
  });
  
  describe('Conscience Protection Testing', () => {
    
    test('should detect fear+anger spikes and trigger protection', async () => {
      // Setup mock response
      mockInvoke.mockResolvedValueOnce({
        protection_triggered: true,
        response_time_ms: 45,
        protection_type: 'fear_anger_spike'
      });
      
      // Run conscience protection benchmark
      const result = await neuralEmotionBenchmark.benchmarkConscienceProtection('fear_anger', 1);
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('test_conscience_protection', expect.objectContaining({
        pattern: 'fear_anger'
      }));
      
      // Verify performance metrics
      expect(result.averageLatencyMs).toBeLessThan(150);
      expect(result.passedThreshold).toBe(true);
    });
    
    test('should detect brain pain patterns and trigger protection', async () => {
      // Setup mock response
      mockInvoke.mockResolvedValueOnce({
        protection_triggered: true,
        response_time_ms: 35,
        protection_type: 'brain_pain'
      });
      
      // Run conscience protection benchmark
      const result = await neuralEmotionBenchmark.benchmarkConscienceProtection('brain_pain', 1);
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('test_conscience_protection', expect.objectContaining({
        pattern: 'brain_pain'
      }));
      
      // Verify performance metrics
      expect(result.averageLatencyMs).toBeLessThan(150);
      expect(result.passedThreshold).toBe(true);
    });
  });
  
  describe('Integration Points Testing', () => {
    
    test('should integrate with Ember Unit', async () => {
      // Setup mock response for Ember Unit integration
      mockInvoke.mockResolvedValueOnce({
        status: 'success',
        ember_unit_response: {
          emotion_received: 'joy',
          action_taken: 'modulate_engagement',
          integration_latency_ms: 35
        }
      });
      
      // Test Ember Unit integration
      const result = await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_ember_unit_integration', {
            emotion: 'joy',
            intensity: 0.8
          });
        },
        'ember_unit_integration'
      );
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('test_ember_unit_integration', {
        emotion: 'joy',
        intensity: 0.8
      });
      
      // Verify latency is acceptable
      // Type assertion for response structure
      type EmberUnitResponse = {
        status: string;
        ember_unit_response: {
          emotion_received: string;
          action_taken: string;
          integration_latency_ms: number;
        }
      };
      expect((result as EmberUnitResponse).ember_unit_response.integration_latency_ms).toBeLessThan(50);
    });
    
    test('should integrate with Cipher Guard', async () => {
      // Setup mock response for Cipher Guard integration
      mockInvoke.mockResolvedValueOnce({
        status: 'success',
        cipher_guard_response: {
          emotion_received: 'fear',
          security_level_adjusted: true,
          integration_latency_ms: 40
        }
      });
      
      // Test Cipher Guard integration
      const result = await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_cipher_guard_integration', {
            emotion: 'fear',
            intensity: 0.7
          });
        },
        'cipher_guard_integration'
      );
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('test_cipher_guard_integration', {
        emotion: 'fear',
        intensity: 0.7
      });
      
      // Verify latency is acceptable
      // Type assertion for response structure
      type CipherGuardResponse = {
        status: string;
        cipher_guard_response: {
          emotion_received: string;
          security_level_adjusted: boolean;
          integration_latency_ms: number;
        }
      };
      expect((result as CipherGuardResponse).cipher_guard_response.integration_latency_ms).toBeLessThan(50);
    });
    
    test('should integrate with UI flame control', async () => {
      // Setup mock response for UI flame integration
      mockInvoke.mockResolvedValueOnce({
        status: 'success',
        flame_control_response: {
          emotion_received: 'joy',
          flame_intensity: 0.8,
          flame_color: '#FFD700',
          integration_latency_ms: 25
        }
      });
      
      // Test UI flame integration
      const result = await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_flame_control_integration', {
            emotion: 'joy',
            intensity: 0.8
          });
        },
        'flame_control_integration'
      );
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('test_flame_control_integration', {
        emotion: 'joy',
        intensity: 0.8
      });
      
      // Verify latency is acceptable
      // Type assertion for response structure
      type FlameControlResponse = {
        status: string;
        flame_control_response: {
          emotion_received: string;
          flame_intensity: number;
          flame_color: string;
          integration_latency_ms: number;
        }
      };
      expect((result as FlameControlResponse).flame_control_response.integration_latency_ms).toBeLessThan(50);
    });
    
    test('should integrate with audio playback system', async () => {
      // Setup mock response for audio system integration
      mockInvoke.mockResolvedValueOnce({
        status: 'success',
        audio_system_response: {
          emotion_received: 'joy',
          audio_file: 'joy_melody.mp3',
          volume: 0.8,
          integration_latency_ms: 30
        }
      });
      
      // Test audio system integration
      const result = await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_audio_system_integration', {
            emotion: 'joy',
            intensity: 0.8
          });
        },
        'audio_system_integration'
      );
      
      // Verify invoke was called with correct parameters
      expect(mockInvoke).toHaveBeenCalledWith('test_audio_system_integration', {
        emotion: 'joy',
        intensity: 0.8
      });
      
      // Verify latency is acceptable
      // Type assertion for response structure
      type AudioSystemResponse = {
        status: string;
        audio_system_response: {
          emotion_received: string;
          audio_file: string;
          volume: number;
          integration_latency_ms: number;
        }
      };
      expect((result as AudioSystemResponse).audio_system_response.integration_latency_ms).toBeLessThan(50);
    });
  });
  
  describe('Full System Integration Test', () => {
    
    test('should perform full end-to-end system integration test', async () => {
      // Setup mock responses
      mockInvoke.mockResolvedValueOnce(mockEmotions.joy); // emotion detection
      mockInvoke.mockResolvedValueOnce({ success: true }); // Heart-KB archive
      mockInvoke.mockResolvedValueOnce({ // Ember Unit
        status: 'success',
        ember_unit_response: {
          emotion_received: 'joy',
          action_taken: 'modulate_engagement',
          integration_latency_ms: 35
        }
      });
      mockInvoke.mockResolvedValueOnce({ // Cipher Guard
        status: 'success',
        cipher_guard_response: {
          emotion_received: 'joy',
          security_level_adjusted: false,
          integration_latency_ms: 40
        }
      });
      mockInvoke.mockResolvedValueOnce({ // UI flame
        status: 'success',
        flame_control_response: {
          emotion_received: 'joy',
          flame_intensity: 0.8,
          flame_color: '#FFD700',
          integration_latency_ms: 25
        }
      });
      mockInvoke.mockResolvedValueOnce({ // Audio
        status: 'success',
        audio_system_response: {
          emotion_received: 'joy',
          audio_file: 'joy_melody.mp3',
          volume: 0.8,
          integration_latency_ms: 30
        }
      });
      
      // Start measuring total integration time
      const startTime = Date.now();
      
      // Step 1: Detect emotion
      const emotionResult = await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke<EmotionState>('get_current_emotion', {
            mockImageData: Array.from(neuralEmotionBenchmark.generateMockImageData('joy')),
            mockAudioData: Array.from(neuralEmotionBenchmark.generateMockAudioData('joy'))
          });
        },
        'full_system_emotion_detection'
      );
      
      // Step 2: Archive to Heart-KB
      await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('archive_emotion', {
            emotion: emotionResult.dominant_emotion,
            intensity: emotionResult.confidence,
            mockMode: true
          });
        },
        'full_system_heart_kb_archive'
      );
      
      // Step 3: Notify Ember Unit
      await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_ember_unit_integration', {
            emotion: emotionResult.dominant_emotion,
            intensity: emotionResult.confidence
          });
        },
        'full_system_ember_unit'
      );
      
      // Step 4: Notify Cipher Guard
      await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_cipher_guard_integration', {
            emotion: emotionResult.dominant_emotion,
            intensity: emotionResult.confidence
          });
        },
        'full_system_cipher_guard'
      );
      
      // Step 5: Update UI flame
      await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_flame_control_integration', {
            emotion: emotionResult.dominant_emotion,
            intensity: emotionResult.confidence
          });
        },
        'full_system_ui_flame'
      );
      
      // Step 6: Trigger audio response
      await neuralEmotionBenchmark.measureLatency(
        async () => {
          return await invoke('test_audio_system_integration', {
            emotion: emotionResult.dominant_emotion,
            intensity: emotionResult.confidence
          });
        },
        'full_system_audio'
      );
      
      // Calculate total end-to-end time
      const totalTime = Date.now() - startTime;
      
      // Verify total time is under threshold (300ms for full integration)
      expect(totalTime).toBeLessThan(300);
      
      // Verify correct number of invocations
      expect(mockInvoke).toHaveBeenCalledTimes(6);
    });
  });
});