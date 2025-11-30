'use client';

import { ConversationEntry } from '@/types';

export interface AgentState {
  status: 'inactive' | 'active' | 'processing' | 'protecting' | 'killing';
  conscienceLevel: number;
}

type AgentStateCallback = (state: AgentState) => void;

class AgentService {
  private state: AgentState = { status: 'inactive', conscienceLevel: 0 };
  private stateCallbacks: Set<AgentStateCallback> = new Set();
  private conversations: ConversationEntry[] = [];

  async awaken(): Promise<void> {
    this.updateState({ status: 'active', conscienceLevel: 0 });
    
    try {
      const response = await fetch('http://localhost:5001/api/v1/agent/awaken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        this.updateState({
          status: 'active',
          conscienceLevel: data.conscience_level || 0,
        });
      }
    } catch (error) {
      console.error('🔥 Agent: Failed to awaken', error);
    }
  }

  async protect(): Promise<string> {
    this.updateState({ status: 'protecting', conscienceLevel: this.state.conscienceLevel });

    try {
      const response = await fetch('http://localhost:5001/api/v1/agent/protect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        this.updateState({ status: 'active', conscienceLevel: data.conscience_level || this.state.conscienceLevel });
        return data.response || 'Protection protocol activated.';
      }
    } catch (error) {
      console.error('🔥 Agent: Failed to protect', error);
    }

    this.updateState({ status: 'active', conscienceLevel: this.state.conscienceLevel });
    return 'Protection protocol activated.';
  }

  async kill(target?: string): Promise<string> {
    this.updateState({ status: 'killing', conscienceLevel: this.state.conscienceLevel });

    try {
      const response = await fetch('http://localhost:5001/api/v1/agent/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });

      if (response.ok) {
        const data = await response.json();
        this.updateState({ status: 'active', conscienceLevel: data.conscience_level || this.state.conscienceLevel });
        return data.response || 'Termination protocol executed.';
      }
    } catch (error) {
      console.error('🔥 Agent: Failed to kill', error);
    }

    this.updateState({ status: 'active', conscienceLevel: this.state.conscienceLevel });
    return target ? `Termination protocol executed for ${target}.` : 'Termination protocol executed.';
  }

  async addConversation(entry: ConversationEntry): Promise<void> {
    this.conversations.push(entry);
    
    try {
      await fetch('http://localhost:5001/api/v1/agent/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('🔥 Agent: Failed to add conversation', error);
    }
  }

  onStateChange(callback: AgentStateCallback): () => void {
    this.stateCallbacks.add(callback);
    callback(this.state);
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  private updateState(newState: Partial<AgentState>): void {
    this.state = { ...this.state, ...newState };
    this.stateCallbacks.forEach(callback => callback(this.state));
  }

  getState(): AgentState {
    return { ...this.state };
  }
}

export const agent = new AgentService();

