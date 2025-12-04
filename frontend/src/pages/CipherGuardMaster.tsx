import React, { useEffect, useState, ReactElement } from 'react';
import {
  Box,
  Grid as MuiGrid,
  Paper,
  Typography,
  useTheme,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  TextField,
  Stack,
  Button,
  Tooltip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider
} from '@mui/material';
import type { GridProps } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import SecurityIcon from '@mui/icons-material/Security';
import BlockIcon from '@mui/icons-material/Block';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';

// Create a properly typed Grid component
const Grid = (props: GridProps) => <MuiGrid {...props} />;
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TimerIcon from '@mui/icons-material/Timer';
import PersonIcon from '@mui/icons-material/Person';

// Types for our components
interface SecurityEvent {
  id: string;
  timestamp: string;
  type: string;
  severity: number;
  description: string;
  relatedEvents: string[];
  source: string;
}

interface Incident {
  id: string;
  aiScore: number;
  title: string;
  description: string;
  status: 'new' | 'in-progress' | 'resolved';
  assignedTo?: string;
  slaDeadline?: string;
}

interface QueryResult {
  id: string;
  timestamp: string;
  data: any;
  source: string;
}

// Mock WebSocket hook until we can properly install react-use-websocket
const useWebSocket = (url: string, options: any) => {
  const [message, setMessage] = useState<{ data: string } | null>(null);
  
  useEffect(() => {
    if (options.onOpen) {
      options.onOpen();
    }
    // Mock some sample data
    const mockData = {
      type: 'incident_update',
      payload: {
        id: '1',
        aiScore: 85,
        title: 'Potential Data Exfiltration',
        description: 'Unusual outbound traffic detected from critical server',
        status: 'new',
        slaDeadline: new Date(Date.now() + 3600000).toISOString()
      }
    };
    setMessage({ data: JSON.stringify(mockData) });
  }, [options]);

  return {
    sendMessage: (message: string) => {},
    lastMessage: message,
    readyState: 1
  };
};

// UnifiedTimeline Component
const UnifiedTimeline: React.FC<{ events: SecurityEvent[] }> = ({ events }): ReactElement => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const filteredEvents = events.filter(event => 
    event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSeverityColor = (severity: number): string => {
    if (severity >= 80) return '#ff1744';
    if (severity >= 60) return '#ff9100';
    if (severity >= 40) return '#ffea00';
    return '#00e676';
  };

  return (
    <Paper elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Unified Timeline</Typography>
        <TextField 
          size="small"
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
          }}
          sx={{ width: 250 }}
        />
        <IconButton>
          <FilterListIcon />
        </IconButton>
      </Stack>
      
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {filteredEvents.map((event) => (
          <ListItem 
            key={event.id}
            alignItems="flex-start"
            sx={{ 
              mb: 1,
              backgroundColor: 'background.paper',
              borderLeft: 6,
              borderLeftColor: getSeverityColor(event.severity),
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1">{event.type}</Typography>
                  <Chip 
                    label={event.source}
                    size="small"
                    sx={{ backgroundColor: 'primary.main', color: 'white' }}
                  />
                  <Typography variant="caption" sx={{ ml: 'auto' }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </Typography>
                </Stack>
              }
              secondary={
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.primary">
                    {event.description}
                  </Typography>
                  {expandedEvent === event.id && event.relatedEvents.length > 0 && (
                    <Box sx={{ mt: 1, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary">
                        Related Events:
                      </Typography>
                      {event.relatedEvents.map((relatedId) => (
                        <Typography key={relatedId} variant="body2" color="text.secondary">
                          {relatedId}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              }
              onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
              sx={{ cursor: 'pointer' }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

// PriorityTriagePane Component
const PriorityTriagePane: React.FC<{ incidents: Incident[] }> = ({ incidents }): ReactElement => {
  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#ff1744';
    if (score >= 60) return '#ff9100';
    if (score >= 40) return '#ffea00';
    return '#00e676';
  };

  const getTimeRemaining = (deadline: string): string => {
    const remaining = new Date(deadline).getTime() - Date.now();
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Paper elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Priority Triage</Typography>
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {incidents.map((incident) => (
          <Paper
            key={incident.id}
            elevation={2}
            sx={{ 
              mb: 2, 
              p: 2,
              borderLeft: 6,
              borderLeftColor: getScoreColor(incident.aiScore)
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight="bold">
                  {incident.title}
                </Typography>
                <Chip 
                  label={`Score: ${incident.aiScore}`}
                  sx={{ 
                    bgcolor: getScoreColor(incident.aiScore),
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              </Stack>
              
              <Typography variant="body2" color="text.secondary">
                {incident.description}
              </Typography>
              
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  icon={<TimerIcon />}
                  label={incident.slaDeadline ? getTimeRemaining(incident.slaDeadline) : 'No SLA'}
                  color={incident.slaDeadline ? 'warning' : 'default'}
                />
                <Chip
                  size="small"
                  icon={<PersonIcon />}
                  label={incident.assignedTo || 'Unassigned'}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={incident.status}
                  color={
                    incident.status === 'new' ? 'error' :
                    incident.status === 'in-progress' ? 'warning' : 'success'
                  }
                />
              </Stack>
              
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AssignmentIcon />}
                  onClick={() => {}}
                >
                  Take Ownership
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {}}
                >
                  View Details
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </List>
    </Paper>
  );
};

// Main component
const CipherGuardMaster: React.FC = () => {
  const theme = useTheme();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([
    {
      id: '1',
      aiScore: 85,
      title: 'Potential Data Exfiltration',
      description: 'Unusual outbound traffic detected from critical server',
      status: 'new',
      slaDeadline: new Date(Date.now() + 3600000).toISOString()
    },
    {
      id: '2',
      aiScore: 65,
      title: 'Multiple Failed Login Attempts',
      description: 'Brute force attack suspected on admin portal',
      status: 'in-progress',
      assignedTo: 'John Doe',
      slaDeadline: new Date(Date.now() + 7200000).toISOString()
    }
  ]);
  const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection
  const { sendMessage, lastMessage, readyState } = useWebSocket('ws://localhost:8080/ws', {
    onOpen: () => {
      console.log('WebSocket Connected');
      setIsLoading(false);
    },
    onError: (error: Event) => {
      setError('WebSocket connection error');
      setIsLoading(false);
    }
  });

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const data = JSON.parse(lastMessage.data);
        switch (data.type) {
          case 'security_event':
            setEvents(prev => [data.payload, ...prev].slice(0, 100));
            break;
          case 'incident_update':
            setIncidents(prev => prev.map(inc => 
              inc.id === data.payload.id ? { ...inc, ...data.payload } : inc
            ));
            break;
          case 'query_result':
            setQueryResults(prev => [data.payload, ...prev]);
            break;
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    }
  }, [lastMessage]);

  // OneClickActions Component
  const OneClickActions: React.FC = () => {
    const [loading, setLoading] = useState<string | null>(null);

    const handleAction = async (action: string) => {
      setLoading(action);
      try {
        // In a real implementation, this would call the backend
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Executing action: ${action}`);
      } catch (error) {
        console.error(`Error executing action: ${action}`, error);
      } finally {
        setLoading(null);
      }
    };

    const actions = [
      {
        id: 'proofpoint-jira',
        title: 'Escalate to JIRA',
        description: 'Create JIRA ticket from Proofpoint alert',
        icon: <BugReportIcon />,
        color: '#0052CC'
      },
      {
        id: 'rapid7-case',
        title: 'Create IDR Case',
        description: 'Open new Rapid7 InsightIDR case',
        icon: <SecurityIcon />,
        color: '#FF3366'
      },
      {
        id: 'crowdstrike-contain',
        title: 'Contain Endpoint',
        description: 'Initiate CrowdStrike endpoint containment',
        icon: <BlockIcon />,
        color: '#FF0000'
      },
      {
        id: 'ioc-block',
        title: 'Block IOC',
        description: 'Add IOC to security tool blocklists',
        icon: <SecurityIcon />,
        color: '#FF9800'
      },
      {
        id: 'custom-action',
        title: 'Custom Action',
        description: 'Configure and execute custom action',
        icon: <SettingsIcon />,
        color: '#4CAF50'
      }
    ];

    return (
      <Paper elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>Quick Actions</Typography>
          <Tooltip title="Add Custom Action">
            <IconButton size="small" onClick={() => handleAction('add-custom')}>
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Stack>
        
        <Stack spacing={1} sx={{ flex: 1, overflow: 'auto' }}>
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outlined"
              startIcon={action.icon}
              onClick={() => handleAction(action.id)}
              disabled={loading !== null}
              sx={{
                justifyContent: 'flex-start',
                borderColor: action.color,
                color: action.color,
                '&:hover': {
                  borderColor: action.color,
                  backgroundColor: `${action.color}10`
                },
                position: 'relative'
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 0.5 }}>
                <Typography variant="subtitle2">{action.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {action.description}
                </Typography>
              </Box>
              {loading === action.id && (
                <CircularProgress
                  size={24}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    color: action.color
                  }}
                />
              )}
            </Button>
          ))}
        </Stack>
      </Paper>
    );
  };

  // ThreatHuntingConsole Component
  const ThreatHuntingConsole: React.FC = () => {
    const [queryType, setQueryType] = useState('cross-tool');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTools, setSelectedTools] = useState<string[]>(['crowdstrike', 'rapid7']);
    const [timeRange, setTimeRange] = useState('24h');
    const [savedQueries, setSavedQueries] = useState([
      { id: '1', name: 'Lateral Movement Detection', query: 'source:crowdstrike type:process_creation lateral_movement:true' },
      { id: '2', name: 'Data Exfiltration Check', query: 'source:rapid7 category:data_transfer size:>1GB' }
    ]);
    const [isSearching, setIsSearching] = useState(false);

    const tools = [
      { id: 'crowdstrike', name: 'CrowdStrike' },
      { id: 'rapid7', name: 'Rapid7 IDR' },
      { id: 'proofpoint', name: 'Proofpoint' },
      { id: 'sentinel', name: 'Microsoft Sentinel' }
    ];

    const timeRanges = [
      { value: '1h', label: 'Last Hour' },
      { value: '24h', label: 'Last 24 Hours' },
      { value: '7d', label: 'Last 7 Days' },
      { value: '30d', label: 'Last 30 Days' },
      { value: 'custom', label: 'Custom Range' }
    ];

    const handleSearch = async () => {
      setIsSearching(true);
      try {
        // In a real implementation, this would query the backend
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('Executing search with:', {
          queryType,
          searchTerm,
          selectedTools,
          timeRange
        });
      } catch (error) {
        console.error('Error executing search:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const handleSaveQuery = () => {
      const newQuery = {
        id: Date.now().toString(),
        name: `Saved Query ${savedQueries.length + 1}`,
        query: searchTerm
      };
      setSavedQueries([...savedQueries, newQuery]);
    };

    return (
      <Paper elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Threat Hunting</Typography>
        
        <Stack spacing={2}>
          {/* Query Builder */}
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Query Type</InputLabel>
              <Select
                value={queryType}
                label="Query Type"
                onChange={(e) => setQueryType(e.target.value)}
              >
                <MenuItem value="cross-tool">Cross-Tool Search</MenuItem>
                <MenuItem value="ioc-enrichment">IOC Enrichment</MenuItem>
                <MenuItem value="behavior">Behavior Analysis</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                {timeRanges.map(range => (
                  <MenuItem key={range.value} value={range.value}>
                    {range.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Tool Selection */}
          <Stack direction="row" spacing={1}>
            {tools.map(tool => (
              <Chip
                key={tool.id}
                label={tool.name}
                onClick={() => {
                  setSelectedTools(prev =>
                    prev.includes(tool.id)
                      ? prev.filter(id => id !== tool.id)
                      : [...prev, tool.id]
                  );
                }}
                color={selectedTools.includes(tool.id) ? 'primary' : 'default'}
                variant={selectedTools.includes(tool.id) ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>

          {/* Search Input */}
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter search query..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              multiline
              rows={2}
            />
            <Stack>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={isSearching || !searchTerm}
                sx={{ height: '50%' }}
              >
                {isSearching ? <CircularProgress size={24} /> : 'Search'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleSaveQuery}
                disabled={!searchTerm}
                sx={{ height: '50%' }}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Saved Queries */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Saved Queries</Typography>
        <List dense sx={{ flex: 1, overflow: 'auto' }}>
          {savedQueries.map((saved) => (
            <ListItem
              key={saved.id}
              sx={{
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
              onClick={() => setSearchTerm(saved.query)}
            >
              <ListItemText
                primary={saved.name}
                secondary={saved.query}
                secondaryTypographyProps={{
                  sx: {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                }}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3, height: '100vh', overflow: 'hidden' }}>
      <Grid container spacing={3} sx={{ height: 'calc(100% - 24px)' }}>
        <Grid container item xs={12} md={8}>
          <Grid container item xs={12} sx={{ height: '60%' }}>
            <Grid item xs={12}>
              <UnifiedTimeline events={events} />
            </Grid>
          </Grid>
          <Grid container item xs={12} sx={{ height: '40%' }}>
            <Grid item xs={12}>
              <ThreatHuntingConsole />
            </Grid>
          </Grid>
        </Grid>
        
        <Grid container item xs={12} md={4}>
          <Grid container item xs={12} sx={{ height: '60%' }}>
            <Grid item xs={12}>
              <PriorityTriagePane incidents={incidents} />
            </Grid>
          </Grid>
          <Grid container item xs={12} sx={{ height: '40%' }}>
            <Grid item xs={12}>
              <OneClickActions />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CipherGuardMaster;