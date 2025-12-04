/**
 * Email Connector
 * 
 * Provides email delivery capabilities for security reports, alerts, and notifications.
 * Supports HTML and plain text formatting, attachments, and templated emails.
 */

class EmailConnector {
    constructor() {
        this.config = {
            enabled: true,
            smtpServer: null, // Would be loaded from configuration
            smtpPort: 587,
            useTLS: true,
            username: null,
            password: null,
            fromAddress: 'cipher-guard@example.com',
            defaultRecipients: [],
            useTemplates: true
        };
        
        this.templateMap = {
            'alert': 'alert-email-template',
            'incident': 'incident-email-template',
            'daily_report': 'daily-report-email-template',
            'weekly_report': 'weekly-report-email-template',
            'vulnerability': 'vulnerability-email-template',
            'executive_summary': 'executive-summary-email-template'
        };
    }
    
    /**
     * Initialize the Email connector
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Validate configuration
        if (!this.config.smtpServer || !this.config.username || !this.config.password) {
            console.warn('Email Connector: Missing required configuration. Functionality will be disabled.');
            this.config.enabled = false;
            return;
        }
        
        // Test connection
        try {
            await this._testConnection();
            console.log('Email Connector: Successfully connected to SMTP server');
        } catch (error) {
            console.error('Email Connector: Failed to connect to SMTP server', error);
            this.config.enabled = false;
        }
    }
    
    /**
     * Send a report via email
     * @param {object} report The report to send
     * @param {object} options Email options
     * @returns {Promise<object>} Delivery result
     */
    async sendReport(report, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Email Connector is not enabled or properly configured.');
        }
        
        // Determine email template
        const template = this._determineTemplate(report, options);
        
        // Format the report for email
        const emailContent = await this._formatReportForEmail(report, template, options);
        
        // Determine recipients
        const recipients = options.recipients || this._determineRecipients(report, options);
        
        // Prepare attachments if requested
        const attachments = [];
        if (options.includeAttachments && report.content && report.content.visualizations) {
            for (const viz of report.content.visualizations) {
                if (viz.path) {
                    attachments.push({
                        filename: `${viz.title || 'visualization'}.${viz.format || 'png'}`,
                        path: viz.path
                    });
                }
            }
        }
        
        // Include report as attachment if requested
        if (options.includeReportAttachment) {
            attachments.push({
                filename: `${report.title || 'Report'}.${options.reportFormat || 'pdf'}`,
                content: await this._generateReportAttachment(report, options.reportFormat)
            });
        }
        
        // Send the email
        const result = await this._sendEmail({
            to: recipients,
            cc: options.cc,
            bcc: options.bcc,
            subject: options.subject || this._generateSubject(report),
            html: emailContent.html,
            text: emailContent.text,
            attachments: attachments,
            importance: this._determineImportance(report, options)
        });
        
        return {
            success: true,
            messageId: result.messageId,
            recipients: recipients,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Send an alert notification via email
     * @param {object} alert The alert to send
     * @param {object} options Email options
     * @returns {Promise<object>} Delivery result
     */
    async sendAlert(alert, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Email Connector is not enabled or properly configured.');
        }
        
        // Determine template
        const template = 'alert';
        
        // Format alert for email
        const emailContent = await this._formatAlertForEmail(alert, options);
        
        // Determine recipients based on alert severity and type
        const recipients = options.recipients || this._determineAlertRecipients(alert);
        
        // Send the email with high importance for critical/high alerts
        const importance = this._determineAlertImportance(alert);
        
        // Send the email
        const result = await this._sendEmail({
            to: recipients,
            cc: options.cc,
            bcc: options.bcc,
            subject: options.subject || `[${alert.severity.toUpperCase()}] ${alert.title}`,
            html: emailContent.html,
            text: emailContent.text,
            importance: importance
        });
        
        return {
            success: true,
            messageId: result.messageId,
            recipients: recipients,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Send bulk notifications (e.g., daily digest)
     * @param {object} data The data to include in the digest
     * @param {object} options Email options
     * @returns {Promise<object>} Delivery result
     */
    async sendDigest(data, options = {}) {
        if (!this.config.enabled) {
            throw new Error('Email Connector is not enabled or properly configured.');
        }
        
        // Determine digest type and template
        const digestType = options.digestType || 'daily';
        const template = this._determineTemplate({ type: `${digestType}_report` }, options);
        
        // Format digest for email
        const emailContent = await this._formatDigestForEmail(digestType, data, options);
        
        // Determine recipients
        const recipients = options.recipients || this.config.defaultRecipients;
        
        // Send the email
        const result = await this._sendEmail({
            to: recipients,
            cc: options.cc,
            bcc: options.bcc,
            subject: options.subject || this._generateDigestSubject(digestType, data),
            html: emailContent.html,
            text: emailContent.text,
            attachments: options.attachments
        });
        
        return {
            success: true,
            messageId: result.messageId,
            recipients: recipients,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Format a report for email delivery
     * @param {object} report The report to format
     * @param {string} template Template to use
     * @param {object} options Formatting options
     * @returns {Promise<object>} Formatted email content
     * @private
     */
    async _formatReportForEmail(report, template, options = {}) {
        // In a real implementation, this would use HTML templates
        // and generate both HTML and plain text versions
        
        // For this placeholder, create simple HTML and text versions
        let html = `<h1>${report.title || 'Security Report'}</h1>`;
        let text = `${report.title || 'Security Report'}\n${'='.repeat((report.title || 'Security Report').length)}\n\n`;
        
        if (report.content && report.content.sections) {
            for (const [sectionName, sectionContent] of Object.entries(report.content.sections)) {
                // Add section to HTML
                html += `<h2>${sectionName}</h2>`;
                html += `<div>${sectionContent}</div>`;
                
                // Add section to plain text
                text += `${sectionName}\n${'-'.repeat(sectionName.length)}\n\n`;
                text += `${sectionContent}\n\n`;
            }
        }
        
        // Add summary if available
        if (report.summary) {
            html = `<p><strong>Summary:</strong> ${report.summary}</p>${html}`;
            text = `Summary: ${report.summary}\n\n${text}`;
        }
        
        // Add footer
        html += '<hr><p><em>Generated by Cipher Guard Agentic SOC</em></p>';
        text += '\n---\nGenerated by Cipher Guard Agentic SOC';
        
        return { html, text };
    }
    
    /**
     * Format an alert for email delivery
     * @param {object} alert The alert to format
     * @param {object} options Formatting options
     * @returns {Promise<object>} Formatted email content
     * @private
     */
    async _formatAlertForEmail(alert, options = {}) {
        // Create styled HTML for the alert
        let severityColor;
        switch (String(alert.severity).toLowerCase()) {
            case 'critical':
                severityColor = '#ff0000';
                break;
            case 'high':
                severityColor = '#ff9900';
                break;
            case 'medium':
                severityColor = '#ffcc00';
                break;
            case 'low':
                severityColor = '#00cc00';
                break;
            default:
                severityColor = '#999999';
        }
        
        // HTML version
        let html = `
            <h1 style="color: ${severityColor};">[${alert.severity.toUpperCase()}] ${alert.title || 'Security Alert'}</h1>
            <p><strong>Time:</strong> ${alert.timestamp || new Date().toISOString()}</p>
            <p><strong>Source:</strong> ${alert.source || 'Agentic SOC'}</p>
            <hr>
            <h2>Description</h2>
            <p>${alert.description || 'No description provided.'}</p>
        `;
        
        // Add IOCs if available
        if (alert.iocs && alert.iocs.length > 0) {
            html += '<h2>Indicators of Compromise</h2><ul>';
            for (const ioc of alert.iocs) {
                html += `<li><strong>${ioc.type}:</strong> ${ioc.value}</li>`;
            }
            html += '</ul>';
        }
        
        // Add recommendations if available
        if (alert.recommendations && alert.recommendations.length > 0) {
            html += '<h2>Recommended Actions</h2><ul>';
            for (const rec of alert.recommendations) {
                html += `<li>${rec}</li>`;
            }
            html += '</ul>';
        }
        
        // Add footer
        html += '<hr><p><em>Generated by Cipher Guard Agentic SOC</em></p>';
        
        // Plain text version
        let text = `[${alert.severity.toUpperCase()}] ${alert.title || 'Security Alert'}\n\n`;
        text += `Time: ${alert.timestamp || new Date().toISOString()}\n`;
        text += `Source: ${alert.source || 'Agentic SOC'}\n\n`;
        text += `Description:\n${alert.description || 'No description provided.'}\n\n`;
        
        // Add IOCs if available
        if (alert.iocs && alert.iocs.length > 0) {
            text += 'Indicators of Compromise:\n';
            for (const ioc of alert.iocs) {
                text += `- ${ioc.type}: ${ioc.value}\n`;
            }
            text += '\n';
        }
        
        // Add recommendations if available
        if (alert.recommendations && alert.recommendations.length > 0) {
            text += 'Recommended Actions:\n';
            for (const rec of alert.recommendations) {
                text += `- ${rec}\n`;
            }
            text += '\n';
        }
        
        // Add footer
        text += '\n---\nGenerated by Cipher Guard Agentic SOC';
        
        return { html, text };
    }
    
    /**
     * Format a digest for email delivery
     * @param {string} digestType Type of digest
     * @param {object} data Digest data
     * @param {object} options Formatting options
     * @returns {Promise<object>} Formatted email content
     * @private
     */
    async _formatDigestForEmail(digestType, data, options = {}) {
        // In a real implementation, this would use templates specific to the digest type
        
        // For this placeholder, create simple HTML and text content
        let title;
        switch (digestType) {
            case 'daily':
                title = 'Daily Security Digest';
                break;
            case 'weekly':
                title = 'Weekly Security Digest';
                break;
            case 'monthly':
                title = 'Monthly Security Report';
                break;
            default:
                title = 'Security Digest';
        }
        
        // HTML version
        let html = `<h1>${title}</h1>`;
        html += `<p><strong>Period:</strong> ${data.period || 'Not specified'}</p>`;
        
        // Add summary section
        html += '<h2>Summary</h2>';
        html += `<p>${data.summary || 'No summary provided.'}</p>`;
        
        // Add alerts section if available
        if (data.alerts && data.alerts.length > 0) {
            html += '<h2>Alerts</h2>';
            html += '<table border="1" style="border-collapse: collapse; width: 100%;">';
            html += '<tr><th>Severity</th><th>Title</th><th>Time</th></tr>';
            
            for (const alert of data.alerts) {
                const severityColor = this._getSeverityColor(alert.severity);
                html += `<tr>
                    <td style="background-color: ${severityColor}; color: white;">${alert.severity}</td>
                    <td>${alert.title}</td>
                    <td>${alert.timestamp}</td>
                </tr>`;
            }
            
            html += '</table>';
        }
        
        // Add incidents section if available
        if (data.incidents && data.incidents.length > 0) {
            html += '<h2>Incidents</h2>';
            html += '<ul>';
            
            for (const incident of data.incidents) {
                html += `<li><strong>${incident.title}</strong> - ${incident.status}</li>`;
            }
            
            html += '</ul>';
        }
        
        // Add footer
        html += '<hr><p><em>Generated by Cipher Guard Agentic SOC</em></p>';
        
        // Plain text version
        let text = `${title}\n${'-'.repeat(title.length)}\n\n`;
        text += `Period: ${data.period || 'Not specified'}\n\n`;
        text += `Summary:\n${data.summary || 'No summary provided.'}\n\n`;
        
        // Add alerts section if available
        if (data.alerts && data.alerts.length > 0) {
            text += 'Alerts:\n';
            
            for (const alert of data.alerts) {
                text += `[${alert.severity.toUpperCase()}] ${alert.title} - ${alert.timestamp}\n`;
            }
            
            text += '\n';
        }
        
        // Add incidents section if available
        if (data.incidents && data.incidents.length > 0) {
            text += 'Incidents:\n';
            
            for (const incident of data.incidents) {
                text += `- ${incident.title} - ${incident.status}\n`;
            }
            
            text += '\n';
        }
        
        // Add footer
        text += '\n---\nGenerated by Cipher Guard Agentic SOC';
        
        return { html, text };
    }
    
    /**
     * Get a color for a severity level
     * @param {string} severity Severity level
     * @returns {string} CSS color
     * @private
     */
    _getSeverityColor(severity) {
        switch (String(severity).toLowerCase()) {
            case 'critical':
                return '#ff0000';
            case 'high':
                return '#ff9900';
            case 'medium':
                return '#ffcc00';
            case 'low':
                return '#00cc00';
            case 'info':
            case 'informational':
                return '#0099cc';
            default:
                return '#999999';
        }
    }
    
    /**
     * Generate a subject line for a report
     * @param {object} report The report
     * @returns {string} Email subject
     * @private
     */
    _generateSubject(report) {
        // Add report type prefix
        let prefix = '';
        if (report.type) {
            switch (report.type.toLowerCase()) {
                case 'incident':
                    prefix = '[Incident Report] ';
                    break;
                case 'vulnerability':
                    prefix = '[Vulnerability Report] ';
                    break;
                case 'threat_intel':
                    prefix = '[Threat Intel] ';
                    break;
                case 'compliance':
                    prefix = '[Compliance Report] ';
                    break;
                default:
                    prefix = '[Security Report] ';
            }
        } else {
            prefix = '[Security Report] ';
        }
        
        // Add severity prefix for relevant report types
        if (report.severity && 
            (report.type === 'incident' || 
             report.type === 'vulnerability' || 
             report.type === 'threat_intel')) {
            prefix = `[${report.severity.toUpperCase()}] ${prefix}`;
        }
        
        return `${prefix}${report.title || 'Security Report'}`;
    }
    
    /**
     * Generate a subject line for a digest
     * @param {string} digestType Type of digest
     * @param {object} data Digest data
     * @returns {string} Email subject
     * @private
     */
    _generateDigestSubject(digestType, data) {
        switch (digestType) {
            case 'daily':
                return `Daily Security Digest - ${new Date().toDateString()}`;
            case 'weekly':
                return `Weekly Security Report - Week ${this._getWeekNumber(new Date())}`;
            case 'monthly':
                return `Monthly Security Summary - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`;
            default:
                return `Security Digest - ${new Date().toDateString()}`;
        }
    }
    
    /**
     * Get the week number for a date
     * @param {Date} date Date to get week number for
     * @returns {number} Week number
     * @private
     */
    _getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    
    /**
     * Determine the template to use for a report
     * @param {object} report The report
     * @param {object} options Email options
     * @returns {string} Template name
     * @private
     */
    _determineTemplate(report, options = {}) {
        // Use explicitly specified template if provided
        if (options.template) {
            return options.template;
        }
        
        // Otherwise determine from report type
        if (report.type && this.templateMap[report.type]) {
            return this.templateMap[report.type];
        }
        
        // Default to generic template
        return 'generic-email-template';
    }
    
    /**
     * Determine recipients for a report
     * @param {object} report The report
     * @param {object} options Email options
     * @returns {array} Email recipients
     * @private
     */
    _determineRecipients(report, options = {}) {
        // In a real implementation, this would determine appropriate recipients
        // based on report type, severity, content, etc.
        
        // For this placeholder, return default recipients
        return this.config.defaultRecipients;
    }
    
    /**
     * Determine recipients for an alert
     * @param {object} alert The alert
     * @returns {array} Email recipients
     * @private
     */
    _determineAlertRecipients(alert) {
        // In a real implementation, this would determine appropriate recipients
        // based on alert severity, type, etc.
        
        // For this placeholder, return default recipients
        return this.config.defaultRecipients;
    }
    
    /**
     * Determine importance for an alert
     * @param {object} alert The alert
     * @returns {string} Email importance
     * @private
     */
    _determineAlertImportance(alert) {
        if (!alert.severity) {
            return 'normal';
        }
        
        switch (String(alert.severity).toLowerCase()) {
            case 'critical':
            case 'high':
                return 'high';
                
            case 'medium':
                return 'normal';
                
            case 'low':
            case 'info':
            case 'informational':
                return 'low';
                
            default:
                return 'normal';
        }
    }
    
    /**
     * Determine importance for a report
     * @param {object} report The report
     * @param {object} options Email options
     * @returns {string} Email importance
     * @private
     */
    _determineImportance(report, options = {}) {
        // Use explicitly specified importance if provided
        if (options.importance) {
            return options.importance;
        }
        
        // For reports with severity
        if (report.severity) {
            switch (String(report.severity).toLowerCase()) {
                case 'critical':
                case 'high':
                    return 'high';
                    
                case 'medium':
                    return 'normal';
                    
                case 'low':
                case 'info':
                case 'informational':
                    return 'low';
                    
                default:
                    return 'normal';
            }
        }
        
        // For specific report types
        if (report.type) {
            switch (report.type.toLowerCase()) {
                case 'incident':
                    return 'high';
                    
                case 'executive_summary':
                    return 'high';
                    
                default:
                    return 'normal';
            }
        }
        
        return 'normal';
    }
    
    /**
     * Generate a report attachment
     * @param {object} report The report
     * @param {string} format Attachment format
     * @returns {Promise<Buffer>} Attachment content
     * @private
     */
    async _generateReportAttachment(report, format) {
        // In a real implementation, this would generate the report in the requested format
        
        // For this placeholder, return a dummy buffer
        return Buffer.from('Placeholder for report attachment');
    }
    
    /**
     * Placeholder methods for email operations
     * In a real implementation, these would use a mail transport
     * @private
     */
    async _testConnection() { return true; }
    async _sendEmail(options) { return { messageId: `msg-${Date.now()}` }; }
}

module.exports = new EmailConnector();