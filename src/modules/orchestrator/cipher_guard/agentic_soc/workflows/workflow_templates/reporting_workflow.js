/**
 * Weekly Leadership Report Workflow
 *
 * Trigger: schedule:weekly:leadership_report
 *
 * Flow:
 *   1. Collect leadership-facing metrics from across the Agentic SOC.
 *   2. Generate an executive Markdown report via the core ReportGenerator + templates.
 *   3. Render the Markdown to a faux PDF buffer (stub, no real PDF engine).
 *   4. Distribute via Email, Obsidian, and Teams.
 */

const reportGenerator = require('../../reporting/report_generator');

/**
 * @type {import('../workflow_engine').WorkflowDefinition}
 */
const reportingWorkflow = {
    name: 'weekly_leadership_report',
    trigger: ['schedule:weekly:leadership_report'],
    description: 'Weekly executive security report generation and distribution workflow.',
    steps: [
        {
            id: 'collect_metrics',
            description:
                'Aggregate metrics: incidents by severity/type, trending threats, vulnerability aging, MTTR.',
            timeoutMs: 15000,
            async run(context, helpers) {
                const agentManager = helpers.agentManager;
                const agentRegistry = helpers.agentRegistry;

                // Incidents by severity/type – placeholder structure; in a real
                // system this would query incident stores or SIEM metrics.
                const incidentsBySeverity = {
                    critical: 3,
                    high: 11,
                    medium: 24,
                    low: 37,
                };

                const incidentsByType = {
                    phishing: 8,
                    endpoint_malware: 5,
                    lateral_movement: 2,
                    vuln_exploitation: 3,
                    other: 4,
                };

                // Trending threats / campaigns – stub examples.
                const trendingThreats = [
                    {
                        name: 'PowerShell downgrade attacks',
                        trend: 'increasing',
                        notes: 'Observed across multiple environments in last 2 weeks.',
                    },
                    {
                        name: 'Credential harvesting via phishing',
                        trend: 'steady',
                        notes: 'Consistent volume, mitigated by automated email workflows.',
                    },
                ];

                // Vulnerability aging – these would normally come from VM data.
                const vulnerabilityAging = {
                    open: {
                        critical: { count: 14, medianAgeDays: 5 },
                        high: { count: 42, medianAgeDays: 18 },
                        medium: { count: 120, medianAgeDays: 45 },
                        low: { count: 200, medianAgeDays: 80 },
                    },
                    closedLastWeek: {
                        critical: 9,
                        high: 27,
                        medium: 75,
                        low: 40,
                    },
                };

                // MTTR / agent metrics – approximate using agent-level metrics if available.
                let mttrMinutes = 90;
                let irAgentMetrics = null;
                let incidentManagerMetrics = null;

                try {
                    if (agentRegistry && typeof agentRegistry.getAgentsByType === 'function') {
                        const irAgents = agentRegistry.getAgentsByType('l2_incident_response_agent') || [];
                        const imAgents = agentRegistry.getAgentsByType('l3_incident_manager_agent') || [];

                        if (irAgents[0]) {
                            irAgentMetrics = irAgents[0].metrics || null;
                        }
                        if (imAgents[0]) {
                            incidentManagerMetrics = imAgents[0].metrics || null;
                        }

                        // Derive a rough MTTR if either agent exposes it via metrics.
                        const irMttr =
                            irAgentMetrics && typeof irAgentMetrics.averageResolutionTimeMinutes === 'number'
                                ? irAgentMetrics.averageResolutionTimeMinutes
                                : null;
                        const imMttr =
                            incidentManagerMetrics &&
                            typeof incidentManagerMetrics.averageResolutionTimeMinutes === 'number'
                                ? incidentManagerMetrics.averageResolutionTimeMinutes
                                : null;

                        if (irMttr && imMttr) {
                            mttrMinutes = Math.round((irMttr + imMttr) / 2);
                        } else if (irMttr || imMttr) {
                            mttrMinutes = Math.round(irMttr || imMttr);
                        }
                    } else if (agentManager && typeof agentManager.getAgentPerformanceMetrics === 'function') {
                        const metrics = agentManager.getAgentPerformanceMetrics();
                        // Simple heuristic over all agents if detailed types are not present.
                        const times = Object.values(metrics)
                            .map((m) => m.avgProcessingTime)
                            .filter((v) => typeof v === 'number' && v > 0);
                        if (times.length > 0) {
                            // Assume avgProcessingTime is in ms; convert to minutes.
                            const medianMs = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
                            mttrMinutes = Math.round((medianMs / 1000 / 60) || mttrMinutes);
                        }
                    }
                } catch (err) {
                    if (helpers.messageBus) {
                        await helpers.messageBus.publish('workflow:warning', {
                            workflow: 'weekly_leadership_report',
                            step: 'collect_metrics',
                            message: `Error collecting MTTR from agents: ${err.message}`,
                        });
                    }
                }

                return {
                    timeWindow: context.eventPayload?.timeWindow || 'last_7_days',
                    incidentsBySeverity,
                    incidentsByType,
                    trendingThreats,
                    vulnerabilityAging,
                    mttrMinutes,
                    irAgentMetrics,
                    incidentManagerMetrics,
                };
            },
        },
        {
            id: 'generate_markdown_report',
            description:
                'Generate an executive Markdown report using the core ReportGenerator and templates.',
            retry: 1,
            timeoutMs: 20000,
            async run(context) {
                const metrics = context.stepResults.collect_metrics || {};

                // Use the generic ReportGenerator with the "executive" report type
                // and render it in a Markdown-friendly format. The current
                // implementation returns structured content, which we then
                // convert into a human-readable Markdown artefact.
                const report = await reportGenerator.generateReport('executive', metrics, {
                    format: 'markdown',
                    title: 'Weekly Leadership Security Report',
                    sections: [
                        'Security Posture Summary',
                        'Key Risk Indicators',
                        'Major Incidents',
                        'Strategic Recommendations',
                    ],
                });

                // Convert structured content to a Markdown string.
                const sections = report.content && report.content.sections ? report.content.sections : {};
                let markdown = `# ${report.title}\n\n`;
                markdown += `Generated: ${new Date().toISOString()}\n\n`;

                markdown += '## Security Posture Summary\n\n';
                markdown += `Time window: ${metrics.timeWindow || 'last_7_days'}\n\n`;
                markdown += `MTTR (median): ${metrics.mttrMinutes || 'n/a'} minutes\n\n`;

                markdown += '### Incidents by Severity\n\n';
                Object.entries(metrics.incidentsBySeverity || {}).forEach(([sev, count]) => {
                    markdown += `- ${sev}: ${count}\n`;
                });
                markdown += '\n';

                markdown += '### Incidents by Type\n\n';
                Object.entries(metrics.incidentsByType || {}).forEach(([type, count]) => {
                    markdown += `- ${type}: ${count}\n`;
                });
                markdown += '\n';

                markdown += '## Trending Threats and Campaigns\n\n';
                (metrics.trendingThreats || []).forEach((t) => {
                    markdown += `- **${t.name}** (${t.trend || 'trend n/a'}): ${t.notes || ''}\n`;
                });
                markdown += '\n';

                markdown += '## Vulnerability Aging (Open)\n\n';
                const agingOpen = metrics.vulnerabilityAging?.open || {};
                Object.entries(agingOpen).forEach(([sev, info]) => {
                    markdown += `- ${sev}: ${info.count} open (median age ${info.medianAgeDays} days)\n`;
                });
                markdown += '\n';

                markdown += '## Strategic Recommendations\n\n';
                markdown +=
                    '- Continue aggressive remediation of critical/high vulnerabilities within SLA.\n' +
                    '- Enhance detection for PowerShell downgrade and credential phishing campaigns.\n' +
                    '- Track MTTR trends for incident response and incident management agents.\n';

                return {
                    report,
                    markdown,
                };
            },
        },
        {
            id: 'render_pdf',
            description:
                'Render the Markdown executive report to a faux PDF buffer using the reporting helper stub.',
            timeoutMs: 15000,
            async run(context) {
                const gen = context.stepResults.generate_markdown_report || {};
                const markdown = gen.markdown || '# Weekly Leadership Security Report\n\n(Empty report body)\n';
                const pdfBuffer = await reportGenerator.renderMarkdownToPdf(markdown);

                return {
                    markdown,
                    pdfBuffer,
                    sizeBytes: pdfBuffer.length,
                };
            },
        },
        {
            id: 'distribute_report',
            description:
                'Distribute the report: email to leadership, archive to Obsidian, and post a short summary to Teams.',
            retry: 1,
            timeoutMs: 30000,
            async run(context, helpers) {
                const email = helpers.integrations && helpers.integrations.email;
                const obsidian = helpers.integrations && helpers.integrations.obsidian;
                const teams = helpers.integrations && helpers.integrations.teams;

                const gen = context.stepResults.generate_markdown_report || {};
                const render = context.stepResults.render_pdf || {};
                const metrics = context.stepResults.collect_metrics || {};

                const title = gen.report?.title || 'Weekly Leadership Security Report';

                const distribution = {
                    email: { attempted: false, success: false, error: null },
                    obsidian: { attempted: false, success: false, error: null },
                    teams: { attempted: false, success: false, error: null },
                };

                // Email distribution
                if (email && typeof email.sendReport === 'function') {
                    distribution.email.attempted = true;
                    try {
                        await email.sendReport(
                            {
                                id: gen.report?.id || `weekly-report-${Date.now()}`,
                                type: 'executive_summary',
                                title,
                                format: 'pdf',
                                content: {
                                    sections: gen.report?.content?.sections || {},
                                },
                                severity: 'info',
                                summary: `Weekly leadership report for ${metrics.timeWindow || 'last_7_days'}.`,
                                timestamp: new Date().toISOString(),
                            },
                            {
                                includeReportAttachment: true,
                                reportFormat: 'pdf',
                                recipients: email.config?.defaultRecipients || [],
                            },
                        );
                        distribution.email.success = true;
                    } catch (err) {
                        distribution.email.error = err.message;
                    }
                }

                // Obsidian archival
                if (obsidian && typeof obsidian.createNote === 'function') {
                    distribution.obsidian.attempted = true;
                    try {
                        const noteReport = {
                            id: gen.report?.id || `weekly-report-${Date.now()}`,
                            type: 'executive',
                            title,
                            severity: 'info',
                            status: 'new',
                            timestamp: new Date().toISOString(),
                            content: {
                                sections: gen.report?.content?.sections || {},
                                visualizations: gen.report?.content?.visualizations || [],
                            },
                        };
                        await obsidian.createNote(noteReport, {
                            category: 'Security/Leadership Reports',
                            filename: `Weekly Leadership Report - ${new Date()
                                .toISOString()
                                .split('T')[0]}`,
                        });
                        distribution.obsidian.success = true;
                    } catch (err) {
                        distribution.obsidian.error = err.message;
                    }
                }

                // Teams summary
                if (teams && typeof teams.sendAlert === 'function') {
                    distribution.teams.attempted = true;
                    try {
                        const totalIncidents =
                            Object.values(metrics.incidentsBySeverity || {}).reduce(
                                (acc, val) => acc + (val || 0),
                                0,
                            ) || 0;

                        const alert = {
                            title: 'Weekly Leadership Security Summary',
                            description:
                                `Time window: ${metrics.timeWindow || 'last_7_days'}\n` +
                                `Total incidents: ${totalIncidents}\n` +
                                `MTTR (median): ${metrics.mttrMinutes || 'n/a'} minutes\n`,
                            severity: 'info',
                            source: 'Agentic SOC - weekly_leadership_report',
                            timestamp: new Date().toISOString(),
                        };

                        const result = await teams.sendAlert(alert, {
                            channel: 'leadership-security-updates',
                            importance: 'important',
                        });
                        distribution.teams.success = true;
                        distribution.teams.messageId = result.messageId;
                        distribution.teams.channelId = result.channelId;
                    } catch (err) {
                        distribution.teams.error = err.message;
                    }
                }

                return distribution;
            },
        },
    ],
};

module.exports = reportingWorkflow;