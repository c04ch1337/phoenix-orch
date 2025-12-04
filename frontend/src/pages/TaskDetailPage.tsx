import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Tab, 
  Tabs, 
  CircularProgress,
  Divider,
  Button,
  Grid,
  Chip
} from '@mui/material';
import { 
  FormatListBulleted as ListIcon,
  Memory as MemoryIcon,
  Description as DescriptionIcon,
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  HourglassEmpty as PendingIcon
} from '@mui/icons-material';

// Import our components
import PlanEditor from '../components/planner/PlanEditor';
import ArtifactViewer from '../components/artifacts/ArtifactViewer';

// Import services
import { fetchTaskPlans } from '../services/planService';

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`task-tabpanel-${index}`}
      aria-labelledby={`task-tab-${index}`}
      {...other}
      style={{ height: 'calc(100% - 48px)', overflow: 'auto' }}
    >
      {value === index && (
        <Box sx={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Task detail page
const TaskDetailPage: React.FC = () => {
  // Get task ID from URL params
  const { taskId } = useParams<{ taskId: string }>();
  
  // State variables
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [hasPendingPlan, setHasPendingPlan] = useState(false);

  // Fetch task data
  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId) return;
      
      setLoading(true);
      try {
        // In a real app, this would be a service call
        const response = await fetch(`/api/tasks/${taskId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch task: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setTask(data);
        
        // Check if there are plans awaiting feedback
        try {
          const plans = await fetchTaskPlans(taskId);
          const pendingPlan = plans.some(plan => plan.awaiting_feedback);
          setHasPendingPlan(pendingPlan);
          
          // If there's a pending plan, switch to the planning tab
          if (pendingPlan) {
            setTabValue(1); // Planning tab
          }
        } catch (err) {
          console.error('Error checking plans:', err);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching task:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch task');
        setLoading(false);
      }
    };
    
    fetchTask();
  }, [taskId]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Display loading state
  if (loading) {
    return (
      <Container sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Display error state
  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error" variant="h6">Error</Typography>
          <Typography>{error}</Typography>
        </Paper>
      </Container>
    );
  }

  // Display when no task is found
  if (!task) {
    return (
      <Container sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6">Task not found</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container 
      maxWidth="xl" 
      sx={{ 
        height: 'calc(100vh - 64px)', 
        display: 'flex', 
        flexDirection: 'column',
        py: 2
      }}
    >
      {/* Task header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h5">{task.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {task.id} | Created: {new Date(task.created_at).toLocaleString()}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Chip 
              label={task.status}
              color={
                task.status === 'Completed' ? 'success' :
                task.status === 'Running' ? 'primary' :
                task.status === 'Failed' ? 'error' :
                'default'
              }
              icon={
                task.status === 'Completed' ? <CheckIcon /> :
                task.status === 'Running' ? <PendingIcon /> :
                task.status === 'Failed' ? <ErrorIcon /> :
                undefined
              }
              sx={{ mr: 1 }}
            />
            <Chip 
              label={`Agent: ${task.agent_id ? task.agent_id.substring(0, 8) : 'None'}`}
              variant="outlined"
              color="primary"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="body1">
              {task.description}
            </Typography>
          </Grid>
          
          {hasPendingPlan && (
            <Grid item xs={12}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 1, 
                  bgcolor: 'warning.light', 
                  color: 'warning.contrastText',
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                  <PendingIcon sx={{ mr: 1, fontSize: '1rem' }} />
                  This task has a plan awaiting your feedback.
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Tabs and content */}
      <Paper 
        sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="task tabs"
          >
            <Tab 
              icon={<DescriptionIcon />} 
              iconPosition="start" 
              label="Details" 
              id="task-tab-0" 
              aria-controls="task-tabpanel-0" 
            />
            <Tab 
              icon={<ListIcon />} 
              iconPosition="start" 
              label={`Planning ${hasPendingPlan ? '(!)' : ''}`} 
              id="task-tab-1" 
              aria-controls="task-tabpanel-1"
              sx={hasPendingPlan ? { color: 'warning.main' } : undefined}
            />
            <Tab 
              icon={<MemoryIcon />} 
              iconPosition="start" 
              label="Artifacts" 
              id="task-tab-2" 
              aria-controls="task-tabpanel-2" 
            />
          </Tabs>
        </Box>

        {/* Task details tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">Task Details</Typography>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">Status</Typography>
                <Typography variant="body1">{task.status}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">Priority</Typography>
                <Typography variant="body1">{task.priority || 'Normal'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1">Progress</Typography>
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ 
                    width: '100%', 
                    bgcolor: 'grey.300', 
                    borderRadius: 1,
                    height: 10,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${task.progress || 0}%`,
                      bgcolor: 'primary.main',
                      borderRadius: 1,
                    }} />
                  </Box>
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
                    {task.progress || 0}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {task.metadata && Object.keys(task.metadata).length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1">Metadata</Typography>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  {Object.entries(task.metadata).map(([key, value]: [string, any]) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <Typography variant="subtitle2" color="text.secondary">{key}</Typography>
                      <Typography variant="body2">{value}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Planning tab - uses our new PlanEditor component */}
        <TabPanel value={tabValue} index={1}>
          <PlanEditor taskId={taskId} />
        </TabPanel>

        {/* Artifacts tab - uses existing ArtifactViewer component */}
        <TabPanel value={tabValue} index={2}>
          <ArtifactViewer taskId={taskId} />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default TaskDetailPage;