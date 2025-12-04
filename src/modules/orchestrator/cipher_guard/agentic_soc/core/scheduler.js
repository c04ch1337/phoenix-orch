/**
 * Scheduler
 * 
 * Provides task scheduling, recurring jobs, and temporal management for the
 * Agentic SOC. Supports prioritization, dependency management, and resource
 * allocation for security tasks.
 */

class Scheduler {
    constructor() {
        this.tasks = new Map();
        this.recurringJobs = new Map();
        this.executingTasks = new Map();
        this.taskQueue = [];
        
        this.config = {
            maxConcurrentTasks: 10,
            maxRetries: 3,
            retryDelayMs: 5000,
            priorityLevels: {
                critical: 0,
                high: 1,
                medium: 2,
                low: 3
            },
            defaultPriority: 2 // medium
        };
        
        this.initialized = false;
        this._intervalId = null;
    }
    
    /**
     * Initialize the scheduler
     * @param {object} config Configuration options
     * @returns {Promise<void>}
     */
    async initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Start the scheduler tick
        this._intervalId = setInterval(() => this._tick(), 1000);
        
        this.initialized = true;
        console.log('Scheduler initialized successfully');
    }
    
    /**
     * Schedule a task to run at a specific time
     * @param {string} taskId Unique task identifier
     * @param {Function} taskFn Task function to execute
     * @param {Date|number} scheduledTime When to run the task (Date or timestamp)
     * @param {object} options Task options
     * @returns {Promise<string>} Task ID
     */
    async scheduleTask(taskId, taskFn, scheduledTime, options = {}) {
        this._checkInitialized();
        
        if (this.tasks.has(taskId)) {
            throw new Error(`Task with ID ${taskId} already exists`);
        }
        
        // Convert scheduledTime to Date if it's a number
        const execTime = scheduledTime instanceof Date 
            ? scheduledTime 
            : new Date(scheduledTime);
        
        // Create the task object
        const task = {
            id: taskId,
            fn: taskFn,
            scheduledTime: execTime,
            priority: options.priority !== undefined 
                ? options.priority 
                : this.config.defaultPriority,
            retries: 0,
            maxRetries: options.maxRetries !== undefined 
                ? options.maxRetries 
                : this.config.maxRetries,
            dependencies: options.dependencies || [],
            resources: options.resources || [],
            metadata: options.metadata || {},
            createdAt: new Date(),
            status: 'scheduled'
        };
        
        // Store the task
        this.tasks.set(taskId, task);
        
        // Add to the task queue if it's time to execute
        if (execTime <= new Date()) {
            this._addToQueue(task);
        }
        
        return taskId;
    }
    
    /**
     * Schedule a recurring job
     * @param {string} jobId Unique job identifier
     * @param {Function} jobFn Job function to execute
     * @param {string} schedule Schedule expression (cron-like)
     * @param {object} options Job options
     * @returns {Promise<string>} Job ID
     */
    async scheduleRecurringJob(jobId, jobFn, schedule, options = {}) {
        this._checkInitialized();
        
        if (this.recurringJobs.has(jobId)) {
            throw new Error(`Recurring job with ID ${jobId} already exists`);
        }
        
        // Parse the schedule
        const parsedSchedule = this._parseSchedule(schedule);
        
        // Create the job object
        const job = {
            id: jobId,
            fn: jobFn,
            schedule: parsedSchedule,
            originalSchedule: schedule,
            priority: options.priority !== undefined 
                ? options.priority 
                : this.config.defaultPriority,
            resources: options.resources || [],
            metadata: options.metadata || {},
            lastExecuted: null,
            nextExecution: this._calculateNextExecution(parsedSchedule),
            createdAt: new Date(),
            status: 'active'
        };
        
        // Store the job
        this.recurringJobs.set(jobId, job);
        
        return jobId;
    }
    
    /**
     * Cancel a scheduled task
     * @param {string} taskId Task ID to cancel
     * @returns {Promise<boolean>} Success status
     */
    async cancelTask(taskId) {
        this._checkInitialized();
        
        // Remove from tasks map
        const removed = this.tasks.delete(taskId);
        
        // Also remove from queue if it's there
        this.taskQueue = this.taskQueue.filter(task => task.id !== taskId);
        
        return removed;
    }
    
    /**
     * Cancel a recurring job
     * @param {string} jobId Job ID to cancel
     * @returns {Promise<boolean>} Success status
     */
    async cancelRecurringJob(jobId) {
        this._checkInitialized();
        
        // Remove from recurring jobs map
        const removed = this.recurringJobs.delete(jobId);
        
        return removed;
    }
    
    /**
     * Get task status
     * @param {string} taskId Task ID
     * @returns {Promise<object>} Task status
     */
    async getTaskStatus(taskId) {
        this._checkInitialized();
        
        // Check in tasks map
        if (this.tasks.has(taskId)) {
            const task = this.tasks.get(taskId);
            return {
                id: task.id,
                status: task.status,
                scheduledTime: task.scheduledTime,
                createdAt: task.createdAt,
                priority: task.priority,
                retries: task.retries,
                metadata: task.metadata
            };
        }
        
        // Check in executing tasks
        if (this.executingTasks.has(taskId)) {
            const task = this.executingTasks.get(taskId);
            return {
                id: task.id,
                status: 'executing',
                scheduledTime: task.scheduledTime,
                startedAt: task.startedAt,
                createdAt: task.createdAt,
                priority: task.priority,
                retries: task.retries,
                metadata: task.metadata
            };
        }
        
        throw new Error(`Task with ID ${taskId} not found`);
    }
    
    /**
     * Get recurring job status
     * @param {string} jobId Job ID
     * @returns {Promise<object>} Job status
     */
    async getRecurringJobStatus(jobId) {
        this._checkInitialized();
        
        if (!this.recurringJobs.has(jobId)) {
            throw new Error(`Recurring job with ID ${jobId} not found`);
        }
        
        const job = this.recurringJobs.get(jobId);
        return {
            id: job.id,
            status: job.status,
            schedule: job.originalSchedule,
            lastExecuted: job.lastExecuted,
            nextExecution: job.nextExecution,
            createdAt: job.createdAt,
            metadata: job.metadata
        };
    }
    
    /**
     * Get all scheduled tasks
     * @returns {Promise<array>} Scheduled tasks
     */
    async getScheduledTasks() {
        this._checkInitialized();
        
        return Array.from(this.tasks.values()).map(task => ({
            id: task.id,
            status: task.status,
            scheduledTime: task.scheduledTime,
            createdAt: task.createdAt,
            priority: task.priority,
            metadata: task.metadata
        }));
    }
    
    /**
     * Get all recurring jobs
     * @returns {Promise<array>} Recurring jobs
     */
    async getRecurringJobs() {
        this._checkInitialized();
        
        return Array.from(this.recurringJobs.values()).map(job => ({
            id: job.id,
            status: job.status,
            schedule: job.originalSchedule,
            lastExecuted: job.lastExecuted,
            nextExecution: job.nextExecution,
            createdAt: job.createdAt,
            metadata: job.metadata
        }));
    }
    
    /**
     * Shutdown the scheduler
     * @returns {Promise<void>}
     */
    async shutdown() {
        // Stop the scheduler tick
        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
        
        this.initialized = false;
        console.log('Scheduler shut down successfully');
    }
    
    /**
     * The scheduler tick - runs periodically to check for tasks to execute
     * @private
     */
    async _tick() {
        try {
            // Check for one-time tasks that are ready to execute
            for (const [taskId, task] of this.tasks.entries()) {
                if (task.scheduledTime <= new Date()) {
                    this._addToQueue(task);
                }
            }
            
            // Check for recurring jobs that are ready to execute
            for (const [jobId, job] of this.recurringJobs.entries()) {
                if (job.status === 'active' && job.nextExecution <= new Date()) {
                    // Create a task from the job
                    const taskId = `${jobId}-${Date.now()}`;
                    const task = {
                        id: taskId,
                        fn: job.fn,
                        scheduledTime: job.nextExecution,
                        priority: job.priority,
                        retries: 0,
                        maxRetries: this.config.maxRetries,
                        dependencies: [],
                        resources: job.resources,
                        metadata: {
                            jobId,
                            recurring: true,
                            ...job.metadata
                        },
                        createdAt: new Date(),
                        status: 'scheduled'
                    };
                    
                    // Store the task and add it to the queue
                    this.tasks.set(taskId, task);
                    this._addToQueue(task);
                    
                    // Update the job's next execution time
                    job.lastExecuted = new Date();
                    job.nextExecution = this._calculateNextExecution(job.schedule);
                    this.recurringJobs.set(jobId, job);
                }
            }
            
            // Process the task queue
            this._processQueue();
        } catch (error) {
            console.error('Error in scheduler tick:', error);
        }
    }
    
    /**
     * Add a task to the execution queue
     * @param {object} task Task to add
     * @private
     */
    _addToQueue(task) {
        // Only add if not already in queue
        if (!this.taskQueue.some(t => t.id === task.id)) {
            this.taskQueue.push(task);
            
            // Sort the queue by priority
            this.taskQueue.sort((a, b) => a.priority - b.priority);
            
            task.status = 'queued';
        }
    }
    
    /**
     * Process the task queue
     * @private
     */
    async _processQueue() {
        // Only process if there are tasks in the queue and not at max concurrent limit
        while (this.taskQueue.length > 0 && 
               this.executingTasks.size < this.config.maxConcurrentTasks) {
            // Get the next task
            const task = this.taskQueue.shift();
            
            // Check if dependencies are satisfied
            if (task.dependencies && task.dependencies.length > 0) {
                const dependenciesSatisfied = this._checkDependencies(task.dependencies);
                if (!dependenciesSatisfied) {
                    // Put it back in the queue
                    this.taskQueue.push(task);
                    continue;
                }
            }
            
            // Execute the task
            this._executeTask(task);
        }
    }
    
    /**
     * Execute a task
     * @param {object} task Task to execute
     * @private
     */
    async _executeTask(task) {
        // Move task from tasks to executing tasks
        this.tasks.delete(task.id);
        
        // Update task status
        task.status = 'executing';
        task.startedAt = new Date();
        
        // Add to executing tasks
        this.executingTasks.set(task.id, task);
        
        try {
            // Execute the task function
            const result = await Promise.resolve(task.fn());
            
            // Task completed successfully
            this._onTaskComplete(task.id, result);
        } catch (error) {
            // Task failed
            this._onTaskError(task.id, error);
        }
    }
    
    /**
     * Handle task completion
     * @param {string} taskId Task ID
     * @param {any} result Task result
     * @private
     */
    _onTaskComplete(taskId, result) {
        if (!this.executingTasks.has(taskId)) return;
        
        const task = this.executingTasks.get(taskId);
        this.executingTasks.delete(taskId);
        
        // For recurring tasks (created from a job), we don't need to store them
        if (task.metadata && task.metadata.recurring) {
            return;
        }
        
        // Otherwise update task status
        task.status = 'completed';
        task.completedAt = new Date();
        task.result = result;
        
        // Store completed task for history
        this.tasks.set(taskId, task);
    }
    
    /**
     * Handle task error
     * @param {string} taskId Task ID
     * @param {Error} error Task error
     * @private
     */
    _onTaskError(taskId, error) {
        if (!this.executingTasks.has(taskId)) return;
        
        const task = this.executingTasks.get(taskId);
        this.executingTasks.delete(taskId);
        
        // Check if we should retry
        if (task.retries < task.maxRetries) {
            // Increment retries and reschedule
            task.retries += 1;
            task.status = 'scheduled';
            task.scheduledTime = new Date(Date.now() + this.config.retryDelayMs);
            task.lastError = {
                message: error.message,
                stack: error.stack,
                time: new Date()
            };
            
            // Store updated task
            this.tasks.set(taskId, task);
        } else {
            // Max retries reached, mark as failed
            task.status = 'failed';
            task.completedAt = new Date();
            task.error = {
                message: error.message,
                stack: error.stack,
                time: new Date()
            };
            
            // Store failed task for history
            this.tasks.set(taskId, task);
        }
    }
    
    /**
     * Check if task dependencies are satisfied
     * @param {array} dependencies Task dependencies
     * @returns {boolean} Whether dependencies are satisfied
     * @private
     */
    _checkDependencies(dependencies) {
        // In a real implementation, this would check if all dependencies have completed
        // For this placeholder, we'll assume they are always satisfied
        return true;
    }
    
    /**
     * Parse a schedule expression
     * @param {string} schedule Schedule expression
     * @returns {object} Parsed schedule
     * @private
     */
    _parseSchedule(schedule) {
        // In a real implementation, this would parse cron-like expressions
        // For this placeholder, we'll just return a simple interval-based schedule
        
        // Handle some basic schedule types
        if (schedule === 'hourly') {
            return { interval: 60 * 60 * 1000 }; // 1 hour
        } else if (schedule === 'daily') {
            return { interval: 24 * 60 * 60 * 1000 }; // 24 hours
        } else if (schedule.startsWith('every')) {
            // Parse 'every X minutes/hours/days'
            const parts = schedule.split(' ');
            if (parts.length === 3) {
                const number = parseInt(parts[1], 10);
                const unit = parts[2];
                
                if (!isNaN(number)) {
                    if (unit === 'minutes' || unit === 'minute') {
                        return { interval: number * 60 * 1000 };
                    } else if (unit === 'hours' || unit === 'hour') {
                        return { interval: number * 60 * 60 * 1000 };
                    } else if (unit === 'days' || unit === 'day') {
                        return { interval: number * 24 * 60 * 60 * 1000 };
                    }
                }
            }
        }
        
        // Default to hourly if we can't parse
        return { interval: 60 * 60 * 1000 };
    }
    
    /**
     * Calculate next execution time for a job
     * @param {object} schedule Parsed schedule
     * @returns {Date} Next execution time
     * @private
     */
    _calculateNextExecution(schedule) {
        // For our simple interval-based schedule, just add the interval to now
        return new Date(Date.now() + schedule.interval);
    }
    
    /**
     * Check if the scheduler is initialized
     * @private
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('Scheduler is not initialized');
        }
    }
}

module.exports = new Scheduler();