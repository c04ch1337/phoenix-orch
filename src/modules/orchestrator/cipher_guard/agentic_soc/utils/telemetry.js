/**
 * Telemetry Utilities
 * 
 * Provides telemetry collection, transmission, and analysis capabilities
 * for operational visibility, debugging, and system health monitoring
 * for the Agentic SOC system.
 */

const crypto = require('crypto');

class TelemetryUtils {
    constructor() {
        this.config = {
            enabled: true,
            transmissionEnabled: true,
            bufferSize: 1000,
            flushInterval: 60000, // 1 minute
            samplingRate: 1.0, // 100%
            redactSensitiveData: true,
            sensitiveFields: [
                'password', 'token', 'key', 'secret', 'credentials', 'apiKey',
                'authToken', 'privateKey', 'sessionId'
            ],
            contextEnrichment: true,
            eventsToIgnore: [],
            debugMode: false,
            destinations: ['local']
        };
        
        this.buffer = [];
        this.sessionId = this._generateSessionId();
        this.systemInfo = {};
        this.flushTimer = null;
        this.initialized = false;
        
        // Event type handlers
        this.handlers = new Map();
    }
    
    /**
     * Initialize telemetry with configuration
     * @param {object} config Configuration options
     */
    initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Collect system information
        this._collectSystemInfo();
        
        // Set up auto flush if enabled
        if (this.config.enabled && this.config.transmissionEnabled) {
            this.startAutoFlush();
        }
        
        this.initialized = true;
    }
    
    /**
     * Start auto flush timer
     */
    startAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }
    
    /**
     * Stop auto flush timer
     */
    stopAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }
    
    /**
     * Record a telemetry event
     * @param {string} type Event type
     * @param {object} data Event data
     * @param {object} options Event options
     */
    record(type, data = {}, options = {}) {
        if (!this.config.enabled || this._shouldIgnoreEvent(type)) {
            return;
        }
        
        // Apply sampling
        if (Math.random() > this.config.samplingRate) {
            return;
        }
        
        // Create event object
        const event = {
            id: this._generateEventId(),
            type,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            data: { ...data },
            source: options.source || 'agentic_soc'
        };
        
        // Enrich with context if enabled
        if (this.config.contextEnrichment) {
            event.context = this._getContext(options.context);
        }
        
        // Redact sensitive data if enabled
        if (this.config.redactSensitiveData) {
            this._redactSensitiveData(event.data);
        }
        
        // Process event through any registered handlers
        if (this.handlers.has(type)) {
            try {
                const handler = this.handlers.get(type);
                const handlerResult = handler(event);
                
                // Handler may return a modified event or null to drop it
                if (handlerResult === null) {
                    return;
                } else if (handlerResult !== undefined) {
                    event.data = handlerResult.data || event.data;
                }
            } catch (error) {
                if (this.config.debugMode) {
                    console.error(`Error processing telemetry handler for ${type}:`, error);
                }
            }
        }
        
        // Add to buffer
        this.buffer.push(event);
        
        // Limit buffer size
        if (this.buffer.length > this.config.bufferSize) {
            this.buffer.shift();
        }
        
        // Debug logging
        if (this.config.debugMode) {
            console.debug('Telemetry event recorded:', event);
        }
        
        // Immediate transmission if requested
        if (options.immediate && this.config.transmissionEnabled) {
            this._transmitEvents([event]);
        }
    }
    
    /**
     * Register a handler for a specific event type
     * @param {string} type Event type
     * @param {Function} handler Handler function
     */
    registerHandler(type, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        
        this.handlers.set(type, handler);
    }
    
    /**
     * Unregister a handler for a specific event type
     * @param {string} type Event type
     */
    unregisterHandler(type) {
        this.handlers.delete(type);
    }
    
    /**
     * Get events of a specific type
     * @param {string} type Event type
     * @param {number} limit Maximum number of events to return
     * @returns {array} Events of the specified type
     */
    getEvents(type, limit = 10) {
        return this.buffer
            .filter(event => event.type === type)
            .slice(-limit)
            .reverse();
    }
    
    /**
     * Get all events
     * @param {number} limit Maximum number of events to return
     * @returns {array} All events
     */
    getAllEvents(limit = 100) {
        return this.buffer
            .slice(-limit)
            .reverse();
    }
    
    /**
     * Clear events from the buffer
     * @param {string} type Optional event type to clear (all if not specified)
     */
    clearEvents(type = null) {
        if (type) {
            this.buffer = this.buffer.filter(event => event.type !== type);
        } else {
            this.buffer = [];
        }
    }
    
    /**
     * Flush events to configured destinations
     * @returns {Promise<object>} Flush results
     */
    async flush() {
        if (!this.config.enabled || !this.config.transmissionEnabled || this.buffer.length === 0) {
            return { success: true, eventsTransmitted: 0 };
        }
        
        const eventsToTransmit = [...this.buffer];
        
        // Clear buffer
        this.buffer = [];
        
        try {
            // Transmit events
            await this._transmitEvents(eventsToTransmit);
            
            return {
                success: true,
                eventsTransmitted: eventsToTransmit.length
            };
        } catch (error) {
            // Put events back in buffer on failure
            this.buffer = [...eventsToTransmit, ...this.buffer];
            
            // Limit buffer size
            if (this.buffer.length > this.config.bufferSize) {
                this.buffer = this.buffer.slice(-this.config.bufferSize);
            }
            
            if (this.config.debugMode) {
                console.error('Failed to transmit telemetry events:', error);
            }
            
            return {
                success: false,
                error: error.message,
                eventsTransmitted: 0
            };
        }
    }
    
    /**
     * Start a new session
     * @returns {string} New session ID
     */
    startNewSession() {
        this.sessionId = this._generateSessionId();
        return this.sessionId;
    }
    
    /**
     * Generate system health telemetry
     * @returns {object} System health data
     */
    generateHealthTelemetry() {
        // In a real implementation, this would collect detailed system health data
        
        const healthData = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            eventCount: this.buffer.length
        };
        
        // Record the health telemetry
        this.record('system.health', healthData);
        
        return healthData;
    }
    
    /**
     * Transmit events to configured destinations
     * @param {array} events Events to transmit
     * @returns {Promise<void>}
     * @private
     */
    async _transmitEvents(events) {
        if (!this.config.transmissionEnabled || events.length === 0) {
            return;
        }
        
        const transmissionPromises = this.config.destinations.map(destination => {
            switch (destination) {
                case 'local':
                    // Just log locally, no actual transmission
                    if (this.config.debugMode) {
                        console.debug(`Would transmit ${events.length} events to local storage`);
                    }
                    return Promise.resolve();
                    
                case 'server':
                    // In a real implementation, this would send to a telemetry server
                    return Promise.resolve();
                    
                default:
                    // Unknown destination
                    return Promise.resolve();
            }
        });
        
        await Promise.all(transmissionPromises);
    }
    
    /**
     * Check if an event should be ignored
     * @param {string} type Event type
     * @returns {boolean} Whether the event should be ignored
     * @private
     */
    _shouldIgnoreEvent(type) {
        return this.config.eventsToIgnore.includes(type);
    }
    
    /**
     * Get context for an event
     * @param {object} additionalContext Additional context to include
     * @returns {object} Context data
     * @private
     */
    _getContext(additionalContext = {}) {
        // Basic context
        const context = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            system: this.systemInfo
        };
        
        // Add call stack info in debug mode
        if (this.config.debugMode) {
            const stack = new Error().stack;
            context.callStack = stack ? stack.split('\n').slice(3) : [];
        }
        
        // Add additional context
        return { ...context, ...additionalContext };
    }
    
    /**
     * Collect system information
     * @private
     */
    _collectSystemInfo() {
        // Basic system info - in a real implementation, this would be more detailed
        this.systemInfo = {
            platform: process.platform,
            nodeVersion: process.version,
            hostname: require('os').hostname(),
            startupTime: new Date().toISOString(),
            pid: process.pid
        };
    }
    
    /**
     * Generate a unique session ID
     * @returns {string} Session ID
     * @private
     */
    _generateSessionId() {
        return `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Generate a unique event ID
     * @returns {string} Event ID
     * @private
     */
    _generateEventId() {
        return `event-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Redact sensitive data from an object
     * @param {object} obj Object to redact
     * @private
     */
    _redactSensitiveData(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        for (const key in obj) {
            // Check if this key should be redacted
            if (this.config.sensitiveFields.some(field => 
                key.toLowerCase().includes(field.toLowerCase()))) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object') {
                // Recurse into nested objects
                this._redactSensitiveData(obj[key]);
            }
        }
    }
}

module.exports = new TelemetryUtils();