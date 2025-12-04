/**
 * Daily Threat Hunt (07:00) Workflow
 *
 * Scenario: “PowerShell downgrade last 7 days”.
 * Triggered by the core scheduler at 07:00 daily and coordinates query
 * construction, hunt execution, result summarization, and reporting.
 */

/**
 * @type {import('../workflow_engine').WorkflowDefinition}
 */
const threatHuntingWorkflow = {
    name: 'daily_threat_hunt_powershell_downgrade',
    trigger: ['schedule:daily:07:00:threat_hunt'],
    description: 'Daily hunt for PowerShell downgrade attacks over the last 7 days.',
    steps: [
        {
            id: 'build_hunt_query',
            description: 'Define a hunting query for PowerShell downgrade attacks over the last 7 days.',
            async run(context, helpers) {
                const query =
                    'EventSource=PowerShell AND ScriptBlockText CONTAINS "version 2" AND ' +
                    'ScriptBlockText CONTAINS "-Version 2" AND Timeframe=last_7_days';

                const timeframe = {
                    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    end: new Date().toISOString(),
                };

                return {
                    query,
                    timeframe,
                    description: 'Hunt for PowerShell downgrade usage (forcing PowerShell v2) during last 7 days.',
                };
            },
        },
        {
            id: 'execute_hunt',
            description:
                'Execute the hunt via a hunting subsystem or Threat Hunter agent (modeled as hunt:execute event).',
            retry: 1,
            timeoutMs: 20000,
            async run(context, helpers) {
                const q = context.stepResults.build_hunt_query || {};

                await helpers.emitEvent('hunt:execute', {
                    query: q.query,
                    timeframe: q.timeframe,
                    scenario: 'powershell_downgrade',
                    source: 'daily_threat_hunt_workflow',
                });

                // Simulated hunt results.
                const hits = [
                    { host: 'server-01', user: 'svc_backup', count: 5 },
                    { host: 'workstation-42', user: 'alice', count: 2 },
                ];

                return {
                    query: q.query,
                    timeframe: q.timeframe,
                    hits,
                };
            },
        },
        {
            id: 'process_results',
            description: 'Summarize hits, key hosts, and users from the hunt results.',
            async run(context) {
                const exec = context.stepResults.execute_hunt || {};
                const hits = exec.hits || [];

                const totalEvents = hits.reduce((acc, h) => acc + (h.count || 0), 0);
                const hosts = [...new Set(hits.map((h) => h.host))];
                const users = [...new Set(hits.map((h) => h.user))];

                const summaryLines = [
                    `Total downgrade-related events: ${totalEvents}`,
                    `Hosts involved (${hosts.length}): ${hosts.join(', ') || 'none'}`,
                    `Users involved (${users.length}): ${users.join(', ') || 'none'}`,
                ];

                return {
                    totalEvents,
                    hosts,
                    users,
                    textSummary: summaryLines.join('\n'),
                };
            },
        },
        {
            id: 'obsidian_log',
            description: 'Write summarized hunt results into the Obsidian daily log.',
            timeoutMs: 15000,
            async run(context, helpers) {
                const obsidian = helpers.integrations && helpers.integrations.obsidian;
                if (!obsidian || typeof obsidian.createDailyLog !== 'function') {
                    return {
                        logged: false,
                        reason: 'Obsidian connector not configured',
                    };
                }

                const queryDef = context.stepResults.build_hunt_query || {};
                const processed = context.stepResults.process_results || {};

                const logData = {
                    summary:
                        'Daily threat hunt: PowerShell downgrade activity over the last 7 days.\n' +
                        processed.textSummary,
                    alerts: [],
                    incidents: [],
                    actions: [],
                    notes: `Query: ${queryDef.query || 'n/a'}`,
                };

                const result = await obsidian.createDailyLog(logData, {
                    updateIndex: true,
                });

                return {
                    logged: true,
                    path: result.path,
                };
            },
        },
        {
            id: 'teams_briefing',
            description: 'Post a concise morning briefing into Teams.',
            timeoutMs: 15000,
            async run(context, helpers) {
                const teams = helpers.integrations && helpers.integrations.teams;
                if (!teams || typeof teams.sendAlert !== 'function') {
                    return {
                        posted: false,
                        reason: 'Teams connector not configured',
                    };
                }

                const processed = context.stepResults.process_results || {};
                const total = processed.totalEvents || 0;

                const alert = {
                    title: 'Daily Threat Hunt - PowerShell Downgrade',
                    description:
                        `Summary of downgrade-related PowerShell activity in the last 7 days:\n\n` +
                        (processed.textSummary || 'No events detected.'),
                    severity: total > 0 ? 'medium' : 'low',
                    source: 'Agentic SOC - Daily Threat Hunt',
                    timestamp: new Date().toISOString(),
                };

                const result = await teams.sendAlert(alert, {
                    channel: 'security-threat-hunts',
                });

                return {
                    posted: true,
                    messageId: result.messageId,
                    channelId: result.channelId,
                };
            },
        },
    ],
};

module.exports = threatHuntingWorkflow;