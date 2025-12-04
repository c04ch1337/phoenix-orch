/**
 * L1 Agents Index
 * 
 * Exports all Level 1 agents in the Agentic SOC system.
 * Level 1 agents handle first-line monitoring, detection, and triage.
 */

const EmailTriageAgent = require('./email_triage_agent');
const AlertTriageAgent = require('./alert_triage_agent');
const VulnScannerAgent = require('./vuln_scanner_agent');
const ThreatHuntAgent = require('./threat_hunt_agent');
const LogMonitorAgent = require('./log_monitor_agent');

module.exports = {
    EmailTriageAgent,
    AlertTriageAgent,
    VulnScannerAgent,
    ThreatHuntAgent,
    LogMonitorAgent
};