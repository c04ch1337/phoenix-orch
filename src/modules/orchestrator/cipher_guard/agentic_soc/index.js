/**
 * Agentic SOC System - Main Entry Point
 * 
 * This module exports all major components of the Cipher Guard Agentic SOC system.
 */

// Agent Hierarchy Framework
const agentFactory = require('./agents/agent_factory');
const agentManager = require('./agents/agent_manager');
const agentRegistry = require('./agents/agent_registry');
const escalationManager = require('./agents/escalation_manager');

// AI Model Integration
const modelRouter = require('./models/model_router');
const deepseekInterface = require('./models/deepseek_interface');
const llamaInterface = require('./models/llama_interface');

// Workflow Engine
const workflowEngine = require('./workflows/workflow_engine');
const workflowRegistry = require('./workflows/workflow_registry');

// Natural Language Interface
const intentParser = require('./interfaces/natural_language/intent_parser');
const contextManager = require('./interfaces/natural_language/context_manager');
const commandProcessor = require('./interfaces/natural_language/command_processor');
const voiceInterface = require('./interfaces/natural_language/voice_interface');

// Anticipatory Defense
const emberUnitIntegration = require('./anticipatory/ember_unit_integration');
const scenarioGenerator = require('./anticipatory/scenario_generator');
const sigmaRuleGenerator = require('./anticipatory/sigma_rule_generator');
const yaraRuleGenerator = require('./anticipatory/yara_rule_generator');
const purpleTeamAutomation = require('./anticipatory/purple_team_automation');
const zeroDayMonitor = require('./anticipatory/zero_day_monitor');

// Dad Oversight Components
const dadInterface = require('./oversight/dad_interface');
const neuralinkConnector = require('./oversight/neuralink_connector');
const priorityFilter = require('./oversight/priority_filter');
const decisionGateway = require('./oversight/decision_gateway');
const briefingGenerator = require('./oversight/briefing_generator');

// Reporting Systems
const reportGenerator = require('./reporting/report_generator');

// Core System
const database = require('./core/database');
const scheduler = require('./core/scheduler');
const messageBus = require('./core/message_bus');
const logger = require('./core/logger');
const securityMonitor = require('./core/security_monitor');
const configManager = require('./core/config_manager');

// Utility Modules
const encryption = require('./utils/encryption');
const validation = require('./utils/validation');
const metrics = require('./utils/metrics');
const telemetry = require('./utils/telemetry');

module.exports = {
    // Agent Hierarchy
    agentFactory,
    agentManager,
    agentRegistry,
    escalationManager,
    
    // AI Models
    modelRouter,
    deepseekInterface,
    llamaInterface,
    
    // Workflows
    workflowEngine,
    workflowRegistry,
    
    // Natural Language
    intentParser,
    contextManager,
    commandProcessor,
    voiceInterface,
    
    // Anticipatory Defense
    emberUnitIntegration,
    scenarioGenerator,
    sigmaRuleGenerator,
    yaraRuleGenerator,
    purpleTeamAutomation,
    zeroDayMonitor,
    
    // Dad Oversight
    dadInterface,
    neuralinkConnector,
    priorityFilter,
    decisionGateway,
    briefingGenerator,
    
    // Reporting
    reportGenerator,
    
    // Core System
    database,
    scheduler,
    messageBus,
    logger,
    securityMonitor,
    configManager,
    
    // Utils
    encryption,
    validation,
    metrics,
    telemetry
};