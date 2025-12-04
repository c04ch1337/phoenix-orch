/**
 * Integration Connectors
 * 
 * This module provides integrations with external security tools, platforms, and services.
 * These connectors enable the Agentic SOC to interact with a variety of security products,
 * collect data from them, and initiate actions within them.
 */

const proofpoint = require('./proofpoint');
const crowdstrike = require('./crowdstrike');
const rapid7 = require('./rapid7');
const jira = require('./jira');
const teams = require('./teams');
const obsidian = require('./obsidian');

class IntegrationManager {
    constructor() {
        this.integrations = {
            proofpoint,
            crowdstrike,
            rapid7,
            jira,
            teams,
            obsidian
        };
        
        this.activeIntegrations = new Set();
    }
    
    /**
     * Initialize integrations
     * @param {object} config Configuration object for integrations
     * @returns {Promise<object>} Initialization results
     */
    async initialize(config = {}) {
        console.log('Initializing Integration Connectors...');
        
        const results = {};
        
        // Initialize each integration if it's enabled in config
        for (const [name, integration] of Object.entries(this.integrations)) {
            if (config[name] && config[name].enabled) {
                try {
                    await integration.initialize(config[name]);
                    this.activeIntegrations.add(name);
                    results[name] = { success: true };
                    console.log(`Integration initialized: ${name}`);
                } catch (error) {
                    results[name] = { success: false, error: error.message };
                    console.error(`Failed to initialize integration ${name}:`, error);
                }
            } else {
                results[name] = { success: false, reason: 'disabled or not configured' };
            }
        }
        
        console.log(`Integration initialization complete. Active integrations: ${[...this.activeIntegrations].join(', ')}`);
        return results;
    }
    
    /**
     * Check if an integration is active
     * @param {string} name Integration name
     * @returns {boolean} Whether the integration is active
     */
    isActive(name) {
        return this.activeIntegrations.has(name);
    }
    
    /**
     * Get an integration by name
     * @param {string} name Integration name
     * @returns {object} The integration module
     * @throws {Error} If the integration is not found or not active
     */
    getIntegration(name) {
        if (!this.integrations[name]) {
            throw new Error(`Integration not found: ${name}`);
        }
        
        if (!this.isActive(name)) {
            throw new Error(`Integration is not active: ${name}`);
        }
        
        return this.integrations[name];
    }
    
    /**
     * Execute a method on an integration
     * @param {string} integration Integration name
     * @param {string} method Method name
     * @param {array} args Arguments for the method
     * @returns {Promise<any>} Method result
     */
    async execute(integration, method, ...args) {
        const integrationModule = this.getIntegration(integration);
        
        if (typeof integrationModule[method] !== 'function') {
            throw new Error(`Method not found on integration ${integration}: ${method}`);
        }
        
        return await integrationModule[method](...args);
    }
}

module.exports = new IntegrationManager();