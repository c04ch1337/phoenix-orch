/**
 * Proofpoint Integration
 * 
 * This module provides integration with Proofpoint email security products,
 * enabling retrieval of email threats, quarantined messages, and management
 * of email protection capabilities.
 */

const emailTapApi = require('./email_tap_api');
const targetedAttackProtectionApi = require('./tap_api');
const quarantineApi = require('./quarantine_api');
const dlpApi = require('./dlp_api');
const insiderThreatApi = require('./insider_threat_api');

class ProofpointIntegration {
    constructor() {
        this.config = {
            enabled: false,
            apiUrl: null,
            apiKey: null,
            apiSecret: null,
            clusterID: null,
            products: {
                emailTap: false,
                tap: false,
                quarantine: false,
                dlp: false,
                insiderThreat: false
            }
        };
        
        this.apis = {
            emailTap: emailTapApi,
            tap: targetedAttackProtectionApi,
            quarantine: quarantineApi,
            dlp: dlpApi,
            insiderThreat: insiderThreatApi
        };
        
        this.initialized = false;
    }
    
    /**
     * Initialize the Proofpoint integration
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Validate configuration
        if (!this.config.apiUrl || !this.config.apiKey || !this.config.apiSecret) {
            throw new Error('Proofpoint integration requires apiUrl, apiKey, and apiSecret');
        }
        
        // Initialize each enabled API
        for (const [product, enabled] of Object.entries(this.config.products)) {
            if (enabled && this.apis[product]) {
                await this.apis[product].initialize({
                    baseUrl: this.config.apiUrl,
                    apiKey: this.config.apiKey,
                    apiSecret: this.config.apiSecret,
                    clusterID: this.config.clusterID,
                    ...this.config[product]
                });
            }
        }
        
        this.initialized = true;
    }
    
    /**
     * Get recent email threats from Targeted Attack Protection
     * @param {object} options Query options
     * @returns {Promise<array>} Recent threats
     */
    async getRecentThreats(options = {}) {
        this._checkInitialized();
        this._checkProductEnabled('tap');
        
        return this.apis.tap.getThreats(options);
    }
    
    /**
     * Get quarantined messages
     * @param {object} options Query options
     * @returns {Promise<array>} Quarantined messages
     */
    async getQuarantinedMessages(options = {}) {
        this._checkInitialized();
        this._checkProductEnabled('quarantine');
        
        return this.apis.quarantine.getMessages(options);
    }
    
    /**
     * Release a quarantined message
     * @param {string} messageId The message ID
     * @param {object} options Release options
     * @returns {Promise<object>} Release result
     */
    async releaseQuarantinedMessage(messageId, options = {}) {
        this._checkInitialized();
        this._checkProductEnabled('quarantine');
        
        return this.apis.quarantine.releaseMessage(messageId, options);
    }
    
    /**
     * Get DLP incidents
     * @param {object} options Query options
     * @returns {Promise<array>} DLP incidents
     */
    async getDLPIncidents(options = {}) {
        this._checkInitialized();
        this._checkProductEnabled('dlp');
        
        return this.apis.dlp.getIncidents(options);
    }
    
    /**
     * Get insider threat alerts
     * @param {object} options Query options
     * @returns {Promise<array>} Insider threat alerts
     */
    async getInsiderThreatAlerts(options = {}) {
        this._checkInitialized();
        this._checkProductEnabled('insiderThreat');
        
        return this.apis.insiderThreat.getAlerts(options);
    }
    
    /**
     * Create a block list entry
     * @param {object} entry Block list entry
     * @returns {Promise<object>} Creation result
     */
    async createBlockListEntry(entry) {
        this._checkInitialized();
        this._checkProductEnabled('tap');
        
        return this.apis.tap.createBlockListEntry(entry);
    }
    
    /**
     * Get click forensics for a URL
     * @param {string} url The URL to check
     * @param {object} options Query options
     * @returns {Promise<object>} Forensics data
     */
    async getURLForensics(url, options = {}) {
        this._checkInitialized();
        this._checkProductEnabled('tap');
        
        return this.apis.tap.getURLForensics(url, options);
    }
    
    /**
     * Get events for a user
     * @param {string} user The user email address
     * @param {object} options Query options
     * @returns {Promise<array>} User events
     */
    async getUserEvents(user, options = {}) {
        this._checkInitialized();
        this._checkProductEnabled('tap');
        
        return this.apis.tap.getUserEvents(user, options);
    }
    
    /**
     * Check if the integration is initialized
     * @private
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('Proofpoint integration is not initialized');
        }
    }
    
    /**
     * Check if a product is enabled
     * @param {string} product Product name
     * @private
     */
    _checkProductEnabled(product) {
        if (!this.config.products[product]) {
            throw new Error(`Proofpoint ${product} is not enabled`);
        }
    }
}

module.exports = new ProofpointIntegration();