/**
 * TypeScript declaration for Phoenix Orch global window extensions
 */
interface HardwareCommandRequest {
  command: string;
  userId: string;
  isThought?: boolean;
}

interface HardwareCommandResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Mobile device command interfaces
interface MobileCommandRequest {
  command: string;
  userId: string;
  isThought?: boolean;
}

interface MobileCommandResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface CybersecurityModeRequest {
  enabled: boolean;
}

interface PhoenixOrch {
  executeHardwareCommand: (request: HardwareCommandRequest) => Promise<HardwareCommandResponse>;
  getHardwareStatus: () => Promise<string>;
  executeMobileCommand: (request: MobileCommandRequest) => Promise<MobileCommandResponse>;
  getMobileStatus: () => Promise<string>;
  setMobileCybersecurityMode: (request: CybersecurityModeRequest) => Promise<MobileCommandResponse>;
  
  // Hak5 device control
  execute_hak5_command: (request: HardwareCommandRequest) => Promise<HardwareCommandResponse>;
  get_hak5_status: () => Promise<string>;
  get_hak5_network_map: () => Promise<any>;
}

interface TauriInvoke {
  invoke: (command: string, args?: any) => Promise<any>;
}

declare global {
  interface Window {
    phoenixOrch?: PhoenixOrch;
    __TAURI__?: TauriInvoke;
    _captureInterval?: NodeJS.Timeout | null;
  }
}

export {};