/**
 * Message Bus
 * 
 * Provides pub/sub messaging capabilities for inter-component communication
 * within the Agentic SOC. Enables event-driven architecture, real-time updates,
 * and decoupled components.
 */

const EventEmitter = require('events');

class MessageBus {
    constructor() {
        this._emitter = new EventEmitter();
        
        // Configure the EventEmitter to handle more listeners
        this._emitter.setMaxListeners(100);
        
        this.config = {
            enabledChannels: {
                'agent:*': true,
                'alert:*': true, 
                'incident:*': true,
                'workflow:*': true,
                'system:*': true,
                'integration:*': true
            },
            persistMessages: false,
            messageHistory: {
                enabled: false,
                maxMessages: 1000,
                retentionTime: 60 * 60 * 1000 // 1 hour
            }
        };
        
        this.messageHistory = {};
        this.subscribers = new Map();
        this.initialized = false;
    }
    
    /**
     * Initialize the message bus
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Initialize message history if enabled
        if (this.config.messageHistory.enabled) {
            this._setupMessageHistory();
        }
        
        this.initialized = true;
        console.log('Message Bus initialized successfully');
    }
    
    /**
     * Subscribe to a channel
     * @param {string} channel Channel to subscribe to (supports wildcards)
     * @param {function} handler Message handler function
     * @param {object} options Subscription options
     * @returns {string} Subscription ID
     */
    subscribe(channel, handler, options = {}) {
        this._checkInitialized();
        
        // Generate subscription ID
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Store subscription
        this.subscribers.set(subscriptionId, {
            channel,
            handler,
            options,
            createdAt: new Date()
        });
        
        // Register handler with event emitter
        if (channel.includes('*')) {
            // For wildcard channels, we need to check the channel in the handler
            this._emitter.on('message', (msgChannel, message) => {
                if (this._channelMatches(channel, msgChannel)) {
                    handler(message, msgChannel);
                }
            });
        } else {
            // For exact channels, we can use the channel directly
            this._emitter.on(channel, handler);
        }
        
        return subscriptionId;
    }
    
    /**
     * Unsubscribe from a channel
     * @param {string} subscriptionId Subscription ID to unsubscribe
     * @returns {boolean} Success status
     */
    unsubscribe(subscriptionId) {
        this._checkInitialized();
        
        if (!this.subscribers.has(subscriptionId)) {
            return false;
        }
        
        const subscription = this.subscribers.get(subscriptionId);
        
        // Remove from event emitter
        if (subscription.channel.includes('*')) {
            // For wildcard channels, we need to remove the specific handler
            this._emitter.removeListener('message', subscription.handler);
        } else {
            // For exact channels, we can remove by channel
            this._emitter.removeListener(subscription.channel, subscription.handler);
        }
        
        // Remove from subscribers map
        this.subscribers.delete(subscriptionId);
        
        return true;
    }
    
    /**
     * Publish a message to a channel
     * @param {string} channel Channel to publish to
     * @param {any} message Message to publish
     * @param {object} options Publication options
     * @returns {Promise<boolean>} Success status
     */
    async publish(channel, message, options = {}) {
        this._checkInitialized();
        
        // Check if channel is enabled
        if (!this._isChannelEnabled(channel)) {
            console.warn(`Attempted to publish to disabled channel: ${channel}`);
            return false;
        }
        
        // Add metadata to the message
        const messageWithMetadata = {
            data: message,
            metadata: {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                timestamp: new Date(),
                channel,
                ...options.metadata
            }
        };
        
        // Store in message history if enabled
        if (this.config.messageHistory.enabled && 
            (options.persist || this.config.persistMessages)) {
            this._addToMessageHistory(channel, messageWithMetadata);
        }
        
        // Emit on the specific channel
        this._emitter.emit(channel, messageWithMetadata);
        
        // Also emit on the 'message' event for wildcard subscribers
        this._emitter.emit('message', channel, messageWithMetadata);
        
        return true;
    }
    
    /**
     * Request-response pattern - send a request and wait for a response
     * @param {string} channel Channel to publish request to
     * @param {any} request Request data
     * @param {object} options Request options
     * @returns {Promise<any>} Response data
     */
    async request(channel, request, options = {}) {
        this._checkInitialized();
        
        // Generate a unique response channel
        const responseChannel = `${channel}:response:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
        
        // Create a promise that will be resolved when the response is received
        const responsePromise = new Promise((resolve, reject) => {
            // Set timeout if specified
            const timeout = options.timeout || 30000; // default 30s
            const timeoutId = setTimeout(() => {
                this.unsubscribe(subscriptionId);
                reject(new Error(`Request timed out after ${timeout}ms`));
            }, timeout);
            
            // Subscribe to the response channel
            const subscriptionId = this.subscribe(responseChannel, (response) => {
                clearTimeout(timeoutId);
                this.unsubscribe(subscriptionId);
                resolve(response.data);
            });
        });
        
        // Publish the request with the response channel
        await this.publish(channel, request, {
            metadata: {
                responseChannel,
                ...options.metadata
            }
        });
        
        // Wait for the response
        return responsePromise;
    }
    
    /**
     * Respond to a request
     * @param {string} responseChannel Channel to publish response to
     * @param {any} response Response data
     * @param {object} options Response options
     * @returns {Promise<boolean>} Success status
     */
    async respond(responseChannel, response, options = {}) {
        this._checkInitialized();
        
        // Publish the response
        return this.publish(responseChannel, response, options);
    }
    
    /**
     * Get message history for a channel
     * @param {string} channel Channel to get history for
     * @param {object} options History options
     * @returns {array} Message history
     */
    getMessageHistory(channel, options = {}) {
        this._checkInitialized();
        
        if (!this.config.messageHistory.enabled) {
            throw new Error('Message history is not enabled');
        }
        
        if (!this.messageHistory[channel]) {
            return [];
        }
        
        // Get messages
        let messages = this.messageHistory[channel];
        
        // Apply time filter if specified
        if (options.since) {
            const sinceTime = options.since instanceof Date 
                ? options.since 
                : new Date(options.since);
            
            messages = messages.filter(msg => 
                msg.metadata.timestamp >= sinceTime
            );
        }
        
        // Apply limit if specified
        if (options.limit) {
            messages = messages.slice(0, options.limit);
        }
        
        return messages;
    }
    
    /**
     * Get the number of subscribers for a channel
     * @param {string} channel Channel to get subscriber count for
     * @returns {number} Subscriber count
     */
    getSubscriberCount(channel) {
        this._checkInitialized();
        
        if (channel.includes('*')) {
            // For wildcard channels, count matching subscribers
            let count = 0;
            for (const subscription of this.subscribers.values()) {
                if (this._channelMatches(subscription.channel, channel) ||
                    this._channelMatches(channel, subscription.channel)) {
                    count++;
                }
            }
            return count;
        } else {
            // For exact channels, use EventEmitter's listener count
            return this._emitter.listenerCount(channel);
        }
    }
    
    /**
     * Shutdown the message bus
     * @returns {Promise<void>}
     */
    async shutdown() {
        this._emitter.removeAllListeners();
        this.subscribers.clear();
        this.messageHistory = {};
        this.initialized = false;
        
        console.log('Message Bus shut down successfully');
    }
    
    /**
     * Check if the message bus is initialized
     * @private
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('Message Bus is not initialized');
        }
    }
    
    /**
     * Check if a channel is enabled
     * @param {string} channel Channel to check
     * @returns {boolean} Whether the channel is enabled
     * @private
     */
    _isChannelEnabled(channel) {
        // Check exact match
        if (this.config.enabledChannels[channel] !== undefined) {
            return this.config.enabledChannels[channel];
        }
        
        // Check wildcard match
        for (const pattern of Object.keys(this.config.enabledChannels)) {
            if (pattern.includes('*') && this._channelMatches(pattern, channel)) {
                return this.config.enabledChannels[pattern];
            }
        }
        
        // Default to disabled
        return false;
    }
    
    /**
     * Check if a channel matches a pattern
     * @param {string} pattern Channel pattern (supports wildcards)
     * @param {string} channel Channel to check
     * @returns {boolean} Whether the channel matches the pattern
     * @private
     */
    _channelMatches(pattern, channel) {
        // Convert wildcard pattern to regex
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        
        return regex.test(channel);
    }
    
    /**
     * Set up message history
     * @private
     */
    _setupMessageHistory() {
        // Initialize message history object
        this.messageHistory = {};
        
        // Set up periodic cleanup
        setInterval(() => {
            this._cleanupMessageHistory();
        }, 60000); // Run every minute
    }
    
    /**
     * Add a message to the history
     * @param {string} channel Channel the message was published to
     * @param {object} message Message with metadata
     * @private
     */
    _addToMessageHistory(channel, message) {
        if (!this.messageHistory[channel]) {
            this.messageHistory[channel] = [];
        }
        
        this.messageHistory[channel].push(message);
        
        // Trim if exceeding max messages
        if (this.messageHistory[channel].length > this.config.messageHistory.maxMessages) {
            this.messageHistory[channel] = this.messageHistory[channel].slice(
                this.messageHistory[channel].length - this.config.messageHistory.maxMessages
            );
        }
    }
    
    /**
     * Clean up old messages from history
     * @private
     */
    _cleanupMessageHistory() {
        const cutoffTime = new Date(Date.now() - this.config.messageHistory.retentionTime);
        
        for (const channel of Object.keys(this.messageHistory)) {
            this.messageHistory[channel] = this.messageHistory[channel].filter(
                msg => msg.metadata.timestamp >= cutoffTime
            );
        }
    }
}

module.exports = new MessageBus();