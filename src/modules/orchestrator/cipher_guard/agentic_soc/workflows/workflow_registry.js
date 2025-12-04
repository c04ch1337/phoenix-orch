/**
 * Workflow Registry
 *
 * Catalog of workflow definitions for the Cipher Guard Agentic SOC.
 * Workflows are indexed by name and by trigger (event type or schedule ID).
 *
 * This module exports a default singleton registry for convenience as well as
 * the underlying {@link WorkflowRegistry} class for callers that want to
 * manage their own registry instance.
 */

class WorkflowRegistry {
    /**
     * Create a new workflow registry.
     */
    constructor() {
        /**
         * Map of workflow name -> definition.
         * @type {Map<string, object>}
         * @private
         */
        this._workflowsByName = new Map();

        /**
         * Map of trigger pattern -> Set<workflowName>.
         * Triggers are simple strings such as "proofpoint:alert" or
         * "schedule:weekly:leadership_report". Basic "*" wildcards are supported.
         * @type {Map<string, Set<string>>}
         * @private
         */
        this._workflowsByTrigger = new Map();
    }

    /**
     * Register a workflow definition.
     *
     * @param {object} definition Workflow definition.
     * @param {string} definition.name Unique workflow name.
     * @param {string|string[]} definition.trigger Event type or schedule ID
     *   (or array of triggers) that should start the workflow.
     * @param {Array<object>} definition.steps Ordered list of step descriptors.
     * @returns {object} Stored workflow definition.
     */
    registerWorkflow(definition) {
        if (!definition || typeof definition !== 'object') {
            throw new Error('WorkflowRegistry.registerWorkflow: definition object is required');
        }

        const { name, trigger, steps } = definition;

        if (!name || typeof name !== 'string') {
            throw new Error('WorkflowRegistry.registerWorkflow: definition.name must be a non-empty string');
        }

        if (!trigger || (typeof trigger !== 'string' && !Array.isArray(trigger))) {
            throw new Error(`WorkflowRegistry.registerWorkflow(${name}): definition.trigger must be a string or string[]`);
        }

        if (!Array.isArray(steps) || steps.length === 0) {
            throw new Error(`WorkflowRegistry.registerWorkflow(${name}): definition.steps must be a non-empty array`);
        }

        // Basic validation of steps – they must have id and run()
        steps.forEach((step, index) => {
            if (!step || typeof step !== 'object') {
                throw new Error(`WorkflowRegistry.registerWorkflow(${name}): step[${index}] must be an object`);
            }
            if (!step.id || typeof step.id !== 'string') {
                throw new Error(`WorkflowRegistry.registerWorkflow(${name}): step[${index}] is missing required id`);
            }
            if (typeof step.run !== 'function') {
                throw new Error(
                    `WorkflowRegistry.registerWorkflow(${name}): step[${step.id}] must define an async run(context, helpers) function`
                );
            }
        });

        const normalizedTriggers = Array.isArray(trigger) ? trigger : [trigger];

        // Store full definition keyed by name
        const storedDefinition = {
            ...definition,
            trigger: normalizedTriggers,
            registeredAt: new Date().toISOString(),
        };

        this._workflowsByName.set(name, storedDefinition);

        // Index by trigger
        normalizedTriggers.forEach((pattern) => {
            if (!this._workflowsByTrigger.has(pattern)) {
                this._workflowsByTrigger.set(pattern, new Set());
            }
            this._workflowsByTrigger.get(pattern).add(name);
        });

        return storedDefinition;
    }

    /**
     * Get a workflow definition by name.
     *
     * @param {string} name Workflow name.
     * @returns {object|null} Workflow definition or null if not found.
     */
    getWorkflowByName(name) {
        return this._workflowsByName.get(name) || null;
    }

    /**
     * Find workflows whose trigger matches the provided event type.
     * Supports simple "*" wildcard patterns in the registered trigger.
     *
     * @param {string} eventType Concrete event type, e.g. "proofpoint:alert".
     * @returns {object[]} Array of matching workflow definitions.
     */
    getWorkflowsByTrigger(eventType) {
        if (!eventType) {
            return [];
        }

        const matches = new Set();

        for (const [pattern, workflowNames] of this._workflowsByTrigger.entries()) {
            if (this._matchesTrigger(pattern, eventType)) {
                workflowNames.forEach((name) => matches.add(name));
            }
        }

        return Array.from(matches)
            .map((name) => this._workflowsByName.get(name))
            .filter(Boolean);
    }

    /**
     * List all registered workflows with basic metadata.
     *
     * @returns {Array<object>} Array of workflow metadata objects.
     */
    listWorkflows() {
        const results = [];
        for (const [name, def] of this._workflowsByName.entries()) {
            results.push({
                name,
                trigger: def.trigger,
                description: def.description || '',
                stepCount: Array.isArray(def.steps) ? def.steps.length : 0,
                registeredAt: def.registeredAt,
            });
        }
        return results;
    }

    /**
     * Internal trigger pattern matcher.
     *
     * Supports:
     *   - Exact matches, e.g. "proofpoint:alert"
     *   - Simple "*" wildcard at any position, e.g. "schedule:daily:*"
     *
     * @param {string} pattern Registered trigger pattern.
     * @param {string} eventType Incoming event type.
     * @returns {boolean} True if the pattern matches the event type.
     * @private
     */
    _matchesTrigger(pattern, eventType) {
        if (pattern === eventType) {
            return true;
        }
        if (pattern.includes('*')) {
            const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
            return regex.test(eventType);
        }
        return false;
    }
}

// Default singleton registry for convenience / backward compatibility.
const defaultRegistry = new WorkflowRegistry();

// Export default instance (for existing callers) and the class for new code.
module.exports = defaultRegistry;
module.exports.WorkflowRegistry = WorkflowRegistry;
module.exports.defaultRegistry = defaultRegistry;
module.exports.createRegistry = () => new WorkflowRegistry();