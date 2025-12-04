/**
 * Anticipatory Defense Index
 * 
 * Exports all anticipatory defense components for the Agentic SOC system.
 * These components help proactively identify and mitigate security threats
 * before they impact the organization.
 */

const emberUnitIntegration = require('./ember_unit_integration');
const scenarioGenerator = require('./scenario_generator');
const sigmaRuleGenerator = require('./sigma_rule_generator');
const yaraRuleGenerator = require('./yara_rule_generator');
const purpleTeamAutomation = require('./purple_team_automation');
const zeroDayMonitor = require('./zero_day_monitor');

/**
 * Initialize all anticipatory defense components
 * @returns {Promise<object>} Initialization status for each component
 */
async function initialize() {
    const results = {};
    
    // Initialize Ember Unit integration
    results.emberUnit = await emberUnitIntegration.initialize()
        .catch(err => {
            console.error('Failed to initialize Ember Unit integration:', err);
            return false;
        });
    
    // Initialize Purple Team automation
    results.purpleTeam = await purpleTeamAutomation.initialize()
        .catch(err => {
            console.error('Failed to initialize Purple Team automation:', err);
            return false;
        });
    
    // Start Zero Day monitoring
    results.zeroDayMonitor = zeroDayMonitor.startMonitoring();
    
    return results;
}

module.exports = {
    // Offensive security integration
    emberUnitIntegration,
    
    // Scenario and rule generation
    scenarioGenerator,
    sigmaRuleGenerator,
    yaraRuleGenerator,
    
    // Automated purple team exercises
    purpleTeamAutomation,
    
    // Zero-day vulnerability monitoring
    zeroDayMonitor,
    
    // Initialization function
    initialize
};