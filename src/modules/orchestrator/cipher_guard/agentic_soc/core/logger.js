/**
 * Logger
 * 
 * Provides centralized logging capabilities for the Agentic SOC.
 * Supports multiple log levels, structured logging, and outputs
 * to various destinations.
 */

class Logger {
    constructor() {
        this.config = {
            level: 'info', // debug, info, warn, error, critical
            structured: true,
            timestamp: true,
            colorize: true,
            outputs: ['console'],
            file: {
                enabled: false,
                path: './logs',
                maxSize: '10m',
                maxFiles: 5,
                format: 'json'
            },
            redact: {
                enabled: true,
                fields: [
                    'password',
                    'apiKey',
                    'secret',
                    'token',
                    'credentials',
                    'personalData'
                ]
            }
        };
        
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            critical: 4
        };
        
        this.initialized = false;
        this.context = {};
    }
    
    /**
     * Initialize the logger
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Set up outputs
        this._setupOutputs();
        
        this.initialized = true;
        this.info('Logger initialized successfully');
    }
    
    /**
     * Set global logging context
     * @param {object} context Context data to include in all logs
     */
    setContext(context) {
        this.context = { ...this.context, ...context };
    }
    
    /**
     * Clear global logging context
     */
    clearContext() {
        this.context = {};
    }
    
    /**
     * Log at debug level
     * @param {string} message Log message
     * @param {object} data Additional data
     */
    debug(message, data = {}) {
        this._log('debug', message, data);
    }
    
    /**
     * Log at info level
     * @param {string} message Log message
     * @param {object} data Additional data
     */
    info(message, data = {}) {
        this._log('info', message, data);
    }
    
    /**
     * Log at warn level
     * @param {string} message Log message
     * @param {object} data Additional data
     */
    warn(message, data = {}) {
        this._log('warn', message, data);
    }
    
    /**
     * Log at error level
     * @param {string} message Log message
     * @param {object} data Additional data
     */
    error(message, data = {}) {
        // If data contains an error object, extract its details
        if (data.error && data.error instanceof Error) {
            const err = data.error;
            data = {
                ...data,
                error: {
                    message: err.message,
                    name: err.name,
                    stack: err.stack,
                    code: err.code
                }
            };
        }
        
        this._log('error', message, data);
    }
    
    /**
     * Log at critical level
     * @param {string} message Log message
     * @param {object} data Additional data
     */
    critical(message, data = {}) {
        this._log('critical', message, data);
    }
    
    /**
     * Log a security event
     * @param {string} message Log message
     * @param {object} data Additional data
     */
    security(message, data = {}) {
        this._log('warn', `SECURITY: ${message}`, { ...data, _security: true });
    }
    
    /**
     * Log an audit event
     * @param {string} action Action being audited
     * @param {object} data Audit data
     */
    audit(action, data = {}) {
        this._log('info', `AUDIT: ${action}`, { ...data, _audit: true, action });
    }
    
    /**
     * Create a child logger with additional context
     * @param {object} context Additional context for the child logger
     * @returns {object} Child logger
     */
    child(context) {
        // Create a simple wrapper that includes additional context
        const childLogger = {};
        
        // Copy all public methods
        for (const method of ['debug', 'info', 'warn', 'error', 'critical', 'security', 'audit']) {
            childLogger[method] = (message, data = {}) => {
                this[method](message, { ...context, ...data });
            };
        }
        
        return childLogger;
    }
    
    /**
     * Internal logging function
     * @param {string} level Log level
     * @param {string} message Log message
     * @param {object} data Additional data
     * @private
     */
    _log(level, message, data = {}) {
        // Check if level is enabled
        if (this.levels[level] < this.levels[this.config.level]) {
            return;
        }
        
        // Create log entry
        const entry = this._createLogEntry(level, message, data);
        
        // Write to all configured outputs
        this._writeToOutputs(entry);
    }
    
    /**
     * Create a log entry
     * @param {string} level Log level
     * @param {string} message Log message
     * @param {object} data Additional data
     * @returns {object} Log entry
     * @private
     */
    _createLogEntry(level, message, data) {
        // Create basic entry
        const entry = {
            level,
            message,
            data: { ...this.context, ...data }
        };
        
        // Add timestamp if configured
        if (this.config.timestamp) {
            entry.timestamp = new Date().toISOString();
        }
        
        // Redact sensitive fields if configured
        if (this.config.redact.enabled) {
            this._redactSensitiveFields(entry.data);
        }
        
        return entry;
    }
    
    /**
     * Redact sensitive fields recursively
     * @param {object} obj Object to redact
     * @private
     */
    _redactSensitiveFields(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                // Recursively process nested objects
                this._redactSensitiveFields(obj[key]);
            } else if (this.config.redact.fields.includes(key.toLowerCase())) {
                // Redact sensitive field
                obj[key] = '[REDACTED]';
            }
        }
    }
    
    /**
     * Format entry for output
     * @param {object} entry Log entry
     * @returns {string} Formatted log entry
     * @private
     */
    _formatEntry(entry) {
        if (this.config.structured) {
            return JSON.stringify(entry);
        } else {
            let result = '';
            
            if (entry.timestamp) {
                result += `[${entry.timestamp}] `;
            }
            
            const levelStr = entry.level.toUpperCase().padEnd(8);
            result += `${levelStr} ${entry.message}`;
            
            if (Object.keys(entry.data).length > 0) {
                result += ` ${JSON.stringify(entry.data)}`;
            }
            
            return result;
        }
    }
    
    /**
     * Set up logging outputs
     * @private
     */
    _setupOutputs() {
        // In a real implementation, this would set up file loggers, etc.
        // For this placeholder, we just use console.log
    }
    
    /**
     * Write log entry to configured outputs
     * @param {object} entry Log entry
     * @private
     */
    _writeToOutputs(entry) {
        const formatted = this._formatEntry(entry);
        
        // Write to console if enabled
        if (this.config.outputs.includes('console')) {
            this._writeToConsole(entry, formatted);
        }
        
        // Write to file if enabled (would be implemented in a real logger)
        if (this.config.file.enabled && this.config.outputs.includes('file')) {
            this._writeToFile(entry, formatted);
        }
    }
    
    /**
     * Write log entry to console
     * @param {object} entry Log entry
     * @param {string} formatted Formatted log entry
     * @private
     */
    _writeToConsole(entry, formatted) {
        // Use different console methods based on level
        switch (entry.level) {
            case 'debug':
                console.debug(formatted);
                break;
            case 'info':
                console.info(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'error':
            case 'critical':
                console.error(formatted);
                break;
            default:
                console.log(formatted);
        }
    }
    
    /**
     * Write log entry to file
     * @param {object} entry Log entry
     * @param {string} formatted Formatted log entry
     * @private
     */
    _writeToFile(entry, formatted) {
        // In a real implementation, this would write to a file
        // For this placeholder, we do nothing
    }
}

module.exports = new Logger();