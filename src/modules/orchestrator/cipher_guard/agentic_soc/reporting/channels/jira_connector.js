/**
 * Jira Connector
 * 
 * Provides integration with Jira for creating and updating tickets related to
 * security incidents, vulnerabilities, and tasks. Supports custom fields,
 * automated workflows, and status tracking.
 */

class JiraConnector {
    constructor() {
        this.config = {
            enabled: true,
            apiUrl: null, // Would be loaded from configuration
            username: null,
            apiToken: null,
            defaultProject: 'SEC',
            issueTypes: {
                incident: 'Security Incident',
                vulnerability: 'Security Vulnerability',
                task: 'Security Task',
                risk: 'Security Risk'
            },
            fields: {
                // Custom field mappings would be defined here
                severity: 'customfield_10101',
                cvss: 'customfield_10102',
                mitreAttackId: 'customfield_10103',
                securityCategory: 'customfield_10104'
            }
        };
    }
    
    /**
     * Initialize the Jira connector
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Validate configuration
        if (!this.config.apiUrl || !this.config.username || !this.config.apiToken) {
            console.warn('Jira Connector: Missing required configuration. Functionality will be disabled.');
            this.config.enabled = false;
            return;
        }
        
        // Test connection
        try {
            await this._testConnection();
            console.log('Jira Connector: Successfully connected to Jira');
        } catch (error) {
            console.error('Jira Connector: Failed to connect', error);
            this.config.enabled = false;
        }
    }
    
    /**
     * Create a Jira issue from a security report or alert
     * @param {object} data The data to use for issue creation
     * @param {object} options Issue creation options
     * @returns {Promise<object>} Created issue information
     */
    async createIssue(data, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Jira Connector is not enabled or properly configured.');
        }
        
        // Determine issue type from data or options
        const issueType = this._determineIssueType(data, options);
        
        // Map data to Jira fields
        const fields = this._mapDataToJiraFields(data, issueType, options);
        
        // Create the issue
        const result = await this._createJiraIssue(fields);
        
        // Add attachments if provided
        if (options.attachments && options.attachments.length > 0) {
            await this._addAttachments(result.key, options.attachments);
        }
        
        // Add watchers if provided
        if (options.watchers && options.watchers.length > 0) {
            await this._addWatchers(result.key, options.watchers);
        }
        
        return {
            success: true,
            issueKey: result.key,
            issueId: result.id,
            issueUrl: `${this.config.apiUrl}/browse/${result.key}`,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Update an existing Jira issue
     * @param {string} issueKey The key of the issue to update
     * @param {object} data The data to use for the update
     * @param {object} options Update options
     * @returns {Promise<object>} Update result
     */
    async updateIssue(issueKey, data, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Jira Connector is not enabled or properly configured.');
        }
        
        // Map data to Jira fields for update
        const fields = this._mapDataToJiraFields(data, null, options);
        
        // Create update payload
        const updatePayload = { fields };
        
        // Add comment if provided
        if (options.comment) {
            updatePayload.update = {
                comment: [
                    {
                        add: {
                            body: options.comment
                        }
                    }
                ]
            };
        }
        
        // Update the issue
        const result = await this._updateJiraIssue(issueKey, updatePayload);
        
        // Add attachments if provided
        if (options.attachments && options.attachments.length > 0) {
            await this._addAttachments(issueKey, options.attachments);
        }
        
        return {
            success: true,
            issueKey: issueKey,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Create a comment on an existing Jira issue
     * @param {string} issueKey The key of the issue to comment on
     * @param {string} comment The comment text
     * @param {object} options Comment options
     * @returns {Promise<object>} Comment result
     */
    async addComment(issueKey, comment, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Jira Connector is not enabled or properly configured.');
        }
        
        // Create the comment
        const result = await this._createComment(issueKey, comment, options.isInternal);
        
        return {
            success: true,
            issueKey: issueKey,
            commentId: result.id,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Track security events in Jira
     * @param {object} event Security event to track
     * @param {object} options Tracking options
     * @returns {Promise<object>} Tracking result
     */
    async trackSecurityEvent(event, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Jira Connector is not enabled or properly configured.');
        }
        
        // Check if there's an existing issue for this event
        const existingIssue = await this._findExistingIssue(event, options);
        
        if (existingIssue) {
            // Update the existing issue
            const updateResult = await this.updateIssue(
                existingIssue.key,
                event,
                {
                    comment: `Updated with new information: ${event.description || 'No description provided'}`,
                    ...options
                }
            );
            
            return {
                ...updateResult,
                action: 'updated',
                existingIssue: existingIssue.key
            };
        } else {
            // Create a new issue
            const createResult = await this.createIssue(event, options);
            
            return {
                ...createResult,
                action: 'created'
            };
        }
    }
    
    /**
     * Find an existing Jira issue for a security event
     * @param {object} event Security event
     * @param {object} options Search options
     * @returns {Promise<object|null>} Existing issue or null
     * @private
     */
    async _findExistingIssue(event, options = {}) {
        // In a real implementation, this would search Jira for an existing issue
        // that matches the event criteria
        
        // For this placeholder, return null to simulate no existing issue
        return null;
    }
    
    /**
     * Determine the appropriate issue type based on data
     * @param {object} data The input data
     * @param {object} options Creation options
     * @returns {string} Jira issue type
     * @private
     */
    _determineIssueType(data, options = {}) {
        // Use explicitly specified type if provided
        if (options.issueType) {
            return options.issueType;
        }
        
        // Otherwise determine from data
        if (data.type === 'incident' || data.type === 'security_incident') {
            return this.config.issueTypes.incident;
        } else if (data.type === 'vulnerability' || data.type === 'security_vulnerability') {
            return this.config.issueTypes.vulnerability;
        } else if (data.type === 'risk' || data.type === 'security_risk') {
            return this.config.issueTypes.risk;
        } else {
            return this.config.issueTypes.task;
        }
    }
    
    /**
     * Map data to Jira fields
     * @param {object} data Input data
     * @param {string} issueType Jira issue type
     * @param {object} options Mapping options
     * @returns {object} Jira fields object
     * @private
     */
    _mapDataToJiraFields(data, issueType, options = {}) {
        // Start with basic fields
        const fields = {
            project: {
                key: options.project || this.config.defaultProject
            }
        };
        
        // Add issue type if provided
        if (issueType) {
            fields.issuetype = {
                name: issueType
            };
        }
        
        // Add summary/title
        fields.summary = data.title || data.summary || 'Security Issue';
        
        // Add description
        fields.description = this._formatDescription(data, options);
        
        // Add priority if available
        if (data.priority || data.severity) {
            fields.priority = {
                name: this._mapSeverityToPriority(data.priority || data.severity)
            };
        }
        
        // Add custom fields
        this._addCustomFields(fields, data, options);
        
        return fields;
    }
    
    /**
     * Add custom fields to the Jira fields object
     * @param {object} fields Jira fields object to modify
     * @param {object} data Source data
     * @param {object} options Mapping options
     * @private
     */
    _addCustomFields(fields, data, options = {}) {
        // Add severity if available
        if (data.severity && this.config.fields.severity) {
            fields[this.config.fields.severity] = data.severity;
        }
        
        // Add CVSS score if available
        if (data.cvssScore && this.config.fields.cvss) {
            fields[this.config.fields.cvss] = data.cvssScore.toString();
        }
        
        // Add MITRE ATT&CK ID if available
        if (data.mitreAttackId && this.config.fields.mitreAttackId) {
            fields[this.config.fields.mitreAttackId] = data.mitreAttackId;
        }
        
        // Add security category if available
        if (data.category && this.config.fields.securityCategory) {
            fields[this.config.fields.securityCategory] = data.category;
        }
        
        // Add any additional custom fields from options
        if (options.customFields) {
            for (const [fieldId, value] of Object.entries(options.customFields)) {
                fields[fieldId] = value;
            }
        }
    }
    
    /**
     * Format a description for Jira in appropriate markup
     * @param {object} data Source data
     * @param {object} options Formatting options
     * @returns {string} Formatted description
     * @private
     */
    _formatDescription(data, options = {}) {
        // In a real implementation, this would format the data into
        // Jira-compatible markup (e.g., Atlassian Document Format)
        
        // For this placeholder, create a simple formatted description
        let description = '';
        
        // Add explicit description if available
        if (data.description) {
            description += data.description + '\n\n';
        }
        
        // Add additional context details
        description += 'h2. Details\n\n';
        
        if (data.timestamp) {
            description += `* Detected: ${data.timestamp}\n`;
        }
        
        if (data.source) {
            description += `* Source: ${data.source}\n`;
        }
        
        if (data.severity) {
            description += `* Severity: ${data.severity}\n`;
        }
        
        // Add technical details if available
        if (data.technicalDetails) {
            description += '\nh2. Technical Details\n\n';
            description += '{noformat}\n';
            description += data.technicalDetails;
            description += '\n{noformat}\n\n';
        }
        
        // Add recommendations if available
        if (data.recommendations && data.recommendations.length > 0) {
            description += '\nh2. Recommendations\n\n';
            for (const rec of data.recommendations) {
                description += `* ${rec}\n`;
            }
        }
        
        // Add references if available
        if (data.references && data.references.length > 0) {
            description += '\nh2. References\n\n';
            for (const ref of data.references) {
                description += `* [${ref.title || ref.url}|${ref.url}]\n`;
            }
        }
        
        // Add generated information
        description += '\n----\n';
        description += 'Generated by Cipher Guard Agentic SOC';
        
        return description;
    }
    
    /**
     * Map severity to Jira priority
     * @param {string} severity Source severity level
     * @returns {string} Jira priority level
     * @private
     */
    _mapSeverityToPriority(severity) {
        const severityStr = String(severity).toLowerCase();
        
        switch (severityStr) {
            case 'critical':
                return 'Highest';
                
            case 'high':
                return 'High';
                
            case 'medium':
                return 'Medium';
                
            case 'low':
                return 'Low';
                
            case 'info':
            case 'informational':
                return 'Lowest';
                
            default:
                return 'Medium';
        }
    }
    
    /**
     * Placeholder methods for Jira API operations
     * In a real implementation, these would use the Jira API
     * @private
     */
    async _testConnection() { return true; }
    async _createJiraIssue(fields) { return { key: 'SEC-123', id: '12345' }; }
    async _updateJiraIssue(issueKey, payload) { return { success: true }; }
    async _createComment(issueKey, comment, isInternal) { return { id: '67890' }; }
    async _addAttachments(issueKey, attachments) { return { success: true }; }
    async _addWatchers(issueKey, watchers) { return { success: true }; }
}

module.exports = new JiraConnector();