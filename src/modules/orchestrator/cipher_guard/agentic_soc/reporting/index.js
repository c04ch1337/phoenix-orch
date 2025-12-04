/**
 * Reporting System
 * 
 * This module provides comprehensive reporting capabilities for the Agentic SOC,
 * including report generation, templating, visualization, and multi-channel delivery.
 */

const reportGenerator = require('./report_generator');
const templates = require('./templates');
const visualizations = require('./visualizations');
const channels = require('./channels');

class ReportingSystem {
    constructor() {
        this.reportGenerator = reportGenerator;
        this.templates = templates;
        this.visualizations = visualizations;
        this.channels = channels;
    }
    
    /**
     * Initialize the reporting system
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        console.log('Initializing Reporting System...');
        
        // Initialize all channel connectors
        if (config.channels) {
            for (const [channelName, channelConfig] of Object.entries(config.channels)) {
                if (this.channels[`${channelName}Connector`] && channelConfig.enabled) {
                    await this.channels[`${channelName}Connector`].initialize(channelConfig);
                }
            }
        }
        
        console.log('Reporting System initialized successfully');
    }
    
    /**
     * Generate and deliver a report
     * @param {string} reportType Type of report to generate
     * @param {object} data Data to include in the report
     * @param {object} options Report generation and delivery options
     * @returns {Promise<object>} The generated report and delivery status
     */
    async generateReport(reportType, data, options = {}) {
        // Generate the report
        const report = await this.reportGenerator.generateReport(reportType, data, options);
        
        // Deliver the report if delivery channels are specified
        const deliveryResults = {};
        if (options.deliverTo && options.deliverTo.length > 0) {
            for (const channel of options.deliverTo) {
                try {
                    if (channel === 'teams' && this.channels.teamsConnector) {
                        deliveryResults.teams = await this.channels.teamsConnector.sendReport(report, options.teamsOptions);
                    } else if (channel === 'obsidian' && this.channels.obsidianConnector) {
                        deliveryResults.obsidian = await this.channels.obsidianConnector.createNote(report, options.obsidianOptions);
                    } else if (channel === 'jira' && this.channels.jiraConnector) {
                        deliveryResults.jira = await this.channels.jiraConnector.createIssue(report, options.jiraOptions);
                    } else if (channel === 'email' && this.channels.emailConnector) {
                        deliveryResults.email = await this.channels.emailConnector.sendReport(report, options.emailOptions);
                    } else {
                        console.warn(`Unknown or disabled delivery channel: ${channel}`);
                    }
                } catch (error) {
                    console.error(`Error delivering report to ${channel}:`, error);
                    deliveryResults[channel] = { error: error.message };
                }
            }
        }
        
        return {
            report,
            deliveryResults
        };
    }
    
    /**
     * Send an alert through specified channels
     * @param {object} alert Alert data
     * @param {object} options Delivery options
     * @returns {Promise<object>} Delivery results
     */
    async sendAlert(alert, options = {}) {
        const deliveryResults = {};
        
        // Determine channels to use
        const channels = options.channels || this._determineAlertChannels(alert);
        
        // Send to each channel
        for (const channel of channels) {
            try {
                if (channel === 'teams' && this.channels.teamsConnector) {
                    deliveryResults.teams = await this.channels.teamsConnector.sendAlert(alert, options.teamsOptions);
                } else if (channel === 'jira' && this.channels.jiraConnector) {
                    deliveryResults.jira = await this.channels.jiraConnector.trackSecurityEvent(alert, options.jiraOptions);
                } else if (channel === 'email' && this.channels.emailConnector) {
                    deliveryResults.email = await this.channels.emailConnector.sendAlert(alert, options.emailOptions);
                } else {
                    console.warn(`Unknown or disabled alert channel: ${channel}`);
                }
            } catch (error) {
                console.error(`Error sending alert to ${channel}:`, error);
                deliveryResults[channel] = { error: error.message };
            }
        }
        
        return {
            alert,
            deliveryResults
        };
    }
    
    /**
     * Generate a visualization
     * @param {string} type Type of visualization
     * @param {object} data Data for the visualization
     * @param {object} options Visualization options
     * @returns {Promise<object>} Generated visualization
     */
    async generateVisualization(type, data, options = {}) {
        return this.visualizations.generateVisualization(type, data, options);
    }
    
    /**
     * Determine appropriate channels for an alert based on its properties
     * @param {object} alert The alert
     * @returns {array} List of channels to use
     * @private
     */
    _determineAlertChannels(alert) {
        const channels = [];
        
        // Always include Teams for real-time notifications
        channels.push('teams');
        
        // Add email for medium or higher severity
        if (alert.severity && ['critical', 'high', 'medium'].includes(alert.severity.toLowerCase())) {
            channels.push('email');
        }
        
        // Add Jira for tracking and follow-up
        channels.push('jira');
        
        return channels;
    }
}

module.exports = new ReportingSystem();