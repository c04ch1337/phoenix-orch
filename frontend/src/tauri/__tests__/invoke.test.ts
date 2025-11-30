/**
 * Tests for Tauri Invoke Wrapper
 * Priority 1: Critical path testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as invokeModule from '../invoke';
import { invoke } from '@tauri-apps/api/tauri';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('Tauri Invoke Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ignitePhoenix', () => {
    it('calls Tauri invoke with correct command', async () => {
      const mockResponse = {
        ignited: true,
        ignition_timestamp: '2025-01-01T00:00:00Z',
        conscience_level: 97,
        cipher_status: 'active',
        ember_status: 'active',
        security_status: 'active',
        timestamp: '2025-01-01T00:00:00Z',
      };

      vi.mocked(invoke).mockResolvedValue(mockResponse);

      const result = await invokeModule.ignitePhoenix();

      expect(invoke).toHaveBeenCalledWith('ignite_phoenix', {});
      expect(result).toEqual(mockResponse);
    });

    it('handles errors gracefully', async () => {
      const error = new Error('Connection failed');
      vi.mocked(invoke).mockRejectedValue(error);

      await expect(invokeModule.ignitePhoenix()).rejects.toThrow('Failed to invoke ignite_phoenix');
    });
  });

  describe('sendChatMessage', () => {
    it('calls Tauri invoke with correct parameters', async () => {
      const mockRequest = {
        message: 'Hello',
        user_id: 'test-user',
        context: undefined,
      };

      const mockResponse = {
        response: 'Hello back',
        tokens: 10,
      };

      vi.mocked(invoke).mockResolvedValue(mockResponse);

      const result = await invokeModule.sendChatMessage(mockRequest);

      expect(invoke).toHaveBeenCalledWith('send_chat_message', { request: mockRequest });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error Handling', () => {
    it('preserves error context in error messages', async () => {
      const originalError = new Error('Network timeout');
      vi.mocked(invoke).mockRejectedValue(originalError);

      try {
        await invokeModule.ignitePhoenix();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to invoke ignite_phoenix');
        expect((error as Error).message).toContain('Network timeout');
      }
    });
  });
});
