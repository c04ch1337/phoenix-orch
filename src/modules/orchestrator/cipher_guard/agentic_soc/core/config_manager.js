/**
 * Configuration Manager
 * 
 * Provides centralized configuration management for the Agentic SOC.
 * Supports loading from multiple sources, validation, overrides, and
 * environment-specific configuration.
 */

const logger = require('./logger');
const database = require('./database');

class ConfigManager {
    constructor() {
        this.config = {};
        this.defaults = {};
        this.schema = {};
        this.sources = [];
        this.initialized = false;
    }
    
    /**
     * Initialize the configuration manager
     * @param {object} options Initialization options
     * @returns {Promise<void>}
     */
    async initialize(options = {}) {
        const {
            configPath = './config',
            environment = process.env.NODE_ENV || 'development',
            sources = ['default', 'file', 'env', 'db'],
            validateConfig = true
        } = options;
        
        try {
            // Load configuration from each source in order
            for (const source of sources) {
                await this._loadFromSource(source, {
                    configPath,
                    environment
                });
            }
            
            // Validate configuration if requested
            if (validateConfig) {
                this._validateConfig();
            }
            
            this.sources = sources;
            this.initialized = true;
            
            logger.info('Configuration Manager initialized successfully', {
                sources,
                environment
            });
        } catch (error) {
            logger.error('Failed to initialize Configuration Manager', { error });
            throw error;
        }
    }
    
    /**
     * Get a configuration value
     * @param {string} key Configuration key (supports dot notation)
     * @param {any} defaultValue Default value if key is not found
     * @returns {any} Configuration value
     */
    get(key, defaultValue) {
        this._checkInitialized();
        
        const value = this._getValueFromPath(this.config, key);
        
        if (value === undefined) {
            return defaultValue;
        }
        
        return value;
    }
    
    /**
     * Set a configuration value
     * @param {string} key Configuration key (supports dot notation)
     * @param {any} value Value to set
     * @param {object} options Set options
     * @returns {boolean} Success status
     */
    set(key, value, options = {}) {
        this._checkInitialized();
        
        const {
            persist = false,
            validate = true,
            source = 'runtime'
        } = options;
        
        // Validate the value if requested
        if (validate) {
            const isValid = this._validateValue(key, value);
            if (!isValid) {
                logger.warn(`Invalid configuration value for ${key}`, { value });
                return false;
            }
        }
        
        // Set the value in memory
        this._setValueAtPath(this.config, key, value);
        
        // Persist the value if requested
        if (persist) {
            this._persistValue(key, value, source);
        }
        
        logger.debug(`Configuration updated: ${key}`, { source });
        return true;
    }
    
    /**
     * Get all configuration values
     * @param {object} options Get options
     * @returns {object} All configuration values
     */
    getAll(options = {}) {
        this._checkInitialized();
        
        const { filter = null, redact = true } = options;
        
        // Clone the config object
        const config = JSON.parse(JSON.stringify(this.config));
        
        // Apply filtering if requested
        if (filter && typeof filter === 'function') {
            this._filterObject(config, filter);
        }
        
        // Redact sensitive values if requested
        if (redact) {
            this._redactSensitiveValues(config);
        }
        
        return config;
    }
    
    /**
     * Register default configuration values
     * @param {string} namespace Configuration namespace
     * @param {object} defaults Default configuration values
     * @param {object} schema Validation schema
     */
    registerDefaults(namespace, defaults, schema = {}) {
        // Store defaults
        this.defaults[namespace] = defaults;
        
        // Store schema
        if (schema) {
            this.schema[namespace] = schema;
        }
        
        // Apply defaults if not already set
        for (const [key, value] of Object.entries(defaults)) {
            const fullKey = namespace ? `${namespace}.${key}` : key;
            if (this.get(fullKey) === undefined) {
                this.set(fullKey, value);
            }
        }
    }
    
    /**
     * Reset configuration to defaults
     * @param {string} namespace Optional namespace to reset
     * @returns {boolean} Success status
     */
    resetToDefaults(namespace = null) {
        this._checkInitialized();
        
        if (namespace) {
            // Reset only the specified namespace
            if (!this.defaults[namespace]) {
                logger.warn(`No defaults registered for namespace: ${namespace}`);
                return false;
            }
            
            // Apply defaults for the namespace
            for (const [key, value] of Object.entries(this.defaults[namespace])) {
                const fullKey = `${namespace}.${key}`;
                this.set(fullKey, value);
            }
        } else {
            // Reset all namespaces
            this.config = {};
            
            // Apply all defaults
            for (const [ns, defaults] of Object.entries(this.defaults)) {
                for (const [key, value] of Object.entries(defaults)) {
                    const fullKey = `${ns}.${key}`;
                    this.set(fullKey, value);
                }
            }
        }
        
        logger.info(`Configuration reset to defaults${namespace ? ` for ${namespace}` : ''}`);
        return true;
    }
    
    /**
     * Reload configuration from sources
     * @returns {Promise<boolean>} Success status
     */
    async reload() {
        this._checkInitialized();
        
        try {
            // Save current config
            const currentConfig = { ...this.config };
            
            // Clear current config
            this.config = {};
            
            // Reload from all sources
            for (const source of this.sources) {
                await this._loadFromSource(source);
            }
            
            // Validate new configuration
            this._validateConfig();
            
            logger.info('Configuration reloaded successfully');
            return true;
        } catch (error) {
            // Restore previous config on error
            this.config = currentConfig;
            
            logger.error('Failed to reload configuration', { error });
            return false;
        }
    }
    
    /**
     * Load configuration from a source
     * @param {string} source Source name
     * @param {object} options Load options
     * @returns {Promise<boolean>} Success status
     * @private
     */
    async _loadFromSource(source, options = {}) {
        const { configPath, environment } = options;
        
        switch (source) {
            case 'default':
                // Load defaults from registered defaults
                for (const [namespace, defaults] of Object.entries(this.defaults)) {
                    for (const [key, value] of Object.entries(defaults)) {
                        const fullKey = `${namespace}.${key}`;
                        if (this.get(fullKey) === undefined) {
                            this._setValueAtPath(this.config, fullKey, value);
                        }
                    }
                }
                break;
                
            case 'file':
                // In a real implementation, this would load from config files
                // For now, we'll just log the attempt
                logger.debug(`Would load configuration from files in ${configPath} for ${environment}`);
                break;
                
            case 'env':
                // Load from environment variables
                this._loadFromEnvironment();
                break;
                
            case 'db':
                // In a real implementation, this would load from the database
                // For now, we'll just log the attempt
                logger.debug('Would load configuration from database');
                break;
                
            default:
                logger.warn(`Unknown configuration source: ${source}`);
                return false;
        }
        
        return true;
    }
    
    /**
     * Load configuration from environment variables
     * @private
     */
    _loadFromEnvironment() {
        // Look for environment variables starting with AGENTIC_SOC_
        const prefix = 'AGENTIC_SOC_';
        
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(prefix)) {
                // Convert AGENTIC_SOC_CORE_LOGGER_LEVEL to core.logger.level
                const configKey = key.substring(prefix.length)
                                     .toLowerCase()
                                     .replace(/__/g, '.')
                                     .replace(/_/g, '.');
                
                // Try to parse as JSON, fallback to string
                let parsedValue = value;
                try {
                    parsedValue = JSON.parse(value);
                } catch (e) {
                    // Not valid JSON, keep as string
                }
                
                this._setValueAtPath(this.config, configKey, parsedValue);
            }
        }
    }
    
    /**
     * Persist a configuration value
     * @param {string} key Configuration key
     * @param {any} value Value to persist
     * @param {string} source Source to persist to
     * @returns {Promise<boolean>} Success status
     * @private
     */
    async _persistValue(key, value, source) {
        switch (source) {
            case 'db':
                try {
                    await database.setConfig(key, value);
                    return true;
                } catch (error) {
                    logger.error(`Failed to persist configuration to database: ${key}`, { error });
                    return false;
                }
                
            case 'file':
                // In a real implementation, this would write to config files
                logger.debug(`Would persist configuration to file: ${key}`);
                return true;
                
            default:
                logger.warn(`Unsupported persistence source: ${source}`);
                return false;
        }
    }
    
    /**
     * Validate the entire configuration
     * @returns {boolean} Whether the configuration is valid
     * @private
     */
    _validateConfig() {
        // In a real implementation, this would validate against schemas
        return true;
    }
    
    /**
     * Validate a single configuration value
     * @param {string} key Configuration key
     * @param {any} value Value to validate
     * @returns {boolean} Whether the value is valid
     * @private
     */
    _validateValue(key, value) {
        // In a real implementation, this would validate against the schema
        return true;
    }
    
    /**
     * Get a nested value from an object using dot notation
     * @param {object} obj The object to get from
     * @param {string} path Path to the value using dot notation
     * @returns {any} The value or undefined if not found
     * @private
     */
    _getValueFromPath(obj, path) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }
    
    /**
     * Set a nested value in an object using dot notation
     * @param {object} obj The object to set in
     * @param {string} path Path to the value using dot notation
     * @param {any} value The value to set
     * @private
     */
    _setValueAtPath(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const key of keys) {
            if (current[key] === undefined) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }
    
    /**
     * Filter an object recursively
     * @param {object} obj The object to filter
     * @param {function} filterFn The filter function
     * @private
     */
    _filterObject(obj, filterFn) {
        for (const key of Object.keys(obj)) {
            if (!filterFn(key, obj[key])) {
                delete obj[key];
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this._filterObject(obj[key], filterFn);
            }
        }
    }
    
    /**
     * Redact sensitive values
     * @param {object} obj The object to redact
     * @private
     */
    _redactSensitiveValues(obj) {
        const sensitiveKeys = [
            'password',
            'secret',
            'key',
            'token',
            'credential',
            'apikey',
            'appkey'
        ];
        
        for (const key of Object.keys(obj)) {
            if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this._redactSensitiveValues(obj[key]);
            }
        }
    }
    
    /**
     * Check if the manager is initialized
     * @private
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('Configuration Manager is not initialized');
        }
    }
}

module.exports = new ConfigManager();