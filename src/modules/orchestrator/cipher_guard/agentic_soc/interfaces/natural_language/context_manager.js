/**
 * Context Manager
 * 
 * Manages the conversation context for natural language interactions.
 * Tracks conversation history, entities, and state to provide context
 * for more accurate intent understanding and response generation.
 */

class ContextManager {
    constructor(config = {}) {
        this.config = {
            maxHistoryLength: 10,
            contextLifespanMinutes: 30,
            entityPersistence: true,
            ...config
        };
        
        // Active contexts by session ID
        this.activeContexts = new Map();
        
        // Scheduled cleanup for expired contexts
        this._scheduleCleanup();
    }
    
    /**
     * Get the current context for a session
     * @param {string} sessionId Session identifier
     * @returns {object} Current context
     */
    getContext(sessionId) {
        if (!this.activeContexts.has(sessionId)) {
            // Initialize new context
            this.activeContexts.set(sessionId, this._createNewContext());
        }
        
        const context = this.activeContexts.get(sessionId);
        
        // Update last access time
        context.lastAccessTime = Date.now();
        
        return context;
    }
    
    /**
     * Update context with new information
     * @param {string} sessionId Session identifier
     * @param {object} updates Updates to apply to the context
     */
    updateContext(sessionId, updates) {
        const context = this.getContext(sessionId);
        
        // Apply updates to context
        if (updates.input) {
            context.history.push({
                role: 'user',
                content: updates.input,
                timestamp: Date.now()
            });
            
            // Trim history if it exceeds max length
            if (context.history.length > this.config.maxHistoryLength) {
                context.history.shift();
            }
        }
        
        if (updates.response) {
            context.history.push({
                role: 'assistant',
                content: updates.response,
                timestamp: Date.now()
            });
            
            // Trim history if it exceeds max length
            if (context.history.length > this.config.maxHistoryLength) {
                context.history.shift();
            }
        }
        
        // Update entities
        if (updates.entities) {
            for (const [entityName, entityValue] of Object.entries(updates.entities)) {
                if (entityValue === null || entityValue === undefined) {
                    // Remove entity
                    delete context.entities[entityName];
                } else {
                    // Add or update entity
                    context.entities[entityName] = {
                        value: entityValue,
                        timestamp: Date.now()
                    };
                }
            }
        }
        
        // Update current state
        if (updates.state) {
            context.state = {
                ...context.state,
                ...updates.state
            };
        }
        
        // Update workflow state
        if (updates.workflow) {
            context.workflow = {
                ...context.workflow,
                ...updates.workflow
            };
        }
        
        // Update access time
        context.lastAccessTime = Date.now();
    }
    
    /**
     * Clear the context for a session
     * @param {string} sessionId Session identifier
     */
    clearContext(sessionId) {
        this.activeContexts.set(sessionId, this._createNewContext());
    }
    
    /**
     * Create a new context object
     * @private
     */
    _createNewContext() {
        return {
            history: [],
            entities: {},
            state: {
                currentIntent: null,
                pendingActions: [],
                lastCommand: null
            },
            workflow: {
                activeWorkflow: null,
                workflowState: null,
                executionId: null
            },
            creationTime: Date.now(),
            lastAccessTime: Date.now()
        };
    }
    
    /**
     * Schedule periodic cleanup of expired contexts
     * @private
     */
    _scheduleCleanup() {
        setInterval(() => {
            this._cleanupExpiredContexts();
        }, 5 * 60 * 1000); // Check every 5 minutes
    }
    
    /**
     * Clean up expired contexts
     * @private
     */
    _cleanupExpiredContexts() {
        const now = Date.now();
        const expirationTime = this.config.contextLifespanMinutes * 60 * 1000;
        
        for (const [sessionId, context] of this.activeContexts.entries()) {
            const timeSinceLastAccess = now - context.lastAccessTime;
            
            if (timeSinceLastAccess > expirationTime) {
                this.activeContexts.delete(sessionId);
            }
        }
    }
    
    /**
     * Get entity from context
     * @param {string} sessionId Session identifier
     * @param {string} entityName Name of the entity to retrieve
     * @returns {*} Entity value or null if not found
     */
    getEntity(sessionId, entityName) {
        const context = this.getContext(sessionId);
        
        if (context.entities[entityName]) {
            return context.entities[entityName].value;
        }
        
        return null;
    }
    
    /**
     * Check if context has a specific entity
     * @param {string} sessionId Session identifier
     * @param {string} entityName Name of the entity to check
     * @returns {boolean} True if the entity exists in the context
     */
    hasEntity(sessionId, entityName) {
        const context = this.getContext(sessionId);
        return !!context.entities[entityName];
    }
    
    /**
     * Get the conversation history
     * @param {string} sessionId Session identifier
     * @param {number} limit Maximum number of history items to retrieve
     * @returns {Array<object>} Conversation history
     */
    getHistory(sessionId, limit = null) {
        const context = this.getContext(sessionId);
        
        if (limit === null) {
            return [...context.history];
        }
        
        return context.history.slice(-limit);
    }
}

module.exports = new ContextManager();