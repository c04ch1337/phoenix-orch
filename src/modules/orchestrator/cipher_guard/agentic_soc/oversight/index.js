/**
 * Dad Oversight Components
 * 
 * This module provides the interface and components for Dad oversight of the
 * Agentic SOC system, including decision filtering, prioritization, and briefing
 * generation.
 */

const dadInterface = require('./dad_interface');
const neuralinkConnector = require('./neuralink_connector');
const priorityFilter = require('./priority_filter');
const decisionGateway = require('./decision_gateway');
const briefingGenerator = require('./briefing_generator');

module.exports = {
    dadInterface,
    neuralinkConnector,
    priorityFilter,
    decisionGateway,
    briefingGenerator
};