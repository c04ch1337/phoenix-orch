/**
 * Purple Team Automation
 * 
 * Automates the coordination between offensive (red) and defensive (blue) security
 * activities to improve overall security posture. Orchestrates combined exercises
 * where offensive testing is immediately followed by defensive improvements.
 */

const emberUnitIntegration = require('./ember_unit_integration');
const scenarioGenerator = require('./scenario_generator');
const sigmaRuleGenerator = require('./sigma_rule_generator');
const yaraRuleGenerator = require('./yara_rule_generator');
const workflowEngine = require('../workflows/workflow_engine');

class PurpleTeamAutomation {
    constructor() {
        this.activeExercises = new Map();
        this.completedExercises = [];
    }
    
    /**
     * Initialize the purple team automation component
     * @returns {Promise<boolean>} Initialization status
     */
    async initialize() {
        // Initialize Ember Unit integration for offensive capabilities
        const emberInitialized = await emberUnitIntegration.initialize()
            .catch(err => {
                console.error('Failed to initialize Ember Unit integration:', err);
                return false;
            });
        
        return { initialized: true, emberUnitInitialized: emberInitialized };
    }
    
    /**
     * Create a new purple team exercise
     * @param {object} params Exercise parameters
     * @returns {Promise<object>} Created exercise
     */
    async createExercise(params = {}) {
        if (!params.name) {
            throw new Error('Exercise name is required');
        }
        
        // Create a new exercise
        const exercise = {
            id: `ex-${Date.now()}`,
            name: params.name,
            description: params.description || `Purple team exercise: ${params.name}`,
            status: 'created',
            targetSystems: params.targetSystems || [],
            phases: {
                planning: { status: 'pending', startTime: null, endTime: null },
                redTeam: { status: 'pending', startTime: null, endTime: null },
                blueTeam: { status: 'pending', startTime: null, endTime: null },
                analysis: { status: 'pending', startTime: null, endTime: null },
                remediation: { status: 'pending', startTime: null, endTime: null }
            },
            planId: null,
            operations: [],
            findings: [],
            defenseImprovements: [],
            createdAt: new Date().toISOString()
        };
        
        // Store the exercise
        this.activeExercises.set(exercise.id, exercise);
        
        return exercise;
    }
    
    /**
     * Start the planning phase of an exercise
     * @param {string} exerciseId Exercise ID
     * @param {object} options Planning options
     * @returns {Promise<object>} Planning results
     */
    async startPlanningPhase(exerciseId, options = {}) {
        const exercise = this.activeExercises.get(exerciseId);
        if (!exercise) {
            throw new Error(`Exercise not found: ${exerciseId}`);
        }
        
        // Update exercise phase
        exercise.phases.planning.status = 'in_progress';
        exercise.phases.planning.startTime = new Date().toISOString();
        
        try {
            // Generate attack scenarios
            const scenario = await scenarioGenerator.generateScenario({
                type: options.scenarioType || 'ransomware',
                targetSystems: exercise.targetSystems,
                useEmberUnit: true,
                organizationType: options.organizationType || 'enterprise'
            });
            
            // Store scenario in exercise
            exercise.scenario = scenario;
            
            // If EmberUnit is available, convert to plan
            let plan = null;
            if (emberUnitIntegration.connected && scenario) {
                try {
                    plan = await scenarioGenerator.convertToEmberUnitPlan(scenario);
                    exercise.planId = plan.planId;
                } catch (error) {
                    console.warn('Failed to convert scenario to Ember Unit plan:', error);
                }
            }
            
            // Mark planning as completed
            exercise.phases.planning.status = 'completed';
            exercise.phases.planning.endTime = new Date().toISOString();
            exercise.status = 'planning_completed';
            
            return {
                exerciseId,
                scenario,
                plan,
                status: 'success'
            };
        } catch (error) {
            // Mark planning as failed
            exercise.phases.planning.status = 'failed';
            exercise.phases.planning.endTime = new Date().toISOString();
            exercise.phases.planning.error = error.message;
            
            throw error;
        }
    }
    
    /**
     * Start the red team phase of an exercise
     * @param {string} exerciseId Exercise ID
     * @param {object} options Execution options
     * @returns {Promise<object>} Execution results
     */
    async startRedTeamPhase(exerciseId, options = {}) {
        const exercise = this.activeExercises.get(exerciseId);
        if (!exercise) {
            throw new Error(`Exercise not found: ${exerciseId}`);
        }
        
        // Check prerequisites
        if (exercise.phases.planning.status !== 'completed') {
            throw new Error('Planning phase must be completed before starting red team phase');
        }
        
        // Update exercise phase
        exercise.phases.redTeam.status = 'in_progress';
        exercise.phases.redTeam.startTime = new Date().toISOString();
        
        try {
            // Execute the offensive operations
            let operations = [];
            
            if (emberUnitIntegration.connected && exercise.planId) {
                // Execute through Ember Unit
                const operationId = await emberUnitIntegration.executeAdversaryEmulation(
                    exercise.planId,
                    {
                        recordEvidence: true,
                        safetyControls: true,
                        ...options
                    }
                );
                
                operations.push({
                    id: operationId,
                    type: 'adversary_emulation',
                    status: 'running',
                    startTime: new Date().toISOString()
                });
            } else {
                // Simulate operations without Ember Unit
                operations.push({
                    id: `sim-op-${Date.now()}`,
                    type: 'simulated_operation',
                    status: 'running',
                    startTime: new Date().toISOString()
                });
            }
            
            // Store operations in exercise
            exercise.operations = operations;
            
            return {
                exerciseId,
                operations,
                status: 'started'
            };
        } catch (error) {
            // Mark red team phase as failed
            exercise.phases.redTeam.status = 'failed';
            exercise.phases.redTeam.endTime = new Date().toISOString();
            exercise.phases.redTeam.error = error.message;
            
            throw error;
        }
    }
    
    /**
     * Check the status of red team operations
     * @param {string} exerciseId Exercise ID
     * @returns {Promise<object>} Operation status
     */
    async checkRedTeamStatus(exerciseId) {
        const exercise = this.activeExercises.get(exerciseId);
        if (!exercise) {
            throw new Error(`Exercise not found: ${exerciseId}`);
        }
        
        // If no operations or phase not in progress, return current status
        if (!exercise.operations || exercise.operations.length === 0 || 
            exercise.phases.redTeam.status !== 'in_progress') {
            return {
                exerciseId,
                status: exercise.phases.redTeam.status,
                operations: exercise.operations || []
            };
        }
        
        // Check status of each operation
        let allCompleted = true;
        let operationStatuses = [];
        
        for (const operation of exercise.operations) {
            if (operation.status === 'completed' || operation.status === 'failed') {
                operationStatuses.push({
                    id: operation.id,
                    status: operation.status
                });
                continue;
            }
            
            let status;
            if (emberUnitIntegration.connected && operation.type === 'adversary_emulation') {
                // Get status from Ember Unit
                try {
                    status = await emberUnitIntegration.getOperationStatus(operation.id);
                } catch (error) {
                    console.warn(`Failed to get status for operation ${operation.id}:`, error);
                    status = { status: 'unknown' };
                }
            } else {
                // Simulate status for simulated operations
                status = {
                    status: Math.random() < 0.7 ? 'completed' : 'running',
                    progress: Math.random() * 100
                };
            }
            
            // Update operation in exercise
            operation.status = status.status;
            if (status.status === 'completed' || status.status === 'failed') {
                operation.endTime = new Date().toISOString();
            }
            
            operationStatuses.push({
                id: operation.id,
                status: status.status,
                progress: status.progress
            });
            
            if (status.status !== 'completed' && status.status !== 'failed') {
                allCompleted = false;
            }
        }
        
        // If all operations completed, update phase status
        if (allCompleted) {
            exercise.phases.redTeam.status = 'completed';
            exercise.phases.redTeam.endTime = new Date().toISOString();
            exercise.status = 'red_team_completed';
        }
        
        return {
            exerciseId,
            status: exercise.phases.redTeam.status,
            operations: operationStatuses
        };
    }
    
    /**
     * Collect findings from the red team phase
     * @param {string} exerciseId Exercise ID
     * @returns {Promise<object>} Collected findings
     */
    async collectRedTeamFindings(exerciseId) {
        const exercise = this.activeExercises.get(exerciseId);
        if (!exercise) {
            throw new Error(`Exercise not found: ${exerciseId}`);
        }
        
        // Ensure red team phase is completed
        if (exercise.phases.redTeam.status !== 'completed') {
            // Try to check status one more time
            await this.checkRedTeamStatus(exerciseId);
            
            if (exercise.phases.redTeam.status !== 'completed') {
                throw new Error('Red team phase must be completed before collecting findings');
            }
        }
        
        // Collect findings from operations
        const findings = [];
        
        for (const operation of exercise.operations) {
            if (emberUnitIntegration.connected && operation.type === 'adversary_emulation') {
                // Get findings from Ember Unit
                try {
                    const operationFindings = await emberUnitIntegration.getOperationFindings(operation.id);
                    findings.push({
                        source: `operation-${operation.id}`,
                        detectionGaps: operationFindings.detectionGaps || [],
                        vulnerabilities: operationFindings.vulnerabilities || [],
                        recommendations: operationFindings.recommendedControls || []
                    });
                } catch (error) {
                    console.warn(`Failed to get findings for operation ${operation.id}:`, error);
                }
            } else {
                // Create simulated findings
                findings.push({
                    source: `simulated-operation-${operation.id}`,
                    detectionGaps: [
                        {
                            technique: 'T1059.001',
                            description: 'PowerShell execution detection gap'
                        }
                    ],
                    vulnerabilities: [
                        {
                            id: 'sim-vuln-001',
                            description: 'Simulated vulnerability for testing',
                            severity: 'medium'
                        }
                    ],
                    recommendations: [
                        'Implement application whitelisting',
                        'Enable PowerShell script block logging'
                    ]
                });
            }
        }
        
        // Store findings in exercise
        exercise.findings = findings;
        
        return {
            exerciseId,
            findings
        };
    }
    
    /**
     * Start the blue team phase of an exercise
     * @param {string} exerciseId Exercise ID
     * @param {object} options Blue team options
     * @returns {Promise<object>} Blue team results
     */
    async startBlueTeamPhase(exerciseId, options = {}) {
        const exercise = this.activeExercises.get(exerciseId);
        if (!exercise) {
            throw new Error(`Exercise not found: ${exerciseId}`);
        }
        
        // Check prerequisites
        if (exercise.phases.redTeam.status !== 'completed' || !exercise.findings) {
            throw new Error('Red team phase must be completed and findings collected before starting blue team phase');
        }
        
        // Update exercise phase
        exercise.phases.blueTeam.status = 'in_progress';
        exercise.phases.blueTeam.startTime = new Date().toISOString();
        
        try {
            // Process each finding and create defense improvements
            const defenseImprovements = [];
            
            // 1. Generate detection rules
            for (const finding of exercise.findings) {
                for (const gap of finding.detectionGaps || []) {
                    // Generate Sigma rules for detection gaps
                    try {
                        const rule = await sigmaRuleGenerator.generateRule({
                            title: `Detection for ${gap.technique || 'technique'}: ${gap.description}`,
                            techniqueId: gap.technique,
                            description: gap.description,
                            emberUnitOperationId: finding.source.startsWith('operation-') ? 
                                finding.source.replace('operation-', '') : null
                        });
                        
                        defenseImprovements.push({
                            type: 'sigma_rule',
                            rule,
                            relatedFinding: `${finding.source}-${gap.technique || 'technique'}`
                        });
                    } catch (error) {
                        console.warn('Failed to generate Sigma rule:', error);
                    }
                    
                    // For some techniques, also generate YARA rules
                    if (gap.technique && ['T1059', 'T1027', 'T1053', 'T1204'].some(t => gap.technique.startsWith(t))) {
                        try {
                            const rule = await yaraRuleGenerator.generateRule({
                                name: `Detect_${gap.technique.replace('.', '_')}`,
                                description: `YARA detection for ${gap.description}`,
                                type: 'malware',
                                emberUnitOperationId: finding.source.startsWith('operation-') ? 
                                    finding.source.replace('operation-', '') : null
                            });
                            
                            defenseImprovements.push({
                                type: 'yara_rule',
                                rule,
                                relatedFinding: `${finding.source}-${gap.technique || 'technique'}`
                            });
                        } catch (error) {
                            console.warn('Failed to generate YARA rule:', error);
                        }
                    }
                }
                
                // 2. Add recommended controls as improvements
                for (const recommendation of finding.recommendations || []) {
                    defenseImprovements.push({
                        type: 'security_control',
                        description: recommendation,
                        relatedFinding: finding.source
                    });
                }
            }
            
            // Store defense improvements in exercise
            exercise.defenseImprovements = defenseImprovements;
            
            // Mark blue team phase as completed
            exercise.phases.blueTeam.status = 'completed';
            exercise.phases.blueTeam.endTime = new Date().toISOString();
            exercise.status = 'blue_team_completed';
            
            return {
                exerciseId,
                defenseImprovements,
                status: 'completed'
            };
        } catch (error) {
            // Mark blue team phase as failed
            exercise.phases.blueTeam.status = 'failed';
            exercise.phases.blueTeam.endTime = new Date().toISOString();
            exercise.phases.blueTeam.error = error.message;
            
            throw error;
        }
    }
    
    /**
     * Complete a purple team exercise
     * @param {string} exerciseId Exercise ID
     * @returns {Promise<object>} Final results
     */
    async completeExercise(exerciseId) {
        const exercise = this.activeExercises.get(exerciseId);
        if (!exercise) {
            throw new Error(`Exercise not found: ${exerciseId}`);
        }
        
        // Update exercise status
        exercise.status = 'completed';
        exercise.completedAt = new Date().toISOString();
        
        // Generate exercise summary
        const summary = {
            id: exercise.id,
            name: exercise.name,
            duration: this._calculateDuration(exercise),
            findings: exercise.findings?.length || 0,
            defenseImprovements: exercise.defenseImprovements?.length || 0,
            recommendations: exercise.findings
                ?.flatMap(f => f.recommendations || [])
                ?.filter((r, i, self) => self.indexOf(r) === i) || []
        };
        
        // Move to completed exercises
        this.completedExercises.push(exercise);
        this.activeExercises.delete(exerciseId);
        
        return {
            exerciseId,
            summary,
            status: 'completed'
        };
    }
    
    /**
     * Calculate exercise duration
     * @param {object} exercise Exercise object
     * @returns {number} Duration in milliseconds
     * @private
     */
    _calculateDuration(exercise) {
        const startTime = new Date(exercise.phases.planning.startTime || exercise.createdAt).getTime();
        const endTime = new Date(exercise.completedAt || new Date().toISOString()).getTime();
        return endTime - startTime;
    }
}

module.exports = new PurpleTeamAutomation();