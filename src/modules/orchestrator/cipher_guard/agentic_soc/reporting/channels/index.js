/**
 * Reporting Channels
 * 
 * This module exports all available channels for delivering security reports,
 * alerts, and notifications to various systems and stakeholders.
 */

const teamsConnector = require('./teams_connector');
const obsidianConnector = require('./obsidian_connector');
const jiraConnector = require('./jira_connector');
const emailConnector = require('./email_connector');

module.exports = {
    teamsConnector,
    obsidianConnector,
    jiraConnector,
    emailConnector
};