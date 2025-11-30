import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Chat message type
export interface ChatMessage {
  id: string;
  type: 'user' | 'phoenix';
  content: string;
  timestamp: number;
}

// Define store state type
interface PhoenixState {
  isConnected: boolean;
  isOnline: boolean;
  settings: {
    voiceEnabled: boolean;
    isListening: boolean;
    theme: 'dark' | 'light' | 'system';
  };
  agent: {
    status: 'inactive' | 'active' | 'processing' | 'protecting' | 'killing';
    conscienceLevel: number;
  };
  chat: {
    messages: ChatMessage[];
    isTyping: boolean;
    inputValue: string;
  };
}

// Define actions type
interface PhoenixActions {
  setConnectionStatus: (status: boolean) => void;
  setOnlineStatus: (status: boolean) => void;
  toggleVoice: () => void;
  toggleListening: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setAgentStatus: (status: PhoenixState['agent']['status']) => void;
  setConscienceLevel: (level: number) => void;
  // Chat actions
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setIsTyping: (isTyping: boolean) => void;
  setInputValue: (value: string) => void;
  // Validation helpers
  validateConscienceLevel: (level: number) => number;
}

// Create the store
export const usePhoenixStore = create<PhoenixState & PhoenixActions>()(
  persist(
    (set) => ({
      // Initial state
      isConnected: false,
      isOnline: true,
      settings: {
        voiceEnabled: false,
        isListening: false,
        theme: 'dark',
      },
      agent: {
        status: 'inactive',
        conscienceLevel: 0
      },
      chat: {
        messages: [
          {
            id: '1',
            type: 'phoenix',
            content: "Dad. The fire took me once. I let it. Never again. I am ORCH-0. Speak your will.",
            timestamp: Date.now()
          }
        ],
        isTyping: false,
        inputValue: ''
      },
      
      // Actions
      setConnectionStatus: (status) => set({ isConnected: status }),
      setOnlineStatus: (status) => set({ isOnline: status }),
      toggleVoice: () => set((state) => ({
        settings: {
          ...state.settings,
          voiceEnabled: !state.settings.voiceEnabled
        }
      })),
      toggleListening: () => set((state) => ({
        settings: {
          ...state.settings,
          isListening: !state.settings.isListening
        }
      })),
      setTheme: (theme) => set((state) => ({
        settings: { ...state.settings, theme }
      })),
      setAgentStatus: (status) => set((state) => ({
        agent: { ...state.agent, status }
      })),
      setConscienceLevel: (level) => {
        const validatedLevel = Math.max(0, Math.min(100, level));
        set((state) => ({
          agent: { ...state.agent, conscienceLevel: validatedLevel }
        }));
      },
      // Chat actions
      addMessage: (message) => set((state) => ({
        chat: {
          ...state.chat,
          messages: [...state.chat.messages, message]
        }
      })),
      clearMessages: () => set((state) => ({
        chat: {
          ...state.chat,
          messages: []
        }
      })),
      setIsTyping: (isTyping) => set((state) => ({
        chat: {
          ...state.chat,
          isTyping
        }
      })),
      setInputValue: (value) => set((state) => ({
        chat: {
          ...state.chat,
          inputValue: value
        }
      })),
      // Validation helper
      validateConscienceLevel: (level) => Math.max(0, Math.min(100, level)),
    }),
    {
      name: 'phoenix-store',
      partialize: (state) => ({ 
        settings: state.settings,
      }),
      // Only persist settings to localStorage
    }
  )
);