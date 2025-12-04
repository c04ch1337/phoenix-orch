/**
 * Scenario Generator
 * 
 * Generates realistic attack scenarios for security testing and training.
 * Uses AI models to create plausible threat scenarios based on current threat
 * intelligence, system configurations, and organizational context.
 */

const modelRouter = require('../models/model_router');
const emberUnitIntegration = require('./ember_unit_integration');

class ScenarioGenerator {
    constructor() {
        this.scenarioTemplates = {
            'ransomware': {
                name: 'Ransomware Attack',
                description: 'Simulates a ransomware attack targeting critical systems',
                phases: ['initial_access', 'execution', 'persistence', 'lateral_movement', 'encryption']
            },
            'data_exfiltration': {
                name: 'Data Exfiltration',
                description: 'Simulates a targeted data theft operation',
                phases: ['initial_access', 'discovery', 'collection', 'exfiltration']
            },
            'credential_theft': {
                name: 'Credential Theft',
                description: 'Simulates credential stealing and privilege escalation',
                phases: ['initial_access', 'discovery', 'credential_access', 'privilege_escalation']
            },
            'supply_chain': {
                name: 'Supply Chain Attack',
                description: 'Simulates attack through compromised third-party software',
                phases: ['supplier_compromise', 'execution', 'persistence', 'lateral_movement']
            }
        };
    }
    
    /**
     * Generate an attack scenario
     * @param {object} params Generation parameters
     * @returns {Promise<object>} Generated scenario
     */
    async generateScenario(params = {}) {
        // Determine the scenario type
        let scenarioType = params.type || 'random';
        if (scenarioType === 'random') {
            const scenarioTypes = Object.keys(this.scenarioTemplates);
            scenarioType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
        }
        
        // Get the template
        const template = this.scenarioTemplates[scenarioType];
        if (!template) {
            throw new Error(`Unknown scenario type: ${scenarioType}`);
        }
        
        // Generate scenario base
        const scenario = {
            id: `scenario-${Date.now()}`,
            type: scenarioType,
            name: template.name,
            description: template.description,
            targetSystems: params.targetSystems || [],
            phases: [],
            goals: [],
            createdAt: new Date().toISOString(),
            estimatedDuration: params.estimatedDuration || 90 // minutes
        };
        
        // Initialize from Ember Unit if available
        if (params.useEmberUnit) {
            try {
                return await this._generateEmberUnitScenario(scenarioType, params);
            } catch (error) {
                console.warn('Failed to generate scenario from Ember Unit, falling back to AI model:', error);
            }
        }
        
        // Generate using AI model
        return await this._generateAIScenario(scenarioType, params);
    }
    
    /**
     * Generate scenario using Ember Unit
     * @private
     */
    async _generateEmberUnitScenario(scenarioType, params) {
        // Check Ember Unit connection
        if (!emberUnitIntegration.connected) {
            await emberUnitIntegration.initialize();
        }
        
        // Map scenario type to adversary profile
        const adversaryMappings = {
            'ransomware': 'fin6',
            'data_exfiltration': 'apt41',
            'credential_theft': 'apt29',
            'supply_chain': 'apt41'
        };
        
        // Plan the operation
        const plan = await emberUnitIntegration.planAdversaryEmulation({
            adversaryProfile: adversaryMappings[scenarioType] || 'apt29',
            targets: params.targetSystems,
            scope: params.scope || 'authorized_systems'
        });
        
        // Format the plan into a scenario
        const template = this.scenarioTemplates[scenarioType];
        
        return {
            id: `scenario-${Date.now()}`,
            type: scenarioType,
            name: template.name,
            description: template.description,
            targetSystems: params.targetSystems || [],
            phases: plan.phases.map(phase => ({
                name: phase.name,
                description: `${phase.name} phase using ${phase.techniques.join(', ')}`,
                techniques: phase.techniques,
                targets: phase.targets
            })),
            goals: [
                'Evaluate detection capabilities',
                'Test response procedures',
                'Identify security gaps'
            ],
            emberUnitPlanId: plan.planId,
            createdAt: new Date().toISOString(),
            estimatedDuration: plan.estimatedDuration || params.estimatedDuration || 90
        };
    }
    
    /**
     * Generate scenario using AI model
     * @private
     */
    async _generateAIScenario(scenarioType, params) {
        const template = this.scenarioTemplates[scenarioType];
        
        // Construct the prompt for the AI model
        const prompt = `
Generate a realistic ${template.name} scenario for cybersecurity testing. 
The scenario should include multiple attack phases including: ${template.phases.join(', ')}.

Target systems: ${params.targetSystems ? params.targetSystems.join(', ') : 'Generic enterprise systems'}
Organization type: ${params.organizationType || 'Generic business'}
Threat actor: ${params.threatActor || 'Advanced persistent threat'}

For each phase, include:
1. Description of activities
2. MITRE ATT&CK techniques used
3. Target systems affected
4. Indicators of compromise
5. Expected alerts or detections

Make the scenario realistic but also safe for testing in a controlled environment.
        `;
        
        try {
            // Use the model to generate the scenario details
            const result = await modelRouter.routeTask('completion', {
                prompt
            }, { strategy: 'capability' });
            
            // Process the AI output into a structured scenario
            // For this placeholder, we'll create a simplified structure
            const scenario = {
                id: `scenario-${Date.now()}`,
                type: scenarioType,
                name: template.name,
                description: template.description,
                targetSystems: params.targetSystems || [],
                phases: template.phases.map(phase => ({
                    name: phase,
                    description: `${phase} phase (AI generated content)`,
                    techniques: []
                })),
                goals: [
                    'Evaluate detection capabilities',
                    'Test response procedures',
                    'Identify security gaps'
                ],
                aiGenerated: true,
                createdAt: new Date().toISOString(),
                estimatedDuration: params.estimatedDuration || 90
            };
            
            return scenario;
        } catch (error) {
            console.error('Error generating scenario with AI model:', error);
            throw new Error(`Failed to generate scenario: ${error.message}`);
        }
    }
    
    /**
     * Convert scenario to runnable Ember Unit plan
     * @param {object} scenario The scenario to convert
     * @returns {Promise<object>} Ember Unit plan
     */
    async convertToEmberUnitPlan(scenario) {
        // Check Ember Unit connection
        if (!emberUnitIntegration.connected) {
            await emberUnitIntegration.initialize();
        }
        
        // Extract techniques from scenario
        const techniques = [];
        scenario.phases.forEach(phase => {
            if (phase.techniques && Array.isArray(phase.techniques)) {
                techniques.push(...phase.techniques);
            }
        });
        
        // Map scenario type to adversary profile
        const adversaryMappings = {
            'ransomware': 'fin6',
            'data_exfiltration': 'apt41',
            'credential_theft': 'apt29',
            'supply_chain': 'apt41'
        };
        
        // Create plan parameters
        const planParams = {
            adversaryProfile: adversaryMappings[scenario.type] || 'apt29',
            targets: scenario.targetSystems,
            scope: 'authorized_systems',
            techniques: techniques.length > 0 ? techniques : undefined
        };
        
        // Generate the plan
        const plan = await emberUnitIntegration.planAdversaryEmulation(planParams);
        
        // Store the plan ID in the scenario
        scenario.emberUnitPlanId = plan.planId;
        
        return plan;
    }
}

module.exports = new ScenarioGenerator();