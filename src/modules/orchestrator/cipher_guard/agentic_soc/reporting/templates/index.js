/**
 * Report Templates
 * 
 * This module provides templates for various types of security reports,
 * including incident reports, vulnerability assessments, and executive briefings.
 */

// Import template definitions (these would be actual template files in a real implementation)
const incidentTemplate = require('./incident_template');
const vulnerabilityTemplate = require('./vulnerability_template');
const threatIntelTemplate = require('./threat_intel_template');
const executiveTemplate = require('./executive_template');
const complianceTemplate = require('./compliance_template');
const dailyOpsTemplate = require('./daily_ops_template');

module.exports = {
    // Report templates
    incidentTemplate,
    vulnerabilityTemplate,
    threatIntelTemplate,
    executiveTemplate,
    complianceTemplate,
    dailyOpsTemplate,
    
    // Template helper functions
    getTemplateByName: (name) => {
        switch (name) {
            case 'incident':
                return incidentTemplate;
            case 'vulnerability':
                return vulnerabilityTemplate;
            case 'threat_intel':
                return threatIntelTemplate;
            case 'executive':
                return executiveTemplate;
            case 'compliance':
                return complianceTemplate;
            case 'daily_ops':
                return dailyOpsTemplate;
            default:
                throw new Error(`Template '${name}' not found`);
        }
    }
};