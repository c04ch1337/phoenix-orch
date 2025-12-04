/**
 * Agentic SOC Core System
 * 
 * The core system provides fundamental infrastructure and services for the
 * Agentic SOC platform, including database connectivity, task scheduling,
 * messaging, logging, security monitoring, and configuration management.
 */

const database = require('./database');
const scheduler = require('./scheduler');
const messageBus = require('./message_bus');
const logger = require('./logger');
const securityMonitor = require('./security_monitor');
const configManager = require('./config_manager');

/**
 * Initialize the core system
 * @param {object} config Configuration options
 * @returns {Promise<object>} Initialization result
 */
async function initialize(config = {}) {
    const results = {};
    
    try {
        // Initialize logger first
        logger.info('Initializing Agentic SOC Core System...');
        
        // Initialize components in dependency order
        
        // 1. Configuration Manager (needed by other components)
        logger.info('Initializing Configuration Manager...');
        await configManager.initialize(config.configManager);
        results.configManager = { success: true };
        
        // 2. Database (needed for persistence)
        logger.info('Initializing Database...');
        await database.initialize(config.database);
        results.database = { success: true };
        
        // 3. Message Bus (needed for communication)
        logger.info('Initializing Message Bus...');
        await messageBus.initialize(config.messageBus);
        results.messageBus = { success: true };
        
        // 4. Scheduler (for task management)
        logger.info('Initializing Scheduler...');
        await scheduler.initialize(config.scheduler);
        results.scheduler = { success: true };
        
        // 5. Security Monitor (for system protection)
        logger.info('Initializing Security Monitor...');
        await securityMonitor.initialize(config.securityMonitor);
        results.securityMonitor = { success: true };
        
        logger.info('Agentic SOC Core System initialized successfully');
        results.success = true;
        
    } catch (error) {
        logger.error('Failed to initialize Agentic SOC Core System', { error });
        results.error = {
            message: error.message,
            stack: error.stack
        };
        results.success = false;
    }
    
    return results;
}

/**
 * Shutdown the core system
 * @returns {Promise<object>} Shutdown result
 */
async function shutdown() {
    const results = {};
    
    try {
        logger.info('Shutting down Agentic SOC Core System...');
        
        // Shutdown in reverse dependency order
        
        // 1. Security Monitor
        await securityMonitor.shutdown();
        results.securityMonitor = { success: true };
        
        // 2. Scheduler
        await scheduler.shutdown();
        results.scheduler = { success: true };
        
        // 3. Message Bus
        await messageBus.shutdown();
        results.messageBus = { success: true };
        
        // 4. Database
        await database.close();
        results.database = { success: true };
        
        logger.info('Agentic SOC Core System shut down successfully');
        results.success = true;
        
    } catch (error) {
        logger.error('Error during Agentic SOC Core System shutdown', { error });
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
    database,
    scheduler,
    messageBus,
    logger,
    securityMonitor,
    configManager
};