import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define API interfaces for network pentest operations
interface NetPentestApi {
  executeNmapScan: (target: string, scanType: string) => Promise<any>;
  generateMetasploitPayload: (options: any) => Promise<any>;
  startBettercapMonitor: (interfaceName: string) => Promise<any>;
  stopBettercapMonitor: () => Promise<void>;
  getActiveScan: (scanId: string) => Promise<any>;
  listAvailableInterfaces: () => Promise<string[]>;
}

// Define the shape of the context data
interface PhoenixContextType {
  netPentestApi: NetPentestApi;
  isLoading: boolean;
  error: string | null;
}

// Create the context with default values
const PhoenixContext = createContext<PhoenixContextType>({
  netPentestApi: {
    executeNmapScan: async () => ({}),
    generateMetasploitPayload: async () => ({}),
    startBettercapMonitor: async () => ({}),
    stopBettercapMonitor: async () => {},
    getActiveScan: async () => ({}),
    listAvailableInterfaces: async () => ([]),
  },
  isLoading: false,
  error: null,
});

// Provider props type
interface PhoenixContextProviderProps {
  children: ReactNode;
}

// Implementation of the actual API calls
const createNetPentestApi = (): NetPentestApi => {
  return {
    executeNmapScan: async (target: string, scanType: string): Promise<any> => {
      const response = await fetch('/api/v1/pentest/nmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target,
          scanType,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Nmap scan failed: ${errorText}`);
      }
      
      return response.json();
    },
    
    generateMetasploitPayload: async (options: any): Promise<any> => {
      const response = await fetch('/api/v1/pentest/metasploit/payload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Metasploit payload generation failed: ${errorText}`);
      }
      
      return response.json();
    },
    
    startBettercapMonitor: async (interfaceName: string): Promise<any> => {
      const response = await fetch('/api/v1/pentest/bettercap/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interface: interfaceName,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bettercap monitor failed: ${errorText}`);
      }
      
      return response.json();
    },
    
    stopBettercapMonitor: async (): Promise<void> => {
      const response = await fetch('/api/v1/pentest/bettercap/monitor', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to stop Bettercap monitor: ${errorText}`);
      }
    },
    
    getActiveScan: async (scanId: string): Promise<any> => {
      const response = await fetch(`/api/v1/pentest/scans/${scanId}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch scan: ${errorText}`);
      }
      
      return response.json();
    },
    
    listAvailableInterfaces: async (): Promise<string[]> => {
      const response = await fetch('/api/v1/pentest/interfaces', {
        method: 'GET',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list network interfaces: ${errorText}`);
      }
      
      const data = await response.json();
      return data.interfaces || [];
    },
  };
};

// Create the context provider component
export const PhoenixContextProvider: React.FC<PhoenixContextProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [netPentestApi] = useState<NetPentestApi>(createNetPentestApi());

  // Initialize any required resources or validate connection
  useEffect(() => {
    const initializeContext = async () => {
      try {
        // Could do initial service health check here
        setIsLoading(false);
      } catch (err) {
        setError(`Failed to initialize Phoenix services: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };

    initializeContext();
  }, []);
  
  return (
    <PhoenixContext.Provider
      value={{
        netPentestApi,
        isLoading,
        error,
      }}
    >
      {children}
    </PhoenixContext.Provider>
  );
};

// Custom hook for using the context
export const usePhoenixContext = () => useContext(PhoenixContext);