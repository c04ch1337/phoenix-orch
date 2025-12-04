/**
 * Intent Parser
 * 
 * Analyzes natural language input to determine the user's intent,
 * extracting entities, actions, and parameters for security operations.
 */

const modelRouter = require('../../models/model_router');

class IntentParser {
    constructor(config = {}) {
        this.config = {
            confidenceThreshold: 0.7,
            defaultLang: 'en',
            fallbackIntent: 'help',
            contextAware: true,
            ...config
        };
        
        // Predefined intents with their patterns and entities
        this.intentPatterns = {
            'analyze_threat': {
                patterns: ['analyze threat', 'check ioc', 'investigate indicator'],
                requiredEntities: ['threat_indicator'],
                optionalEntities: ['time_range', 'data_source']
            },
            'run_scan': {
                patterns: ['run scan', 'perform scan', 'scan for vulnerabilities'],
                requiredEntities: ['target'],
                optionalEntities: ['scan_type', 'depth', 'priority']
            },
            'contain_threat': {
                patterns: ['contain threat', 'isolate system', 'quarantine host'],
                requiredEntities: ['target'],
                optionalEntities: ['threat_type', 'isolation_type']
            },
            'report_incident': {
                patterns: ['report incident', 'create ticket', 'document event'],
                requiredEntities: ['incident_description'],
                optionalEntities: ['severity', 'affected_systems']
            },
            'status_check': {
                patterns: ['status update', 'check progress', 'get status'],
                requiredEntities: [],
                optionalEntities: ['task_id', 'time_range']
            }
        };
        
        // Entity extractors
        this.entityExtractors = {
            'threat_indicator': this.extractThreatIndicator.bind(this),
            'target': this.extractTarget.bind(this),
            'time_range': this.extractTimeRange.bind(this),
            'severity': this.extractSeverity.bind(this)
            // Additional extractors would be defined here
        };
    }
    
    /**
     * Parse natural language input to determine intent
     * @param {string} input The natural language input
     * @param {object} context Conversational context
     * @returns {Promise<object>} Parsed intent
     */
    async parseIntent(input, context = {}) {
        // First attempt simple pattern matching
        const simpleMatch = this.attemptPatternMatch(input);
        
        if (simpleMatch && simpleMatch.confidence > this.config.confidenceThreshold) {
            return this.enhanceIntentWithEntities(simpleMatch, input, context);
        }
        
        // If simple matching fails or has low confidence, use the AI model
        return this.parseWithModel(input, context);
    }
    
    /**
     * Attempt to match input using pattern matching
     * @private
     */
    attemptPatternMatch(input) {
        const normalizedInput = input.toLowerCase();
        
        for (const [intent, config] of Object.entries(this.intentPatterns)) {
            for (const pattern of config.patterns) {
                if (normalizedInput.includes(pattern)) {
                    return {
                        intent,
                        confidence: 0.8, // Simple pattern matches get decent confidence
                        entities: {},
                        rawInput: input
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Parse intent using AI model
     * @private
     */
    async parseWithModel(input, context) {
        try {
            const result = await modelRouter.routeTask('chat', {
                messages: [
                    {
                        role: 'system',
                        content: 'You are an intent classifier for a cybersecurity system. Identify the user\'s intent and extract relevant entities.'
                    },
                    {
                        role: 'user',
                        content: input
                    }
                ]
            }, { strategy: 'capability' });
            
            // Process model output to extract intent and entities
            // For now, we'll provide a placeholder
            return {
                intent: 'help',
                confidence: 0.7,
                entities: {},
                rawInput: input,
                modelProcessed: true
            };
        } catch (error) {
            console.error('Error parsing intent with model:', error);
            
            // Fallback to default intent
            return {
                intent: this.config.fallbackIntent,
                confidence: 0.3,
                entities: {},
                rawInput: input,
                error: error.message
            };
        }
    }
    
    /**
     * Enhance intent with extracted entities
     * @private
     */
    async enhanceIntentWithEntities(intentResult, input, context) {
        const { intent } = intentResult;
        const intentConfig = this.intentPatterns[intent];
        
        if (!intentConfig) {
            return intentResult;
        }
        
        // Extract entities
        const entities = {};
        
        // Extract required entities
        for (const entityName of intentConfig.requiredEntities) {
            if (this.entityExtractors[entityName]) {
                const extractedEntity = await this.entityExtractors[entityName](input, context);
                if (extractedEntity) {
                    entities[entityName] = extractedEntity;
                }
            }
        }
        
        // Extract optional entities
        for (const entityName of intentConfig.optionalEntities) {
            if (this.entityExtractors[entityName]) {
                const extractedEntity = await this.entityExtractors[entityName](input, context);
                if (extractedEntity) {
                    entities[entityName] = extractedEntity;
                }
            }
        }
        
        // Check if all required entities are present
        const missingEntities = intentConfig.requiredEntities.filter(
            entity => !entities[entity]
        );
        
        return {
            ...intentResult,
            entities,
            missingEntities: missingEntities.length > 0 ? missingEntities : null,
            complete: missingEntities.length === 0
        };
    }
    
    /**
     * Extract threat indicator entities
     * @private
     */
    async extractThreatIndicator(input, context) {
        // Simplified extraction for demonstration
        const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        const hashRegex = /\b[A-Fa-f0-9]{32,64}\b/;
        const urlRegex = /https?:\/\/[^\s]+/;
        
        // Try regex matches
        const ipMatch = input.match(ipRegex);
        if (ipMatch) {
            return { type: 'ip', value: ipMatch[0] };
        }
        
        const hashMatch = input.match(hashRegex);
        if (hashMatch) {
            return { type: 'hash', value: hashMatch[0] };
        }
        
        const urlMatch = input.match(urlRegex);
        if (urlMatch) {
            return { type: 'url', value: urlMatch[0] };
        }
        
        // If no matches with regex, we would use the AI model for more sophisticated extraction
        // For now, return null
        return null;
    }
    
    /**
     * Extract target entity
     * @private
     */
    async extractTarget(input, context) {
        // Simplified extraction - in a real implementation would use more sophisticated techniques
        // For now, look for common target indicators
        
        const hostnameRegex = /\b([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/;
        const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        
        // Check for hostname
        const hostnameMatch = input.match(hostnameRegex);
        if (hostnameMatch) {
            return { type: 'hostname', value: hostnameMatch[0] };
        }
        
        // Check for IP
        const ipMatch = input.match(ipRegex);
        if (ipMatch) {
            return { type: 'ip', value: ipMatch[0] };
        }
        
        // Check for common keywords
        const keywords = ['server', 'workstation', 'laptop', 'endpoint', 'device'];
        for (const keyword of keywords) {
            const regex = new RegExp(`\\b(${keyword})\\s+([a-zA-Z0-9-_]+)\\b`, 'i');
            const match = input.match(regex);
            if (match) {
                return { type: keyword, value: match[2] };
            }
        }
        
        return null;
    }
    
    /**
     * Extract time range entity
     * @private
     */
    async extractTimeRange(input, context) {
        // Simple time range extraction
        const timeRanges = {
            'last hour': { unit: 'hour', value: 1 },
            'last 24 hours': { unit: 'hour', value: 24 },
            'last day': { unit: 'day', value: 1 },
            'last week': { unit: 'week', value: 1 },
            'last month': { unit: 'month', value: 1 }
        };
        
        for (const [pattern, range] of Object.entries(timeRanges)) {
            if (input.toLowerCase().includes(pattern)) {
                return range;
            }
        }
        
        // Regex for specific patterns like "last X hours"
        const patternRegex = /last\s+(\d+)\s+(hour|day|week|month)s?/i;
        const match = input.match(patternRegex);
        
        if (match) {
            return {
                unit: match[2].toLowerCase(),
                value: parseInt(match[1], 10)
            };
        }
        
        return null;
    }
    
    /**
     * Extract severity entity
     * @private
     */
    async extractSeverity(input, context) {
        const severityLevels = ['critical', 'high', 'medium', 'low'];
        
        for (const level of severityLevels) {
            if (input.toLowerCase().includes(level)) {
                return level;
            }
        }
        
        return null;
    }
}

module.exports = new IntentParser();