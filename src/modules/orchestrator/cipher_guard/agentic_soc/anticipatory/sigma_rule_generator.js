/**
 * Sigma Rule Generator
 * 
 * Automatically generates Sigma rules for detecting security threats based on
 * threat intelligence, simulation results, and observed attack behaviors.
 * Sigma is an open standard for SIEM rule formats.
 */

const modelRouter = require('../models/model_router');
const emberUnitIntegration = require('./ember_unit_integration');

class SigmaRuleGenerator {
    constructor() {
        this.ruleTemplates = {
            'windows': {
                logsource: {
                    product: 'windows',
                    service: 'sysmon'
                },
                detection: {
                    selection: {},
                    condition: 'selection'
                },
                fields: [],
                falsepositives: [],
                level: 'medium'
            },
            'linux': {
                logsource: {
                    product: 'linux',
                    service: 'auditd'
                },
                detection: {
                    selection: {},
                    condition: 'selection'
                },
                fields: [],
                falsepositives: [],
                level: 'medium'
            },
            'network': {
                logsource: {
                    category: 'proxy'
                },
                detection: {
                    selection: {},
                    condition: 'selection'
                },
                fields: [],
                falsepositives: [],
                level: 'medium'
            }
        };
    }
    
    /**
     * Generate a Sigma rule based on technique or observed behavior
     * @param {object} params Generation parameters
     * @returns {Promise<object>} Generated Sigma rule
     */
    async generateRule(params = {}) {
        // Validate required parameters
        if (!params.title) {
            throw new Error('Rule title is required');
        }
        
        if (!params.techniqueId && !params.description) {
            throw new Error('Either technique ID or description is required');
        }
        
        // Determine rule template type
        const platform = params.platform || 'windows';
        
        if (!this.ruleTemplates[platform]) {
            throw new Error(`Unsupported platform: ${platform}`);
        }
        
        // If using an Ember Unit operation as source, get operation data
        if (params.emberUnitOperationId) {
            try {
                return await this._generateRuleFromEmberUnit(params);
            } catch (error) {
                console.warn('Failed to generate rule from Ember Unit, falling back to AI model:', error);
            }
        }
        
        // Generate rule using AI model
        return await this._generateRuleWithAI(params);
    }
    
    /**
     * Generate rule from Ember Unit operation data
     * @private
     */
    async _generateRuleFromEmberUnit(params) {
        if (!emberUnitIntegration.connected) {
            await emberUnitIntegration.initialize();
        }
        
        // Get operation findings from Ember Unit
        const findings = await emberUnitIntegration.getOperationFindings(params.emberUnitOperationId);
        
        // Find the detection gap that matches our technique or description
        const relevantGap = findings.detectionGaps.find(gap => {
            if (params.techniqueId && gap.technique.startsWith(params.techniqueId)) {
                return true;
            }
            
            if (params.description && gap.description.toLowerCase().includes(params.description.toLowerCase())) {
                return true;
            }
            
            return false;
        });
        
        if (!relevantGap) {
            throw new Error('No relevant detection gaps found in Ember Unit operation');
        }
        
        // Generate a base rule template
        const platform = params.platform || 'windows';
        const ruleTemplate = JSON.parse(JSON.stringify(this.ruleTemplates[platform]));
        
        // Fill in basic metadata
        const rule = {
            title: params.title,
            id: `rule-${Date.now()}`,
            status: 'experimental',
            description: params.description || relevantGap.description,
            author: 'CipherGuard Agentic SOC',
            date: new Date().toISOString().split('T')[0],
            references: [],
            tags: [],
            ...ruleTemplate
        };
        
        // Add technique to tags if provided
        if (relevantGap.technique) {
            const technique = relevantGap.technique.split('.')[0];
            rule.tags.push(`attack.t${technique}`);
            rule.references.push(`https://attack.mitre.org/techniques/${technique}/`);
        }
        
        // Add basic detection logic based on the technique
        // This is simplified - real implementations would have more sophisticated logic
        if (relevantGap.technique) {
            switch (relevantGap.technique.split('.')[0]) {
                case 'T1059': // Command and Scripting Interpreter
                    rule.detection.selection = {
                        EventID: 1,
                        Image: { endswith: ['powershell.exe', 'cmd.exe', 'wscript.exe', 'cscript.exe'] }
                    };
                    break;
                case 'T1021': // Remote Services
                    rule.detection.selection = {
                        EventID: 3,
                        DestinationPort: { inrange: ['3389', '5985-5986'] }
                    };
                    break;
                default:
                    // Generic placeholder
                    rule.detection.selection = {
                        EventID: [1, 3, 5, 11]
                    };
            }
        }
        
        return rule;
    }
    
    /**
     * Generate rule using AI model
     * @private
     */
    async _generateRuleWithAI(params) {
        // Construct the prompt for the AI model
        const prompt = `
Generate a Sigma rule for detecting the following security threat:

Title: ${params.title}
${params.techniqueId ? `MITRE ATT&CK Technique: ${params.techniqueId}` : ''}
${params.description ? `Description: ${params.description}` : ''}
Platform: ${params.platform || 'windows'}

The Sigma rule should include:
1. Complete YAML structure
2. Appropriate logsource configuration
3. Realistic detection logic
4. A condition that accurately detects the threat
5. List of fields to include in results
6. Possible false positives
7. Appropriate level (informational, low, medium, high, critical)

Make sure the detection logic is as specific as possible to reduce false positives.
        `;
        
        try {
            // Use the model to generate the rule
            const result = await modelRouter.routeTask('completion', {
                prompt
            }, { strategy: 'capability' });
            
            // In a real implementation, this would parse the YAML from the model response
            // For this placeholder, we'll create a simplified structure
            
            // Generate a base rule template
            const platform = params.platform || 'windows';
            const ruleTemplate = JSON.parse(JSON.stringify(this.ruleTemplates[platform]));
            
            // Fill in basic metadata
            const rule = {
                title: params.title,
                id: `rule-${Date.now()}`,
                status: 'experimental',
                description: params.description || `Detection rule for ${params.title}`,
                author: 'CipherGuard Agentic SOC',
                date: new Date().toISOString().split('T')[0],
                references: [],
                tags: [],
                ...ruleTemplate
            };
            
            // Add technique to tags if provided
            if (params.techniqueId) {
                rule.tags.push(`attack.t${params.techniqueId}`);
                rule.references.push(`https://attack.mitre.org/techniques/${params.techniqueId}/`);
            }
            
            // Add simple detection logic based on the technique
            // This is simplified - real AI generations would have more sophisticated logic
            rule.detection.selection = {
                EventID: [1, 3, 5]
            };
            
            rule.aiGenerated = true;
            
            return rule;
        } catch (error) {
            console.error('Error generating Sigma rule with AI model:', error);
            throw new Error(`Failed to generate Sigma rule: ${error.message}`);
        }
    }
    
    /**
     * Convert a rule to YAML format
     * @param {object} rule Rule object
     * @returns {string} YAML formatted rule
     */
    convertToYaml(rule) {
        // In a real implementation, this would use a YAML library
        // For this placeholder, we'll return a dummy YAML string
        return `
title: ${rule.title}
id: ${rule.id}
status: ${rule.status}
description: ${rule.description}
author: ${rule.author}
date: ${rule.date}
logsource:
    product: ${rule.logsource.product || 'windows'}
    service: ${rule.logsource.service || 'sysmon'}
detection:
    selection:
        # Detection logic would be here
    condition: selection
falsepositives:
    - Unknown
level: ${rule.level}
tags:
${rule.tags.map(tag => `    - ${tag}`).join('\n')}
        `;
    }
    
    /**
     * Validate a generated rule
     * @param {object} rule Rule to validate
     * @returns {object} Validation results
     */
    validateRule(rule) {
        const validationResults = {
            valid: true,
            errors: [],
            warnings: []
        };
        
        // Check required fields
        if (!rule.title) {
            validationResults.valid = false;
            validationResults.errors.push('Missing title');
        }
        
        if (!rule.description) {
            validationResults.valid = false;
            validationResults.errors.push('Missing description');
        }
        
        if (!rule.detection || !rule.detection.condition) {
            validationResults.valid = false;
            validationResults.errors.push('Missing detection condition');
        }
        
        // Check for potential issues
        if (rule.level === 'critical' && rule.falsepositives.length === 0) {
            validationResults.warnings.push('Critical rule with no documented false positives');
        }
        
        if (Object.keys(rule.detection.selection || {}).length === 0) {
            validationResults.warnings.push('Empty selection criteria');
        }
        
        return validationResults;
    }
}

module.exports = new SigmaRuleGenerator();