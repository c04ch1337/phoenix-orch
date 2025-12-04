'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhoenixContext } from './usePhoenixContext';
import {
  MobilePrivacySettings,
  MobileConscienceRequest,
  MobileConscienceResponse,
  MobileContextProfile,
  HitmLevel,
  RequestOrigin
} from '../types/mobile';

/**
 * Hook for integrating with the mobile conscience gate backend
 * Provides real-time status updates and mobile security management
 */
export const useMobileConscienceGate = () => {
  const phoenix = usePhoenixContext();
  const [mobileSettings, setMobileSettings] = useState<MobilePrivacySettings>({
    cybersecurityMode: false,
    privacyLevel: 75,
    monitoringEnabled: true,
    locationTracking: false,
    appPermissionsRestricted: true,
    networkMonitoring: false,
    deviceEncryption: true,
    remoteWipeEnabled: false,
    lastUpdate: new Date().toISOString()
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  /**
   * Check if cybersecurity context is active
   */
  const isCybersecurityContextActive = useCallback(() => {
    return phoenix.user.name.includes('CYBERSECURITY') || 
           phoenix.runtime.features['mobile-cybersecurity'] === true;
  }, [phoenix.user.name, phoenix.runtime.features]);

  /**
   * Fetch mobile status from the conscience gate backend
   */
  const fetchMobileStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call to mobile conscience gate
      // In production, this would be a real API endpoint
      const response = await fetch('/api/mobile/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${phoenix.user.id}`
        }
      });

      if (!response.ok) {
        throw new Error(`Mobile gate API error: ${response.status}`);
      }

      const data = await response.json();
      
      const newSettings: MobilePrivacySettings = {
        cybersecurityMode: data.cybersecurityMode || isCybersecurityContextActive(),
        privacyLevel: data.privacyLevel || (isCybersecurityContextActive() ? 100 : 75),
        monitoringEnabled: data.monitoringEnabled ?? isCybersecurityContextActive(),
        locationTracking: data.locationTracking ?? isCybersecurityContextActive(),
        appPermissionsRestricted: data.appPermissionsRestricted ?? isCybersecurityContextActive(),
        networkMonitoring: data.networkMonitoring ?? isCybersecurityContextActive(),
        deviceEncryption: data.deviceEncryption ?? true,
        remoteWipeEnabled: data.remoteWipeEnabled ?? false,
        lastUpdate: new Date().toISOString()
      };

      setMobileSettings(newSettings);
      setLastSync(new Date().toISOString());
      
    } catch (err) {
      console.error('Failed to fetch mobile status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Fallback to context-based settings
      const fallbackSettings: MobilePrivacySettings = {
        cybersecurityMode: isCybersecurityContextActive(),
        privacyLevel: isCybersecurityContextActive() ? 100 : 75,
        monitoringEnabled: isCybersecurityContextActive(),
        locationTracking: isCybersecurityContextActive(),
        appPermissionsRestricted: isCybersecurityContextActive(),
        networkMonitoring: isCybersecurityContextActive(),
        deviceEncryption: true,
        remoteWipeEnabled: false,
        lastUpdate: new Date().toISOString()
      };
      
      setMobileSettings(fallbackSettings);
    } finally {
      setIsLoading(false);
    }
  }, [phoenix.user.id, isCybersecurityContextActive]);

  /**
   * Update mobile privacy settings
   */
  const updateMobileSettings = useCallback(async (updates: Partial<MobilePrivacySettings>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call to update settings
      const response = await fetch('/api/mobile/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${phoenix.user.id}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update mobile settings: ${response.status}`);
      }

      const updatedSettings = { ...mobileSettings, ...updates, lastUpdate: new Date().toISOString() };
      setMobileSettings(updatedSettings);
      setLastSync(new Date().toISOString());
      
    } catch (err) {
      console.error('Failed to update mobile settings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [mobileSettings, phoenix.user.id]);

  /**
   * Toggle cybersecurity mode
   */
  const toggleCybersecurityMode = useCallback(async () => {
    const newMode = !mobileSettings.cybersecurityMode;
    await updateMobileSettings({ cybersecurityMode: newMode });
  }, [mobileSettings.cybersecurityMode, updateMobileSettings]);

  /**
   * Evaluate a mobile action through the conscience gate
   */
  const evaluateMobileAction = useCallback(async (
    action: string,
    toolId: string,
    parameters: Record<string, unknown> = {},
    context: Record<string, string> = {}
  ): Promise<MobileConscienceResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const request: MobileConscienceRequest = {
        id: `mobile-${Date.now()}`,
        action,
        toolId,
        parameters,
        context: {
          ...context,
          userId: phoenix.user.id,
          userName: phoenix.user.name,
          cybersecurityMode: mobileSettings.cybersecurityMode.toString(),
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        origin: RequestOrigin.User
      };

      // Simulate API call to conscience gate evaluation
      const response = await fetch('/api/mobile/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${phoenix.user.id}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Conscience gate evaluation failed: ${response.status}`);
      }

      const result: MobileConscienceResponse = await response.json();
      setLastSync(new Date().toISOString());
      
      return result;
      
    } catch (err) {
      console.error('Failed to evaluate mobile action:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Fallback response
      return {
        approved: mobileSettings.cybersecurityMode, // Only approve if cybersecurity mode is active
        reason: err instanceof Error ? err.message : 'Evaluation failed',
        riskScore: 50,
        timestamp: new Date().toISOString()
      };
    } finally {
      setIsLoading(false);
    }
  }, [phoenix.user.id, phoenix.user.name, mobileSettings.cybersecurityMode]);

  /**
   * Add a mobile context profile to the conscience gate
   */
  const addMobileProfile = useCallback(async (profileName: string, profile: MobileContextProfile) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mobile/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${phoenix.user.id}`
        },
        body: JSON.stringify({ profileName, profile })
      });

      if (!response.ok) {
        throw new Error(`Failed to add mobile profile: ${response.status}`);
      }

      setLastSync(new Date().toISOString());
      
    } catch (err) {
      console.error('Failed to add mobile profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [phoenix.user.id]);

  /**
   * Set up real-time updates via SSE
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const eventSource = new EventSource('/api/mobile/events');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'mobile-status-update') {
          setMobileSettings(prev => ({
            ...prev,
            ...data.payload,
            lastUpdate: new Date().toISOString()
          }));
          setLastSync(new Date().toISOString());
        }
      } catch (err) {
        console.error('Failed to parse mobile event:', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('Mobile events SSE error:', err);
    };
    
    return () => {
      eventSource.close();
    };
  }, []);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    fetchMobileStatus();
  }, [fetchMobileStatus]);

  return {
    // State
    mobileSettings,
    isLoading,
    error,
    lastSync,
    
    // Actions
    fetchMobileStatus,
    updateMobileSettings,
    toggleCybersecurityMode,
    evaluateMobileAction,
    addMobileProfile,
    
    // Utilities
    isCybersecurityContextActive: isCybersecurityContextActive()
  };
};

export default useMobileConscienceGate;