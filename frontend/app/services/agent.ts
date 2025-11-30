// Phoenix agent service for agent state management and actions

import { AgentState, ConversationEntry } from '../types';

type StateChangeCallback = (state: AgentState) => void;

class AgentService {
  private state: AgentState = {
    status: 'inactive',
    conscienceLevel: 0
  };
  
  private stateCallbacks: StateChangeCallback[] = [];
  private memory: ConversationEntry[] = [];
  
  // Initialize and awaken the agent
  async awaken(): Promise<void> {
    console.log('🔥 Awakening Phoenix agent...');
    
    // Simulate initialization process
    this.updateState({
      status: 'processing',
      conscienceLevel: 10
    });
    
    // Simulate gradual conscience level increase
    let level = 10;
    const interval = setInterval(() => {
      level += Math.floor(Math.random() * 5) + 5;
      
      if (level >= 85) {
        clearInterval(interval);
        level = 85;
        
        this.updateState({
          status: 'active',
          conscienceLevel: level
        });
        
        console.log(`🔥 Phoenix agent awakened with conscience level ${level}%`);
      } else {
        this.updateState({
          status: 'processing',
          conscienceLevel: level
        });
      }
    }, 200);
    
    return Promise.resolve();
  }
  
  // Add conversation entry to agent memory
  async addConversation(entry: ConversationEntry): Promise<void> {
    this.memory.push(entry);
    console.log(`🔥 Added to memory: ${entry.role} - ${entry.content.substring(0, 30)}...`);
    return Promise.resolve();
  }
  
  // Protect action
  async protect(): Promise<string> {
    this.updateState({
      ...this.state,
      status: 'protecting'
    });
    
    // Simulate protection process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    this.updateState({
      ...this.state,
      status: 'active'
    });
    
    return "Protection protocol engaged. System secured. Environmental defenses online.";
  }
  
  // Kill action
  async kill(target?: string): Promise<string> {
    this.updateState({
      ...this.state,
      status: 'killing'
    });
    
    // Simulate kill process
    await new Promise(resolve => setTimeout(resolve, 1800));
    
    this.updateState({
      ...this.state,
      status: 'active'
    });
    
    if (target) {
      return `Target "${target}" eliminated. Execution complete.`;
    }
    
    return "Kill command executed. Threat neutralized.";
  }
  
  // Register state change callback
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.push(callback);
    
    // Immediately call with current state
    callback(this.state);
    
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter(cb => cb !== callback);
    };
  }
  
  // Update agent state and notify listeners
  private updateState(newState: AgentState): void {
    this.state = newState;
    this.stateCallbacks.forEach(callback => callback(this.state));
  }
}

export const agent = new AgentService();
export type { AgentState };