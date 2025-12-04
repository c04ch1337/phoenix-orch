/**
 * CrowdStrike Integration
 * 
 * This module provides integration with CrowdStrike Falcon platform,
 * enabling retrieval of endpoint detections, incidents, host information,
 * and the ability to take response actions on endpoints.
 */

const detectionsApi = require('./detections_api');
const hostsApi = require('./hosts_api');
const incidentsApi = require('./incidents_api');
const responseActionsApi = require('./response_actions_api');
const intelligenceApi = require('./intelligence_api');
const vulnerabilityApi = require('./vulnerability_api');

class CrowdStrikeIntegration {
    constructor() {
        this.config = {
            enabled: false,
            apiUrl: null,
            clientId: null,
            clientSecret: null,
            tokenUrl: null,
            features: {
                detections: true,
                hosts: true,
                incidents: true,
                responseActions: true,
                intelligence: true,
                vulnerability: true
            }
        };
        
        this.apis = {
            detections: detectionsApi,
            hosts: hostsApi,
            incidents: incidentsApi,
            responseActions: responseActionsApi,
            intelligence: intelligenceApi,
            vulnerability: vulnerabilityApi
        };
        
        this.authToken = null;
        this.tokenExpiration = null;
        this.initialized = false;
    }
    
    /**
     * Initialize the CrowdStrike integration
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Validate configuration
        if (!this.config.apiUrl || !this.config.clientId || !this.config.clientSecret) {
            throw new Error('CrowdStrike integration requires apiUrl, clientId, and clientSecret');
        }
        
        // Set default token URL if not provided
        if (!this.config.tokenUrl) {
            this.config.tokenUrl = `${this.config.apiUrl}/oauth2/token`;
        }
        
        // Get initial auth token
        await this._authenticateWithCrowdStrike();
        
        // Initialize each API
        for (const [feature, enabled] of Object.entries(this.config.features)) {
            if (enabled && this.apis[feature]) {
                await this.apis[feature].initialize({
                    baseUrl: this.config.apiUrl,
                    getAuthToken: this._getAuthToken.bind(this),
                    ...this.config[feature]
                });
            }
        }
        
        this.initialized = true;
    }
    
    /**
     * Get detections from CrowdStrike
     * @param {object} options Query options
     * @returns {Promise<array>} Detections
     */
    async getDetections(options = {}) {
        this._checkInitialized();
        this._checkFeatureEnabled('detections');
        
        return this.apis.detections.getDetections(options);
    }
    
    /**
     * Get hosts from CrowdStrike
     * @param {object} options Query options
     * @returns {Promise<array>} Hosts
     */
    async getHosts(options = {}) {
        this._checkInitialized();
        this._checkFeatureEnabled('hosts');
        
        return this.apis.hosts.getHosts(options);
    }
    
    /**
     * Get host details
     * @param {string} hostId Host ID
     * @returns {Promise<object>} Host details
     */
    async getHostDetails(hostId) {
        this._checkInitialized();
        this._checkFeatureEnabled('hosts');
        
        return this.apis.hosts.getHostDetails(hostId);
    }
    
    /**
     * Get incidents from CrowdStrike
     * @param {object} options Query options
     * @returns {Promise<array>} Incidents
     */
    async getIncidents(options = {}) {
        this._checkInitialized();
        this._checkFeatureEnabled('incidents');
        
        return this.apis.incidents.getIncidents(options);
    }
    
    /**
     * Get incident details
     * @param {string} incidentId Incident ID
     * @returns {Promise<object>} Incident details
     */
    async getIncidentDetails(incidentId) {
        this._checkInitialized();
        this._checkFeatureEnabled('incidents');
        
        return this.apis.incidents.getIncidentDetails(incidentId);
    }
    
    /**
     * Contain a host (isolate from network)
     * @param {string} hostId Host ID
     * @returns {Promise<object>} Action result
     */
    async containHost(hostId) {
        this._checkInitialized();
        this._checkFeatureEnabled('responseActions');
        
        return this.apis.responseActions.containHost(hostId);
    }
    
    /**
     * Lift containment from a host (restore network connectivity)
     * @param {string} hostId Host ID
     * @returns {Promise<object>} Action result
     */
    async liftContainment(hostId) {
        this._checkInitialized();
        this._checkFeatureEnabled('responseActions');
        
        return this.apis.responseActions.liftContainment(hostId);
    }
    
    /**
     * Run a Real-time Response command on a host
     * @param {string} hostId Host ID
     * @param {string} command Command to run
     * @param {object} parameters Command parameters
     * @returns {Promise<object>} Command result
     */
    async runRTRCommand(hostId, command, parameters = {}) {
        this._checkInitialized();
        this._checkFeatureEnabled('responseActions');
        
        return this.apis.responseActions.runRTRCommand(hostId, command, parameters);
    }
    
    /**
     * Search for threat intelligence
     * @param {object} query Query parameters
     * @returns {Promise<array>} Intelligence results
     */
    async searchIntelligence(query) {
        this._checkInitialized();
        this._checkFeatureEnabled('intelligence');
        
        return this.apis.intelligence.searchIntelligence(query);
    }
    
    /**
     * Get vulnerabilities for a host
     * @param {string} hostId Host ID
     * @returns {Promise<array>} Vulnerabilities
     */
    async getHostVulnerabilities(hostId) {
        this._checkInitialized();
        this._checkFeatureEnabled('vulnerability');
        
        return this.apis.vulnerability.getHostVulnerabilities(hostId);
    }
    
    /**
     * Check if an authentication token is valid
     * @returns {boolean} Whether the token is valid
     * @private
     */
    _isTokenValid() {
        return (
            this.authToken && 
            this.tokenExpiration && 
            this.tokenExpiration > Date.now()
        );
    }
    
    /**
     * Get an authentication token, refreshing it if necessary
     * @returns {Promise<string>} Authentication token
     * @private
     */
    async _getAuthToken() {
        if (!this._isTokenValid()) {
            await this._authenticateWithCrowdStrike();
        }
        
        return this.authToken;
    }
    
    /**
     * Authenticate with CrowdStrike and get an access token
     * @returns {Promise<void>}
     * @private
     */
    async _authenticateWithCrowdStrike() {
        // In a real implementation, this would make an OAuth2 request
        // to get an access token from CrowdStrike
        
        // For this placeholder, simulate authentication
        this.authToken = `simulated_token_${Date.now()}`;
        this.tokenExpiration = Date.now() + 1800000; // 30 minutes
    }
    
    /**
     * Check if the integration is initialized
     * @private
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('CrowdStrike integration is not initialized');
        }
    }
    
    /**
     * Check if a feature is enabled
     * @param {string} feature Feature name
     * @private
     */
    _checkFeatureEnabled(feature) {
        if (!this.config.features[feature]) {
            throw new Error(`CrowdStrike ${feature} feature is not enabled`);
        }
    }
}

module.exports = new CrowdStrikeIntegration();