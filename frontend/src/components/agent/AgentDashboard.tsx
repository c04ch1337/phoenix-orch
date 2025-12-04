import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Grid, 
  Typography, 
  Button, 
  IconButton, 
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Paper,
  Stack,
  InputAdornment,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import AgentCard, { AgentData, AgentType, AgentStatus } from './AgentCard';

interface AgentDashboardProps {
  // SSE connection status
  isConnected: boolean;
  // Agent data fetched from backend
  agents: AgentData[];
  // Handler functions
  onCreateAgent: (name: string, type: AgentType) => void;
  onPauseAgent: (agentId: string) => void;
  onResumeAgent: (agentId: string) => void;
  onTerminateAgent: (agentId: string) => void;
  onRestartAgent: (agentId: string) => void;
}

const AgentDashboard: React.FC<AgentDashboardProps> = ({
  isConnected,
  agents,
  onCreateAgent,
  onPauseAgent,
  onResumeAgent,
  onTerminateAgent,
  onRestartAgent
}) => {
  // State for the create agent dialog
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentType, setNewAgentType] = useState<AgentType>(AgentType.EmberUnit);
  const [isCreating, setIsCreating] = useState(false);

  // State for handling notifications
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });

  // State for search/filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');

  // Filtered agents based on search and status filter
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.agentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Handler for creating a new agent
  const handleCreateAgent = useCallback(async () => {
    if (!newAgentName.trim()) {
      setNotification({
        open: true,
        message: 'Agent name cannot be empty',
        severity: 'error'
      });
      return;
    }

    try {
      setIsCreating(true);
      await onCreateAgent(newAgentName, newAgentType);
      setOpenCreateDialog(false);
      setNewAgentName('');
      setNotification({
        open: true,
        message: `Agent "${newAgentName}" created successfully`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error creating agent:', error);
      setNotification({
        open: true,
        message: `Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setIsCreating(false);
    }
  }, [newAgentName, newAgentType, onCreateAgent]);

  // Connection status indicator
  const renderConnectionStatus = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: isConnected ? 'success.main' : 'error.main',
          mr: 1
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {isConnected ? 'Connected' : 'Disconnected'}
      </Typography>
    </Box>
  );

  // Status filters for dropdown
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: AgentStatus.Idle, label: 'Idle' },
    { value: AgentStatus.Working, label: 'Working' },
    { value: AgentStatus.Paused, label: 'Paused' },
    { value: AgentStatus.Error, label: 'Error' },
    { value: AgentStatus.Terminated, label: 'Terminated' },
  ];

  return (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Dashboard Header */}
      <Stack 
        direction="row" 
        alignItems="center" 
        justifyContent="space-between" 
        sx={{ mb: 3 }}
      >
        <Stack direction="row" alignItems="center">
          <Typography variant="h5" component="h2">
            Agent Mission Control
          </Typography>
          {renderConnectionStatus()}
        </Stack>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
        >
          New Agent
        </Button>
      </Stack>

      {/* Search and Filter */}
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <TextField
          placeholder="Search agents..."
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            )
          }}
        />

        <FormControl variant="outlined" size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AgentStatus | 'all')}
          >
            {statusOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexGrow: 1,
            p: 4
          }}
        >
          <Typography variant="h6" color="text.secondary" align="center">
            No agents created yet
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Click "New Agent" to create your first agent
          </Typography>
        </Box>
      ) : filteredAgents.length === 0 ? (
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flexGrow: 1,
            p: 4
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No agents match your search criteria
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Grid container spacing={3}>
            {filteredAgents.map(agent => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={agent.id}>
                <AgentCard
                  agent={agent}
                  onPause={onPauseAgent}
                  onResume={onResumeAgent}
                  onTerminate={onTerminateAgent}
                  onRestart={onRestartAgent}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Stats Footer */}
      <Stack 
        direction="row" 
        alignItems="center" 
        justifyContent="space-between"
        sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}
      >
        <Typography variant="body2" color="text.secondary">
          {`${agents.length} total agents • ${agents.filter(a => a.status === AgentStatus.Working).length} working • ${agents.filter(a => a.status === AgentStatus.Error).length} in error`}
        </Typography>
        <Tooltip title="Refresh agent data">
          <IconButton size="small" onClick={() => window.location.reload()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Create Agent Dialog */}
      <Dialog open={openCreateDialog} onClose={() => !isCreating && setOpenCreateDialog(false)}>
        <DialogTitle>Create New Agent</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Create a new agent to handle tasks in the Antigravity system.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Agent Name"
            fullWidth
            variant="outlined"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            disabled={isCreating}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel>Agent Type</InputLabel>
            <Select
              value={newAgentType}
              onChange={(e) => setNewAgentType(e.target.value as AgentType)}
              label="Agent Type"
              disabled={isCreating}
            >
              <MenuItem value={AgentType.EmberUnit}>Ember Unit</MenuItem>
              <MenuItem value={AgentType.CipherGuard}>Cipher Guard</MenuItem>
              <MenuItem value={AgentType.Orchestrator}>Orchestrator</MenuItem>
              <MenuItem value={AgentType.Custom}>Custom</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenCreateDialog(false)} 
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateAgent} 
            variant="contained"
            disabled={isCreating || !newAgentName.trim()}
          >
            {isCreating ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default AgentDashboard;