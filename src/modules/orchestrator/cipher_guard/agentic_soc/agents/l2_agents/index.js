/**
 * L2 Agents Index
 * 
 * Exports all Level 2 agents in the Agentic SOC system.
 * Level 2 agents handle specialized analysis, investigation, and response.
 */

const IncidentResponseAgent = require('./incident_response_agent');
const ForensicsAgent = require('./forensics_agent');
const ThreatIntelligenceAgent = require('./threat_intelligence_agent');
const VulnManagementAgent = require('./vuln_management_agent');
const ThreatHunterAgent = require('./threat_hunter_agent');

module.exports = {
    IncidentResponseAgent,
    ForensicsAgent,
    ThreatIntelligenceAgent,
    VulnManagementAgent,
    ThreatHunterAgent
};