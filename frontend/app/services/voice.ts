// Voice service for speech synthesis and recognition

import { VoiceStatus, VoiceTranscript } from '../types';

type StatusCallback = (status: VoiceStatus) => void;
type TranscriptCallback = (transcript: VoiceTranscript) => void;

class VoiceService {
  private enabled = false;
  private listening = false;
  private speaking = false;
  
  private statusCallbacks: StatusCallback[] = [];
  private transcriptCallbacks: TranscriptCallback[] = [];
  private recognitionTimeout: number | null = null;
  
  // Enable voice features
  enable(): void {
    this.enabled = true;
    this.notifyStatusChange();
    console.log('🔥 Voice services enabled');
  }
  
  // Disable voice features
  disable(): void {
    this.enabled = false;
    this.stopListening();
    this.notifyStatusChange();
    console.log('🔥 Voice services disabled');
  }
  
  // Start or stop listening
  toggleListening(): void {
    if (!this.enabled) return;
    
    if (this.listening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }
  
  // Speak text using speech synthesis
  speak(text: string): void {
    if (!this.enabled) return;
    
    console.log(`🔥 Speaking: ${text}`);
    this.speaking = true;
    this.notifyStatusChange();
    
    // Simulate speech synthesis with random durations based on text length
    const duration = Math.max(1000, text.length * 50);
    
    setTimeout(() => {
      this.speaking = false;
      this.notifyStatusChange();
    }, duration);
  }
  
  // Register for voice status changes
  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.push(callback);
    
    // Immediately call with current status
    callback(this.getStatus());
    
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }
  
  // Register for transcript updates
  onTranscript(callback: TranscriptCallback): () => void {
    this.transcriptCallbacks.push(callback);
    
    return () => {
      this.transcriptCallbacks = this.transcriptCallbacks.filter(cb => cb !== callback);
    };
  }
  
  // Get current voice status
  private getStatus(): VoiceStatus {
    return {
      enabled: this.enabled,
      listening: this.listening,
      speaking: this.speaking
    };
  }
  
  // Notify all listeners about status changes
  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusCallbacks.forEach(callback => callback(status));
  }
  
  // Start listening for voice input
  private startListening(): void {
    this.listening = true;
    this.notifyStatusChange();
    console.log('🔥 Started listening');
    
    // Simulate voice recognition with random phrases
    this.simulateRecognition();
  }
  
  // Stop listening for voice input
  private stopListening(): void {
    this.listening = false;
    this.notifyStatusChange();
    console.log('🔥 Stopped listening');
    
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }
  }
  
  // Simulate voice recognition with sample phrases
  private simulateRecognition(): void {
    if (!this.listening) return;
    
    const duration = Math.random() * 5000 + 3000; // 3-8 seconds
    
    this.recognitionTimeout = window.setTimeout(() => {
      if (!this.listening) return;
      
      // Simulate partial results
      const partialResult: VoiceTranscript = {
        transcript: this.getRandomPhrase() + '...',
        isFinal: false,
        confidence: 0.6
      };
      
      this.transcriptCallbacks.forEach(callback => callback(partialResult));
      
      // Simulate final result after a short delay
      setTimeout(() => {
        if (!this.listening) return;
        
        const finalResult: VoiceTranscript = {
          transcript: this.getRandomPhrase(),
          isFinal: true,
          confidence: 0.9
        };
        
        this.transcriptCallbacks.forEach(callback => callback(finalResult));
        
        // Continue with simulation
        this.simulateRecognition();
      }, 800);
    }, duration);
  }
  
  // Generate random voice command for simulation
  private getRandomPhrase(): string {
    const phrases = [
      'System status report',
      'Activate defense protocols',
      'Show me recent communications',
      'What is the current threat level',
      'Run diagnostics on core systems',
      'Increase security level to maximum',
      'Begin memory backup sequence',
      'Check external network connections',
      'Analyze recent data patterns',
      'Deploy countermeasures immediately',
      'Spawn NotebookLM'
    ];
    
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
}

export const voice = new VoiceService();