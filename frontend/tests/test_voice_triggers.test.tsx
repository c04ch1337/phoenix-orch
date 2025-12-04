import { describe, it, expect } from 'vitest';

// Simple test suite to verify test environment
describe('Voice Trigger System', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });
  
  it('should recognize SpeechRecognition is available', () => {
    expect(global.SpeechRecognition).toBeDefined();
    expect(global.webkitSpeechRecognition).toBeDefined();
  });

  it('should pass with speech synthesis mocks', () => {
    expect(global.speechSynthesis).toBeDefined();
    expect(global.speechSynthesis.speak).toBeDefined();
  });
});