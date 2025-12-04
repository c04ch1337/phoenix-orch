/**
 * Teams Connector
 * 
 * Provides integration with Microsoft Teams for delivering security reports,
 * alerts, and notifications. Supports rich message formatting, adaptive cards,
 * and interactive elements.
 */

class TeamsConnector {
    constructor() {
        this.config = {
            enabled: true,
            webhookUrl: null, // Would be loaded from configuration
            defaultChannel: 'security-alerts',
            supportedFormats: ['adaptive-card', 'text', 'html']
        };
    }
    
    /**
     * Initialize the Teams connector
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Validate configuration
        if (!this.config.webhookUrl && !config.useDefaultCredentials) {
            console.warn('Teams Connector: No webhook URL provided. Functionality will be disabled.');
            this.config.enabled = false;
            return;
        }
        
        // Test connection
        try {
            await this._testConnection();
            console.log('Teams Connector: Successfully connected to Microsoft Teams');
        } catch (error) {
            console.error('Teams Connector: Failed to connect', error);
            this.config.enabled = false;
        }
    }
    
    /**
     * Send a report to Teams
     * @param {object} report The report to send
     * @param {object} options Delivery options
     * @returns {Promise<object>} Delivery result
     */
    async sendReport(report, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Teams Connector is not enabled or properly configured.');
        }
        
        const channel = options.channel || this.config.defaultChannel;
        const format = options.format || this._determineOptimalFormat(report);
        const importance = options.importance || 'normal';
        
        // Format the report for Teams
        const formattedContent = await this._formatReportForTeams(report, format);
        
        // Send the message
        const result = await this._sendMessage(channel, formattedContent, importance);
        
        return {
            success: true,
            messageId: result.id,
            channelId: channel,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Send an alert notification to Teams
     * @param {object} alert Alert information
     * @param {object} options Delivery options
     * @returns {Promise<object>} Delivery result
     */
    async sendAlert(alert, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Teams Connector is not enabled or properly configured.');
        }
        
        const channel = options.channel || alert.channel || this.config.defaultChannel;
        const importance = this._determineImportanceFromSeverity(alert.severity);
        
        // Create an adaptive card for the alert
        const adaptiveCard = this._createAlertAdaptiveCard(alert);
        
        // Send the message with the adaptive card
        const result = await this._sendMessage(channel, adaptiveCard, importance);
        
        return {
            success: true,
            messageId: result.id,
            channelId: channel,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Create an Adaptive Card for an alert
     * @param {object} alert Alert information
     * @returns {object} Adaptive Card payload
     * @private
     */
    _createAlertAdaptiveCard(alert) {
        // In a real implementation, this would generate a proper Adaptive Card
        // based on the alert information
        
        // For this placeholder, return a simple card structure
        return {
            type: 'AdaptiveCard',
            version: '1.3',
            body: [
                {
                    type: 'TextBlock',
                    size: 'large',
                    weight: 'bolder',
                    text: alert.title || 'Security Alert'
                },
                {
                    type: 'TextBlock',
                    text: alert.description || 'No description provided',
                    wrap: true
                },
                {
                    type: 'FactSet',
                    facts: [
                        { title: 'Severity', value: alert.severity || 'Unknown' },
                        { title: 'Time', value: alert.timestamp || new Date().toISOString() },
                        { title: 'Source', value: alert.source || 'Agentic SOC' }
                    ]
                }
            ],
            actions: [
                {
                    type: 'Action.OpenUrl',
                    title: 'View Details',
                    url: alert.detailsUrl || '#'
                },
                {
                    type: 'Action.OpenUrl',
                    title: 'Acknowledge',
                    url: alert.acknowledgeUrl || '#'
                }
            ]
        };
    }
    
    /**
     * Format a report for delivery to Teams
     * @param {object} report The report to format
     * @param {string} format Desired format
     * @returns {Promise<object>} Formatted content
     * @private
     */
    async _formatReportForTeams(report, format) {
        // In a real implementation, this would convert the report to the appropriate
        // format for Teams, such as an Adaptive Card or formatted HTML
        
        // For this placeholder, return a simple structure
        switch (format) {
            case 'adaptive-card':
                return {
                    type: 'AdaptiveCard',
                    version: '1.3',
                    body: [
                        {
                            type: 'TextBlock',
                            size: 'large',
                            weight: 'bolder',
                            text: report.title || 'Security Report'
                        },
                        {
                            type: 'TextBlock',
                            text: 'A new security report is available.',
                            wrap: true
                        }
                    ],
                    actions: [
                        {
                            type: 'Action.OpenUrl',
                            title: 'View Report',
                            url: report.url || '#'
                        }
                    ]
                };
                
            case 'html':
                return {
                    contentType: 'html',
                    content: `<h1>${report.title || 'Security Report'}</h1><p>A new security report is available.</p>`
                };
                
            case 'text':
            default:
                return {
                    contentType: 'text',
                    content: `${report.title || 'Security Report'}\n\nA new security report is available.`
                };
        }
    }
    
    /**
     * Determine the best format for the report based on its content
     * @param {object} report The report
     * @returns {string} Optimal format
     * @private
     */
    _determineOptimalFormat(report) {
        // In a real implementation, this would analyze the report content
        // and determine the best format for Teams
        
        // For this placeholder, default to adaptive-card
        return 'adaptive-card';
    }
    
    /**
     * Map alert severity to Teams message importance
     * @param {string} severity Alert severity
     * @returns {string} Teams message importance
     * @private
     */
    _determineImportanceFromSeverity(severity) {
        switch (String(severity).toLowerCase()) {
            case 'critical':
            case 'high':
                return 'urgent';
                
            case 'medium':
                return 'important';
                
            case 'low':
            case 'info':
            default:
                return 'normal';
        }
    }
    
    /**
     * Send a message to Teams
     * @param {string} channel Target channel
     * @param {object} content Message content
     * @param {string} importance Message importance
     * @returns {Promise<object>} Result
     * @private
     */
    async _sendMessage(channel, content, importance) {
        // In a real implementation, this would use the Teams API to send the message
        
        // For this placeholder, return a mock response
        return {
            id: `msg-${Date.now()}`,
            delivered: true,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Test the connection to Teams
     * @returns {Promise<boolean>}
     * @private
     */
    async _testConnection() {
        // In a real implementation, this would send a test message
        // to verify the connection is working
        
        // For this placeholder, return success
        return true;
    }
}

module.exports = new TeamsConnector();