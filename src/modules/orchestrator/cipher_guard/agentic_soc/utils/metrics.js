/**
 * Metrics Utilities
 * 
 * Provides metrics collection, calculation, and analysis capabilities
 * for monitoring performance, health, and effectiveness of the 
 * Agentic SOC system.
 */

class MetricsUtils {
    constructor() {
        // Initialize metrics storage
        this.metrics = new Map();
        
        // Track timing data
        this.timers = new Map();
        
        // Metrics configuration
        this.config = {
            disabledMetrics: new Set(),
            samplingRates: new Map(),
            defaultSamplingRate: 1.0, // 100%
            bufferSize: 1000,
            autoFlush: true,
            flushInterval: 60000 // 1 minute
        };
        
        // Placeholder for a flush interval timer
        this.flushTimer = null;
    }
    
    /**
     * Initialize metrics with configuration
     * @param {object} config Configuration options
     */
    initialize(config = {}) {
        this.config = { ...this.config, ...config };
        
        // Set up auto flush if enabled
        if (this.config.autoFlush) {
            this.startAutoFlush();
        }
    }
    
    /**
     * Start auto flush timer
     */
    startAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }
    
    /**
     * Stop auto flush timer
     */
    stopAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }
    
    /**
     * Record a counter metric
     * @param {string} name Metric name
     * @param {number} value Value to increment by (default: 1)
     * @param {object} tags Optional tags/dimensions
     */
    incrementCounter(name, value = 1, tags = {}) {
        if (this._shouldSkipMetric(name)) return;
        
        const key = this._getMetricKey(name, tags);
        
        if (!this.metrics.has(key)) {
            this.metrics.set(key, {
                name,
                type: 'counter',
                value: 0,
                tags,
                lastUpdated: Date.now()
            });
        }
        
        const metric = this.metrics.get(key);
        metric.value += value;
        metric.lastUpdated = Date.now();
    }
    
    /**
     * Record a gauge metric (point-in-time value)
     * @param {string} name Metric name
     * @param {number} value Value to record
     * @param {object} tags Optional tags/dimensions
     */
    recordGauge(name, value, tags = {}) {
        if (this._shouldSkipMetric(name)) return;
        
        const key = this._getMetricKey(name, tags);
        
        this.metrics.set(key, {
            name,
            type: 'gauge',
            value,
            tags,
            lastUpdated: Date.now()
        });
    }
    
    /**
     * Record a histogram sample
     * @param {string} name Metric name
     * @param {number} value Value to record
     * @param {object} tags Optional tags/dimensions
     */
    recordHistogram(name, value, tags = {}) {
        if (this._shouldSkipMetric(name)) return;
        
        const key = this._getMetricKey(name, tags);
        
        if (!this.metrics.has(key)) {
            this.metrics.set(key, {
                name,
                type: 'histogram',
                values: [],
                min: value,
                max: value,
                sum: 0,
                count: 0,
                tags,
                lastUpdated: Date.now()
            });
        }
        
        const metric = this.metrics.get(key);
        metric.values.push(value);
        metric.min = Math.min(metric.min, value);
        metric.max = Math.max(metric.max, value);
        metric.sum += value;
        metric.count++;
        metric.lastUpdated = Date.now();
        
        // Limit the size of the values array
        if (metric.values.length > this.config.bufferSize) {
            metric.values.shift();
        }
    }
    
    /**
     * Start timing an operation
     * @param {string} name Timer name
     * @param {object} tags Optional tags/dimensions
     * @returns {string} Timer ID
     */
    startTimer(name, tags = {}) {
        if (this._shouldSkipMetric(name)) return '';
        
        const timerId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        this.timers.set(timerId, {
            name,
            tags,
            startTime: process.hrtime(),
            active: true
        });
        
        return timerId;
    }
    
    /**
     * Stop timing an operation and record the duration
     * @param {string} timerId Timer ID from startTimer()
     * @returns {number} Duration in milliseconds
     */
    stopTimer(timerId) {
        if (!this.timers.has(timerId)) return 0;
        
        const timer = this.timers.get(timerId);
        if (!timer.active) return 0;
        
        const duration = this._calculateDuration(timer.startTime);
        timer.active = false;
        
        // Record the duration as a histogram
        this.recordHistogram(`${timer.name}.duration`, duration, timer.tags);
        
        return duration;
    }
    
    /**
     * Record an operation duration
     * @param {string} name Timer name
     * @param {number} durationMs Duration in milliseconds
     * @param {object} tags Optional tags/dimensions
     */
    recordTimer(name, durationMs, tags = {}) {
        this.recordHistogram(`${name}.duration`, durationMs, tags);
    }
    
    /**
     * Time a function execution
     * @param {string} name Timer name
     * @param {Function} fn Function to time
     * @param {object} tags Optional tags/dimensions
     * @returns {any} Function result
     */
    timeFunction(name, fn, tags = {}) {
        const timerId = this.startTimer(name, tags);
        
        try {
            const result = fn();
            
            // Handle promises
            if (result instanceof Promise) {
                return result.then(value => {
                    this.stopTimer(timerId);
                    return value;
                }).catch(error => {
                    this.stopTimer(timerId);
                    throw error;
                });
            }
            
            this.stopTimer(timerId);
            return result;
        } catch (error) {
            this.stopTimer(timerId);
            throw error;
        }
    }
    
    /**
     * Calculate percentile value for a histogram
     * @param {string} name Metric name
     * @param {number} percentile Percentile (0-100)
     * @param {object} tags Optional tags/dimensions
     * @returns {number|null} Percentile value or null if not found
     */
    getPercentile(name, percentile, tags = {}) {
        const key = this._getMetricKey(name, tags);
        
        if (!this.metrics.has(key)) return null;
        
        const metric = this.metrics.get(key);
        if (metric.type !== 'histogram' || metric.values.length === 0) return null;
        
        // Sort values (if not already sorted)
        const values = [...metric.values].sort((a, b) => a - b);
        
        const index = Math.ceil((percentile / 100) * values.length) - 1;
        return values[Math.max(0, Math.min(index, values.length - 1))];
    }
    
    /**
     * Get statistics for a histogram metric
     * @param {string} name Metric name
     * @param {object} tags Optional tags/dimensions
     * @returns {object|null} Metric statistics or null if not found
     */
    getHistogramStats(name, tags = {}) {
        const key = this._getMetricKey(name, tags);
        
        if (!this.metrics.has(key)) return null;
        
        const metric = this.metrics.get(key);
        if (metric.type !== 'histogram') return null;
        
        const mean = metric.count > 0 ? metric.sum / metric.count : 0;
        
        return {
            min: metric.min,
            max: metric.max,
            mean,
            count: metric.count,
            p50: this.getPercentile(name, 50, tags),
            p90: this.getPercentile(name, 90, tags),
            p95: this.getPercentile(name, 95, tags),
            p99: this.getPercentile(name, 99, tags)
        };
    }
    
    /**
     * Get the current value of a metric
     * @param {string} name Metric name
     * @param {object} tags Optional tags/dimensions
     * @returns {any} Metric value or null if not found
     */
    getMetric(name, tags = {}) {
        const key = this._getMetricKey(name, tags);
        
        if (!this.metrics.has(key)) return null;
        
        const metric = this.metrics.get(key);
        
        if (metric.type === 'histogram') {
            return this.getHistogramStats(name, tags);
        }
        
        return metric.value;
    }
    
    /**
     * Get all metrics
     * @returns {object} All metrics
     */
    getAllMetrics() {
        const result = {};
        
        for (const [key, metric] of this.metrics.entries()) {
            if (metric.type === 'histogram') {
                result[key] = this.getHistogramStats(metric.name, metric.tags);
            } else {
                result[key] = metric.value;
            }
        }
        
        return result;
    }
    
    /**
     * Reset a specific metric
     * @param {string} name Metric name
     * @param {object} tags Optional tags/dimensions
     */
    resetMetric(name, tags = {}) {
        const key = this._getMetricKey(name, tags);
        
        if (this.metrics.has(key)) {
            const metric = this.metrics.get(key);
            
            if (metric.type === 'counter' || metric.type === 'gauge') {
                metric.value = 0;
            } else if (metric.type === 'histogram') {
                metric.values = [];
                metric.min = 0;
                metric.max = 0;
                metric.sum = 0;
                metric.count = 0;
            }
            
            metric.lastUpdated = Date.now();
        }
    }
    
    /**
     * Reset all metrics
     */
    resetAllMetrics() {
        this.metrics.clear();
    }
    
    /**
     * Flush metrics to output targets
     * @returns {object} Flushed metrics
     */
    flush() {
        // In a real implementation, this would send metrics to external systems
        const allMetrics = this.getAllMetrics();
        
        // For this placeholder, we just return the current metrics
        return allMetrics;
    }
    
    /**
     * Enable or disable a metric
     * @param {string} name Metric name
     * @param {boolean} enabled Whether the metric is enabled
     */
    setMetricEnabled(name, enabled) {
        if (enabled) {
            this.config.disabledMetrics.delete(name);
        } else {
            this.config.disabledMetrics.add(name);
        }
    }
    
    /**
     * Set sampling rate for a metric
     * @param {string} name Metric name
     * @param {number} rate Sampling rate (0-1)
     */
    setSamplingRate(name, rate) {
        rate = Math.max(0, Math.min(1, rate));
        this.config.samplingRates.set(name, rate);
    }
    
    /**
     * Check if a metric should be skipped due to sampling
     * @param {string} name Metric name
     * @returns {boolean} Whether to skip this metric
     * @private
     */
    _shouldSkipMetric(name) {
        // Skip if disabled
        if (this.config.disabledMetrics.has(name)) {
            return true;
        }
        
        // Apply sampling rate
        const samplingRate = this.config.samplingRates.has(name)
            ? this.config.samplingRates.get(name)
            : this.config.defaultSamplingRate;
            
        // Skip based on sampling rate
        if (samplingRate < 1.0 && Math.random() > samplingRate) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Generate a unique key for a metric and its tags
     * @param {string} name Metric name
     * @param {object} tags Tags/dimensions
     * @returns {string} Unique metric key
     * @private
     */
    _getMetricKey(name, tags) {
        if (Object.keys(tags).length === 0) {
            return name;
        }
        
        // Sort tags by key for consistent ordering
        const sortedTags = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
            
        return `${name}{${sortedTags}}`;
    }
    
    /**
     * Calculate duration from a process.hrtime() start time
     * @param {[number, number]} startTime Start time from process.hrtime()
     * @returns {number} Duration in milliseconds
     * @private
     */
    _calculateDuration(startTime) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        return seconds * 1000 + nanoseconds / 1000000;
    }
}

module.exports = new MetricsUtils();