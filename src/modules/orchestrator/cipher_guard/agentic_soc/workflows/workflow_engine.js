/**
 * Workflow Engine
 *
 * Event-driven engine for executing and managing security workflows in the
 * Cipher Guard Agentic SOC. Workflows:
 *   - Are defined in the WorkflowRegistry with { name, trigger, steps[] }.
 *   - Are started either explicitly via startWorkflow/executeWorkflow or
 *     implicitly via events (handleEvent / message bus subscription).
 *   - Execute an ordered list of async steps with retries, timeouts, and
 *     per-step error handling hooks.
 */

const { defaultRegistry } = require('./workflow_registry');

/**
 * @typedef {Object} WorkflowStepDefinition
 * @property {string} id
 * @property {string} description
 * @property {function(Object, Object): Promise<any>} run
 * @property {function(Error, Object, Object): Promise<void>} [onError]
 * @property {number} [retry]        Number of additional attempts on failure.
 * @property {number} [timeoutMs]    Per-attempt timeout in milliseconds.
 */

/**
 * @typedef {Object} WorkflowDefinition
 * @property {string} name
 * @property {string|string[]} trigger
 * @property {string} [description]
 * @property {WorkflowStepDefinition[]} steps
 */

/**
 * @typedef {Object} WorkflowInstance
 * @property {string} id
 * @property {string} name
 * @property {WorkflowDefinition} definition
 * @property {'pending'|'running'|'completed'|'failed'|'cancelled'} status
 * @property {number} startedAt
 * @property {number} updatedAt
 * @property {number|null} completedAt
 * @property {number} currentStepIndex
 * @property {Object} context
 * @property {Array<{id: string, description: string, status: string, startedAt?: number, completedAt?: number}>} steps
 * @property {Array<{timestamp: number, level: string, message: string, meta?: any}>} logs
 * @property {{message: string, stack?: string}|null} error
 */

/**
 * WorkflowEngine
 *
 * Core orchestrator that ties workflow definitions, agents, integrations,
 * and the message bus together.
 */
class WorkflowEngine {
    /**
     * @param {Object} [options]
     * @param {import('./workflow_registry').WorkflowRegistry} [options.workflowRegistry]
     * @param {Object} [options.agentManager]
     * @param {Object} [options.agentRegistry]
     * @param {Object} [options.messageBus]
     * @param {Object} [options.integrations] Bundled external integrations
     *   (jira, teams, obsidian, email, proofpoint, crowdstrike, rapid7, ...).
     * @param {Console|Object} [options.logger]
     */
    constructor(options = {}) {
        this.workflowRegistry = options.workflowRegistry || defaultRegistry;
        this.agentManager = options.agentManager || null;
        this.agentRegistry = options.agentRegistry || null;
        this.messageBus = options.messageBus || null;
        this.integrations = options.integrations || {};
        this.logger = options.logger || console;

        /** @type {Map<string, WorkflowInstance>} */
        this.runningWorkflows = new Map();

        /** @type {WorkflowInstance[]} */
        this.workflowHistory = [];

        /** @type {string|null} */
        this._busSubscriptionId = null;

        if (this.messageBus) {
            this.attachToMessageBus();
        }
    }

    /**
     * Associate an AgentManager at runtime.
     * @param {Object} agentManager
     */
    setAgentManager(agentManager) {
        this.agentManager = agentManager;
    }

    /**
     * Associate an AgentRegistry at runtime.
     * @param {Object} agentRegistry
     */
    setAgentRegistry(agentRegistry) {
        this.agentRegistry = agentRegistry;
    }

    /**
     * Associate a message bus and attach subscriptions.
     * @param {Object} messageBus
     */
    setMessageBus(messageBus) {
        this.messageBus = messageBus;
        this.attachToMessageBus();
    }

    /**
     * Replace or extend the integrations bundle.
     * @param {Object} integrations
     */
    setIntegrations(integrations) {
        this.integrations = integrations || {};
    }

    /**
     * Register a workflow definition with the underlying registry.
     *
     * @param {WorkflowDefinition} definition
     * @returns {WorkflowDefinition}
     */
    registerWorkflow(definition) {
        if (!this.workflowRegistry) {
            throw new Error('WorkflowEngine.registerWorkflow: workflowRegistry not configured');
        }
        return this.workflowRegistry.registerWorkflow(definition);
    }

    /**
     * Start a workflow instance by name.
     *
     * @param {string} workflowName
     * @param {Object} [context={}] Initial workflow context.
     * @param {Object} [options]
     * @param {Object} [options.triggerEvent] Original event that triggered the workflow.
     * @param {boolean} [options.continueOnError=false] Continue executing remaining
     *   steps even if one fails (errors are still recorded on the instance).
     * @returns {string} Workflow execution ID.
     */
    async startWorkflow(workflowName, context = {}, options = {}) {
        if (!this.workflowRegistry) {
            throw new Error('WorkflowEngine.startWorkflow: workflowRegistry not configured');
        }

        const definition =
            this.workflowRegistry.getWorkflowByName
                ? this.workflowRegistry.getWorkflowByName(workflowName)
                : null;

        if (!definition) {
            throw new Error(`WorkflowEngine.startWorkflow: workflow not found: ${workflowName}`);
        }

        const executionId = options.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        /** @type {WorkflowInstance} */
        const instance = {
            id: executionId,
            name: workflowName,
            definition,
            status: 'pending',
            startedAt: Date.now(),
            updatedAt: Date.now(),
            completedAt: null,
            currentStepIndex: -1,
            context: {
                ...context,
                workflowId: executionId,
                workflowName,
                triggerEvent: options.triggerEvent || null,
                stepResults: {},
            },
            steps: definition.steps.map((step) => ({
                id: step.id,
                description: step.description || '',
                status: 'pending',
            })),
            logs: [],
            error: null,
        };

        this.runningWorkflows.set(executionId, instance);
        this._log(instance, 'info', `Workflow started: ${workflowName}`, {
            triggerType: instance.context.triggerEvent && instance.context.triggerEvent.type,
        });

        // Execute asynchronously so startWorkflow returns immediately.
        this._runWorkflowInstance(executionId, {
            continueOnError: Boolean(options.continueOnError),
        }).catch((err) => {
            this._log(instance, 'error', `Workflow execution failed: ${err.message}`, {
                stack: err.stack,
            });
        });

        return executionId;
    }

    /**
     * Backwards-compatible alias for startWorkflow.
     * Existing callers use executeWorkflow(name, parameters, options).
     *
     * @param {string} workflowName
     * @param {Object} parameters
     * @param {Object} [options]
     * @returns {Promise<string>}
     */
    async executeWorkflow(workflowName, parameters, options = {}) {
        return this.startWorkflow(workflowName, parameters || {}, options);
    }

    /**
     * Handle an incoming event. This can be called directly or from
     * a message bus subscription.
     *
     * @param {{type: string, payload?: any, metadata?: any}} event
     * @param {Object} [options]
     * @returns {Promise<string[]>} IDs of workflow instances that were started.
     */
    async handleEvent(event, options = {}) {
        if (!event || !event.type) {
            throw new Error('WorkflowEngine.handleEvent: event.type is required');
        }

        if (!this.workflowRegistry || !this.workflowRegistry.getWorkflowsByTrigger) {
            this.logger.warn?.(
                `[WorkflowEngine] handleEvent called but workflowRegistry does not support trigger lookups (event: ${event.type})`,
            );
            return [];
        }

        const matchingWorkflows = this.workflowRegistry.getWorkflowsByTrigger(event.type) || [];
        if (matchingWorkflows.length === 0) {
            this._debug(`No workflows registered for event type: ${event.type}`);
            return [];
        }

        this._debug(
            `Event "${event.type}" matched workflows: ${matchingWorkflows.map((w) => w.name).join(', ')}`,
        );

        const executionIds = [];
        for (const workflowDef of matchingWorkflows) {
            try {
                const execId = await this.startWorkflow(
                    workflowDef.name,
                    {
                        event,
                        eventPayload: event.payload,
                        eventMetadata: event.metadata,
                    },
                    {
                        triggerEvent: event,
                        continueOnError: options.continueOnError,
                    },
                );
                executionIds.push(execId);
            } catch (err) {
                this.logger.error?.(
                    `[WorkflowEngine] Failed to start workflow "${workflowDef.name}" for event "${event.type}": ${err.message}`,
                    err,
                );
            }
        }

        return executionIds;
    }

    /**
     * Attach to the configured message bus and subscribe for events.
     * This sets up a wildcard subscription and converts each bus
     * message into a workflow event.
     */
    attachToMessageBus() {
        if (!this.messageBus || typeof this.messageBus.subscribe !== 'function') {
            return;
        }

        // Avoid duplicate subscriptions.
        if (this._busSubscriptionId) {
            return;
        }

        // Subscribe to all channels; workflow selection is done by trigger patterns.
        this._busSubscriptionId = this.messageBus.subscribe('*', (message, channel) => {
            const event = {
                type: channel,
                payload: message && message.data,
                metadata: message && message.metadata,
            };

            this.handleEvent(event).catch((err) => {
                this.logger.error?.(
                    `[WorkflowEngine] Error handling event from message bus on channel "${channel}": ${err.message}`,
                    err,
                );
            });
        });
    }

    /**
     * Emit an event onto the message bus (if available).
     *
     * @param {string} type Channel / event type.
     * @param {any} payload
     * @param {Object} [metadata]
     * @returns {Promise<boolean>}
     */
    async emitEvent(type, payload, metadata = {}) {
        if (!this.messageBus || typeof this.messageBus.publish !== 'function') {
            this._debug(`emitEvent(${type}) called without a configured messageBus – logging only.`);
            this.logger.info?.(`[WorkflowEngine] Event (no bus): ${type}`, { payload, metadata });
            return false;
        }

        try {
            await this.messageBus.publish(type, payload, { metadata });
            return true;
        } catch (err) {
            this.logger.error?.(
                `[WorkflowEngine] Failed to publish event "${type}" to message bus: ${err.message}`,
                err,
            );
            return false;
        }
    }

    /**
     * Get the current status of a workflow execution.
     *
     * @param {string} executionId
     * @returns {object}
     */
    getWorkflowStatus(executionId) {
        const instance = this.runningWorkflows.get(executionId);
        if (!instance) {
            // Fall back to history.
            const historic = this.workflowHistory.find((wf) => wf.id === executionId);
            if (!historic) {
                throw new Error(`WorkflowEngine.getWorkflowStatus: workflow not found: ${executionId}`);
            }
            return this._summarizeInstance(historic);
        }
        return this._summarizeInstance(instance);
    }

    /**
     * Cancel a running workflow.
     *
     * @param {string} executionId
     * @returns {boolean} True if cancelled, false if not found or already completed.
     */
    cancelWorkflow(executionId) {
        const instance = this.runningWorkflows.get(executionId);
        if (!instance || instance.status !== 'running') {
            return false;
        }

        instance.status = 'cancelled';
        instance.updatedAt = Date.now();
        instance.completedAt = Date.now();
        this._log(instance, 'info', 'Workflow cancelled by caller');

        this._finalizeInstance(executionId);
        return true;
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /**
     * Execute all steps in a workflow instance sequentially.
     *
     * @param {string} executionId
     * @param {Object} options
     * @param {boolean} [options.continueOnError=false]
     * @private
     */
    async _runWorkflowInstance(executionId, options) {
        const instance = this.runningWorkflows.get(executionId);
        if (!instance) {
            throw new Error(`WorkflowEngine._runWorkflowInstance: instance not found: ${executionId}`);
        }

        instance.status = 'running';
        instance.updatedAt = Date.now();

        const { steps } = instance.definition;
        const continueOnError = Boolean(options && options.continueOnError);

        for (let i = 0; i < steps.length; i += 1) {
            const stepDef = steps[i];
            const stepState = instance.steps[i];
            instance.currentStepIndex = i;
            instance.updatedAt = Date.now();

            const helpers = this._createHelpers(instance);

            const maxAttempts =
                typeof stepDef.retry === 'number' && stepDef.retry >= 0 ? stepDef.retry + 1 : 1;

            let attempt = 0;
            let lastError = null;

            while (attempt < maxAttempts) {
                attempt += 1;
                stepState.status = 'running';
                stepState.startedAt = Date.now();

                try {
                    this._log(instance, 'info', `Starting step "${stepDef.id}" (attempt ${attempt}/${maxAttempts})`);

                    const runPromise = Promise.resolve(stepDef.run(instance.context, helpers));
                    const result =
                        typeof stepDef.timeoutMs === 'number' && stepDef.timeoutMs > 0
                            ? await this._withTimeout(
                                  runPromise,
                                  stepDef.timeoutMs,
                                  `Step "${stepDef.id}" in workflow "${instance.name}" timed out after ${stepDef.timeoutMs}ms`,
                              )
                            : await runPromise;

                    instance.context.stepResults[stepDef.id] = result;
                    stepState.status = 'completed';
                    stepState.completedAt = Date.now();
                    instance.updatedAt = Date.now();

                    this._log(instance, 'info', `Completed step "${stepDef.id}"`, {
                        attempt,
                    });

                    lastError = null;
                    break; // step succeeded
                } catch (err) {
                    lastError = err;
                    this._log(instance, 'error', `Step "${stepDef.id}" failed on attempt ${attempt}: ${err.message}`, {
                        stack: err.stack,
                    });

                    if (typeof stepDef.onError === 'function') {
                        try {
                            await stepDef.onError(err, instance.context, helpers);
                        } catch (handlerErr) {
                            this._log(
                                instance,
                                'error',
                                `onError handler for step "${stepDef.id}" threw: ${handlerErr.message}`,
                                { stack: handlerErr.stack },
                            );
                        }
                    }

                    if (attempt >= maxAttempts) {
                        stepState.status = 'failed';
                        stepState.completedAt = Date.now();
                        instance.updatedAt = Date.now();

                        instance.status = 'failed';
                        instance.error = { message: err.message, stack: err.stack };

                        if (!continueOnError) {
                            this._finalizeInstance(executionId);
                            throw err;
                        }

                        // Continue-on-error: log and move to next step.
                        break;
                    }
                }
            }

            // If workflow marked cancelled externally, stop processing.
            if (instance.status === 'cancelled') {
                this._log(instance, 'info', 'Stopping workflow execution due to cancellation');
                this._finalizeInstance(executionId);
                return;
            }

            // If we are continuing on error, but this step failed permanently,
            // record the last error and proceed.
            if (lastError && continueOnError) {
                this._log(
                    instance,
                    'warn',
                    `Proceeding to next step despite failure in "${stepDef.id}" because continueOnError=true`,
                );
            }
        }

        if (instance.status !== 'failed' && instance.status !== 'cancelled') {
            instance.status = 'completed';
            instance.completedAt = Date.now();
            instance.updatedAt = Date.now();
            this._log(instance, 'info', 'Workflow completed successfully');
        }

        this._finalizeInstance(executionId);
    }

    /**
     * Create the helpers object passed into each workflow step.
     *
     * @param {WorkflowInstance} instance
     * @returns {Object}
     * @private
     */
    _createHelpers(instance) {
        const engine = this;

        return {
            agentManager: this.agentManager,
            agentRegistry: this.agentRegistry,
            messageBus: this.messageBus,
            integrations: this.integrations || {},
            workflowRegistry: this.workflowRegistry,

            /**
             * Start another workflow from within a step.
             * @param {string} name
             * @param {Object} context
             * @returns {Promise<string>}
             */
            startWorkflow(name, context) {
                return engine.startWorkflow(name, context, {
                    triggerEvent: {
                        type: 'workflow:chained',
                        payload: { parentWorkflowId: instance.id, parentWorkflowName: instance.name },
                    },
                });
            },

            /**
             * Emit an event through the engine.
             * @param {string} type
             * @param {any} payload
             * @param {Object} metadata
             * @returns {Promise<boolean>}
             */
            emitEvent(type, payload, metadata) {
                return engine.emitEvent(type, payload, {
                    ...(metadata || {}),
                    workflowId: instance.id,
                    workflowName: instance.name,
                });
            },

            /**
             * Convenience helper to invoke an agent through the AgentManager
             * if one is configured. This is intentionally generic so that
             * individual workflows can decide how to interpret agent types
             * and tasks.
             *
             * @param {string} agentType
             * @param {Object} task
             * @param {Object} [options]
             * @returns {Promise<any>}
             */
            async invokeAgent(agentType, task, options = {}) {
                if (!engine.agentManager || typeof engine.agentManager.distributeTask !== 'function') {
                    // Fallback stub for environments without a real AgentManager.
                    engine._debug(
                        `invokeAgent(${agentType}) called without a configured AgentManager – returning stub result`,
                    );
                    return {
                        agentType,
                        task,
                        simulated: true,
                    };
                }

                const requirements = {
                    type: agentType,
                    ...(options.requirements || {}),
                };

                const assignedAgentId = await engine.agentManager.distributeTask(task, requirements);
                return {
                    agentId: assignedAgentId,
                    agentType,
                };
            },
        };
    }

    /**
     * Wrap a promise with a timeout.
     *
     * @param {Promise<any>} promise
     * @param {number} timeoutMs
     * @param {string} timeoutMessage
     * @returns {Promise<any>}
     * @private
     */
    _withTimeout(promise, timeoutMs, timeoutMessage) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`)),
                timeoutMs,
            );

            promise
                .then((value) => {
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    /**
     * Move a workflow instance from the running map into history.
     *
     * @param {string} executionId
     * @private
     */
    _finalizeInstance(executionId) {
        const instance = this.runningWorkflows.get(executionId);
        if (!instance) {
            return;
        }

        this.workflowHistory.push({ ...instance });
        this.runningWorkflows.delete(executionId);

        // Limit history size.
        if (this.workflowHistory.length > 100) {
            this.workflowHistory.shift();
        }
    }

    /**
     * Summarize a workflow instance for external callers.
     *
     * @param {WorkflowInstance} instance
     * @returns {object}
     * @private
     */
    _summarizeInstance(instance) {
        return {
            id: instance.id,
            name: instance.name,
            status: instance.status,
            startedAt: instance.startedAt,
            updatedAt: instance.updatedAt,
            completedAt: instance.completedAt,
            currentStepIndex: instance.currentStepIndex,
            totalSteps: instance.steps.length,
            steps: instance.steps.map((s) => ({
                id: s.id,
                description: s.description,
                status: s.status,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
            })),
            error: instance.error,
        };
    }

    /**
     * Log a message against a workflow instance and to the shared logger.
     *
     * @param {WorkflowInstance} instance
     * @param {'info'|'warn'|'error'|'debug'} level
     * @param {string} message
     * @param {any} [meta]
     * @private
     */
    _log(instance, level, message, meta) {
        const entry = {
            timestamp: Date.now(),
            level,
            message,
            meta,
        };
        instance.logs.push(entry);

        const prefix = `[WorkflowEngine][${instance.name}][${instance.id}]`;
        switch (level) {
            case 'error':
                this.logger.error?.(`${prefix} ${message}`, meta);
                break;
            case 'warn':
                this.logger.warn?.(`${prefix} ${message}`, meta);
                break;
            case 'debug':
                this.logger.debug?.(`${prefix} ${message}`, meta);
                break;
            default:
                this.logger.info?.(`${prefix} ${message}`, meta);
        }
    }

    /**
     * Internal debug helper.
     * @param {string} msg
     * @private
     */
    _debug(msg) {
        if (this.logger && typeof this.logger.debug === 'function') {
            this.logger.debug(`[WorkflowEngine] ${msg}`);
        }
    }
}

// Default engine instance using the default registry.
// NOTE: Dependencies like agentManager, agentRegistry, and messageBus are
// intentionally not wired here. They should be injected by higher-level
// systems or by the demo harness.
const defaultEngine = new WorkflowEngine({ workflowRegistry: defaultRegistry });

module.exports = defaultEngine;
module.exports.WorkflowEngine = WorkflowEngine;
module.exports.defaultEngine = defaultEngine;
/**
 * Factory for creating a new WorkflowEngine with custom dependencies.
 * @param {Object} options
 * @returns {WorkflowEngine}
 */
module.exports.createEngine = (options = {}) => new WorkflowEngine(options);

/**
 * Register the default Cipher Guard workflows into the provided registry,
 * using the supplied engine instance if needed.
 *
 * This is a convenience helper for wiring up the canonical workflows.
 *
 * @param {Object} [options]
 * @param {import('./workflow_registry').WorkflowRegistry} [options.registry]
 * @param {WorkflowEngine} [options.engine]
 * @returns {WorkflowDefinition[]} The registered workflow definitions.
 */
module.exports.registerDefaultWorkflows = function registerDefaultWorkflows(options = {}) {
    const registry = options.registry || defaultRegistry;

    // Lazy-load templates to avoid circular dependencies on module load.
    const emailResponseWorkflow = require('./workflow_templates/email_response_workflow');
    const threatContainmentWorkflow = require('./workflow_templates/threat_containment_workflow');
    const vulnerabilityManagementWorkflow = require('./workflow_templates/vulnerability_management_workflow');
    const threatHuntingWorkflow = require('./workflow_templates/threat_hunting_workflow');
    const reportingWorkflow = require('./workflow_templates/reporting_workflow');

    const definitions = [
        emailResponseWorkflow,
        threatContainmentWorkflow,
        vulnerabilityManagementWorkflow,
        threatHuntingWorkflow,
        reportingWorkflow,
    ];

    definitions.forEach((def) => {
        try {
            registry.registerWorkflow(def);
        } catch (err) {
            // Log but continue with other workflows.
            // Use console here to avoid potential logger cycles during startup.
            // eslint-disable-next-line no-console
            console.error(`[WorkflowEngine] Failed to register workflow "${def && def.name}": ${err.message}`);
        }
    });

    // Engine-level registration is not strictly required since the engine
    // always resolves definitions through the registry, but callers may
    // still want to inject the registry into a specific engine instance.
    if (options.engine instanceof WorkflowEngine) {
        options.engine.workflowRegistry = registry;
    }

    return definitions;
};