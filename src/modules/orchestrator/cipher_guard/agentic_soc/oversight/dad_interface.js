/**
 * Dad Interface
 * 
 * Provides the primary interface for Dad's oversight of the Agentic SOC system.
 * Manages communication, approvals, and feedback between the system and Dad.
 */

const priorityFilter = require('./priority_filter');
const decisionGateway = require('./decision_gateway');
const briefingGenerator = require('./briefing_generator');
const neuralinkConnector = require('./neuralink_connector');

class DadInterface {
    constructor(config = {}) {
        this.config = {
            defaultCommunicationChannel: 'teams', // Default: Teams, other options: email, neuralink
            autoApprovalThreshold: 'low', // Approval not required for low-risk actions
            alertThreshold: 'medium', // Alert Dad for medium+ risk situations
            escalationThreshold: 'high', // Immediate attention for high+ risk situations
            briefingSchedule: 'daily', // Default briefing frequency
            ...config
        };
        
        this.pendingApprovals = new Map();
        this.communicationStatus = {
            lastContact: null,
            openRequests: 0,
            lastRequestTime: null,
            preferredChannel: this.config.defaultCommunicationChannel
        };
        
        this.neuralinkAvailable = false;
    }
    
    /**
     * Initialize the Dad interface
     * @returns {Promise<boolean>} Initialization status
     */
    async initialize() {
        console.log('Initializing Dad Interface');
        
        // Try to establish Neuralink connection if configured
        if (this.config.defaultCommunicationChannel === 'neuralink') {
            try {
                this.neuralinkAvailable = await neuralinkConnector.initialize();
                console.log(`Neuralink connection ${this.neuralinkAvailable ? 'established' : 'failed'}`);
            } catch (error) {
                console.error('Error initializing Neuralink:', error);
                this.neuralinkAvailable = false;
            }
        }
        
        return true;
    }
    
    /**
     * Request Dad's approval for a critical action
     * @param {object} action The action requiring approval
     * @param {object} context Context information for the decision
     * @param {string} urgency How urgent the request is ('normal', 'urgent', 'critical')
     * @returns {Promise<object>} Approval response
     */
    async requestApproval(action, context, urgency = 'normal') {
        if (!action || !action.type) {
            throw new Error('Invalid action object');
        }
        
        // Check if action requires Dad's approval based on risk level
        const riskLevel = decisionGateway.assessRisk(action, context);
        
        if (riskLevel === 'low' && this.config.autoApprovalThreshold === 'low') {
            return {
                approved: true,
                autoApproved: true,
                approvalId: `auto-${Date.now()}`,
                message: 'Auto-approved based on low risk assessment'
            };
        }
        
        // Generate a request ID
        const requestId = `req-${Date.now()}`;
        
        // Format the decision request
        const request = {
            id: requestId,
            action,
            context,
            riskLevel,
            urgency,
            requestTime: new Date().toISOString(),
            status: 'pending',
            decision: null
        };
        
        // Store the pending request
        this.pendingApprovals.set(requestId, request);
        this.communicationStatus.openRequests++;
        this.communicationStatus.lastRequestTime = new Date().toISOString();
        
        // Send the request through the appropriate channel
        const sent = await this._sendApprovalRequest(request);
        if (!sent) {
            throw new Error('Failed to send approval request');
        }
        
        // For urgent/critical requests, we'll wait for response
        if (urgency === 'urgent' || urgency === 'critical') {
            // In a real implementation, this would await the response
            // For this placeholder, we'll simulate a response
            
            // Simulate Dad's response (auto-approval for this placeholder)
            setTimeout(() => {
                this._processApprovalResponse(requestId, {
                    approved: true,
                    message: 'Approved by Dad',
                    conditions: []
                });
            }, 2000);
            
            // For simplicity in this placeholder, we'll return an auto-response
            // In reality, this would likely return a Promise that resolves when Dad responds
            return {
                requestId,
                status: 'pending',
                message: `Approval request sent to Dad with ${urgency} urgency`
            };
        }
        
        // For normal urgency, return immediately and process asynchronously
        return {
            requestId,
            status: 'pending',
            message: 'Approval request sent to Dad'
        };
    }
    
    /**
     * Check the status of a pending approval request
     * @param {string} requestId The request ID to check
     * @returns {object} Current status of the approval request
     */
    checkApprovalStatus(requestId) {
        const request = this.pendingApprovals.get(requestId);
        
        if (!request) {
            return {
                requestId,
                status: 'not_found',
                message: 'Approval request not found'
            };
        }
        
        return {
            requestId,
            status: request.status,
            decision: request.decision,
            requestTime: request.requestTime,
            responseTime: request.responseTime
        };
    }
    
    /**
     * Notify Dad about an important event or information
     * @param {object} notification Information to notify about
     * @param {string} priority Priority level ('low', 'medium', 'high', 'critical')
     * @returns {Promise<boolean>} Whether the notification was sent
     */
    async notifyDad(notification, priority = 'medium') {
        if (!notification || !notification.title) {
            throw new Error('Invalid notification object');
        }
        
        // Check if this notification meets the priority threshold
        if (!priorityFilter.shouldNotify(notification, priority, this.config.alertThreshold)) {
            console.log(`Notification skipped due to priority filter: ${notification.title}`);
            return false;
        }
        
        // Format the notification
        const formattedNotification = {
            ...notification,
            priority,
            timestamp: new Date().toISOString(),
            id: `notif-${Date.now()}`
        };
        
        // Send the notification through the appropriate channel
        return this._sendNotification(formattedNotification);
    }
    
    /**
     * Generate and deliver a briefing to Dad
     * @param {string} briefingType Type of briefing ('daily', 'weekly', 'monthly', 'incident', 'custom')
     * @param {object} parameters Additional parameters for the briefing
     * @returns {Promise<object>} Briefing delivery result
     */
    async deliverBriefing(briefingType = 'daily', parameters = {}) {
        // Generate the briefing using the briefing generator
        const briefing = await briefingGenerator.generateBriefing(briefingType, parameters);
        
        // Format the briefing for delivery
        const deliveryPackage = {
            id: `brief-${Date.now()}`,
            type: briefingType,
            title: briefing.title,
            summary: briefing.summary,
            content: briefing.content,
            attachments: briefing.attachments,
            timestamp: new Date().toISOString()
        };
        
        // Deliver the briefing through the appropriate channel
        const delivered = await this._sendBriefing(deliveryPackage);
        
        return {
            briefingId: deliveryPackage.id,
            delivered,
            timestamp: deliveryPackage.timestamp,
            type: briefingType
        };
    }
    
    /**
     * Change Dad's preferred communication channel
     * @param {string} channel New preferred communication channel
     */
    setPreferredChannel(channel) {
        if (!['teams', 'email', 'neuralink'].includes(channel)) {
            throw new Error(`Unsupported communication channel: ${channel}`);
        }
        
        // If switching to Neuralink, verify availability
        if (channel === 'neuralink' && !this.neuralinkAvailable) {
            throw new Error('Neuralink communication requested but not available');
        }
        
        this.communicationStatus.preferredChannel = channel;
    }
    
    /**
     * Record feedback received from Dad
     * @param {object} feedback Feedback provided by Dad
     * @returns {string} Feedback ID
     */
    recordFeedback(feedback) {
        if (!feedback || !feedback.content) {
            throw new Error('Invalid feedback object');
        }
        
        const feedbackRecord = {
            ...feedback,
            id: `feedback-${Date.now()}`,
            timestamp: new Date().toISOString(),
            status: 'received',
            processed: false
        };
        
        // In a real implementation, this would store the feedback
        // and trigger appropriate handling processes
        
        return feedbackRecord.id;
    }
    
    /** 
     * Get communication status with Dad
     * @returns {object} Current communication status
     */
    getCommunicationStatus() {
        return {
            ...this.communicationStatus,
            neuralinkAvailable: this.neuralinkAvailable,
            pendingApprovals: this.pendingApprovals.size
        };
    }
    
    /**
     * Send an approval request through the appropriate channel
     * @private
     */
    async _sendApprovalRequest(request) {
        const channel = this.communicationStatus.preferredChannel;
        
        // In a real implementation, this would send through the selected channel
        console.log(`[${channel.toUpperCase()}] Sending approval request to Dad: ${request.id}`);
        
        // Simulate successful sending
        return true;
    }
    
    /**
     * Process a response from Dad about an approval request
     * @private
     */
    _processApprovalResponse(requestId, response) {
        const request = this.pendingApprovals.get(requestId);
        
        if (!request) {
            console.error(`Cannot process response for unknown request: ${requestId}`);
            return false;
        }
        
        // Update the request with the response
        request.status = 'completed';
        request.decision = response;
        request.responseTime = new Date().toISOString();
        
        // Update communication status
        this.communicationStatus.lastContact = new Date().toISOString();
        this.communicationStatus.openRequests--;
        
        // In a real implementation, this would trigger appropriate actions
        // based on the response
        
        return true;
    }
    
    /**
     * Send a notification through the appropriate channel
     * @private
     */
    async _sendNotification(notification) {
        const channel = this.communicationStatus.preferredChannel;
        
        // For high priority items where Neuralink is available, use it
        if (notification.priority === 'critical' && this.neuralinkAvailable) {
            // In a real implementation, this would use the Neuralink
            console.log(`[NEURALINK] Sending CRITICAL notification to Dad: ${notification.title}`);
            return true;
        }
        
        // Otherwise use the preferred channel
        console.log(`[${channel.toUpperCase()}] Sending ${notification.priority} notification to Dad: ${notification.title}`);
        
        // Simulate successful sending
        return true;
    }
    
    /**
     * Send a briefing through the appropriate channel
     * @private
     */
    async _sendBriefing(briefing) {
        const channel = this.communicationStatus.preferredChannel;
        
        // In a real implementation, this would send through the selected channel
        console.log(`[${channel.toUpperCase()}] Sending ${briefing.type} briefing to Dad: ${briefing.title}`);
        
        // Simulate successful sending
        return true;
    }
}

module.exports = new DadInterface();