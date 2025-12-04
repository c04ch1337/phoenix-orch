/**
 * Workflows Index
 *
 * Aggregated exports for the Cipher Guard Agentic SOC workflow system.
 * Provides convenient access to the WorkflowEngine, WorkflowRegistry and
 * a helper to register the default SOC workflows.
 *
 * Note: Existing modules still import the engine/registry directly from
 * ./workflow_engine and ./workflow_registry. This index is intended for
 * new code and for the workflows_demo harness.
 */

const workflowEngineModule = require('./workflow_engine');
const workflowRegistryModule = require('./workflow_registry');

const {
    WorkflowEngine,
    defaultEngine,
    createEngine,
    registerDefaultWorkflows,
} = workflowEngineModule;

const {
    WorkflowRegistry,
    defaultRegistry,
    createRegistry,
} = workflowRegistryModule;

module.exports = {
    // Core classes
    WorkflowEngine,
    WorkflowRegistry,

    // Default singletons
    defaultEngine,
    defaultRegistry,

    // Factory helpers
    createEngine,
    createRegistry,

    // Registration helper to load the five canonical workflows
    registerDefaultWorkflows,

    // Backwards-compatible aliases for convenience
    workflowEngine: defaultEngine,
    workflowRegistry: defaultRegistry,

    /**
     * Convenience wrapper to execute a workflow via the default engine.
     * @param {string} workflowName
     * @param {object} parameters
     * @param {object} [options]
     * @returns {Promise<string>}
     */
    executeWorkflow: async (workflowName, parameters, options) => {
        return defaultEngine.executeWorkflow(workflowName, parameters, options);
    },
};