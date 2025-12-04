/**
 * Agentic SOC Utility Modules
 * 
 * This module exports utility functions and helpers used throughout the
 * Agentic SOC system, including encryption, validation, metrics collection,
 * and telemetry.
 */

const encryption = require('./encryption');
const validation = require('./validation');
const metrics = require('./metrics');
const telemetry = require('./telemetry');

/**
 * Initialize utility modules with configuration
 * @param {object} config Configuration options
 * @returns {Promise<object>} Initialization result
 */
async function initialize(config = {}) {
    const results = {};
    
    try {
        // Initialize metrics
        if (config.metrics) {
            metrics.initialize(config.metrics);
            results.metrics = { success: true };
        }
        
        // Initialize telemetry
        if (config.telemetry) {
            telemetry.initialize(config.telemetry);
            results.telemetry = { success: true };
        }
        
        results.success = true;
    } catch (error) {
        results.error = {
            message: error.message,
            stack: error.stack
        };
        results.success = false;
    }
    
    return results;
}

/**
 * Shutdown utility modules
 * @returns {Promise<object>} Shutdown result
 */
async function shutdown() {
    const results = {};
    
    try {
        // Stop metrics auto flush
        if (metrics.stopAutoFlush) {
            metrics.stopAutoFlush();
            results.metrics = { success: true };
        }
        
        // Stop telemetry auto flush
        if (telemetry.stopAutoFlush) {
            telemetry.stopAutoFlush();
            results.telemetry = { success: true };
        }
        
        results.success = true;
    } catch (error) {
        results.error = {
            message: error.message,
            stack: error.stack
        };
        results.success = false;
    }
    
    return results;
}

module.exports = {
    initialize,
    shutdown,
    encryption,
    validation,
    metrics,
    telemetry
};