import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Paper,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';

import AgentDashboard from '../components/agent/AgentDashboard';
import { AgentData, AgentType, AgentStatus } from '../components/agent/AgentCard';
import ArtifactViewer from '../components/artifacts/ArtifactViewer';

// Styled for pulsing animation on error
const PulsingBox = styled(Box)(({ theme }) => ({
  animation: 'pulse 2s infinite',
  '@keyframes pulse': {
    '0%': {
      boxShadow: '0 0 0 0 rgba(255, 0, 0, 0.7)'
    },
    '70%': {
      boxShadow: '0 0 0 15px rgba(255, 0, 0, 0)'
    },
    '100%': {
      boxShadow: '0 0 0 0 rgba(255, 0, 0, 0)'
    }
  }
}));

// Main WeaverMaster component (renamed from /weaver)
const WeaverMaster: React.FC = () => {
  // Application state
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
    neuralink?: boolean; // Flag to trigger Neuralink pulse
  }>({ open: false, message: '', severity: 'info' });
  
  // Ref to store the EventSource instance
  const eventSourceRef = useRef<EventSource | null>(null);

  // Helper to show notifications
  const showNotification = useCallback((message: string, severity: 'success' | 'info' | 'warning' | 'error', neuralink = false) => {
    setNotification({
      open: true,
      message,
      severity,
      neuralink
    });
  }, []);

  // Handle agent-related events from SSE
  const handleAgentEvent = useCallback((event: Event) => {
    try {
      const messageEvent = event as MessageEvent;
      const data = JSON.parse(messageEvent.data);
      console.log('Received agent event:', data);
      
      if (!data.agent_id) return;
      
      // Update agents state based on event data
      setAgents(prevAgents => {
        const existingAgentIndex = prevAgents.findIndex(a => a.id === data.agent_id);
        const payload = data.payload || {};
        
        // Determine agent status from payload
        let agentStatus;
        if (payload.status) {
          agentStatus = payload.status as AgentStatus;
        }
        
        if (existingAgentIndex >= 0) {
          // Update existing agent
          const updatedAgents = [...prevAgents];
          const existingAgent = updatedAgents[existingAgentIndex];
          
          // Only update the fields that are provided in the event
          updatedAgents[existingAgentIndex] = {
            ...existingAgent,
            status: agentStatus || existingAgent.status,
            lastUpdated: data.timestamp || new Date().toISOString(),
            error: payload.error || existingAgent.error,
            // Update task if available
            ...(data.task_id && {
              currentTaskId: data.task_id,
            })
          };
          
          // Check if this is an error status, show notification if so
          if (agentStatus === AgentStatus.Error && payload.error) {
            showNotification(`Agent ${existingAgent.name}: ${payload.error}`, 'error', true);
          }
          
          return updatedAgents;
        } else {
          // New agent, add to list
          // We might not have all info about the agent yet, so use what we have
          const newAgent: AgentData = {
            id: data.agent_id,
            name: payload.name || `Agent-${data.agent_id.substr(0, 6)}`,
            agentType: (payload.type || 'Custom') as AgentType,
            status: agentStatus || AgentStatus.Initializing,
            lastUpdated: data.timestamp || new Date().toISOString(),
            error: payload.error,
            currentTaskId: data.task_id,
          };
          
          return [...prevAgents, newAgent];
        }
      });
    } catch (error) {
      console.error('Error handling agent event:', error);
    }
  }, [showNotification]);
  
  // Handle task-related events from SSE
  const handleTaskEvent = useCallback((event: Event) => {
    try {
      const messageEvent = event as MessageEvent;
      const data = JSON.parse(messageEvent.data);
      console.log('Received task event:', data);
      
      if (!data.task_id) return;
      
      // Update task info for the associated agent
      setAgents(prevAgents => {
        const payload = data.payload || {};
        
        // Find the agent that this task belongs to
        if (!data.agent_id) return prevAgents;
        
        const agentIndex = prevAgents.findIndex(a => a.id === data.agent_id);
        if (agentIndex < 0) return prevAgents;
        
        const updatedAgents = [...prevAgents];
        const agent = updatedAgents[agentIndex];
        
        // Update the agent with task information
        updatedAgents[agentIndex] = {
          ...agent,
          currentTaskId: data.task_id,
          currentTaskTitle: payload.title || agent.currentTaskTitle,
          currentTaskStatus: payload.status || agent.currentTaskStatus,
          progress: payload.progress !== undefined ? payload.progress : agent.progress,
          lastUpdated: data.timestamp || new Date().toISOString()
        };
        
        return updatedAgents;
      });
    } catch (error) {
      console.error('Error handling task event:', error);
    }
  }, []);

  // Connect to the SSE endpoint
  useEffect(() => {
    const connectSSE = () => {
      console.log('Connecting to SSE endpoint...');
      
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Create new EventSource connection
      const eventSource = new EventSource('/api/agent/stream');
      eventSourceRef.current = eventSource;
      
      // Event handlers
      eventSource.onopen = () => {
        console.log('SSE connection established');
        setSseConnected(true);
        setLoading(false);
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setSseConnected(false);
        setError('Failed to connect to agent status stream');
        
        // Try to reconnect after a delay
        setTimeout(() => {
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            connectSSE();
          }
        }, 5000);
      };
      
      // Listen for various event types from the SSE stream
      eventSource.addEventListener('connected', (event) => {
        console.log('SSE initial connection event:', event);
        setSseConnected(true);
      });
      
      eventSource.addEventListener('agent_registered', handleAgentEvent);
      eventSource.addEventListener('agent_status_update', handleAgentEvent);
      eventSource.addEventListener('task_status_update', handleTaskEvent);
      eventSource.addEventListener('task_assigned', handleTaskEvent);
      eventSource.addEventListener('task_created', handleTaskEvent);
    };
    
    connectSSE();
    
    // Clean up on unmount
    return () => {
      console.log('Closing SSE connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleAgentEvent, handleTaskEvent]);
  
  // Load initial agent data
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Transform the data to match our AgentData interface
        const formattedAgents: AgentData[] = data.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          agentType: agent.agent_type as AgentType,
          status: agent.status as AgentStatus,
          lastUpdated: agent.last_updated,
          currentTaskId: agent.current_task_id || undefined,
          error: agent.metadata?.error,
        }));
        
        setAgents(formattedAgents);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch agents');
        setLoading(false);
      }
    };
    
    fetchAgents();
  }, []);
  
  // Handler for viewing task artifacts
  const handleViewArtifacts = useCallback((taskId: string) => {
    setSelectedTask(taskId);
    setShowArtifacts(true);
  }, []);

  // Handler for closing artifacts view
  const handleCloseArtifacts = useCallback(() => {
    setShowArtifacts(false);
  }, []);
  
  // Agent management handlers
  const handleCreateAgent = async (name: string, agentType: AgentType) => {
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          agent_type: agentType,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create agent: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      showNotification(`Agent ${name} created successfully`, 'success');
      
      // New agent will be added via SSE event, but we can add it manually for immediate feedback
      const newAgent: AgentData = {
        id: data.agent_id,
        name,
        agentType,
        status: AgentStatus.Initializing,
        lastUpdated: new Date().toISOString(),
      };
      
      setAgents(prev => [...prev, newAgent]);
      
      return data.agent_id;
    } catch (error) {
      console.error('Error creating agent:', error);
      showNotification(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', true);
      throw error;
    }
  };
  
  const handlePauseAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/pause`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to pause agent: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      showNotification(`Agent paused successfully`, 'success');
      
      // Update will come through SSE, but we can update manually for immediate feedback
      setAgents(prev => 
        prev.map(agent => 
          agent.id === agentId ? { ...agent, status: AgentStatus.Paused } : agent
        )
      );
    } catch (error) {
      console.error('Error pausing agent:', error);
      showNotification(`Failed to pause agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', true);
    }
  };
  
  const handleResumeAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/resume`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to resume agent: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      showNotification(`Agent resumed successfully`, 'success');
      
      // Update will come through SSE, but we can update manually for immediate feedback
      setAgents(prev => 
        prev.map(agent => 
          agent.id === agentId ? { 
            ...agent, 
            status: agent.currentTaskId ? AgentStatus.Working : AgentStatus.Idle 
          } : agent
        )
      );
    } catch (error) {
      console.error('Error resuming agent:', error);
      showNotification(`Failed to resume agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', true);
    }
  };
  
  const handleTerminateAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/terminate`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to terminate agent: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      showNotification(`Agent terminated successfully`, 'success');
      
      // Update will come through SSE, but we can update manually for immediate feedback
      setAgents(prev => 
        prev.map(agent => 
          agent.id === agentId ? { ...agent, status: AgentStatus.Terminating } : agent
        )
      );
    } catch (error) {
      console.error('Error terminating agent:', error);
      showNotification(`Failed to terminate agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', true);
    }
  };
  
  const handleRestartAgent = async (agentId: string) => {
    try {
      // First get the agent details
      const agent = agents.find(a => a.id === agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }
      
      // Create new agent with same details
      const newAgentId = await handleCreateAgent(agent.name, agent.agentType);
      showNotification(`Agent ${agent.name} restarted successfully`, 'success');
    } catch (error) {
      console.error('Error restarting agent:', error);
      showNotification(`Failed to restart agent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', true);
    }
  };
  
  // Render loading state
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh' 
        }}
      >
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading Antigravity Mission Control...
        </Typography>
      </Box>
    );
  }
  
  // Render error state
  if (error && !sseConnected) {
    return (
      <Container sx={{ py: 4 }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 3, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            border: '1px solid',
            borderColor: 'error.main'
          }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            System Error
          </Typography>
          <Typography variant="body1">
            {error}
          </Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Check the backend server status and refresh the page.
          </Typography>
        </Paper>
      </Container>
    );
  }
  
  return (
    <Box sx={{ flexGrow: 1, height: '100vh', overflow: 'hidden' }}>
      <Grid container spacing={0} sx={{ height: '100%' }}>
        {showArtifacts ? (
          <Grid item xs={12} sx={{ height: '100%', p: 2 }}>
            <Box sx={{ height: '100%' }}>
              <ArtifactViewer 
                taskId={selectedTask || undefined} 
                onClose={handleCloseArtifacts}
              />
            </Box>
          </Grid>
        ) : (
          <Grid item xs={12} sx={{ height: '100%' }}>
            <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
              <AgentDashboard
                isConnected={sseConnected}
                agents={agents}
                onCreateAgent={handleCreateAgent}
                onPauseAgent={handlePauseAgent}
                onResumeAgent={handleResumeAgent}
                onTerminateAgent={handleTerminateAgent}
                onRestartAgent={handleRestartAgent}
                onViewArtifacts={handleViewArtifacts}
              />
            </Box>
          </Grid>
        )}
      </Grid>
      
      {/* Notifications with Neuralink pulse */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        {notification.neuralink ? (
          <PulsingBox sx={{ width: '100%' }}>
            <Alert 
              onClose={() => setNotification({ ...notification, open: false })} 
              severity={notification.severity} 
              sx={{ width: '100%' }}
            >
              {notification.message}
            </Alert>
          </PulsingBox>
        ) : (
          <Alert 
            onClose={() => setNotification({ ...notification, open: false })} 
            severity={notification.severity} 
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default WeaverMaster;