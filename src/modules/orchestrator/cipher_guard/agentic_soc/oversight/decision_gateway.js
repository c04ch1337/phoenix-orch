/**
 * Decision Gateway
 * 
 * Manages security decisions that require approval from Dad.
 * Evaluates decision requests, determines risk levels, and enforces
 * governance for critical security actions.
 */

class DecisionGateway {
    constructor() {
        this.decisionHistory = [];
        this.pendingDecisions = new Map();
        this.preApprovedPatterns = new Map();
        
        // Risk level definitions
        this.riskLevels = {
            'minimal': {
                description: 'No meaningful risk to systems or data',
                autoApproveDefault: true,
                examples: ['Reading logs', 'Running scans on test systems']
            },
            'low': {
                description: 'Limited risk with minimal potential impact',
                autoApproveDefault: true,
                examples: ['Routine scanning', 'Basic log analysis actions']
            },
            'medium': {
                description: 'Moderate risk with potential localized impact',
                autoApproveDefault: false,
                examples: ['System isolation', 'Process termination']
            },
            'high': {
                description: 'Significant risk with potential widespread impact',
                autoApproveDefault: false,
                examples: ['Network isolation', 'Service shutdown']
            },
            'critical': {
                description: 'Extreme risk with potential organization-wide impact',
                autoApproveDefault: false,
                examples: ['Complete system shutdown', 'Disconnecting from internet']
            }
        };
    }
    
    /**
     * Assess the risk level of an action
     * @param {object} action The action to evaluate
     * @param {object} context Additional context for the decision
     * @returns {string} Risk level assessment ('minimal', 'low', 'medium', 'high', 'critical')
     */
    assessRisk(action, context = {}) {
        if (!action || !action.type) {
            throw new Error('Invalid action object');
        }
        
        // Calculate risk based on various factors
        let riskScore = this._calculateBaseRisk(action);
        
        // Apply context modifiers
        riskScore = this._applyContextModifiers(riskScore, action, context);
        
        // Convert score to risk level
        return this._scoreToRiskLevel(riskScore);
    }
    
    /**
     * Submit a decision for approval
     * @param {object} decision Decision details
     * @param {function} callback Function to call when decision is made
     * @returns {string} Decision request ID
     */
    submitDecision(decision, callback) {
        if (!decision.action || !decision.context) {
            throw new Error('Invalid decision request: missing action or context');
        }
        
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        // Generate decision ID
        const decisionId = `dec-${Date.now()}`;
        
        // Assess risk
        const riskLevel = this.assessRisk(decision.action, decision.context);
        
        // Check for pre-approved pattern
        const isPreApproved = this._checkPreApprovalPattern(decision);
        
        // Format decision request
        const decisionRequest = {
            id: decisionId,
            action: decision.action,
            context: decision.context,
            riskLevel,
            submittedAt: new Date().toISOString(),
            status: 'pending',
            isPreApproved,
            callback
        };
        
        // Store pending decision
        this.pendingDecisions.set(decisionId, decisionRequest);
        
        // If pre-approved or minimal/low risk with auto-approve default, approve automatically
        if (isPreApproved || (this.riskLevels[riskLevel].autoApproveDefault)) {
            this._resolveDecision(decisionId, {
                approved: true,
                approver: 'system',
                reason: isPreApproved ? 'Pre-approved pattern' : `Auto-approved ${riskLevel} risk action`
            });
        }
        
        return decisionId;
    }
    
    /**
     * Get the status of a pending decision
     * @param {string} decisionId Decision ID
     * @returns {object} Decision status
     */
    getDecisionStatus(decisionId) {
        const decision = this.pendingDecisions.get(decisionId) || 
            this.decisionHistory.find(d => d.id === decisionId);
        
        if (!decision) {
            throw new Error(`Decision not found: ${decisionId}`);
        }
        
        return {
            id: decision.id,
            status: decision.status,
            riskLevel: decision.riskLevel,
            submittedAt: decision.submittedAt,
            resolvedAt: decision.resolvedAt,
            result: decision.result
        };
    }
    
    /**
     * Register a pre-approved pattern
     * @param {object} pattern Pattern to pre-approve
     * @param {string} expiration ISO timestamp when the pre-approval expires
     * @returns {string} Pattern ID
     */
    registerPreApprovalPattern(pattern, expiration = null) {
        if (!pattern.actionType) {
            throw new Error('Invalid pre-approval pattern: missing actionType');
        }
        
        const patternId = `pattern-${Date.now()}`;
        
        this.preApprovedPatterns.set(patternId, {
            id: patternId,
            pattern,
            createdAt: new Date().toISOString(),
            expiration,
            status: 'active'
        });
        
        return patternId;
    }
    
    /**
     * Resolve a pending decision
     * @param {string} decisionId Decision ID
     * @param {object} result Decision result
     * @private
     */
    _resolveDecision(decisionId, result) {
        const decision = this.pendingDecisions.get(decisionId);
        
        if (!decision) {
            throw new Error(`Decision not found: ${decisionId}`);
        }
        
        // Update decision with result
        decision.status = 'resolved';
        decision.resolvedAt = new Date().toISOString();
        decision.result = result;
        
        // Move to history
        this.decisionHistory.push({ ...decision });
        this.pendingDecisions.delete(decisionId);
        
        // Execute callback
        try {
            decision.callback(null, result);
        } catch (error) {
            console.error(`Error executing decision callback for ${decisionId}:`, error);
        }
    }
    
    /**
     * Calculate the base risk score for an action
     * @param {object} action Action to evaluate
     * @returns {number} Base risk score
     * @private
     */
    _calculateBaseRisk(action) {
        // Base scores for different action types
        const baseScores = {
            'scan': 10,
            'monitor': 10,
            'analyze': 15,
            'alert': 20,
            'isolate': 60,
            'block': 50,
            'terminate': 55,
            'delete': 70,
            'modify': 65,
            'shutdown': 80
        };
        
        // Get base score for the action type, default to 50 if unknown
        let score = baseScores[action.type] || 50;
        
        // Adjust based on scope
        if (action.scope === 'single') score *= 0.8;
        else if (action.scope === 'multiple') score *= 1.2;
        else if (action.scope === 'global') score *= 1.5;
        
        // Adjust based on target criticality
        if (action.targetCriticality === 'low') score *= 0.8;
        else if (action.targetCriticality === 'medium') score *= 1.0;
        else if (action.targetCriticality === 'high') score *= 1.3;
        else if (action.targetCriticality === 'critical') score *= 1.6;
        
        return score;
    }
    
    /**
     * Apply context modifiers to a risk score
     * @param {number} score Base risk score
     * @param {object} action Action being evaluated
     * @param {object} context Decision context
     * @returns {number} Modified risk score
     * @private
     */
    _applyContextModifiers(score, action, context) {
        let modifiedScore = score;
        
        // Incident response context can modify risk assessment
        if (context.incidentId) {
            // During active incidents, certain actions may be more justified
            modifiedScore *= 0.9;
        }
        
        // Confidence in the need for the action
        if (context.confidence === 'low') modifiedScore *= 1.2;
        else if (context.confidence === 'medium') modifiedScore *= 1.0;
        else if (context.confidence === 'high') modifiedScore *= 0.9;
        
        // Time sensitivity
        if (context.timeWindow === 'immediate') modifiedScore *= 0.8;
        
        // Prior authorization
        if (context.authorized === true) modifiedScore *= 0.7;
        
        // Business hours vs. after hours
        if (context.afterHours === true) modifiedScore *= 1.2;
        
        return modifiedScore;
    }
    
    /**
     * Convert a risk score to a risk level
     * @param {number} score Risk score
     * @returns {string} Risk level
     * @private
     */
    _scoreToRiskLevel(score) {
        if (score < 20) return 'minimal';
        if (score < 40) return 'low';
        if (score < 60) return 'medium';
        if (score < 80) return 'high';
        return 'critical';
    }
    
    /**
     * Check if a decision matches a pre-approval pattern
     * @param {object} decision Decision to check
     * @returns {boolean} Whether the decision is pre-approved
     * @private
     */
    _checkPreApprovalPattern(decision) {
        const now = new Date().toISOString();
        
        for (const [patternId, patternData] of this.preApprovedPatterns.entries()) {
            // Skip expired or inactive patterns
            if (patternData.expiration && patternData.expiration < now) {
                continue;
            }
            
            if (patternData.status !== 'active') {
                continue;
            }
            
            // Check if pattern matches
            const pattern = patternData.pattern;
            
            // Must match action type
            if (pattern.actionType !== decision.action.type) {
                continue;
            }
            
            // Check additional pattern criteria
            let matches = true;
            
            // If pattern specifies scope, it must match
            if (pattern.scope && pattern.scope !== decision.action.scope) {
                matches = false;
            }
            
            // If pattern specifies target, it must match
            if (pattern.target && !this._matchesTarget(pattern.target, decision.action.target)) {
                matches = false;
            }
            
            if (matches) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if a target matches a pattern target
     * @private
     */
    _matchesTarget(patternTarget, decisionTarget) {
        if (typeof patternTarget === 'string') {
            return patternTarget === decisionTarget;
        }
        
        if (patternTarget instanceof RegExp) {
            return patternTarget.test(decisionTarget);
        }
        
        if (Array.isArray(patternTarget)) {
            return patternTarget.includes(decisionTarget);
        }
        
        return false;
    }
}

module.exports = new DecisionGateway();