/**
 * Model Router
 * 
 * Manages the routing of AI tasks to the appropriate model based on
 * requirements, availability, and optimization criteria.
 */

const deepseekInterface = require('./deepseek_interface');
const llamaInterface = require('./llama_interface');

class ModelRouter {
    constructor() {
        this.modelInterfaces = {
            'deepseek': deepseekInterface,
            'llama': llamaInterface
        };
        
        this.routingStrategies = {
            'cost': this.routeByCost.bind(this),
            'performance': this.routeByPerformance.bind(this),
            'capability': this.routeByCapability.bind(this),
            'availability': this.routeByAvailability.bind(this)
        };
        
        this.taskRequirements = {
            'code-analysis': ['deepseek'],
            'threat-analysis': ['deepseek', 'llama'],
            'vulnerability-reasoning': ['deepseek', 'llama'],
            'forensic-analysis': ['deepseek']
        };
    }
    
    /**
     * Initialize all model interfaces
     */
    async initialize() {
        const results = {};
        for (const [name, interface] of Object.entries(this.modelInterfaces)) {
            results[name] = await interface.initialize().catch(err => {
                console.error(`Failed to initialize ${name}:`, err);
                return false;
            });
        }
        return results;
    }
    
    /**
     * Route a task to the appropriate model
     * @param {string} task Task type
     * @param {object} input Task input
     * @param {object} options Routing options
     * @returns {Promise<object>} Model response
     */
    async routeTask(task, input, options = {}) {
        const strategy = options.strategy || 'capability';
        const modelName = await this.routingStrategies[strategy](task, options);
        
        if (!modelName) {
            throw new Error(`No suitable model found for task: ${task}`);
        }
        
        const modelInterface = this.modelInterfaces[modelName];
        
        switch (task) {
            case 'completion':
                return modelInterface.generateCompletion(input.prompt, options);
            case 'chat':
                return modelInterface.processChat(input.messages, options);
            case 'code-analysis':
                return modelInterface.analyzeCodeSecurity(input.code, input.language);
            default:
                throw new Error(`Unknown task type: ${task}`);
        }
    }
    
    /**
     * Route based on cost optimization
     * @private
     */
    async routeByCost(task, options) {
        const candidates = this.taskRequirements[task] || Object.keys(this.modelInterfaces);
        // Cost routing logic would go here
        return candidates[0]; // Default to first available
    }
    
    /**
     * Route based on performance
     * @private
     */
    async routeByPerformance(task, options) {
        const candidates = this.taskRequirements[task] || Object.keys(this.modelInterfaces);
        // Performance routing logic would go here
        return candidates[0]; // Default to first available
    }
    
    /**
     * Route based on capability
     * @private
     */
    async routeByCapability(task, options) {
        const candidates = this.taskRequirements[task] || Object.keys(this.modelInterfaces);
        // Capability routing logic would go here
        return candidates[0]; // Default to first available
    }
    
    /**
     * Route based on availability
     * @private
     */
    async routeByAvailability(task, options) {
        const candidates = this.taskRequirements[task] || Object.keys(this.modelInterfaces);
        // Availability routing logic would go here
        return candidates[0]; // Default to first available
    }
    
    /**
     * Get metrics from all models
     * @returns {object} Aggregated metrics
     */
    getMetrics() {
        const metrics = {};
        for (const [name, interface] of Object.entries(this.modelInterfaces)) {
            metrics[name] = interface.getMetrics();
        }
        return metrics;
    }
}

module.exports = new ModelRouter();