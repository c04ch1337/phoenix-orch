/**
 * Natural Language Interface Index
 * 
 * Exports all natural language interface components for the Agentic SOC system.
 * Provides a unified interface for natural language processing, context management,
 * command processing, and voice interaction.
 */

const intentParser = require('./intent_parser');
const contextManager = require('./context_manager');
const commandProcessor = require('./command_processor');
const voiceInterface = require('./voice_interface');

/**
 * Process a natural language input
 * @param {string} input User's natural language input
 * @param {string} sessionId User's session ID
 * @param {boolean} isVoice Whether this is a voice input
 * @returns {Promise<object>} Processing result
 */
async function processNaturalLanguageInput(input, sessionId, isVoice = false) {
    // Get current context
    const context = contextManager.getContext(sessionId);
    
    // Check if we're awaiting an entity or confirmation
    if (context.state.awaitingEntity) {
        // User is providing a missing entity
        const entityName = context.state.awaitingEntity;
        const currentIntent = context.state.currentIntent;
        
        // Extract the entity from the input
        let entityValue = null;
        
        if (intentParser.entityExtractors[entityName]) {
            entityValue = await intentParser.entityExtractors[entityName](input, context);
        }
        
        if (entityValue) {
            // Update the context with the new entity
            const entityUpdate = {};
            entityUpdate[entityName] = entityValue;
            
            contextManager.updateContext(sessionId, {
                entities: entityUpdate,
                state: {
                    awaitingEntity: null
                }
            });
            
            // Process the original intent now that we have the missing entity
            return commandProcessor.processCommand(context.state.lastCommand, sessionId);
        }
    } else if (context.state.awaitingConfirmation) {
        // User is confirming an action
        const affirmativeResponses = ['yes', 'confirm', 'proceed', 'continue', 'approve', 'ok', 'sure', 'go ahead'];
        const negativeResponses = ['no', 'cancel', 'stop', 'abort', 'decline', 'negative', 'don\'t'];
        
        const normalizedInput = input.toLowerCase();
        
        // Check for affirmative response
        for (const response of affirmativeResponses) {
            if (normalizedInput.includes(response)) {
                // User confirmed the action
                contextManager.updateContext(sessionId, {
                    state: {
                        awaitingConfirmation: false,
                        confirmationProvided: true
                    }
                });
                
                // Process the original intent with confirmation
                return commandProcessor.processCommand(context.state.lastCommand, sessionId);
            }
        }
        
        // Check for negative response
        for (const response of negativeResponses) {
            if (normalizedInput.includes(response)) {
                // User declined the action
                contextManager.updateContext(sessionId, {
                    state: {
                        awaitingConfirmation: false,
                        confirmationProvided: false,
                        pendingIntent: null,
                        pendingEntities: null
                    }
                });
                
                return {
                    status: 'cancelled',
                    message: 'Action cancelled.'
                };
            }
        }
    }
    
    // Normal processing flow
    const result = await commandProcessor.processCommand(input, sessionId);
    
    // If voice mode is active, consider converting response to speech
    if (isVoice && result && result.message) {
        voiceInterface.speak(result.message);
    }
    
    return result;
}

/**
 * Initialize the natural language interface
 * @returns {Promise<boolean>} Success status
 */
async function initialize() {
    // Initialize voice interface if needed
    const voiceInitialized = await voiceInterface.initialize()
        .catch(err => {
            console.error('Error initializing voice interface:', err);
            return false;
        });
    
    return {
        initialized: true,
        voiceInitialized
    };
}

module.exports = {
    // Core components
    intentParser,
    contextManager,
    commandProcessor,
    voiceInterface,
    
    // Helper functions
    processNaturalLanguageInput,
    initialize
};