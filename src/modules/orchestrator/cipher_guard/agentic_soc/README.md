# Cipher Guard Agentic SOC System

The Cipher Guard Agentic SOC (Security Operations Center) is an advanced autonomous security system that leverages AI agents in a hierarchical structure to monitor, detect, analyze, and respond to cybersecurity threats.

## Directory Structure

### Agent Hierarchy Framework
- `agents/` - Core agent framework components
  - `l1_agents/` - Level 1 agents (first-line response)
  - `l2_agents/` - Level 2 agents (specialized analysis)
  - `l3_agents/` - Level 3 agents (advanced response and management)
  - `agent_factory.js` - Agent instantiation and configuration
  - `agent_manager.js` - Agent lifecycle management
  - `agent_registry.js` - Agent registration and discovery
  - `escalation_manager.js` - Manages escalation between agent levels

### Specialized Agent Modules
- `agents/l1_agents/` - Level 1 agents
  - `email_triage_agent/` - Email threat analysis
  - `alert_triage_agent/` - Security alert initial assessment
  - `vuln_scanner_agent/` - Vulnerability scanning
  - `threat_hunt_agent/` - Basic threat hunting
  - `log_monitor_agent/` - Log monitoring and analysis
- `agents/l2_agents/` - Level 2 agents
  - `incident_response_agent/` - Incident response coordination
  - `forensics_agent/` - Digital forensics
  - `threat_intelligence_agent/` - Threat intelligence analysis
  - `vuln_management_agent/` - Vulnerability management
  - `threat_hunter_agent/` - Advanced threat hunting
- `agents/l3_agents/` - Level 3 agents
  - `advanced_threat_agent/` - Advanced persistent threat response
  - `incident_manager_agent/` - High-level incident management

### AI Model Integration
- `models/` - AI model interfaces and management
  - `deepseek_interface.js` - Interface to Deepseek AI models
  - `llama_interface.js` - Interface to Llama AI models
  - `model_router.js` - Model selection and routing
  - `prompt_templates/` - Specialized prompt templates for security tasks

### Workflow Engine
- `workflows/` - Automated workflow management
  - `workflow_engine.js` - Workflow execution engine
  - `workflow_registry.js` - Workflow registration and discovery
  - `workflow_templates/` - Predefined workflow templates
    - `email_response_workflow.js` - Email threat response
    - `threat_containment_workflow.js` - Threat containment procedures
    - `vulnerability_management_workflow.js` - Vuln management process
    - `threat_hunting_workflow.js` - Threat hunting procedures
    - `reporting_workflow.js` - Report generation workflows

### Natural Language Interface
- `interfaces/natural_language/` - NLP components
  - `intent_parser.js` - Analyzes user intent from natural language
  - `context_manager.js` - Manages conversation context
  - `command_processor.js` - Processes commands from natural language
  - `voice_interface.js` - Voice interaction capabilities

### Anticipatory Defense
- `anticipatory/` - Proactive defense mechanisms
  - `ember_unit_integration.js` - Integration with Ember Unit
  - `scenario_generator.js` - Security scenario simulation
  - `sigma_rule_generator.js` - Automatic Sigma rule generation
  - `yara_rule_generator.js` - Automatic YARA rule generation
  - `purple_team_automation.js` - Automated red/blue team exercises
  - `zero_day_monitor.js` - Zero-day vulnerability monitoring

### Dad Oversight Components
- `oversight/` - Human oversight and governance
  - `dad_interface.js` - Interface for human oversight
  - `neuralink_connector.js` - Neural interface connection
  - `priority_filter.js` - Prioritization for human attention
  - `decision_gateway.js` - Critical decision approval workflow
  - `briefing_generator.js` - Executive briefing preparation

### Reporting Systems
- `reporting/` - Reporting and notification components
  - `report_generator.js` - Report creation and formatting
  - `templates/` - Report templates
  - `visualizations/` - Data visualization components
  - `channels/` - Communication channels
    - `teams_connector.js` - Microsoft Teams integration
    - `obsidian_connector.js` - Obsidian integration
    - `jira_connector.js` - Jira integration
    - `email_connector.js` - Email notifications

### Integration Connectors
- `integrations/` - External system integrations
  - `proofpoint/` - Proofpoint integration
  - `crowdstrike/` - CrowdStrike integration
  - `rapid7/` - Rapid7 integration
  - `jira/` - Jira integration
  - `teams/` - Microsoft Teams integration
  - `obsidian/` - Obsidian integration

### Core System
- `core/` - Core system components
  - `database.js` - Database operations
  - `scheduler.js` - Task scheduling
  - `message_bus.js` - Internal messaging system
  - `logger.js` - Logging and audit trail
  - `security_monitor.js` - System self-monitoring
  - `config_manager.js` - Configuration management

### Utility Modules
- `utils/` - Shared utilities
  - `encryption.js` - Encryption utilities
  - `validation.js` - Input validation
  - `metrics.js` - Performance metrics
  - `telemetry.js` - System telemetry

## Getting Started

This is currently a placeholder structure for the Cipher Guard Agentic SOC system. Implementation details will be provided in future updates.

## Dependencies

- Node.js
- AI model providers (Deepseek, Llama)
- Various security tools and APIs

## License

Proprietary - Cipher Guard