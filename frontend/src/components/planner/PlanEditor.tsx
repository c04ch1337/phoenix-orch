import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  IconButton,
  Button,
  TextField,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as EditIcon,
  PlayArrow as ExecuteIcon,
  SkipNext as SkipIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Done as DoneIcon,
  Warning as WarningIcon,
  LightbulbOutlined as FlameIcon,
  Send as SendIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { yellow } from '@mui/material/colors';

// Types definitions for plans
export interface PlanStep {
  id: string;
  number: number;
  description: string;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Skipped' | 'Failed' | 'Modified';
  metadata: Record<string, string>;
  agent_feedback?: string;
  user_feedback?: string;
}

export interface PlanInfo {
  id: string;
  title: string;
  description: string;
  task_id: string;
  agent_id: string;
  state: 'Drafting' | 'AwaitingFeedback' | 'Approved' | 'Rejected' | 'InExecution' | 'Completed' | 'Failed';
  created_at: string;
  updated_at: string;
  steps: PlanStep[];
  artifact_id?: string;
  awaiting_feedback: boolean;
  metadata: Record<string, string>;
}

// Styled components
const StyledFlameIcon = styled(FlameIcon)(({ theme, awaitingfeedback }: { theme: any, awaitingfeedback: string }) => ({
  color: awaitingfeedback === 'true' ? yellow[700] : theme.palette.text.disabled,
  animation: awaitingfeedback === 'true' ? 'pulse 1.5s infinite ease-in-out' : 'none',
}));

const FlameAnimation = styled('style')({
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(1)',
      opacity: 1,
    },
    '50%': {
      transform: 'scale(1.1)',
      opacity: 0.7,
    },
    '100%': {
      transform: 'scale(1)',
      opacity: 1,
    },
  },
});

const StepItem = styled(ListItem)(({ theme, status }: { theme: any, status: string }) => ({
  borderLeft: `4px solid ${
    status === 'Completed' ? theme.palette.success.main :
    status === 'InProgress' ? theme.palette.info.main :
    status === 'Skipped' ? theme.palette.warning.main :
    status === 'Failed' ? theme.palette.error.main :
    status === 'Modified' ? yellow[700] :
    theme.palette.divider
  }`,
  marginBottom: '8px',
  borderRadius: '4px',
  backgroundColor: theme.palette.background.paper,
}));

const ModifiedText = styled(Typography)({
  fontStyle: 'italic',
});

// Main PlanEditor component
interface PlanEditorProps {
  taskId?: string;
  planId?: string;
  onClose?: () => void;
}

const PlanEditor: React.FC<PlanEditorProps> = ({
  taskId,
  planId,
  onClose,
}) => {
  // State variables
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<PlanStep | null>(null);
  const [editAction, setEditAction] = useState<'modify' | 'skip' | 'approach' | 'add'>('modify');
  const [editStepText, setEditStepText] = useState('');
  const [addAfterStepId, setAddAfterStepId] = useState<string | null>(null);
  
  // Status indicators
  const [successAlert, setSuccessAlert] = useState<string | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  // Fetch plans for a task
  const fetchTaskPlans = useCallback(async () => {
    if (!taskId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/plans/task/${taskId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch plans: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setPlans(data);
      
      // Select the first plan if none is selected and plans exist
      if (data.length > 0 && !selectedPlan) {
        setSelectedPlan(data[0]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching plans:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch plans');
      setLoading(false);
    }
  }, [taskId, selectedPlan]);

  // Fetch a specific plan
  const fetchPlan = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plans/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch plan: ${response.status} ${response.statusText}`);
      }
      
      const plan = await response.json();
      setSelectedPlan(plan);
      
      // Update the list if we already have plans loaded
      if (plans.length > 0) {
        const updatedPlans = plans.map(p => p.id === plan.id ? plan : p);
        setPlans(updatedPlans);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching plan:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch plan');
      setLoading(false);
    }
  }, [plans]);

  // Approve the entire plan
  const approvePlan = useCallback(async () => {
    if (!selectedPlan) return;
    
    try {
      const response = await fetch(`/api/plans/${selectedPlan.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ApproveAll',
          user_id: 'human', // In a real app, this would be the user's ID
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to approve plan: ${response.status} ${response.statusText}`);
      }
      
      // Show success indicator
      setSuccessAlert('Plan approved successfully');
      setTimeout(() => setSuccessAlert(null), 3000);
      
      // Refresh the plan to get updated state
      fetchPlan(selectedPlan.id);
    } catch (error) {
      console.error('Error approving plan:', error);
      setErrorAlert(error instanceof Error ? error.message : 'Failed to approve plan');
      setTimeout(() => setErrorAlert(null), 3000);
    }
  }, [selectedPlan, fetchPlan]);

  // Reject the entire plan
  const rejectPlan = useCallback(async () => {
    if (!selectedPlan) return;
    
    try {
      const response = await fetch(`/api/plans/${selectedPlan.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'RejectAll',
          user_id: 'human', // In a real app, this would be the user's ID
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reject plan: ${response.status} ${response.statusText}`);
      }
      
      // Show success indicator
      setSuccessAlert('Plan rejected');
      setTimeout(() => setSuccessAlert(null), 3000);
      
      // Refresh the plan to get updated state
      fetchPlan(selectedPlan.id);
    } catch (error) {
      console.error('Error rejecting plan:', error);
      setErrorAlert(error instanceof Error ? error.message : 'Failed to reject plan');
      setTimeout(() => setErrorAlert(null), 3000);
    }
  }, [selectedPlan, fetchPlan]);

  // Modify a step in a plan
  const openEditDialog = (step: PlanStep, action: 'modify' | 'skip' | 'approach' | 'add') => {
    setEditingStep(step);
    setEditingStepId(step.id);
    setEditAction(action);
    
    if (action === 'modify') {
      setEditStepText(step.description);
    } else if (action === 'approach') {
      setEditStepText(''); // Start with empty text for approach
    } else if (action === 'add') {
      setAddAfterStepId(step.id);
      setEditStepText(''); // Start with empty text for new step
    }
    
    setEditDialogOpen(true);
  };

  // Submit step feedback
  const submitStepFeedback = async () => {
    if (!selectedPlan || !editingStepId) return;
    
    try {
      let requestBody: any = {
        user_id: 'human', // In a real app, this would be the user's ID
      };
      
      // Create appropriate feedback action based on edit action
      switch (editAction) {
        case 'modify':
          requestBody.action = 'ModifyStep';
          requestBody.step_id = editingStepId;
          requestBody.description = editStepText;
          break;
        case 'skip':
          requestBody.action = 'SkipStep';
          requestBody.step_id = editingStepId;
          break;
        case 'approach':
          requestBody.action = 'ChangeApproach';
          requestBody.step_id = editingStepId;
          requestBody.approach = editStepText;
          break;
        case 'add':
          requestBody.action = 'AddStep';
          requestBody.after_step_id = addAfterStepId;
          requestBody.description = editStepText;
          break;
      }
      
      const response = await fetch(`/api/plans/${selectedPlan.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.status} ${response.statusText}`);
      }
      
      // Close the dialog
      setEditDialogOpen(false);
      
      // Show success indicator
      setSuccessAlert('Feedback submitted successfully');
      setTimeout(() => setSuccessAlert(null), 3000);
      
      // Refresh the plan to get updated state
      fetchPlan(selectedPlan.id);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setErrorAlert(error instanceof Error ? error.message : 'Failed to submit feedback');
      setTimeout(() => setErrorAlert(null), 3000);
    }
  };

  // Connect to SSE for real-time updates
  const connectToSSE = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }
    
    const newEventSource = new EventSource('/api/plans/stream');
    
    newEventSource.onopen = () => {
      console.log('Connected to plans SSE stream');
    };
    
    newEventSource.onerror = (error) => {
      console.error('Plans SSE stream error:', error);
    };
    
    newEventSource.addEventListener('plan_created', (event) => {
      const data = JSON.parse(event.data);
      if (data.task_id === taskId) {
        // Refresh plans if a new one is created for this task
        fetchTaskPlans();
      }
    });
    
    newEventSource.addEventListener('plan_state_updated', (event) => {
      const data = JSON.parse(event.data);
      if (selectedPlan && data.plan_id === selectedPlan.id) {
        // Refresh the plan if its state is updated
        fetchPlan(selectedPlan.id);
      }
    });
    
    newEventSource.addEventListener('plan_step_updated', (event) => {
      const data = JSON.parse(event.data);
      if (selectedPlan && data.plan_id === selectedPlan.id) {
        // Refresh the plan if a step is updated
        fetchPlan(selectedPlan.id);
      }
    });
    
    newEventSource.addEventListener('plan_feedback_requested', (event) => {
      const data = JSON.parse(event.data);
      // If this plan is requesting feedback, refresh it to show the status change
      if (selectedPlan && data.plan_id === selectedPlan.id) {
        fetchPlan(selectedPlan.id);
      } else if (taskId && data.task_id === taskId) {
        // Otherwise, if it's for the same task, refresh all plans
        fetchTaskPlans();
      }
    });
    
    setEventSource(newEventSource);
    
    return () => {
      newEventSource.close();
    };
  }, [eventSource, taskId, selectedPlan, fetchTaskPlans, fetchPlan]);

  // Initial load
  useEffect(() => {
    if (taskId) {
      fetchTaskPlans();
    } else if (planId) {
      fetchPlan(planId);
    }
    
    const cleanup = connectToSSE();
    
    return () => {
      cleanup();
    };
  }, [taskId, planId, fetchTaskPlans, fetchPlan, connectToSSE]);

  // Render plan steps
  const renderPlanSteps = () => {
    if (!selectedPlan) return null;
    
    return (
      <List sx={{ width: '100%', bgcolor: 'background.paper', mt: 2 }}>
        {selectedPlan.steps.map((step, index) => (
          <StepItem key={step.id} status={step.status}>
            <ListItemIcon>
              <Box sx={{ minWidth: '28px', textAlign: 'center' }}>
                <Typography variant="subtitle1">{step.number}</Typography>
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={
                <>
                  {step.status === 'Modified' ? (
                    <ModifiedText>{step.description}</ModifiedText>
                  ) : (
                    step.description
                  )}
                </>
              }
              secondary={
                <>
                  {step.user_feedback && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="primary">
                        User feedback: {step.user_feedback}
                      </Typography>
                    </Box>
                  )}
                  {step.agent_feedback && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="secondary">
                        Agent feedback: {step.agent_feedback}
                      </Typography>
                    </Box>
                  )}
                </>
              }
            />
            <ListItemSecondaryAction>
              <Box sx={{ display: 'flex' }}>
                {selectedPlan.state === 'AwaitingFeedback' && (
                  <>
                    <Tooltip title="Modify step">
                      <IconButton edge="end" onClick={() => openEditDialog(step, 'modify')}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Skip step">
                      <IconButton edge="end" onClick={() => openEditDialog(step, 'skip')}>
                        <SkipIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Change approach">
                      <IconButton edge="end" onClick={() => openEditDialog(step, 'approach')}>
                        <LightbulbOutlined />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add step after this">
                      <IconButton edge="end" onClick={() => openEditDialog(step, 'add')}>
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                <Tooltip title={`Status: ${step.status}`}>
                  <Chip 
                    label={step.status} 
                    size="small" 
                    color={
                      step.status === 'Completed' ? 'success' :
                      step.status === 'InProgress' ? 'primary' :
                      step.status === 'Skipped' ? 'warning' :
                      step.status === 'Failed' ? 'error' :
                      step.status === 'Modified' ? 'secondary' :
                      'default'
                    }
                    sx={{ ml: 1 }}
                  />
                </Tooltip>
              </Box>
            </ListItemSecondaryAction>
          </StepItem>
        ))}
      </List>
    );
  };

  // Render plan list
  const renderPlanList = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (plans.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1">No plans available for this task</Typography>
        </Box>
      );
    }
    
    return (
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            sx={{ 
              mb: 1, 
              cursor: 'pointer',
              bgcolor: selectedPlan?.id === plan.id ? 'action.selected' : 'inherit',
            }}
            onClick={() => fetchPlan(plan.id)}
          >
            <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" noWrap>
                  {plan.title}
                </Typography>
                {plan.awaiting_feedback && (
                  <Tooltip title="Awaiting feedback">
                    <StyledFlameIcon awaitingfeedback="true" />
                  </Tooltip>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Chip 
                  label={plan.state} 
                  size="small" 
                  color={
                    plan.state === 'Completed' ? 'success' :
                    plan.state === 'InExecution' ? 'primary' :
                    plan.state === 'AwaitingFeedback' ? 'warning' :
                    plan.state === 'Rejected' ? 'error' :
                    plan.state === 'Approved' ? 'success' :
                    'default'
                  }
                />
                <Typography variant="caption" color="text.secondary">
                  Steps: {plan.steps.length}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  // Edit dialog
  const renderEditDialog = () => {
    if (!editingStep) return null;
    
    const dialogTitle = 
      editAction === 'modify' ? 'Modify Step' :
      editAction === 'skip' ? 'Skip Step' :
      editAction === 'approach' ? 'Change Approach' :
      'Add New Step';
    
    return (
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {editAction === 'skip' ? (
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to skip step {editingStep.number}: "{editingStep.description}"?
            </Typography>
          ) : (
            <>
              {editAction === 'approach' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body1" gutterBottom>
                    Original step {editingStep.number}: "{editingStep.description}"
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Suggest a different approach for accomplishing this step:
                  </Typography>
                </Box>
              )}
              {editAction === 'add' && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Add a new step after step {editingStep.number}:
                </Typography>
              )}
              <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                label={editAction === 'add' ? "New step description" : 
                      editAction === 'approach' ? "Suggested approach" : "Step description"}
                value={editStepText}
                onChange={(e) => setEditStepText(e.target.value)}
                sx={{ mt: 1 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} color="inherit">Cancel</Button>
          <Button 
            onClick={submitStepFeedback} 
            color="primary"
            disabled={editAction !== 'skip' && !editStepText.trim()}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Main render
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <FlameAnimation />
      
      {/* Alerts */}
      <Collapse in={!!successAlert || !!errorAlert}>
        <Alert 
          severity={successAlert ? "success" : "error"} 
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                setSuccessAlert(null);
                setErrorAlert(null);
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          sx={{ mb: 2 }}
        >
          {successAlert || errorAlert}
        </Alert>
      </Collapse>
      
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">
            {selectedPlan ? selectedPlan.title : 'Implementation Plans'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {selectedPlan?.awaiting_feedback && (
              <Tooltip title="Awaiting feedback">
                <StyledFlameIcon awaitingfeedback="true" sx={{ mr: 1 }} />
              </Tooltip>
            )}
            <Tooltip title="Refresh">
              <IconButton onClick={() => taskId ? fetchTaskPlans() : planId && fetchPlan(planId)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {onClose && (
              <Tooltip title="Close">
                <IconButton onClick={onClose}>
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        {selectedPlan && (
          <Typography variant="body2" color="text.secondary">
            Task ID: {selectedPlan.task_id} | Created: {new Date(selectedPlan.created_at).toLocaleString()} | {selectedPlan.state}
          </Typography>
        )}
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Plan list sidebar */}
        {taskId && (
          <Box sx={{ width: '250px', borderRight: 1, borderColor: 'divider', height: '100%', overflow: 'auto' }}>
            {renderPlanList()}
          </Box>
        )}

        {/* Plan details */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="error">{error}</Typography>
            </Box>
          ) : selectedPlan ? (
            <>
              {/* Plan details section */}
              <Box>
                <Typography variant="h5">{selectedPlan.title}</Typography>
                <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>
                  {selectedPlan.description}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 2 }}>
                  <Chip 
                    label={`Status: ${selectedPlan.state}`}
                    color={
                      selectedPlan.state === 'Completed' ? 'success' :
                      selectedPlan.state === 'InExecution' ? 'primary' :
                      selectedPlan.state === 'AwaitingFeedback' ? 'warning' :
                      selectedPlan.state === 'Rejected' ? 'error' :
                      selectedPlan.state === 'Approved' ? 'success' :
                      'default'
                    }
                    sx={{ mr: 1 }}
                  />
                  
                  {/* Action buttons */}
                  {selectedPlan.awaiting_feedback && (
                    <Box sx={{ ml: 'auto' }}>
                      <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={<ApproveIcon />} 
                        onClick={approvePlan}
                        sx={{ mr: 1 }}
                      >
                        Approve All
                      </Button>
                      <Button 
                        variant="outlined" 
                        color="error" 
                        startIcon={<RejectIcon />} 
                        onClick={rejectPlan}
                      >
                        Reject
                      </Button>
                    </Box>
                  )}
                </Box>
                
                <Divider sx={{ my: 2 }} />
              </Box>
              
              {/* Steps list */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="h6">Implementation Steps</Typography>
                  
                  {selectedPlan.awaiting_feedback && (
                    <Chip 
                      label="Awaiting your feedback"
                      color="warning"
                      icon={<WarningIcon />}
                      sx={{ ml: 2 }}
                    />
                  )}
                </Box>
                
                {renderPlanSteps()}
              </Box>
              
              {/* Feedback section */}
              {selectedPlan.state === 'AwaitingFeedback' && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    <FlameIcon sx={{ verticalAlign: 'middle', mr: 1, color: yellow[700] }} />
                    This plan is waiting for your feedback
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    You can approve the plan as-is, reject it entirely, or modify specific steps.
                    The agent will continue based on your feedback.
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1">No plan selected</Typography>
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Edit dialog */}
      {renderEditDialog()}
    </Paper>
  );
};

export default PlanEditor;