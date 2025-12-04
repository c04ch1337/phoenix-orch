/**
 * Rapid7 Integration
 * 
 * This module provides integration with Rapid7 products including InsightVM,
 * InsightIDR, and InsightConnect, enabling vulnerability management, SIEM, and
 * security orchestration capabilities.
 */

const insightVMApi = require('./insightvm_api');
const insightIDRApi = require('./insightidr_api');
const insightConnectApi = require('./insightconnect_api');

class Rapid7Integration {
    constructor() {
        this.config = {
            enabled: false,
            products: {
                insightVM: {
                    enabled: false,
                    apiUrl: null,
                    apiKey: null
                },
                insightIDR: {
                    enabled: false,
                    apiUrl: null,
                    apiKey: null
                },
                insightConnect: {
                    enabled: false,
                    apiUrl: null,
                    apiKey: null
                }
            }
        };
        
        this.apis = {
            insightVM: insightVMApi,
            insightIDR: insightIDRApi,
            insightConnect: insightConnectApi
        };
        
        this.initialized = false;
    }
    
    /**
     * Initialize the Rapid7 integration
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        // Merge config with defaults
        this.config = {
            ...this.config,
            ...config,
            products: {
                ...this.config.products,
                ...config.products
            }
        };
        
        // Initialize each enabled product
        for (const [product, productConfig] of Object.entries(this.config.products)) {
            if (productConfig.enabled && this.apis[product]) {
                if (!productConfig.apiUrl || !productConfig.apiKey) {
                    throw new Error(`Rapid7 ${product} integration requires apiUrl and apiKey`);
                }
                
                await this.apis[product].initialize(productConfig);
                console.log(`Initialized Rapid7 ${product} integration`);
            }
        }
        
        this.initialized = true;
    }
    
    /**
     * Check if the integration is initialized
     * @private
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('Rapid7 integration is not initialized');
        }
    }
    
    /**
     * Check if a product is enabled
     * @param {string} product Product name
     * @private
     */
    _checkProductEnabled(product) {
        this._checkInitialized();
        
        if (!this.config.products[product] || !this.config.products[product].enabled) {
            throw new Error(`Rapid7 ${product} is not enabled`);
        }
    }
    
    // InsightVM Methods
    
    /**
     * Get vulnerabilities
     * @param {object} options Query options
     * @returns {Promise<array>} Vulnerabilities
     */
    async getVulnerabilities(options = {}) {
        this._checkProductEnabled('insightVM');
        return this.apis.insightVM.getVulnerabilities(options);
    }
    
    /**
     * Get assets
     * @param {object} options Query options
     * @returns {Promise<array>} Assets
     */
    async getAssets(options = {}) {
        this._checkProductEnabled('insightVM');
        return this.apis.insightVM.getAssets(options);
    }
    
    /**
     * Get an asset's vulnerabilities
     * @param {string} assetId Asset ID
     * @param {object} options Query options
     * @returns {Promise<array>} Asset vulnerabilities
     */
    async getAssetVulnerabilities(assetId, options = {}) {
        this._checkProductEnabled('insightVM');
        return this.apis.insightVM.getAssetVulnerabilities(assetId, options);
    }
    
    /**
     * Start a vulnerability scan
     * @param {object} scanConfig Scan configuration
     * @returns {Promise<object>} Scan information
     */
    async startScan(scanConfig) {
        this._checkProductEnabled('insightVM');
        return this.apis.insightVM.startScan(scanConfig);
    }
    
    /**
     * Get scan status
     * @param {string} scanId Scan ID
     * @returns {Promise<object>} Scan status
     */
    async getScanStatus(scanId) {
        this._checkProductEnabled('insightVM');
        return this.apis.insightVM.getScanStatus(scanId);
    }
    
    // InsightIDR Methods
    
    /**
     * Get investigations
     * @param {object} options Query options
     * @returns {Promise<array>} Investigations
     */
    async getInvestigations(options = {}) {
        this._checkProductEnabled('insightIDR');
        return this.apis.insightIDR.getInvestigations(options);
    }
    
    /**
     * Get investigation details
     * @param {string} investigationId Investigation ID
     * @returns {Promise<object>} Investigation details
     */
    async getInvestigationDetails(investigationId) {
        this._checkProductEnabled('insightIDR');
        return this.apis.insightIDR.getInvestigationDetails(investigationId);
    }
    
    /**
     * Get logs
     * @param {object} query Log query
     * @returns {Promise<array>} Logs
     */
    async getLogs(query) {
        this._checkProductEnabled('insightIDR');
        return this.apis.insightIDR.getLogs(query);
    }
    
    /**
     * Create a custom alert
     * @param {object} alert Alert data
     * @returns {Promise<object>} Alert creation result
     */
    async createAlert(alert) {
        this._checkProductEnabled('insightIDR');
        return this.apis.insightIDR.createAlert(alert);
    }
    
    /**
     * Add indicators to a threat
     * @param {string} threatId Threat ID
     * @param {array} indicators Indicators to add
     * @returns {Promise<object>} Result
     */
    async addIndicatorsToThreat(threatId, indicators) {
        this._checkProductEnabled('insightIDR');
        return this.apis.insightIDR.addIndicatorsToThreat(threatId, indicators);
    }
    
    // InsightConnect Methods
    
    /**
     * Execute a workflow
     * @param {string} workflowId Workflow ID
     * @param {object} inputs Workflow inputs
     * @returns {Promise<object>} Workflow execution result
     */
    async executeWorkflow(workflowId, inputs = {}) {
        this._checkProductEnabled('insightConnect');
        return this.apis.insightConnect.executeWorkflow(workflowId, inputs);
    }
    
    /**
     * Get workflow execution status
     * @param {string} executionId Execution ID
     * @returns {Promise<object>} Execution status
     */
    async getWorkflowStatus(executionId) {
        this._checkProductEnabled('insightConnect');
        return this.apis.insightConnect.getWorkflowStatus(executionId);
    }
    
    /**
     * Get workflow executions
     * @param {object} options Query options
     * @returns {Promise<array>} Workflow executions
     */
    async getWorkflowExecutions(options = {}) {
        this._checkProductEnabled('insightConnect');
        return this.apis.insightConnect.getWorkflowExecutions(options);
    }
    
    /**
     * Get available workflows
     * @returns {Promise<array>} Workflows
     */
    async getWorkflows() {
        this._checkProductEnabled('insightConnect');
        return this.apis.insightConnect.getWorkflows();
    }
}

module.exports = new Rapid7Integration();