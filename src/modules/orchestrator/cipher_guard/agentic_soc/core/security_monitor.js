/**
 * Security Monitor
 * 
 * Provides security monitoring for the Agentic SOC system itself,
 * ensuring the integrity and security of the platform. Monitors for
 * potential attacks, unauthorized access, and runtime anomalies.
 */

const logger = require('./logger');
const messageBus = require('./message_bus');

class SecurityMonitor {
    constructor() {
        this.config = {
            enabled: true,
            monitoringIntervalMs: 60000, // 1 minute
            maxCpuUsagePercent: 90,
            maxMemoryUsagePercent: 90,
            fileIntegrityMonitoring: {
                enabled: true,
                paths: [
                    './src/modules/orchestrator/cipher_guard/agentic_soc/core',
                    './src/modules/orchestrator/cipher_guard/agentic_soc/agents'
                ],
                excludePaths: [
                    '**/*.log',
                    '**/*.tmp',
                    '**/node_modules/**'
                ]
            },
            abnormalBehavior: {
                enabled: true,
                maxMessagesPerSecond: 1000,
                maxErrorRatePercent: 10,
                maxAgentFailures: 3
            },
            selfHealing: {
                enabled: true,
                autoRestart: true,
                autoRollback: true
            }
        };
        
        this.initialized = false;
        this.monitoringInterval = null;
        this.messageStats = {
            total: 0,
            errors: 0,
            lastReset: Date.now()
        };
        this.systemMetrics = {
            cpu: 0,
            memory: 0,
            uptimeMs: 0,
            lastCheck: null
        };
        this.fileHashes = new Map();
        this.agentFailures = new Map();
        this.abnormalEvents = [];
    }
    
    /**
     * Initialize the security monitor
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        if (!this.config.enabled) {
            logger.warn('Security Monitor is disabled');
            return;
        }
        
        try {
            // Subscribe to system events
            this._subscribeToEvents();
            
            // Compute baseline file hashes if file integrity monitoring is enabled
            if (this.config.fileIntegrityMonitoring.enabled) {
                await this._computeInitialFileHashes();
            }
            
            // Start monitoring
            this._startMonitoring();
            
            this.initialized = true;
            logger.info('Security Monitor initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Security Monitor', { error });
            throw error;
        }
    }
    
    /**
     * Start security monitoring
     * @private
     */
    _startMonitoring() {
        // Clear any existing interval
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        // Set up monitoring interval
        this.monitoringInterval = setInterval(() => {
            this._performSecurityChecks();
        }, this.config.monitoringIntervalMs);
        
        logger.info('Security monitoring started', {
            intervalMs: this.config.monitoringIntervalMs
        });
    }
    
    /**
     * Subscribe to relevant system events
     * @private
     */
    _subscribeToEvents() {
        // Subscribe to all messages for monitoring
        messageBus.subscribe('*', this._handleMessage.bind(this), {
            metadata: { component: 'SecurityMonitor' }
        });
        
        // Subscribe to agent failures
        messageBus.subscribe('agent:failure', this._handleAgentFailure.bind(this), {
            metadata: { component: 'SecurityMonitor' }
        });
        
        // Subscribe to system errors
        messageBus.subscribe('system:error', this._handleSystemError.bind(this), {
            metadata: { component: 'SecurityMonitor' }
        });
    }
    
    /**
     * Perform periodic security checks
     * @private
     */
    async _performSecurityChecks() {
        try {
            // Update system metrics
            await this._updateSystemMetrics();
            
            // Check for resource usage issues
            this._checkResourceUsage();
            
            // Check message statistics
            this._checkMessageStatistics();
            
            // Check file integrity if enabled
            if (this.config.fileIntegrityMonitoring.enabled) {
                await this._checkFileIntegrity();
            }
            
            // Reset message statistics periodically
            if (Date.now() - this.messageStats.lastReset > 3600000) { // 1 hour
                this._resetMessageStats();
            }
            
            // Publish current security status
            messageBus.publish('system:security:status', {
                status: 'healthy',
                metrics: this.systemMetrics,
                abnormalEvents: this.abnormalEvents.length
            });
        } catch (error) {
            logger.error('Error performing security checks', { error });
            
            messageBus.publish('system:security:status', {
                status: 'error',
                error: error.message
            });
        }
    }
    
    /**
     * Update system metrics (CPU, memory, etc.)
     * @private
     */
    async _updateSystemMetrics() {
        // In a real implementation, this would collect actual system metrics
        // For this placeholder, just simulate some values
        
        this.systemMetrics = {
            cpu: Math.random() * 50, // Simulate 0-50% CPU usage
            memory: Math.random() * 60, // Simulate 0-60% memory usage
            uptimeMs: process.uptime() * 1000,
            lastCheck: new Date()
        };
    }
    
    /**
     * Check for resource usage issues
     * @private
     */
    _checkResourceUsage() {
        // Check CPU usage
        if (this.systemMetrics.cpu > this.config.maxCpuUsagePercent) {
            this._handleAbnormalEvent('high_cpu_usage', {
                cpu: this.systemMetrics.cpu,
                threshold: this.config.maxCpuUsagePercent
            });
        }
        
        // Check memory usage
        if (this.systemMetrics.memory > this.config.maxMemoryUsagePercent) {
            this._handleAbnormalEvent('high_memory_usage', {
                memory: this.systemMetrics.memory,
                threshold: this.config.maxMemoryUsagePercent
            });
        }
    }
    
    /**
     * Check message statistics for abnormal patterns
     * @private
     */
    _checkMessageStatistics() {
        const timeSinceReset = (Date.now() - this.messageStats.lastReset) / 1000; // seconds
        
        // Calculate messages per second
        const messagesPerSecond = this.messageStats.total / timeSinceReset;
        
        // Check for high message rate
        if (messagesPerSecond > this.config.abnormalBehavior.maxMessagesPerSecond) {
            this._handleAbnormalEvent('high_message_rate', {
                rate: messagesPerSecond,
                threshold: this.config.abnormalBehavior.maxMessagesPerSecond
            });
        }
        
        // Calculate error rate
        const errorRate = this.messageStats.total > 0
            ? (this.messageStats.errors / this.messageStats.total) * 100
            : 0;
        
        // Check for high error rate
        if (errorRate > this.config.abnormalBehavior.maxErrorRatePercent) {
            this._handleAbnormalEvent('high_error_rate', {
                rate: errorRate,
                threshold: this.config.abnormalBehavior.maxErrorRatePercent
            });
        }
    }
    
    /**
     * Check file integrity by comparing current hashes to baseline
     * @private
     */
    async _checkFileIntegrity() {
        // In a real implementation, this would:
        // 1. Compute hashes of monitored files
        // 2. Compare against the stored baseline hashes
        // 3. Flag any differences as potential security issues
        
        // For this placeholder, we'll just simulate a check
        logger.debug('Performing file integrity check');
    }
    
    /**
     * Compute initial file hashes for integrity monitoring
     * @private
     */
    async _computeInitialFileHashes() {
        // In a real implementation, this would:
        // 1. Scan all files in the monitored paths
        // 2. Compute cryptographic hashes
        // 3. Store them as the baseline
        
        // For this placeholder, we'll just simulate this
        logger.info('Computing initial file hashes for integrity monitoring');
    }
    
    /**
     * Reset message statistics
     * @private
     */
    _resetMessageStats() {
        this.messageStats = {
            total: 0,
            errors: 0,
            lastReset: Date.now()
        };
        
        logger.debug('Reset message statistics');
    }
    
    /**
     * Handle a message for monitoring purposes
     * @param {object} message Message object
     * @param {string} channel Message channel
     * @private
     */
    _handleMessage(message, channel) {
        // Update message statistics
        this.messageStats.total++;
        
        // Check if this is an error message
        if (channel.includes('error') || 
            (message.data && message.data.error) ||
            (message.metadata && message.metadata.level === 'error')) {
            this.messageStats.errors++;
        }
    }
    
    /**
     * Handle agent failure event
     * @param {object} message Failure message
     * @private
     */
    _handleAgentFailure(message) {
        const agentId = message.data.agentId;
        
        // Increment failure count for this agent
        if (!this.agentFailures.has(agentId)) {
            this.agentFailures.set(agentId, 0);
        }
        
        const failures = this.agentFailures.get(agentId) + 1;
        this.agentFailures.set(agentId, failures);
        
        // Check if failures exceed threshold
        if (failures >= this.config.abnormalBehavior.maxAgentFailures) {
            this._handleAbnormalEvent('agent_failure_threshold', {
                agentId,
                failures,
                threshold: this.config.abnormalBehavior.maxAgentFailures
            });
        }
    }
    
    /**
     * Handle system error event
     * @param {object} message Error message
     * @private
     */
    _handleSystemError(message) {
        logger.error('System error detected', { message });
        
        // For critical errors, trigger an abnormal event
        if (message.data && message.data.critical) {
            this._handleAbnormalEvent('critical_system_error', {
                error: message.data.error,
                component: message.data.component
            });
        }
    }
    
    /**
     * Handle an abnormal event
     * @param {string} type Event type
     * @param {object} data Event data
     * @private
     */
    _handleAbnormalEvent(type, data) {
        const event = {
            type,
            timestamp: new Date(),
            data
        };
        
        // Add to abnormal events list
        this.abnormalEvents.push(event);
        
        // Trim list if it gets too large
        if (this.abnormalEvents.length > 100) {
            this.abnormalEvents = this.abnormalEvents.slice(-100);
        }
        
        // Log the event
        logger.warn(`Abnormal security event detected: ${type}`, data);
        
        // Publish security alert
        messageBus.publish('system:security:alert', {
            type,
            timestamp: event.timestamp,
            data
        });
        
        // Perform self-healing if enabled
        if (this.config.selfHealing.enabled) {
            this._performSelfHealing(type, data);
        }
    }
    
    /**
     * Perform self-healing actions based on abnormal event
     * @param {string} eventType Event type
     * @param {object} eventData Event data
     * @private
     */
    _performSelfHealing(eventType, eventData) {
        switch (eventType) {
            case 'high_cpu_usage':
            case 'high_memory_usage':
                // Could restart services or throttle activities
                logger.info('Performing self-healing for resource issue', {
                    eventType, 
                    action: 'resource_optimization'
                });
                break;
                
            case 'agent_failure_threshold':
                // Could restart the problematic agent
                if (this.config.selfHealing.autoRestart) {
                    logger.info('Performing self-healing for agent failure', {
                        eventType,
                        agentId: eventData.agentId,
                        action: 'restart'
                    });
                    
                    messageBus.publish('agent:control', {
                        action: 'restart',
                        agentId: eventData.agentId
                    });
                }
                break;
                
            case 'file_integrity_violation':
                // Could restore files from backup
                if (this.config.selfHealing.autoRollback) {
                    logger.info('Performing self-healing for file integrity violation', {
                        eventType,
                        file: eventData.file,
                        action: 'rollback'
                    });
                }
                break;
                
            default:
                logger.info('No self-healing action defined for event type', { eventType });
        }
    }
    
    /**
     * Shutdown the security monitor
     * @returns {Promise<void>}
     */
    async shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.initialized = false;
        logger.info('Security Monitor shut down successfully');
    }
    
    /**
     * Get recent abnormal events
     * @param {number} limit Maximum number of events to return
     * @returns {array} Abnormal events
     */
    getAbnormalEvents(limit = 10) {
        return this.abnormalEvents.slice(-limit);
    }
    
    /**
     * Get current system metrics
     * @returns {object} System metrics
     */
    getSystemMetrics() {
        return { ...this.systemMetrics };
    }
}

module.exports = new SecurityMonitor();