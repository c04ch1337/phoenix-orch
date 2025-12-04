import React, { useState, useEffect, useRef } from 'react';
import Editor, { Monaco } from "@monaco-editor/react";
import { editor } from 'monaco-editor';
import { Box, Tabs, Tab, Divider, IconButton, Tooltip, Typography, Stack, Button, Snackbar, Alert } from '@mui/material';
import { Terminal, Split, LayoutPanelLeft, GitCompare, Zap, Play, RefreshCw, Copy, Save, Download, Globe } from 'lucide-react';
import clsx from 'clsx';

// Import existing components we'll integrate with
import OrchestratorConsole from '../components/OrchestratorConsole';
import agentService, { Agent, AgentType } from '../services/agent';

// Define workflow types
interface WorkflowStep {
  type: 'command' | 'code_edit' | 'language_change' | 'view_change';
  payload: any;
  description: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

interface Message {
  id: string;
  content: string;
  type: 'command' | 'response' | 'warning' | 'tool-output' | 'error';
  timestamp: string;
}

interface ConsoleMasterProps {
  className?: string;
}

type ViewMode = 'code' | 'split' | 'diff' | 'terminal' | 'preview';

const ConsoleMaster: React.FC<ConsoleMasterProps> = ({ className }) => {
  // State for the Monaco editor
  const [editorContent, setEditorContent] = useState<string>('// Phoenix Orch - Antigravity Alternative\n// Type your code here or use inline commands like @agent\n\n');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [language, setLanguage] = useState<string>('typescript');
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  
  // State for terminal messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState<boolean>(false);
  
  // State for agents and notifications
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });
  
  // State for preview
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  
  // State for workflows
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: 'example-workflow-1',
      name: 'TypeScript to JavaScript',
      description: 'Converts TypeScript code to JavaScript and updates the language setting',
      steps: [
        {
          type: 'command',
          payload: '@agent convert this TypeScript code to JavaScript',
          description: 'Request agent to convert TypeScript to JavaScript'
        },
        {
          type: 'language_change',
          payload: 'javascript',
          description: 'Switch language to JavaScript'
        }
      ]
    },
    {
      id: 'example-workflow-2',
      name: 'Format and Document Code',
      description: 'Formats the code and requests documentation for all functions',
      steps: [
        {
          type: 'command',
          payload: '@agent format this code according to best practices',
          description: 'Request agent to format the code'
        },
        {
          type: 'command',
          payload: '@agent add documentation to all functions in this code',
          description: 'Request agent to document all functions'
        }
      ]
    }
  ]);
  const [isRecordingWorkflow, setIsRecordingWorkflow] = useState<boolean>(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowStep[]>([]);
  const [workflowName, setWorkflowName] = useState<string>('');
  const [workflowDescription, setWorkflowDescription] = useState<string>('');
  const [showWorkflowDialog, setShowWorkflowDialog] = useState<boolean>(false);

  // Monaco editor instance ref
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);

  // Handle editor mount
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    
    // Set up Monaco editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      lineNumbers: 'on',
      folding: true,
      formatOnPaste: true,
      formatOnType: true,
      suggest: {
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showStructs: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showSnippets: true
      }
    });

    // Add command to handle inline agent commands 
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      if (selection) {
        const text = editor.getModel()?.getValueInRange(selection);
        if (text && text.includes('@agent')) {
          handleAgentCommand(text);
        }
      }
    });

    // Register agent command provider for IntelliSense
    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions = [
          {
            label: '@agent',
            kind: monaco.languages.CompletionItemKind.Keyword,
            documentation: 'Execute a command with the agent',
            insertText: '@agent ',
            range: range
          },
          {
            label: '@agent fix',
            kind: monaco.languages.CompletionItemKind.Snippet,
            documentation: 'Ask the agent to fix the selected code',
            insertText: '@agent fix this code',
            range: range
          },
          {
            label: '@agent explain',
            kind: monaco.languages.CompletionItemKind.Snippet,
            documentation: 'Ask the agent to explain the selected code',
            insertText: '@agent explain this code',
            range: range
          }
        ];

        return { suggestions };
      }
    });
  };

  // Handle diff editor mount
  const handleDiffEditorDidMount = (editor: editor.IStandaloneDiffEditor, monaco: Monaco) => {
    diffEditorRef.current = editor;
  };

  // Fetch available agents on component mount
  useEffect(() => {
    const agents = agentService.getAgents();
    setAvailableAgents(agents);
    
    if (agents.length > 0) {
      // Select the first available agent
      setSelectedAgentId(agents[0].id);
    }
    
    // You would typically set up event listeners here for agent status updates
    // This is a placeholder for where you would register handlers with socketService
    
    return () => {
      // Clean up listeners when component unmounts
    };
  }, []);

  // Handle agent commands
  const handleAgentCommand = async (command: string) => {
    if (!selectedAgentId) {
      showNotification('No agent selected. Please select or deploy an agent first.', 'error');
      return;
    }
    
    const timestamp = new Date().toISOString();
    const newMessage: Message = {
      id: `cmd-${timestamp}`,
      content: command,
      type: 'command',
      timestamp
    };

    setMessages(prev => [...prev, newMessage]);
    setIsThinking(true);
    
    try {
      // Send actual command to the agent service
      const result = await agentService.sendAgentCommand({
        agentId: selectedAgentId,
        commandType: 'execute_inline',
        payload: {
          command,
          context: {
            language,
            content: editorContent
          }
        }
      });
      
      setIsThinking(false);
      setIsStreamingResponse(true);
      
      const responseTimestamp = new Date().toISOString();
      const response: Message = {
        id: `res-${responseTimestamp}`,
        content: result?.output || 'Command executed successfully',
        type: 'response',
        timestamp: responseTimestamp
      };
      
      setMessages(prev => [...prev, response]);
      
      // If the agent response includes code modifications, apply them to the editor
      if (result?.codeChanges?.content) {
        setEditorContent(result.codeChanges.content);
      }
      
      setTimeout(() => setIsStreamingResponse(false), 1000);
      
    } catch (error) {
      setIsThinking(false);
      
      const errorTimestamp = new Date().toISOString();
      const errorMessage: Message = {
        id: `err-${errorTimestamp}`,
        content: error instanceof Error ? error.message : 'An unknown error occurred',
        type: 'error',
        timestamp: errorTimestamp
      };
      
      setMessages(prev => [...prev, errorMessage]);
      showNotification('Error executing command: ' +
        (error instanceof Error ? error.message : 'Unknown error'), 'error');
    }
  };

  // Handle command submission from terminal
  const handleSendCommand = async (command: string) => {
    const timestamp = new Date().toISOString();
    const newMessage: Message = {
      id: `cmd-${timestamp}`,
      content: command,
      type: 'command',
      timestamp
    };

    setMessages(prev => [...prev, newMessage]);
    
    if (!selectedAgentId) {
      const errorTimestamp = new Date().toISOString();
      const errorMessage: Message = {
        id: `err-${errorTimestamp}`,
        content: 'No agent selected. Please select or deploy an agent first.',
        type: 'error',
        timestamp: errorTimestamp
      };
      
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    // If command starts with '@', it's a special agent command
    if (command.startsWith('@') && editorRef.current) {
      try {
        setIsThinking(true);
        
        // Get the current editor content and cursor position
        const currValue = editorRef.current.getValue();
        const selection = editorRef.current.getSelection();
        
        // Send command to agent service
        const result = await agentService.sendAgentCommand({
          agentId: selectedAgentId,
          commandType: 'terminal_command',
          payload: {
            command: command.substring(1), // Remove the @ prefix
            context: {
              editorContent: currValue,
              selection: selection ? {
                startLineNumber: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLineNumber: selection.endLineNumber,
                endColumn: selection.endColumn
              } : null
            }
          }
        });
        
        setIsThinking(false);
        const responseTimestamp = new Date().toISOString();
        const response: Message = {
          id: `res-${responseTimestamp}`,
          content: result?.output || 'Command executed successfully',
          type: 'response',
          timestamp: responseTimestamp
        };
        
        setMessages(prev => [...prev, response]);
        
        // If the agent suggests code modifications, show them in the diff view
        if (result?.codeChanges?.content) {
          setOriginalContent(currValue);
          setEditorContent(result.codeChanges.content);
          setViewMode('diff');
        }
        
      } catch (error) {
        setIsThinking(false);
        
        const errorTimestamp = new Date().toISOString();
        const errorMessage: Message = {
          id: `err-${errorTimestamp}`,
          content: error instanceof Error ? error.message : 'An unknown error occurred',
          type: 'error',
          timestamp: errorTimestamp
        };
        
        setMessages(prev => [...prev, errorMessage]);
        showNotification('Error executing command', 'error');
      }
    } else {
      // Regular terminal command
      try {
        const result = await agentService.sendAgentCommand({
          agentId: selectedAgentId,
          commandType: 'shell_command',
          payload: {
            command
          }
        });
        
        const responseTimestamp = new Date().toISOString();
        const response: Message = {
          id: `res-${responseTimestamp}`,
          content: result?.output || 'Command executed successfully',
          type: 'response',
          timestamp: responseTimestamp
        };
        
        setMessages(prev => [...prev, response]);
        
      } catch (error) {
        const errorTimestamp = new Date().toISOString();
        const errorMessage: Message = {
          id: `err-${errorTimestamp}`,
          content: error instanceof Error ? error.message : 'An unknown error occurred',
          type: 'error',
          timestamp: errorTimestamp
        };
        
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };
  
  // Helper to show notifications
  const showNotification = (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };
  
  // Workflow management functions
  const startRecordingWorkflow = () => {
    setIsRecordingWorkflow(true);
    setCurrentWorkflow([]);
    showNotification('Recording workflow...', 'info');
  };
  
  const stopRecordingWorkflow = () => {
    setIsRecordingWorkflow(false);
    setShowWorkflowDialog(true);
  };
  
  const saveWorkflow = () => {
    if (currentWorkflow.length === 0) {
      showNotification('Cannot save empty workflow', 'error');
      return;
    }
    
    if (!workflowName) {
      showNotification('Please provide a name for the workflow', 'error');
      return;
    }
    
    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: workflowName,
      description: workflowDescription || `Workflow created on ${new Date().toLocaleDateString()}`,
      steps: currentWorkflow
    };
    
    setWorkflows(prev => [...prev, newWorkflow]);
    setWorkflowName('');
    setWorkflowDescription('');
    setShowWorkflowDialog(false);
    showNotification(`Workflow "${newWorkflow.name}" saved successfully`, 'success');
  };
  
  const executeWorkflow = async (workflow: Workflow) => {
    showNotification(`Executing workflow: ${workflow.name}`, 'info');
    
    for (const step of workflow.steps) {
      try {
        switch (step.type) {
          case 'command':
            // Execute command
            await handleSendCommand(step.payload);
            break;
          case 'code_edit':
            // Apply code edit
            setEditorContent(step.payload);
            break;
          case 'language_change':
            // Change language
            setLanguage(step.payload);
            break;
          case 'view_change':
            // Change view mode
            setViewMode(step.payload);
            break;
        }
        
        // Pause between steps to allow for processing
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        showNotification(`Error executing workflow step: ${step.description}`, 'error');
        break;
      }
    }
    
    showNotification(`Workflow "${workflow.name}" completed`, 'success');
  };
  
  // Record user actions as workflow steps
  useEffect(() => {
    if (isRecordingWorkflow) {
      // We're not implementing the full recording logic here, but in a real implementation,
      // you would intercept all user actions and add them to the currentWorkflow array
    }
  }, [isRecordingWorkflow]);

  // Handle content changes in the editor
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
    }
  };

  // Switch to diff view and compare current with original
  const switchToDiffView = () => {
    setOriginalContent(editorContent);
    setViewMode('diff');
  };

  // Save current content to original for future diff comparisons
  const saveAsOriginal = () => {
    setOriginalContent(editorContent);
  };
  
  // Generate preview of the code
  const generatePreview = () => {
    setIsPreviewLoading(true);
    
    try {
      // Create a blob with the content
      let htmlContent = '';
      
      // Handle different languages
      if (language === 'html' || editorContent.includes('<html')) {
        // Full HTML document
        htmlContent = editorContent;
      } else if (language === 'javascript' || language === 'typescript') {
        // Wrap JS code in HTML
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Code Preview</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .console-output {
                  background: #f4f4f4;
                  border: 1px solid #ddd;
                  padding: 10px;
                  border-radius: 4px;
                  font-family: monospace;
                  white-space: pre-wrap;
                }
              </style>
              <script>
                // Capture console outputs
                const originalConsoleLog = console.log;
                const originalConsoleError = console.error;
                const originalConsoleWarn = console.warn;
                const originalConsoleInfo = console.info;
                
                const outputs = [];
                
                console.log = function(...args) {
                  originalConsoleLog.apply(console, args);
                  outputs.push(['log', ...args]);
                  updateConsoleOutput();
                };
                
                console.error = function(...args) {
                  originalConsoleError.apply(console, args);
                  outputs.push(['error', ...args]);
                  updateConsoleOutput();
                };
                
                console.warn = function(...args) {
                  originalConsoleWarn.apply(console, args);
                  outputs.push(['warn', ...args]);
                  updateConsoleOutput();
                };
                
                console.info = function(...args) {
                  originalConsoleInfo.apply(console, args);
                  outputs.push(['info', ...args]);
                  updateConsoleOutput();
                };
                
                function updateConsoleOutput() {
                  const output = document.getElementById('console-output');
                  if (output) {
                    output.innerHTML = outputs.map(entry => {
                      const [type, ...args] = entry;
                      const content = args.map(arg =>
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                      ).join(' ');
                      
                      let style = '';
                      if (type === 'error') style = 'color: red;';
                      else if (type === 'warn') style = 'color: orange;';
                      else if (type === 'info') style = 'color: blue;';
                      
                      return \`<div style="\${style}">\${content}</div>\`;
                    }).join('\\n');
                  }
                }
              </script>
            </head>
            <body>
              <div id="app"></div>
              <h3>Console Output:</h3>
              <div id="console-output" class="console-output"></div>
              
              <script>
                try {
                  ${editorContent}
                } catch (error) {
                  console.error('Execution error:', error.message);
                }
              </script>
            </body>
          </html>
        `;
      } else if (language === 'css') {
        // CSS preview with a sample HTML structure
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>CSS Preview</title>
              <style>
                ${editorContent}
              </style>
            </head>
            <body>
              <div class="container">
                <h1>CSS Preview</h1>
                <p>This is a preview of your CSS styles applied to sample HTML elements.</p>
                <div class="sample-box">
                  <h2>Sample Heading</h2>
                  <p>Sample paragraph with <a href="#">link</a> and <strong>bold text</strong>.</p>
                  <button>Sample Button</button>
                </div>
                <div class="content">
                  <ul>
                    <li>List item 1</li>
                    <li>List item 2</li>
                    <li>List item 3</li>
                  </ul>
                </div>
              </div>
            </body>
          </html>
        `;
      }
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Update the iframe source
      setPreviewSrc(url);
      setViewMode('preview');
      
      // Switch to preview mode
      showNotification('Preview generated successfully', 'success');
    } catch (error) {
      showNotification('Error generating preview: ' +
        (error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <Box className={clsx("flex flex-col h-full", className)}>
      {/* Header with controls */}
      <Box className="flex items-center justify-between p-2 bg-zinc-900 border-b border-zinc-800">
        <Typography variant="h6" className="text-zinc-200 flex items-center gap-2">
          <Terminal size={18} />
          VS Code-Like Console
        </Typography>
        
        {/* View mode toggles */}
        <Stack direction="row" spacing={1}>
          <Tooltip title="Code View">
            <IconButton 
              size="small" 
              color={viewMode === 'code' ? 'primary' : 'default'}
              onClick={() => setViewMode('code')}
            >
              <LayoutPanelLeft size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Split View">
            <IconButton 
              size="small" 
              color={viewMode === 'split' ? 'primary' : 'default'} 
              onClick={() => setViewMode('split')}
            >
              <Split size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Diff View">
            <IconButton 
              size="small" 
              color={viewMode === 'diff' ? 'primary' : 'default'} 
              onClick={switchToDiffView}
            >
              <GitCompare size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Terminal View">
            <IconButton 
              size="small" 
              color={viewMode === 'terminal' ? 'primary' : 'default'} 
              onClick={() => setViewMode('terminal')}
            >
              <Terminal size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Preview">
            <IconButton
              size="small"
              color={viewMode === 'preview' ? 'primary' : 'default'}
              onClick={generatePreview}
            >
              <Globe size={18} />
            </IconButton>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem />
          
          <Tooltip title="Save for Diff">
            <IconButton 
              size="small"
              onClick={saveAsOriginal}
            >
              <Save size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy">
            <IconButton 
              size="small"
              onClick={() => {
                if (editorRef.current) {
                  const text = editorRef.current.getValue();
                  navigator.clipboard.writeText(text);
                }
              }}
            >
              <Copy size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title={isRecordingWorkflow ? "Stop Recording Workflow" : "Record Workflow"}>
            <IconButton
              size="small"
              color={isRecordingWorkflow ? "error" : "default"}
              onClick={isRecordingWorkflow ? stopRecordingWorkflow : startRecordingWorkflow}
            >
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
      
      {/* Main content area */}
      <Box className="flex-grow flex">
        {(viewMode === 'code' || viewMode === 'split') && (
          <Box className={viewMode === 'split' ? 'w-1/2' : 'w-full'} height="100%">
            <Editor
              height="100%"
              language={language}
              value={editorContent}
              theme={theme}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                readOnly: false
              }}
            />
          </Box>
        )}
        
        {viewMode === 'diff' && (
          <Box className="w-full" height="100%">
            <Editor
              height="100%"
              original={originalContent}
              modified={editorContent}
              theme={theme}
              onMount={handleDiffEditorDidMount}
              options={{
                readOnly: false,
                renderSideBySide: true,
                enableSplitViewResizing: true
              }}
            />
          </Box>
        )}
        
        {viewMode === 'preview' && (
          <Box className="w-full h-full flex flex-col">
            {isPreviewLoading ? (
              <Box className="w-full h-full flex items-center justify-center bg-zinc-900">
                <Typography variant="body1" color="text.secondary">
                  Generating preview...
                </Typography>
              </Box>
            ) : (
              <iframe
                src={previewSrc}
                title="Code Preview"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            )}
          </Box>
        )}
        
        {(viewMode === 'terminal' || viewMode === 'split') && (
          <Box className={viewMode === 'split' ? 'w-1/2' : 'w-full'} height="100%">
            <OrchestratorConsole
              messages={messages}
              isThinking={isThinking}
              isStreamingResponse={isStreamingResponse}
              onSendCommand={handleSendCommand}
              className="h-full"
            />
          </Box>
        )}
      </Box>
      
      {/* Status bar */}
      <Box className="flex items-center justify-between p-1 px-3 bg-zinc-800 border-t border-zinc-700 text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <span>{language}</span>
          <span>UTF-8</span>
          <button
            className="hover:text-zinc-200"
            onClick={() => setLanguage(language === 'typescript' ? 'javascript' : 'typescript')}
          >
            Change Language
          </button>
          
          {/* Agent selector */}
          {availableAgents.length > 0 && (
            <div className="ml-4 flex items-center">
              <span>Agent:</span>
              <select
                className="ml-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 px-1"
                value={selectedAgentId || ''}
                onChange={(e) => setSelectedAgentId(e.target.value)}
              >
                {availableAgents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Workflow selector */}
          {workflows.length > 0 && (
            <div className="flex items-center">
              <span>Workflow:</span>
              <select
                className="ml-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 px-1"
                onChange={(e) => {
                  const selectedWorkflow = workflows.find(w => w.id === e.target.value);
                  if (selectedWorkflow) {
                    executeWorkflow(selectedWorkflow);
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select workflow</option>
                {workflows.map(workflow => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {language === 'javascript' || language === 'typescript' || language === 'html' || language === 'css' ? (
            <button
              className="hover:text-zinc-200"
              onClick={generatePreview}
            >
              Generate Preview
            </button>
          ) : null}
          
          <button
            className="hover:text-zinc-200"
            onClick={() => setTheme(theme === 'vs-dark' ? 'light' : 'vs-dark')}
          >
            {theme === 'vs-dark' ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>
      </Box>
      
      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
      
      {/* Workflow Dialog */}
      {showWorkflowDialog && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-5 rounded-md shadow-lg w-96">
            <Typography variant="h6" className="mb-4">Save Workflow</Typography>
            
            <div className="mb-4">
              <Typography variant="body2" className="mb-1">Workflow Name</Typography>
              <input
                type="text"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Enter workflow name..."
              />
            </div>
            
            <div className="mb-4">
              <Typography variant="body2" className="mb-1">Description (optional)</Typography>
              <textarea
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                rows={3}
                placeholder="Enter workflow description..."
              />
            </div>
            
            <div className="mb-4">
              <Typography variant="body2" className="mb-2">Steps Recorded: {currentWorkflow.length}</Typography>
              {currentWorkflow.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-zinc-800 p-2 rounded">
                  {currentWorkflow.map((step, index) => (
                    <div key={index} className="text-xs mb-1 text-zinc-300">
                      {index + 1}. {step.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setShowWorkflowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={saveWorkflow}
                disabled={currentWorkflow.length === 0 || !workflowName}
              >
                Save Workflow
              </Button>
            </div>
          </div>
        </div>
      )}
    </Box>
  );
};

export default ConsoleMaster;