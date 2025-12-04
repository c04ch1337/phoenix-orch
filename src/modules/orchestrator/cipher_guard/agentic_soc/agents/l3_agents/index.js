/**
 * L3 Agents Index
 * 
 * Exports all Level 3 agents in the Agentic SOC system.
 * Level 3 agents handle high-level, complex security and incident management.
 */

const AdvancedThreatAgent = require('./advanced_threat_agent');
const IncidentManagerAgent = require('./incident_manager_agent');

module.exports = {
    AdvancedThreatAgent,
    IncidentManagerAgent
};