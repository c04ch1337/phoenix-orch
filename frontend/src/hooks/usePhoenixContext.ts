import { createContext, useContext } from 'react';

type PhoenixContextType = {
  executeOrchestratorScan: (command: string) => void;
  invokeCoreCommand: (command: string, args?: any) => Promise<any>;
  cybersecurityStatus: () => Promise<{
    armed: boolean;
    hak5Devices: string[];
  }>;
  // Cipher Guard specific methods
  cipherGuard: {
    startDefense: (scope: any) => Promise<string>;
    stopDefense: (defenseId: string) => Promise<boolean>;
    getCurrentDefense: () => Promise<any>;
    getDefensePhase: (defenseId: string) => Promise<string>;
    getIncidents: (defenseId: string) => Promise<any[]>;
    executeDefensiveAction: (defenseId: string, actionType: string, parameters: any) => Promise<any>;
    getAssets: (defenseId: string) => Promise<any[]>;
    getEvidenceVault: (defenseId: string) => Promise<any>;
    getDefenseMatrix: (defenseId: string) => Promise<any>;
    getDefenseTimeline: (defenseId: string) => Promise<any>;
    deployBlueTeam: (targetId: string, targetType: string) => Promise<any[]>;
  };
};

const PhoenixContext = createContext<PhoenixContextType>({
  executeOrchestratorScan: () => {},
  invokeCoreCommand: async () => {},
  cybersecurityStatus: async () => ({
    armed: false,
    hak5Devices: []
  }),
  cipherGuard: {
    startDefense: async () => '',
    stopDefense: async () => false,
    getCurrentDefense: async () => null,
    getDefensePhase: async () => '',
    getIncidents: async () => [],
    executeDefensiveAction: async () => null,
    getAssets: async () => [],
    getEvidenceVault: async () => null,
    getDefenseMatrix: async () => null,
    getDefenseTimeline: async () => null,
    deployBlueTeam: async () => []
  }
});

export const PhoenixProvider = PhoenixContext.Provider;

export default function usePhoenixContext() {
  return useContext(PhoenixContext);
}