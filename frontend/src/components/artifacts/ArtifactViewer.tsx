import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  IconButton,
  Divider,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Comment as CommentIcon,
  History as HistoryIcon,
  Code as CodeIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  Description as TextIcon,
  DataObject as JsonIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import ReactJson from 'react-json-view';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Types definitions for artifacts
export interface ArtifactInfo {
  id: string;
  title: string;
  artifact_type: string;
  task_id: string;
  agent_id: string;
  created_at: string;
  content_type: string;
  storage_path: string;
  description?: string;
  sequence: number;
  step_id?: string;
  parent_id?: string;
  metadata: Record<string, string>;
}

export interface ArtifactComment {
  id: string;
  artifact_id: string;
  user_id: string;
  text: string;
  created_at: string;
  is_human: boolean;
  parent_id?: string;
  position?: string;
}

// Tab panel component for artifact viewer tabs
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
      id={`artifact-tabpanel-${index}`}
      aria-labelledby={`artifact-tab-${index}`}
      {...other}
      style={{ height: 'calc(100% - 48px)', overflow: 'auto' }}
    >
      {value === index && (
        <Box sx={{ p: 2, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Styled components for the artifact viewer
const StyledCommentSection = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  maxHeight: '300px',
  overflow: 'auto',
}));

const CommentItem = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
}));

const UserComment = styled(CommentItem)(({ theme }) => ({
  borderLeft: `4px solid ${theme.palette.primary.main}`,
}));

const AgentComment = styled(CommentItem)(({ theme }) => ({
  borderLeft: `4px solid ${theme.palette.secondary.main}`,
}));

// Main ArtifactViewer component
interface ArtifactViewerProps {
  taskId?: string;
  artifactId?: string;
  onClose?: () => void;
}

const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  taskId,
  artifactId,
  onClose,
}) => {
  // State variables
  const [tab, setTab] = useState(0);
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactInfo | null>(null);
  const [artifactContent, setArtifactContent] = useState<any>(null);
  const [comments, setComments] = useState<ArtifactComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Fetch artifacts for a task
  const fetchTaskArtifacts = useCallback(async () => {
    if (!taskId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/artifacts/task/${taskId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch artifacts: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setArtifacts(data);
      
      // Select the first artifact if none is selected
      if (data.length > 0 && !selectedArtifact) {
        setSelectedArtifact(data[0]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching artifacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch artifacts');
      setLoading(false);
    }
  }, [taskId, selectedArtifact]);

  // Fetch a specific artifact
  const fetchArtifact = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/artifacts/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch artifact: ${response.status} ${response.statusText}`);
      }
      
      // Find the artifact in the list
      const artifactInfo = artifacts.find(a => a.id === id);
      if (artifactInfo) {
        setSelectedArtifact(artifactInfo);
        
        // Handle content based on type
        if (artifactInfo.artifact_type === 'Json') {
          const jsonData = await response.json();
          setArtifactContent(jsonData);
        } else if (artifactInfo.artifact_type === 'Text' || artifactInfo.artifact_type === 'Logs' || artifactInfo.artifact_type === 'CodeDiff') {
          const textContent = await response.text();
          setArtifactContent(textContent);
        } else {
          // For binary content (images, videos), we'll use the URL directly
          setArtifactContent(URL.createObjectURL(await response.blob()));
        }
        
        // Fetch comments for this artifact
        fetchComments(id);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching artifact:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch artifact');
      setLoading(false);
    }
  }, [artifacts, fetchComments]);

  // Fetch comments for an artifact
  const fetchComments = useCallback(async (artifactId: string) => {
    try {
      const response = await fetch(`/api/artifacts/${artifactId}/comments`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, []);

  // Add a comment to an artifact
  const addComment = useCallback(async () => {
    if (!selectedArtifact || !commentText.trim()) return;
    
    try {
      const response = await fetch(`/api/artifacts/${selectedArtifact.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'human', // In a real app, this would be the user's ID
          text: commentText,
          is_human: true,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.status} ${response.statusText}`);
      }
      
      // Clear comment text and refresh comments
      setCommentText('');
      fetchComments(selectedArtifact.id);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }, [selectedArtifact, commentText, fetchComments]);

  // Connect to SSE for real-time updates
  const connectToSSE = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }
    
    const newEventSource = new EventSource('/api/artifacts/stream');
    
    newEventSource.onopen = () => {
      console.log('Connected to artifacts SSE stream');
    };
    
    newEventSource.onerror = (error) => {
      console.error('Artifacts SSE stream error:', error);
    };
    
    newEventSource.addEventListener('artifact_created', (event) => {
      const data = JSON.parse(event.data);
      if (data.task_id === taskId) {
        // Refresh artifacts if a new one is created for this task
        fetchTaskArtifacts();
      }
    });
    
    newEventSource.addEventListener('artifact_comment_added', (event) => {
      const data = JSON.parse(event.data);
      if (selectedArtifact && data.artifact_id === selectedArtifact.id) {
        // Refresh comments if a new one is added for the selected artifact
        fetchComments(selectedArtifact.id);
      }
    });
    
    setEventSource(newEventSource);
    
    return () => {
      newEventSource.close();
    };
  }, [eventSource, taskId, selectedArtifact, fetchTaskArtifacts, fetchComments]);

  // Initial load
  useEffect(() => {
    if (taskId) {
      fetchTaskArtifacts();
    } else if (artifactId) {
      fetchArtifact(artifactId);
    }
    
    const cleanup = connectToSSE();
    
    return () => {
      cleanup();
    };
  }, [taskId, artifactId, fetchTaskArtifacts, fetchArtifact, connectToSSE]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };

  // Render content based on artifact type
  const renderArtifactContent = () => {
    if (!selectedArtifact || !artifactContent) {
      return <Typography>No content to display</Typography>;
    }
    
    switch (selectedArtifact.artifact_type) {
      case 'Json':
        return (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <ReactJson 
              src={artifactContent} 
              theme="monokai" 
              displayDataTypes={false} 
              enableClipboard={true}
              style={{ padding: '10px', borderRadius: '4px' }}
            />
          </Box>
        );
      
      case 'CodeDiff':
        return (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <SyntaxHighlighter 
              language="diff" 
              style={docco} 
              showLineNumbers={true}
            >
              {artifactContent}
            </SyntaxHighlighter>
          </Box>
        );
      
      case 'Screenshot':
        return (
          <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
            <img 
              src={artifactContent} 
              alt={selectedArtifact.title} 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            />
          </Box>
        );
      
      case 'Video':
        return (
          <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
            <video 
              controls 
              src={artifactContent} 
              style={{ maxWidth: '100%', maxHeight: '100%' }} 
            />
          </Box>
        );
      
      case 'Logs':
      case 'Text':
        return (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <SyntaxHighlighter style={docco} showLineNumbers={true}>
              {artifactContent}
            </SyntaxHighlighter>
          </Box>
        );
      
      default:
        return <Typography>Unknown artifact type: {selectedArtifact.artifact_type}</Typography>;
    }
  };

  // Render artifact list
  const renderArtifactList = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (artifacts.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1">No artifacts available for this task</Typography>
        </Box>
      );
    }
    
    return (
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        {artifacts.map((artifact) => (
          <Card 
            key={artifact.id} 
            sx={{ 
              mb: 1, 
              cursor: 'pointer',
              bgcolor: selectedArtifact?.id === artifact.id ? 'action.selected' : 'inherit',
            }}
            onClick={() => fetchArtifact(artifact.id)}
          >
            <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {artifact.artifact_type === 'Json' && <JsonIcon color="primary" sx={{ mr: 1 }} />}
                {artifact.artifact_type === 'CodeDiff' && <CodeIcon color="primary" sx={{ mr: 1 }} />}
                {artifact.artifact_type === 'Screenshot' && <ImageIcon color="primary" sx={{ mr: 1 }} />}
                {artifact.artifact_type === 'Video' && <VideoIcon color="primary" sx={{ mr: 1 }} />}
                {(['Logs', 'Text'].includes(artifact.artifact_type)) && <TextIcon color="primary" sx={{ mr: 1 }} />}
                <Typography variant="subtitle1" noWrap>
                  {artifact.title}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Chip 
                  label={artifact.artifact_type} 
                  size="small" 
                  variant="outlined" 
                />
                <Typography variant="caption" color="text.secondary">
                  #{artifact.sequence}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  // Render comments section
  const renderComments = () => {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <StyledCommentSection sx={{ flexGrow: 1, mb: 2 }}>
          {comments.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center">
              No comments yet
            </Typography>
          ) : (
            comments.map((comment) => (
              <React.Fragment key={comment.id}>
                {comment.is_human ? (
                  <UserComment>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle2" color="primary">
                        Human
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(comment.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2">{comment.text}</Typography>
                  </UserComment>
                ) : (
                  <AgentComment>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle2" color="secondary">
                        Agent
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(comment.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2">{comment.text}</Typography>
                  </AgentComment>
                )}
              </React.Fragment>
            ))
          )}
        </StyledCommentSection>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            multiline
            minRows={1}
            maxRows={3}
            disabled={!selectedArtifact}
          />
          <IconButton 
            color="primary" 
            onClick={addComment} 
            disabled={!selectedArtifact || !commentText.trim()}
            sx={{ ml: 1 }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
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
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">
            {selectedArtifact ? selectedArtifact.title : 'Artifacts'}
          </Typography>
          <Box>
            <Tooltip title="Refresh">
              <IconButton onClick={() => taskId ? fetchTaskArtifacts() : artifactId && fetchArtifact(artifactId)}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {onClose && (
              <Tooltip title="Close">
                <IconButton onClick={onClose}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        {selectedArtifact && (
          <Typography variant="body2" color="text.secondary">
            Task ID: {selectedArtifact.task_id} | Created: {new Date(selectedArtifact.created_at).toLocaleString()}
          </Typography>
        )}
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Artifact list sidebar */}
        <Box sx={{ width: '250px', borderRight: 1, borderColor: 'divider', height: '100%', overflow: 'auto' }}>
          {renderArtifactList()}
        </Box>

        {/* Artifact content and tabs */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs value={tab} onChange={handleTabChange} aria-label="artifact tabs">
            <Tab icon={<ImageIcon />} iconPosition="start" label="Content" id="artifact-tab-0" aria-controls="artifact-tabpanel-0" />
            <Tab icon={<CommentIcon />} iconPosition="start" label="Comments" id="artifact-tab-1" aria-controls="artifact-tabpanel-1" />
            <Tab icon={<HistoryIcon />} iconPosition="start" label="History" id="artifact-tab-2" aria-controls="artifact-tabpanel-2" />
          </Tabs>

          <TabPanel value={tab} index={0}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="error">{error}</Typography>
              </Box>
            ) : (
              renderArtifactContent()
            )}
          </TabPanel>

          <TabPanel value={tab} index={1}>
            {renderComments()}
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <Box sx={{ height: '100%', overflow: 'auto' }}>
              <Typography variant="h6">Artifact History</Typography>
              <Typography variant="body2">
                {selectedArtifact?.parent_id ? (
                  <>This artifact is a revision of another artifact.</>
                ) : (
                  <>This is the original version of this artifact.</>
                )}
              </Typography>
              
              {selectedArtifact?.metadata && Object.keys(selectedArtifact.metadata).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">Metadata</Typography>
                  <Grid container spacing={1} sx={{ mt: 1 }}>
                    {Object.entries(selectedArtifact.metadata).map(([key, value]) => (
                      <Grid item key={key}>
                        <Chip 
                          label={`${key}: ${value}`} 
                          variant="outlined" 
                          size="small"
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          </TabPanel>
        </Box>
      </Box>
    </Paper>
  );
};

export default ArtifactViewer;