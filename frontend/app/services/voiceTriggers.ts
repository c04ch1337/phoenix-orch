'use client';

import { voice } from './voice';
import { usePhoenixContext } from '../hooks/usePhoenixContext';
import { useMobileConscienceGate } from '../hooks/useMobileConscienceGate';
import { VoiceStatus } from '../types';

/**
 * Voice trigger patterns for Ember Unit mode activation/deactivation
 */
export const VOICE_TRIGGER_PATTERNS = {
  EMBER_UNIT_MODE: [
    /phoenix.*ember.*unit.*mode/i,     // "Phoenix, Ember Unit mode"
    /phoenix.*arm.*ember.*unit/i,      // "Phoenix, arm Ember Unit" 
    /phoenix.*full.*ember/i,           // "Phoenix, full Ember"
    /ember.*unit.*mode/i,
    /activate.*ember.*unit/i,
    /enable.*ember.*unit/i
  ],
  NORMAL_MODE: [
    /phoenix.*normal.*mode/i,
    /normal.*mode/i,
    /deactivate.*ember.*unit/i,
    /disable.*ember.*unit/i,
    /ember.*unit.*off/i
  ]
};

/**
 * Voice trigger handler service for Ember Unit mode
 */
class VoiceTriggerService {
  private isInitialized = false;
  private phoenixContext: any = null;
  private mobileConscienceGate: any = null;

  /**
   * Initialize the voice trigger service
   */
  initialize(phoenixContext: any, mobileConscienceGate: any) {
    if (this.isInitialized) return;

    this.phoenixContext = phoenixContext;
    this.mobileConscienceGate = mobileConscienceGate;
    this.isInitialized = true;

    // Register voice transcript listener
    voice.onTranscript(this.handleVoiceTranscript.bind(this));
    
    console.log('🔥 VoiceTriggerService: Initialized Ember Unit mode voice triggers');
  }

  /**
   * Handle incoming voice transcripts
   */
  private async handleVoiceTranscript(result: any) {
    if (!result.isFinal || !result.transcript.trim()) return;

    const transcript = result.transcript.toLowerCase().trim();
    console.log('🔥 VoiceTriggerService: Processing transcript:', transcript);

    // Check for Ember Unit mode triggers
    if (this.isEmberUnitModeTrigger(transcript)) {
      await this.activateEmberUnitMode();
      return;
    }

    // Check for normal mode triggers
    if (this.isNormalModeTrigger(transcript)) {
      await this.deactivateEmberUnitMode();
      return;
    }

    // Check for mixed triggers (both phrases in one utterance)
    if (this.isMixedModeTrigger(transcript)) {
      await this.handleMixedModeTrigger(transcript);
      return;
    }
  }

  /**
   * Check if transcript contains Ember Unit mode trigger
   */
  private isEmberUnitModeTrigger(transcript: string): boolean {
    return VOICE_TRIGGER_PATTERNS.EMBER_UNIT_MODE.some(pattern => 
      pattern.test(transcript)
    );
  }

  /**
   * Check if transcript contains normal mode trigger
   */
  private isNormalModeTrigger(transcript: string): boolean {
    return VOICE_TRIGGER_PATTERNS.NORMAL_MODE.some(pattern => 
      pattern.test(transcript)
    );
  }

  /**
   * Check for mixed triggers (both phrases in one utterance)
   */
  private isMixedModeTrigger(transcript: string): boolean {
    const hasEmberUnitTrigger = this.isEmberUnitModeTrigger(transcript);
    const hasNormalTrigger = this.isNormalModeTrigger(transcript);
    
    return hasEmberUnitTrigger && hasNormalTrigger;
  }

  /**
   * Handle mixed mode triggers intelligently
   */
  private async handleMixedModeTrigger(transcript: string) {
    console.log('🔥 VoiceTriggerService: Mixed mode trigger detected');
    
    // Determine which command comes last in the transcript
    const emberUnitIndex = Math.min(
      ...VOICE_TRIGGER_PATTERNS.EMBER_UNIT_MODE
        .map(pattern => transcript.search(pattern))
        .filter(index => index >= 0)
    );
    
    const normalIndex = Math.min(
      ...VOICE_TRIGGER_PATTERNS.NORMAL_MODE
        .map(pattern => transcript.search(pattern))
        .filter(index => index >= 0)
    );

    // Execute the command that appears last (most recent intention)
    if (emberUnitIndex > normalIndex) {
      await this.activateEmberUnitMode();
    } else {
      await this.deactivateEmberUnitMode();
    }
  }

  /**
   * Activate Ember Unit mode atomically
   */
  private async activateEmberUnitMode() {
    console.log('🔥 VoiceTriggerService: Activating Ember Unit mode');
    
    try {
      // Update frontend context immediately for responsive UX
      this.updatePhoenixContext('Jamey 2.0 EMBER UNIT');
      
      // Update mobile conscience gate backend
      await this.updateMobileConscienceGate(true);
      
      // Provide voice feedback
      this.provideVoiceFeedback('Ember Unit mode activated. Full offensive capabilities unlocked.');
      
      console.log('🔥 VoiceTriggerService: Ember Unit mode activated successfully');
    } catch (error) {
      console.error('🔥 VoiceTriggerService: Failed to activate Ember Unit mode:', error);
      this.provideVoiceFeedback('Failed to activate Ember Unit mode. Please try again.');
    }
  }

  /**
   * Deactivate Ember Unit mode (return to normal mode)
   */
  private async deactivateEmberUnitMode() {
    console.log('🔥 VoiceTriggerService: Deactivating Ember Unit mode');
    
    try {
      // Update frontend context immediately for responsive UX
      this.updatePhoenixContext('Jamey 2.0');
      
      // Update mobile conscience gate backend
      await this.updateMobileConscienceGate(false);
      
      // Provide voice feedback
      this.provideVoiceFeedback('Normal mode restored. Offensive capabilities disarmed.');
      
      console.log('🔥 VoiceTriggerService: Ember Unit mode deactivated successfully');
    } catch (error) {
      console.error('🔥 VoiceTriggerService: Failed to deactivate Ember Unit mode:', error);
      this.provideVoiceFeedback('Failed to deactivate Ember Unit mode.');
    }
  }

  /**
   * Update Phoenix context with new user profile
   */
  private updatePhoenixContext(userName: string) {
    if (!this.phoenixContext) return;
    
    this.phoenixContext.setUser({ 
      name: userName,
      lastActive: new Date().toISOString()
    });
  }

  /**
   * Update mobile conscience gate backend
   */
  private async updateMobileConscienceGate(emberUnitMode: boolean) {
    if (!this.mobileConscienceGate) return;
    
    // Use the existing toggle functionality
    const currentMode = this.mobileConscienceGate.mobileSettings?.cybersecurityMode;
    
    // Only toggle if the mode is different
    if (currentMode !== emberUnitMode) {
      await this.mobileConscienceGate.toggleCybersecurityMode();
    }
  }

  /**
   * Provide voice feedback for user confirmation
   */
  provideVoiceFeedback(message: string) {
    // Simple implementation - speak directly since we're already in voice context
    try {
      voice.speak(message);
    } catch (error) {
      console.log('Voice feedback unavailable');
    }
  }

  /**
   * Manual trigger for testing and external integration
   */
  async triggerEmberUnitMode(enable: boolean) {
    if (enable) {
      await this.activateEmberUnitMode();
    } else {
      await this.deactivateEmberUnitMode();
    }
  }

  /**
   * Cleanup the service
   */
  destroy() {
    this.isInitialized = false;
    this.phoenixContext = null;
    this.mobileConscienceGate = null;
  }
}

/**
 * Hook for using voice triggers in React components
 */
export function useVoiceTriggers() {
  const phoenix = usePhoenixContext();
  const mobileConscienceGate = useMobileConscienceGate();
  const voiceTriggerService = new VoiceTriggerService();

  // Initialize the service when hook is used
  voiceTriggerService.initialize(phoenix, mobileConscienceGate);

  return {
    triggerEmberUnitMode: (enable: boolean) =>
      voiceTriggerService.triggerEmberUnitMode(enable),
    isEmberUnitModeActive: () =>
      mobileConscienceGate.isCybersecurityContextActive
  };
}

// Export singleton instance for global use
export const voiceTriggers = new VoiceTriggerService();