/**
 * Priority Filter
 * 
 * Filters and prioritizes information sent to Dad, ensuring only important
 * items that require human oversight or decision-making are escalated.
 * Prevents information overload while ensuring critical items are addressed.
 */

class PriorityFilter {
    constructor() {
        this.priorityLevels = {
            'critical': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        };
        
        // Scoring rules determine how different factors contribute to priority
        this.scoringRules = {
            securityImpact: {
                'critical': 40,
                'high': 30,
                'medium': 20,
                'low': 10,
                'none': 0
            },
            businessImpact: {
                'critical': 30,
                'high': 25,
                'medium': 15,
                'low': 5,
                'none': 0
            },
            timeWindow: {
                'immediate': 25,
                'hours': 20,
                'day': 15,
                'week': 10,
                'indefinite': 0
            },
            confidenceLevel: {
                'confirmed': 15,
                'high': 10,
                'medium': 5,
                'low': -5,
                'speculative': -10
            },
            novelty: {
                'new_threat': 15,
                'variation': 10,
                'known': 0,
                'routine': -5
            }
        };
    }
    
    /**
     * Determine if an item should be escalated to Dad based on priority
     * @param {object} item The item to evaluate
     * @param {string} declaredPriority Explicitly declared priority ('critical', 'high', 'medium', 'low')
     * @param {string} minimumThreshold Minimum priority threshold for notification
     * @returns {boolean} Whether the item should be escalated
     */
    shouldNotify(item, declaredPriority, minimumThreshold = 'medium') {
        // If item has already been explicitly flagged for Dad's attention
        if (item.requiresDadAttention === true) {
            return true;
        }
        
        // Convert text threshold to numeric
        const thresholdValue = this.priorityLevels[minimumThreshold] || 2;
        
        // If declared priority exceeds threshold, notify
        if (declaredPriority && this.priorityLevels[declaredPriority] >= thresholdValue) {
            return true;
        }
        
        // Calculate a priority score based on item attributes
        const priorityScore = this._calculatePriorityScore(item);
        
        // Map score back to priority level
        let calculatedPriority;
        if (priorityScore >= 70) calculatedPriority = 'critical';
        else if (priorityScore >= 50) calculatedPriority = 'high';
        else if (priorityScore >= 30) calculatedPriority = 'medium';
        else calculatedPriority = 'low';
        
        // Return whether calculated priority exceeds threshold
        return this.priorityLevels[calculatedPriority] >= thresholdValue;
    }
    
    /**
     * Calculate a priority score for an item based on its attributes
     * @param {object} item Item to evaluate
     * @returns {number} Calculated priority score (0-100)
     * @private
     */
    _calculatePriorityScore(item) {
        let score = 0;
        
        // Add scores from each category if the attribute exists
        if (item.securityImpact) {
            score += this.scoringRules.securityImpact[item.securityImpact] || 0;
        }
        
        if (item.businessImpact) {
            score += this.scoringRules.businessImpact[item.businessImpact] || 0;
        }
        
        if (item.timeWindow) {
            score += this.scoringRules.timeWindow[item.timeWindow] || 0;
        }
        
        if (item.confidenceLevel) {
            score += this.scoringRules.confidenceLevel[item.confidenceLevel] || 0;
        }
        
        if (item.novelty) {
            score += this.scoringRules.novelty[item.novelty] || 0;
        }
        
        // Check for special case indicators
        this._applySpecialCaseModifiers(item, score);
        
        // Ensure score is within 0-100 range
        return Math.max(0, Math.min(100, score));
    }
    
    /**
     * Apply special case modifiers to the priority score
     * @param {object} item The item being evaluated
     * @param {number} score The current priority score
     * @private
     */
    _applySpecialCaseModifiers(item, score) {
        // Special circumstances that should increase priority
        
        // If there's a direct security breach
        if (item.breach === true) {
            score += 25;
        }
        
        // If critical infrastructure is affected
        if (item.affectsCriticalInfrastructure === true) {
            score += 20;
        }
        
        // If sensitive data is involved
        if (item.involvesSensitiveData === true) {
            score += 15;
        }
        
        // If there's external visibility/PR impact
        if (item.externalVisibility === true) {
            score += 10;
        }
        
        // If Dad has previously shown interest in similar items
        if (item.dadPreviousInterest === true) {
            score += 15;
        }
        
        // Reduce score for routine or automated activities that are handling well
        if (item.routineHandling === true) {
            score -= 15;
        }
        
        return score;
    }
    
    /**
     * Prioritize a list of items for Dad's attention
     * @param {Array<object>} items List of items to prioritize
     * @param {number} limit Maximum number of items to return
     * @returns {Array<object>} Prioritized items with calculated priority scores
     */
    prioritizeItems(items, limit = 10) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }
        
        // Calculate priority score for each item
        const scoredItems = items.map(item => ({
            ...item,
            priorityScore: this._calculatePriorityScore(item),
            calculatedPriority: this._scoreToPriority(this._calculatePriorityScore(item))
        }));
        
        // Sort by priority score (descending)
        scoredItems.sort((a, b) => b.priorityScore - a.priorityScore);
        
        // Return top items up to limit
        return scoredItems.slice(0, limit);
    }
    
    /**
     * Convert a score to a priority level
     * @param {number} score Priority score
     * @returns {string} Priority level
     * @private
     */
    _scoreToPriority(score) {
        if (score >= 70) return 'critical';
        if (score >= 50) return 'high';
        if (score >= 30) return 'medium';
        return 'low';
    }
}

module.exports = new PriorityFilter();