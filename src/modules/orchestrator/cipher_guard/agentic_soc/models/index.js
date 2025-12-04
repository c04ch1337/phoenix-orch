/**
 * AI Models Index
 * 
 * Exports all AI model interfaces and related components.
 */

const deepseekInterface = require('./deepseek_interface');
const llamaInterface = require('./llama_interface');
const modelRouter = require('./model_router');
const securityAnalysisTemplates = require('./prompt_templates/security_analysis');

// Export all prompt templates
const promptTemplates = {
    securityAnalysis: securityAnalysisTemplates
};

module.exports = {
    // Model interfaces
    deepseekInterface,
    llamaInterface,
    
    // Model routing
    modelRouter,
    
    // Prompt templates
    promptTemplates
};