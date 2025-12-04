import React from 'react';
import { 
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Stack,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

// Agent types and statuses from backend
export enum AgentType {
  EmberUnit = 'EmberUnit',
  CipherGuard = 'CipherGuard',
  Orchestrator = 'Orchestrator',
  Custom = 'Custom',
}

export enum AgentStatus {
  Initializing = 'Initializing',
  Idle = 'Idle',
  Working = 'Working',
  Paused = 'Paused',
  Terminating = 'Terminating',
  Terminated = 'Terminated',
  Error = 'Error',
}

// Task statuses from backend
export enum TaskStatus {
  Queued = 'Queued',
  Planning = 'Planning',
  Running = 'Running',
  AwaitingFeedback = 'Awaiting Feedback',
  Paused = 'Paused',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled'
}

// Interface for agent data
export interface AgentData {
  id: string;
  name: string;
  agentType: AgentType;
  status: AgentStatus;
  currentTaskId?: string;
  currentTaskTitle?: string;
  currentTaskStatus?: TaskStatus;
  progress?: number;
  lastUpdated: string;
  error?: string;
}

interface AgentCardProps {
  agent: AgentData;
  onPause: (agentId: string) => void;
  onResume: (agentId: string) => void;
  onTerminate: (agentId: string) => void;
  onRestart: (agentId: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agent, 
  onPause, 
  onResume, 
  onTerminate,
  onRestart
}) => {
  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.Idle:
        return 'success';
      case AgentStatus.Working:
        return 'primary';
      case AgentStatus.Paused:
        return 'warning';
      case AgentStatus.Error:
        return 'error';
      case AgentStatus.Terminating:
      case AgentStatus.Terminated:
        return 'error';
      case AgentStatus.Initializing:
      default:
        return 'info';
    }
  };

  const getAgentTypeColor = (type: AgentType) => {
    switch (type) {
      case AgentType.EmberUnit:
        return '#FF5722'; // Deep Orange
      case AgentType.CipherGuard:
        return '#4CAF50'; // Green
      case AgentType.Orchestrator:
        return '#2196F3'; // Blue
      default:
        return '#9C27B0'; // Purple for custom
    }
  };

  const getAgentTypeIcon = (type: AgentType) => {
    switch (type) {
      case AgentType.EmberUnit:
        return '🔥'; // Fire emoji for Ember Unit
      case AgentType.CipherGuard:
        return '🔒'; // Lock emoji for Cipher Guard
      case AgentType.Orchestrator:
        return '🎮'; // Controller emoji for Orchestrator
      default:
        return '🤖'; // Robot emoji for custom agents
    }
  };

  // Format time elapsed since last update
  const formatTimeElapsed = (lastUpdated: string) => {
    const lastTime = new Date(lastUpdated).getTime();
    const now = new Date().getTime();
    const elapsed = now - lastTime;
    
    const seconds = Math.floor(elapsed / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Determine if agent can be paused/resumed/terminated based on current status
  const canPause = agent.status === AgentStatus.Working || agent.status === AgentStatus.Idle;
  const canResume = agent.status === AgentStatus.Paused;
  const canTerminate = agent.status !== AgentStatus.Terminated;
  const canRestart = agent.status === AgentStatus.Terminated || agent.status === AgentStatus.Error;

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 2, 
        borderRadius: 2,
        borderLeft: 6,
        borderLeftColor: getAgentTypeColor(agent.agentType),
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 6,
        }
      }}
    >
      <Stack spacing={1.5}>
        {/* Agent Header */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
            {getAgentTypeIcon(agent.agentType)} {agent.name}
          </Typography>
          <Chip 
            size="small"
            label={agent.status}
            color={getStatusColor(agent.status)}
          />
        </Stack>

        {/* Agent Type and ID */}
        <Box>
          <Typography variant="body2" color="text.secondary">
            Type: {agent.agentType}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ID: {agent.id}
          </Typography>
        </Box>
        
        {/* Current Task (if any) */}
        {agent.currentTaskId && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              Current Task: {agent.currentTaskTitle || agent.currentTaskId}
            </Typography>
            {agent.currentTaskStatus && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip 
                  size="small"
                  label={agent.currentTaskStatus}
                  color={agent.currentTaskStatus === TaskStatus.Failed ? 'error' : 'primary'}
                  variant="outlined"
                />
                {agent.progress !== undefined && agent.progress > 0 && (
                  <Box sx={{ width: '100%' }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={agent.progress} 
                      sx={{ height: 8, borderRadius: 4 }} 
                    />
                    <Typography variant="caption" align="right" display="block">
                      {agent.progress}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        )}

        {/* Error message if available */}
        {agent.error && (
          <Typography variant="body2" color="error">
            Error: {agent.error}
          </Typography>
        )}

        {/* Agent Controls */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {canPause && (
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<PauseIcon />}
              onClick={() => onPause(agent.id)}
            >
              Pause
            </Button>
          )}
          {canResume && (
            <Button 
              variant="outlined" 
              size="small"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={() => onResume(agent.id)}
            >
              Resume
            </Button>
          )}
          {canTerminate && (
            <Button 
              variant="outlined" 
              size="small"
              color="error"
              startIcon={<StopIcon />}
              onClick={() => onTerminate(agent.id)}
            >
              Terminate
            </Button>
          )}
          {canRestart && (
            <Button 
              variant="outlined" 
              size="small"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={() => onRestart(agent.id)}
            >
              Restart
            </Button>
          )}
        </Stack>

        {/* Last updated timestamp */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Tooltip title={new Date(agent.lastUpdated).toLocaleString()}>
            <Typography variant="caption" color="text.secondary">
              Last updated: {formatTimeElapsed(agent.lastUpdated)}
            </Typography>
          </Tooltip>
        </Box>
      </Stack>
    </Paper>
  );
};

export default AgentCard;