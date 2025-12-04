/**
 * Command Processor
 * 
 * Processes parsed intents into executable commands for the system.
 * Maps natural language intents to specific workflows, agent actions,
 * and system operations.
 */

const intentParser = require('./intent_parser');
const contextManager = require('./context_manager');
const workflowEngine = require('../../workflows/workflow_engine');
const agentManager = require('../../agents/agent_manager');

class CommandProcessor {
    constructor() {
        // Map of intent to command handler functions
        this.commandHandlers = {
            'analyze_threat': this.handleAnalyzeThreat.bind(this),
            'run_scan': this.handleRunScan.bind(this),
            'contain_threat': this.handleContainThreat.bind(this),
            'report_incident': this.handleReportIncident.bind(this),
            'status_check': this.handleStatusCheck.bind(this),
            'help': this.handleHelp.bind(this)
        };
        
        // Commands that require confirmation before execution
        this.confirmationRequiredCommands = [
            'contain_threat',
            'delete_data',
            'shutdown_system'
        ];
    }
    
    /**
     * Process a natural language command
     * @param {string} input Natural language input
     * @param {string} sessionId Session identifier
     * @returns {Promise<object>} Command result
     */
    async processCommand(input, sessionId) {
        // Get current context
        const context = contextManager.getContext(sessionId);
        
        // Parse intent
        const intentResult = await intentParser.parseIntent(input, context);
        
        // Update context with new intent
        contextManager.updateContext(sessionId, {
            input,
            state: {
                currentIntent: intentResult.intent,
                lastCommand: input
            }
        });
        
        // Check if intent requires missing entities
        if (intentResult.missingEntities && intentResult.missingEntities.length > 0) {
            return this.handleMissingEntities(intentResult, sessionId);
        }
        
        // Check if intent requires confirmation
        if (this.confirmationRequiredCommands.includes(intentResult.intent) && 
            !context.state.confirmationProvided) {
            return this.requestConfirmation(intentResult, sessionId);
        }
        
        // Execute the command handler for the intent
        if (this.commandHandlers[intentResult.intent]) {
            return this.commandHandlers[intentResult.intent](intentResult, sessionId);
        }
        
        // If no handler found, return error
        return {
            status: 'error',
            message: `I don't know how to process the intent: ${intentResult.intent}`,
            intent: intentResult.intent
        };
    }
    
    /**
     * Handle missing required entities
     * @private
     */
    async handleMissingEntities(intentResult, sessionId) {
        const missingEntity = intentResult.missingEntities[0];
        let promptMessage = '';
        
        // Create appropriate prompt based on missing entity
        switch (missingEntity) {
            case 'threat_indicator':
                promptMessage = 'What threat indicator would you like me to analyze? (IP, URL, or file hash)';
                break;
            case 'target':
                promptMessage = 'Which system or device would you like to perform this action on?';
                break;
            case 'incident_description':
                promptMessage = 'Please provide a description of the security incident.';
                break;
            default:
                promptMessage = `Please provide the ${missingEntity.replace('_', ' ')}.`;
        }
        
        // Update context to track that we're waiting for entity
        contextManager.updateContext(sessionId, {
            state: {
                awaitingEntity: missingEntity,
                currentIntent: intentResult.intent
            }
        });
        
        return {
            status: 'need_info',
            message: promptMessage,
            missingEntity,
            intent: intentResult.intent
        };
    }
    
    /**
     * Request confirmation for sensitive commands
     * @private
     */
    async requestConfirmation(intentResult, sessionId) {
        // Generate confirmation message based on intent
        let confirmationMessage = '';
        
        switch (intentResult.intent) {
            case 'contain_threat':
                const target = intentResult.entities.target ?
                    intentResult.entities.target.value : 'the specified systems';
                confirmationMessage = `Are you sure you want to contain and isolate ${target}? This will disrupt operations on those systems.`;
                break;
            case 'delete_data':
                confirmationMessage = 'Are you sure you want to delete this data? This action cannot be undone.';
                break;
            case 'shutdown_system':
                confirmationMessage = 'Are you sure you want to shut down this system? This will disrupt all operations.';
                break;
            default:
                confirmationMessage = 'Are you sure you want to proceed with this action?';
        }
        
        // Update context to track that we're waiting for confirmation
        contextManager.updateContext(sessionId, {
            state: {
                awaitingConfirmation: true,
                pendingIntent: intentResult.intent,
                pendingEntities: intentResult.entities
            }
        });
        
        return {
            status: 'need_confirmation',
            message: confirmationMessage,
            intent: intentResult.intent
        };
    }
    
    /**
     * Handle analyze threat command
     * @private
     */
    async handleAnalyzeThreat(intentResult, sessionId) {
        const { entities } = intentResult;
        
        if (!entities.threat_indicator) {
            return {
                status: 'error',
                message: 'No threat indicator provided for analysis.'
            };
        }
        
        // Start the threat analysis workflow
        try {
            const executionId = await workflowEngine.executeWorkflow('threat_analysis', {
                indicator: entities.threat_indicator.value,
                indicatorType: entities.threat_indicator.type,
                timeRange: entities.time_range || { unit: 'day', value: 7 }
            });
            
            // Update context with workflow execution info
            contextManager.updateContext(sessionId, {
                workflow: {
                    activeWorkflow: 'threat_analysis',
                    executionId
                },
                response: `Analyzing threat indicator: ${entities.threat_indicator.value}`
            });
            
            return {
                status: 'processing',
                message: `I'm analyzing the ${entities.threat_indicator.type} ${entities.threat_indicator.value}. This may take a moment.`,
                executionId,
                workflow: 'threat_analysis'
            };
        } catch (error) {
            return {
                status: 'error',
                message: `Error analyzing threat: ${error.message}`
            };
        }
    }
    
    /**
     * Handle run scan command
     * @private
     */
    async handleRunScan(intentResult, sessionId) {
        const { entities } = intentResult;
        
        if (!entities.target) {
            return {
                status: 'error',
                message: 'No target specified for scanning.'
            };
        }
        
        // Start a scan using the vulnerability scanner agent
        try {
            const agentId = await agentManager.startAgent(`scan-${Date.now()}`, 'vuln_scanner', {
                scanTarget: entities.target.value,
                scanType: entities.scan_type || 'standard',
                depth: entities.depth || 'medium'
            });
            
            // Update context
            contextManager.updateContext(sessionId, {
                state: {
                    activeAgentId: agentId,
                    activeAgentType: 'vuln_scanner'
                },
                response: `Starting vulnerability scan on ${entities.target.value}`
            });
            
            return {
                status: 'processing',
                message: `Starting a ${entities.scan_type || 'standard'} vulnerability scan on ${entities.target.value}. I'll notify you when it's complete.`,
                agentId
            };
        } catch (error) {
            return {
                status: 'error',
                message: `Error starting scan: ${error.message}`
            };
        }
    }
    
    /**
     * Handle contain threat command
     * @private
     */
    async handleContainThreat(intentResult, sessionId) {
        const { entities } = intentResult;
        
        if (!entities.target) {
            return {
                status: 'error',
                message: 'No target specified for containment.'
            };
        }
        
        // Start the threat containment workflow
        try {
            const executionId = await workflowEngine.executeWorkflow('threat_containment', {
                affectedSystems: [entities.target.value],
                threatType: entities.threat_type || 'unknown',
                severity: entities.severity || 'high',
                alertData: {
                    source: 'manual_command',
                    description: `Manual containment request for ${entities.target.value}`
                },
                alertId: `manual-${Date.now()}`
            });
            
            // Update context
            contextManager.updateContext(sessionId, {
                workflow: {
                    activeWorkflow: 'threat_containment',
                    executionId
                },
                response: `Initiating containment procedures for ${entities.target.value}`
            });
            
            return {
                status: 'processing',
                message: `Initiating containment procedures for ${entities.target.value}. The system will be isolated to prevent threat spread.`,
                executionId,
                workflow: 'threat_containment'
            };
        } catch (error) {
            return {
                status: 'error',
                message: `Error containing threat: ${error.message}`
            };
        }
    }
    
    /**
     * Handle report incident command
     * @private
     */
    async handleReportIncident(intentResult, sessionId) {
        const { entities } = intentResult;
        
        if (!entities.incident_description) {
            return {
                status: 'error',
                message: 'No incident description provided.'
            };
        }
        
        // Implementation would create an incident report and potentially escalate
        // For now, just return a placeholder response
        
        return {
            status: 'success',
            message: `I've created an incident report with the following details:\nDescription: ${entities.incident_description}\nSeverity: ${entities.severity || 'medium'}\nAffected systems: ${entities.affected_systems ? entities.affected_systems.join(', ') : 'Not specified'}`
        };
    }
    
    /**
     * Handle status check command
     * @private
     */
    async handleStatusCheck(intentResult, sessionId) {
        const context = contextManager.getContext(sessionId);
        
        // Check for active workflow
        if (context.workflow && context.workflow.activeWorkflow && context.workflow.executionId) {
            try {
                const workflowStatus = await workflowEngine.getWorkflowStatus(context.workflow.executionId);
                
                return {
                    status: 'success',
                    message: `Current workflow "${context.workflow.activeWorkflow}" status: ${workflowStatus.status}. Current step: ${workflowStatus.currentStep + 1} of ${workflowStatus.totalSteps}.`,
                    workflowStatus
                };
            } catch (error) {
                // Workflow not found or other error
            }
        }
        
        // Check for active agent
        if (context.state && context.state.activeAgentId) {
            try {
                const agentStatus = await agentManager.getAgentStatus(context.state.activeAgentId);
                
                return {
                    status: 'success',
                    message: `Current agent status: ${agentStatus.status}. Type: ${agentStatus.type}. Running for ${Math.floor(agentStatus.uptime / 1000 / 60)} minutes.`,
                    agentStatus
                };
            } catch (error) {
                // Agent not found or other error
            }
        }
        
        // If no active workflow or agent
        return {
            status: 'success',
            message: 'No active operations in progress. How can I assist you with security operations?'
        };
    }
    
    /**
     * Handle help command
     * @private
     */
    async handleHelp(intentResult, sessionId) {
        return {
            status: 'success',
            message: `Here are some commands you can use:
- Analyze a threat indicator: "Analyze IP 192.168.1.1" or "Check if this hash is malicious: abc123..."
- Run a vulnerability scan: "Scan server web-01 for vulnerabilities"
- Contain a threat: "Isolate infected workstation LAPTOP-45"
- Report an incident: "Report a phishing email from marketing@example.com"
- Check status: "What's the status of the current operation?"

You can also ask for help with specific topics like "How do I analyze a threat?" or "What types of scans can I run?"`,
            availableCommands: Object.keys(this.commandHandlers)
        };
    }
}

module.exports = new CommandProcessor();