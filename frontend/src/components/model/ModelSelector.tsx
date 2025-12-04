import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Stack,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import BuildIcon from '@mui/icons-material/Build';
import AutorenewIcon from '@mui/icons-material/Autorenew';

// Import agent types from AgentCard
import { AgentType } from '../agent/AgentCard';

// Model types from backend
export enum ModelType {
  DeepSeekCoder = 'DeepSeekCoder',
  Claude35 = 'Claude35',
  Gemini3Pro = 'Gemini3Pro',
  LocalLlama70B = 'LocalLlama70B',
}

// Interface for task information
interface TaskInfo {
  id: string;
  title: string;
  agentId?: string;
  agentType?: AgentType;
  currentModel?: ModelType;
}

// Interface for model information
interface ModelInfo {
  type: ModelType;
  name: string;
  maxTokens: number;
  supportsStreaming: boolean;
}

// Model selector props
interface ModelSelectorProps {
  // Selected task (if in task context)
  selectedTask?: TaskInfo;
  // Selected agent (if in agent context)
  selectedAgentId?: string;
  selectedAgentType?: AgentType;
  // Callback when model is changed
  onModelChange?: (modelType: ModelType, taskId?: string, agentId?: string) => Promise<void>;
  // Is the selector in a loading state
  isLoading?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedTask,
  selectedAgentId,
  selectedAgentType,
  onModelChange,
  isLoading = false
}) => {
  // State for the currently selected model
  const [selectedModel, setSelectedModel] = useState<ModelType | ''>('');
  
  // State for the model info dialog
  const [modelInfoOpen, setModelInfoOpen] = useState(false);
  // State for the advanced settings dialog
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  
  // State for notifications
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });

  // List of available models
  const availableModels: ModelInfo[] = [
    {
      type: ModelType.DeepSeekCoder,
      name: 'DeepSeek-Coder-V2',
      maxTokens: 32000,
      supportsStreaming: true,
    },
    {
      type: ModelType.Claude35,
      name: 'Claude 3.5',
      maxTokens: 200000,
      supportsStreaming: true,
    },
    {
      type: ModelType.Gemini3Pro,
      name: 'Gemini 3 Pro',
      maxTokens: 128000,
      supportsStreaming: true,
    },
    {
      type: ModelType.LocalLlama70B,
      name: 'Local Llama 3.1 70B',
      maxTokens: 32000,
      supportsStreaming: true,
    },
  ];

  // Get model name from type
  const getModelName = (type: ModelType): string => {
    const model = availableModels.find(m => m.type === type);
    return model ? model.name : type.toString();
  };

  // Get default model for agent type
  const getDefaultModelForAgentType = (agentType?: AgentType): ModelType => {
    if (agentType === AgentType.EmberUnit) {
      return ModelType.DeepSeekCoder;
    } else if (agentType === AgentType.CipherGuard) {
      return ModelType.Claude35;
    }
    return ModelType.Claude35; // Default fallback
  };

  // Initialize selected model based on task or agent
  useEffect(() => {
    if (selectedTask?.currentModel) {
      setSelectedModel(selectedTask.currentModel);
    } else if (selectedTask) {
      setSelectedModel(getDefaultModelForAgentType(selectedTask.agentType));
    } else if (selectedAgentType) {
      setSelectedModel(getDefaultModelForAgentType(selectedAgentType));
    } else {
      setSelectedModel(ModelType.Claude35); // Default fallback
    }
  }, [selectedTask, selectedAgentType]);

  // Handle model change
  const handleModelChange = (event: any) => {
    setSelectedModel(event.target.value as ModelType);
  };

  // Handle save button click
  const handleSave = useCallback(async () => {
    if (!selectedModel || !onModelChange) return;
    
    try {
      await onModelChange(
        selectedModel as ModelType, 
        selectedTask?.id, 
        selectedAgentId
      );
      
      setNotification({
        open: true,
        message: 'Model selection saved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving model selection:', error);
      setNotification({
        open: true,
        message: `Failed to save model selection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }, [selectedModel, onModelChange, selectedTask, selectedAgentId]);

  // Get color for model chip
  const getModelColor = (modelType: ModelType) => {
    switch (modelType) {
      case ModelType.DeepSeekCoder:
        return '#FF5722'; // Deep Orange for code-focused model
      case ModelType.Claude35:
        return '#2196F3'; // Blue for Claude
      case ModelType.Gemini3Pro:
        return '#4CAF50'; // Green for Gemini
      case ModelType.LocalLlama70B:
        return '#9C27B0'; // Purple for local model
      default:
        return '#9E9E9E'; // Grey fallback
    }
  };

  // Get icon/emoji for model type
  const getModelIcon = (modelType: ModelType) => {
    switch (modelType) {
      case ModelType.DeepSeekCoder:
        return '💻'; // Computer for code-focused
      case ModelType.Claude35:
        return '🧠'; // Brain for Claude
      case ModelType.Gemini3Pro:
        return '🌐'; // Globe for Gemini
      case ModelType.LocalLlama70B:
        return '🦙'; // Llama for Llama
      default:
        return '🤖'; // Robot fallback
    }
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 2, 
        borderRadius: 2,
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 6,
        }
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" fontWeight="medium">
            Model Selection
          </Typography>
          <Tooltip title="View model information">
            <IconButton size="small" onClick={() => setModelInfoOpen(true)}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        
        {/* Context Info */}
        {selectedTask && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              Task: {selectedTask.title}
            </Typography>
            {selectedTask.agentType && (
              <Chip 
                size="small"
                label={selectedTask.agentType}
                sx={{ mt: 0.5 }}
              />
            )}
          </Box>
        )}
        
        {!selectedTask && selectedAgentType && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              Agent Type: {selectedAgentType}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Default model will be used for all tasks unless overridden
            </Typography>
          </Box>
        )}
        
        {/* Model Selector */}
        <FormControl fullWidth variant="outlined">
          <InputLabel id="model-select-label">Model</InputLabel>
          <Select
            labelId="model-select-label"
            value={selectedModel}
            onChange={handleModelChange}
            label="Model"
            disabled={isLoading}
          >
            {availableModels.map(model => (
              <MenuItem key={model.type} value={model.type}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ mr: 1 }}>{getModelIcon(model.type)}</Box>
                  {model.name}
                  {model.type === getDefaultModelForAgentType(selectedTask?.agentType || selectedAgentType) && (
                    <Chip 
                      size="small" 
                      label="Default" 
                      color="primary" 
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {/* Selected Model Display */}
        {selectedModel && (
          <Box 
            sx={{ 
              p: 1.5, 
              borderRadius: 2,
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={getModelName(selectedModel as ModelType)}
                  sx={{ 
                    bgcolor: getModelColor(selectedModel as ModelType),
                    color: 'white',
                    fontWeight: 'medium'
                  }}
                />
                {selectedModel === getDefaultModelForAgentType(selectedTask?.agentType || selectedAgentType) && (
                  <Chip 
                    size="small" 
                    label="Default for this agent" 
                    variant="outlined" 
                  />
                )}
              </Stack>
              <Tooltip title="Advanced settings">
                <IconButton 
                  size="small"
                  onClick={() => setAdvancedSettingsOpen(true)}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            
            {/* Model info preview */}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Max Context: {availableModels.find(m => m.type === selectedModel)?.maxTokens.toLocaleString()} tokens
            </Typography>
          </Box>
        )}
        
        {/* Save Button */}
        <Button
          variant="contained"
          color="primary"
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={isLoading || !selectedModel || selectedModel === ''}
        >
          {isLoading ? 'Saving...' : 'Save Model Selection'}
        </Button>
      </Stack>

      {/* Model Info Dialog */}
      <Dialog open={modelInfoOpen} onClose={() => setModelInfoOpen(false)}>
        <DialogTitle>Model Information</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {availableModels.map(model => (
              <Paper 
                key={model.type} 
                elevation={1} 
                sx={{ 
                  p: 2, 
                  borderLeft: 5, 
                  borderColor: getModelColor(model.type) 
                }}
              >
                <Typography variant="h6" gutterBottom>
                  {getModelIcon(model.type)} {model.name}
                </Typography>

                <Typography variant="body2" paragraph>
                  <strong>Max tokens:</strong> {model.maxTokens.toLocaleString()}
                </Typography>

                <Typography variant="body2">
                  <strong>Features:</strong>
                </Typography>
                <Box sx={{ ml: 2 }}>
                  {model.type === ModelType.DeepSeekCoder && (
                    <>
                      <Typography variant="body2">• Optimized for code tasks and red teaming</Typography>
                      <Typography variant="body2">• Default for Ember Unit agents</Typography>
                      <Typography variant="body2">• Strong code generation capabilities</Typography>
                    </>
                  )}
                  {model.type === ModelType.Claude35 && (
                    <>
                      <Typography variant="body2">• Balanced performance across tasks</Typography>
                      <Typography variant="body2">• Default for Cipher Guard agents</Typography>
                      <Typography variant="body2">• Excellent reasoning capabilities</Typography>
                    </>
                  )}
                  {model.type === ModelType.Gemini3Pro && (
                    <>
                      <Typography variant="body2">• Strong multimodal capabilities</Typography>
                      <Typography variant="body2">• Good for general tasks</Typography>
                      <Typography variant="body2">• Fast response times</Typography>
                    </>
                  )}
                  {model.type === ModelType.LocalLlama70B && (
                    <>
                      <Typography variant="body2">• Privacy-focused local execution</Typography>
                      <Typography variant="body2">• No data leaves your system</Typography>
                      <Typography variant="body2">• Good for sensitive operations</Typography>
                    </>
                  )}
                </Box>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModelInfoOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Advanced Settings Dialog */}
      <Dialog 
        open={advancedSettingsOpen} 
        onClose={() => setAdvancedSettingsOpen(false)}
        maxWidth="md"
      >
        <DialogTitle>Advanced Model Settings</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Adjust advanced parameters for the selected model.
            These settings will be applied for {selectedTask ? 'this specific task' : 'all tasks using this agent'}.
          </DialogContentText>
          
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {getModelIcon(selectedModel as ModelType)} {getModelName(selectedModel as ModelType)} Settings
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Advanced parameter configuration will be available in a future update.
              Currently using default parameters for optimal performance.
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Chip icon={<BuildIcon />} label="Coming Soon" color="primary" />
              <Chip icon={<AutorenewIcon />} label="Use Defaults" variant="outlined" />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvancedSettingsOpen(false)}>Close</Button>
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

export default ModelSelector;