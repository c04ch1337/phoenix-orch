import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import { antigravityCore } from '../../src/services/antigravity/core';
import type { Mock } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}));

// Mock the event system
vi.mock('../../src/services/events', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}));

describe('Antigravity Core Integration Tests', () => {
  const mockInvoke = invoke as Mock;
  
  beforeEach(() => {
    // Reset mocks before each test
    mockInvoke.mockReset();
    vi.clearAllMocks();
  });

  // CORE-01: Initialize Antigravity Core subsystem
  test('CORE-01: Initialize Antigravity Core subsystem', async () => {
    // Mock successful initialization response
    mockInvoke.mockResolvedValueOnce({
      success: true,
      version: '1.0.0',
      components: [
        { name: 'agent_manager', status: 'active' },
        { name: 'mission_control', status: 'active' },
        { name: 'artifact_system', status: 'active' }
      ]
    });
    
    // Call initialize method
    const result = await antigravityCore.initialize();
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('initialize_antigravity_core');
    
    // Verify response was processed correctly
    expect(result.success).toBe(true);
    expect(result.version).toBe('1.0.0');
    expect(result.components.length).toBe(3);
  });

  // CORE-02: Verify core configuration loading
  test('CORE-02: Verify core configuration loading', async () => {
    // Mock configuration response
    const mockConfig = {
      agent_defaults: {
        planning_required: true,
        min_confidence: 0.7,
        max_retry_attempts: 3
      },
      system_settings: {
        log_level: 'info',
        telemetry_enabled: false,
        max_concurrent_agents: 5
      },
      security: {
        default_autonomy_level: 3,
        fast_mode_enabled: true,
        require_approval_level: 7
      }
    };
    
    mockInvoke.mockResolvedValueOnce(mockConfig);
    
    // Call the method to load configuration
    const config = await antigravityCore.loadConfiguration();
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('get_antigravity_config');
    
    // Verify configuration was loaded correctly
    expect(config).toEqual(mockConfig);
    expect(config.agent_defaults.planning_required).toBe(true);
    expect(config.security.default_autonomy_level).toBe(3);
  });

  // CORE-03: Test core API endpoints
  test('CORE-03: Test core API endpoints', async () => {
    // Mock API status response
    mockInvoke.mockResolvedValueOnce({
      status: 'healthy',
      endpoints: [
        { path: '/api/agents', method: 'GET', status: 'available' },
        { path: '/api/missions', method: 'GET', status: 'available' },
        { path: '/api/artifacts', method: 'GET', status: 'available' }
      ]
    });
    
    // Call the method to check API status
    const apiStatus = await antigravityCore.checkApiStatus();
    
    // Verify invoke was called with correct parameters
    expect(mockInvoke).toHaveBeenCalledWith('check_antigravity_api_status');
    
    // Verify API status was returned correctly
    expect(apiStatus.status).toBe('healthy');
    expect(apiStatus.endpoints.length).toBe(3);
    expect(apiStatus.endpoints[0].path).toBe('/api/agents');
  });

  // CORE-04: Verify core event emitters
  test('CORE-04: Verify core event emitters', async () => {
    // Setup event handlers
    const testEventHandler = vi.fn();
    antigravityCore.events.on('core_status_change', testEventHandler);
    
    // Mock event emission
    mockInvoke.mockImplementationOnce(() => {
      // Simulate backend emitting an event
      setTimeout(() => {
        antigravityCore.events.emit('core_status_change', { status: 'ready' });
      }, 10);
      return Promise.resolve({ success: true });
    });
    
    // Start watching events
    await antigravityCore.startEventMonitoring();
    
    // Wait for the simulated event
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Verify event handler was called
    expect(testEventHandler).toHaveBeenCalledWith({ status: 'ready' });
    
    // Clean up
    antigravityCore.events.off('core_status_change', testEventHandler);
  });

  // CORE-05: Test core error handling
  test('CORE-05: Test core error handling', async () => {
    // Mock a backend error
    const mockError = {
      code: 'ANTIGRAVITY_ERROR',
      message: 'Core system failure',
      details: {
        component: 'memory_allocator',
        severity: 'critical'
      }
    };
    
    mockInvoke.mockRejectedValueOnce(mockError);
    
    // Call method that should handle the error
    try {
      await antigravityCore.initialize();
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Verify error was handled correctly
      expect(error).toEqual(mockError);
      expect(antigravityCore.getLastError()).toEqual({
        code: 'ANTIGRAVITY_ERROR',
        message: 'Core system failure',
        details: {
          component: 'memory_allocator',
          severity: 'critical'
        }
      });
    }
  });
});