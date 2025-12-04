'use client';

import { VoiceStatus, VoiceTranscript } from '../types';

type VoiceStatusCallback = (status: VoiceStatus) => void;
type VoiceTranscriptCallback = (result: VoiceTranscript) => void;

class VoiceService {
  private enabled = false;
  private listening = false;
  private speaking = false;
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private statusCallbacks: Set<VoiceStatusCallback> = new Set();
  private transcriptCallbacks: Set<VoiceTranscriptCallback> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;

      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0]?.transcript || '';
          const isFinal = event.results[current]?.isFinal || false;

          this.transcriptCallbacks.forEach(callback => {
            callback({
              transcript,
              isFinal,
              confidence: event.results[current][0]?.confidence,
            });
          });
        };

        this.recognition.onerror = (event: any) => {
          console.error('🔥 Voice: Recognition error', event.error);
          if (event.error === 'no-speech' || event.error === 'audio-capture') {
            this.listening = false;
            this.notifyStatusChange();
          }
        };

        this.recognition.onend = () => {
          if (this.enabled && this.listening) {
            try {
              this.recognition?.start();
            } catch (error) {
              console.error('🔥 Voice: Failed to restart recognition', error);
              this.listening = false;
              this.notifyStatusChange();
            }
          } else {
            this.listening = false;
            this.notifyStatusChange();
          }
        };
      }
    }
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.notifyStatusChange();
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.stopListening();
    this.stopSpeaking();
    this.notifyStatusChange();
  }

  toggleListening(): void {
    if (!this.enabled) {
      this.enable();
    }

    if (this.listening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  private startListening(): void {
    if (!this.recognition || this.listening) return;

    try {
      this.recognition.start();
      this.listening = true;
      this.notifyStatusChange();
    } catch (error) {
      console.error('🔥 Voice: Failed to start listening', error);
      this.listening = false;
      this.notifyStatusChange();
    }
  }

  private stopListening(): void {
    if (!this.recognition || !this.listening) return;

    try {
      this.recognition.stop();
      this.listening = false;
      this.notifyStatusChange();
    } catch (error) {
      console.error('🔥 Voice: Failed to stop listening', error);
    }
  }

  speak(text: string): void {
    if (!this.enabled || !this.synthesis) return;

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this.speaking = true;
      this.notifyStatusChange();
    };

    utterance.onend = () => {
      this.speaking = false;
      this.notifyStatusChange();
    };

    utterance.onerror = (error) => {
      console.error('🔥 Voice: Synthesis error', error);
      this.speaking = false;
      this.notifyStatusChange();
    };

    this.synthesis.speak(utterance);
  }

  private stopSpeaking(): void {
    if (this.synthesis && this.speaking) {
      this.synthesis.cancel();
      this.speaking = false;
      this.notifyStatusChange();
    }
  }

  onStatusChange(callback: VoiceStatusCallback): () => void {
    this.statusCallbacks.add(callback);
    callback(this.getStatus());
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  onTranscript(callback: VoiceTranscriptCallback): () => void {
    this.transcriptCallbacks.add(callback);
    return () => {
      this.transcriptCallbacks.delete(callback);
    };
  }

  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusCallbacks.forEach(callback => callback(status));
  }

  getStatus(): VoiceStatus {
    return {
      enabled: this.enabled,
      listening: this.listening,
      speaking: this.speaking,
    };
  }
}

export const voice = new VoiceService();
