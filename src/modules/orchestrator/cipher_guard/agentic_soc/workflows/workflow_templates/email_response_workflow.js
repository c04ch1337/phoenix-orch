/**
 * Email / Phishing Incident Workflow
 *
 * Triggered by Proofpoint (or normalized email) phishing alerts. Orchestrates
 * L1 triage, sandboxing, containment, ticketing, collaboration, and logging.
 *
 * This module defines a pure workflow definition object. All external systems
 * (agents, Jira, Teams, Obsidian, Proofpoint, etc.) are accessed through the
 * helpers provided by the WorkflowEngine at runtime.
 */

/**
 * @type {import('../workflow_engine').WorkflowDefinition}
 */
const emailResponseWorkflow = {
    name: 'email_response',
    trigger: ['proofpoint:alert', 'email:phishing_alert'],
    description: 'End-to-end handling of suspected phishing / malicious email alerts.',
    steps: [
        {
            id: 'l1_email_triage',
            description: 'Invoke L1 Email Triage agent to classify the alert and extract IOCs.',
            retry: 1,
            timeoutMs: 15000,
            async run(context, helpers) {
                const alert = context.eventPayload || context.emailAlert || {};
                const email = alert.email || alert.message || {};

                // Best-effort call into the agent hierarchy; fall back to stubbed data
                try {
                    await helpers.invokeAgent('l1_email_triage', {
                        type: 'email_triage',
                        source: alert.source || 'proofpoint',
                        rawAlert: alert,
                    });
                } catch (err) {
                    // Invocation errors are logged but do not abort the workflow;
                    // step still returns a stubbed triage result.
                    if (helpers.messageBus) {
                        await helpers.messageBus.publish('workflow:warning', {
                            workflow: 'email_response',
                            step: 'l1_email_triage',
                            message: `Error invoking L1 email triage agent: ${err.message}`,
                        });
                    }
                }

                const triage = {
                    severity: alert.severity || 'high',
                    confidence: alert.confidence || 0.95,
                    iocs: alert.iocs || [],
                    recommendedContainment: alert.recommendedContainment || [
                        'Quarantine message',
                        'Block sender address',
                        'Block sender domain',
                    ],
                    sender: email.sender || alert.sender,
                    recipients: email.recipients || alert.recipients || [],
                    subject: email.subject || alert.subject,
                    messageId: email.messageId || alert.messageId,
                };

                return triage;
            },
        },
        {
            id: 'sandbox_detonation',
            description:
                'If severity/confidence are elevated, detonate the message or payload in a sandbox and record the verdict.',
            timeoutMs: 15000,
            async run(context, helpers) {
                const triage = context.stepResults.l1_email_triage || {};
                const severity = (triage.severity || 'medium').toLowerCase();
                const confidence = typeof triage.confidence === 'number' ? triage.confidence : 0.5;

                const shouldDetonate =
                    severity === 'critical' ||
                    severity === 'high' ||
                    (severity === 'medium' && confidence >= 0.8);

                if (!shouldDetonate) {
                    return {
                        detonated: false,
                        reason: 'Risk below sandbox threshold',
                    };
                }

                await helpers.emitEvent('sandbox:detonate', {
                    workflow: 'email_response',
                    email: {
                        subject: triage.subject,
                        sender: triage.sender,
                        recipients: triage.recipients,
                    },
                    iocs: triage.iocs,
                });

                // In a real system we would correlate on a response event. For now,
                // simulate a malicious verdict when severity is high/critical.
                const verdict =
                    severity === 'critical' || severity === 'high'
                        ? 'malicious'
                        : 'suspicious';

                return {
                    detonated: true,
                    verdict,
                    score: confidence,
                };
            },
        },
        {
            id: 'containment',
            description:
                'For high-confidence malicious verdicts, block sender/domain and quarantine the message via email security integration.',
            retry: 2,
            timeoutMs: 20000,
            async run(context, helpers) {
                const triage = context.stepResults.l1_email_triage || {};
                const sandbox = context.stepResults.sandbox_detonation || {};

                const severity = (triage.severity || 'medium').toLowerCase();
                const confidence = typeof triage.confidence === 'number' ? triage.confidence : 0.5;

                const highRisk =
                    (severity === 'critical' || severity === 'high') && confidence >= 0.8;
                const maliciousVerdict = sandbox.verdict === 'malicious';

                if (!highRisk && !maliciousVerdict) {
                    return {
                        containmentApplied: false,
                        reason: 'Risk below auto-containment threshold',
                    };
                }

                const actions = [];
                const proofpoint = helpers.integrations && helpers.integrations.proofpoint;

                const sender = triage.sender || (triage.iocs || []).find((ioc) => ioc.type === 'email')?.value;
                const domain =
                    sender && typeof sender === 'string' && sender.includes('@')
                        ? sender.split('@')[1]
                        : null;

                if (proofpoint && typeof proofpoint.createBlockListEntry === 'function') {
                    if (sender) {
                        await proofpoint.createBlockListEntry({
                            type: 'sender',
                            value: sender,
                            reason: 'High-confidence phishing email',
                        });
                        actions.push(`Blocked sender ${sender}`);
                    }

                    if (domain) {
                        await proofpoint.createBlockListEntry({
                            type: 'domain',
                            value: domain,
                            reason: 'High-confidence phishing email from domain',
                        });
                        actions.push(`Blocked domain ${domain}`);
                    }
                } else {
                    actions.push('Simulated sender/domain block (Proofpoint integration not configured)');
                }

                // Model quarantine as an event to downstream mail infrastructure
                await helpers.emitEvent('email:quarantine', {
                    workflow: 'email_response',
                    sender,
                    domain,
                    messageId: triage.messageId,
                    subject: triage.subject,
                });
                actions.push('Quarantined message via email:quarantine event');

                return {
                    containmentApplied: true,
                    actions,
                };
            },
        },
        {
            id: 'jira_ticket',
            description: 'Create a Jira incident ticket capturing triage, sandbox, and containment details.',
            retry: 1,
            timeoutMs: 15000,
            async run(context, helpers) {
                const jira = helpers.integrations && helpers.integrations.jira;
                const triage = context.stepResults.l1_email_triage || {};
                const sandbox = context.stepResults.sandbox_detonation || {};
                const containment = context.stepResults.containment || {};

                if (!jira || typeof jira.createIssue !== 'function') {
                    return {
                        created: false,
                        reason: 'Jira connector not configured',
                    };
                }

                const title = `Phishing alert - ${triage.subject || 'Unknown subject'}`;
                const descriptionParts = [
                    `Email phishing alert triaged with severity ${triage.severity || 'unknown'} and confidence ${
                        triage.confidence ?? 'n/a'
                    }.`,
                    `Sandbox verdict: ${sandbox.verdict || 'n/a'} (detonated=${sandbox.detonated ? 'yes' : 'no'}).`,
                ];

                if (containment && containment.containmentApplied) {
                    descriptionParts.push(`Containment actions: ${(containment.actions || []).join('; ')}`);
                }

                const issueData = {
                    type: 'incident',
                    title,
                    description: descriptionParts.join('\n'),
                    severity: triage.severity || 'high',
                    source: 'proofpoint/email',
                    technicalDetails: JSON.stringify(
                        {
                            triage,
                            sandbox,
                            containment,
                        },
                        null,
                        2,
                    ),
                    recommendations: triage.recommendedContainment || [],
                };

                const result = await jira.createIssue(issueData, {
                    issueType: jira.config && jira.config.issueTypes && jira.config.issueTypes.incident,
                });

                return {
                    created: true,
                    issueKey: result.issueKey,
                    issueUrl: result.issueUrl,
                };
            },
        },
        {
            id: 'teams_summary',
            description: 'Post an incident summary to the appropriate Microsoft Teams channel.',
            timeoutMs: 10000,
            async run(context, helpers) {
                const teams = helpers.integrations && helpers.integrations.teams;
                if (!teams || typeof teams.sendAlert !== 'function') {
                    return {
                        posted: false,
                        reason: 'Teams connector not configured',
                    };
                }

                const triage = context.stepResults.l1_email_triage || {};
                const sandbox = context.stepResults.sandbox_detonation || {};
                const containment = context.stepResults.containment || {};
                const jiraTicket = context.stepResults.jira_ticket || {};

                const alert = {
                    title: `Email phishing incident - ${triage.subject || 'Unknown subject'}`,
                    description: `Sender: ${triage.sender || 'unknown'}\nSeverity: ${
                        triage.severity || 'unknown'
                    }\nSandbox verdict: ${sandbox.verdict || 'n/a'}`,
                    severity: triage.severity || 'high',
                    source: 'Agentic SOC - Email Workflow',
                    timestamp: new Date().toISOString(),
                    detailsUrl: jiraTicket.issueUrl || undefined,
                    recommendations: triage.recommendedContainment || [],
                };

                const result = await teams.sendAlert(alert, {
                    channel: 'security-email-incidents',
                });

                return {
                    posted: true,
                    messageId: result.messageId,
                    channelId: result.channelId,
                };
            },
        },
        {
            id: 'obsidian_daily_log',
            description: 'Append a structured entry to the Obsidian daily security log.',
            timeoutMs: 10000,
            async run(context, helpers) {
                const obsidian = helpers.integrations && helpers.integrations.obsidian;
                if (!obsidian || typeof obsidian.createDailyLog !== 'function') {
                    return {
                        logged: false,
                        reason: 'Obsidian connector not configured',
                    };
                }

                const triage = context.stepResults.l1_email_triage || {};
                const sandbox = context.stepResults.sandbox_detonation || {};
                const containment = context.stepResults.containment || {};
                const jiraTicket = context.stepResults.jira_ticket || {};

                const logData = {
                    summary: `Phishing alert for "${triage.subject || 'Unknown subject'}" from ${
                        triage.sender || 'unknown sender'
                    }. Severity ${triage.severity || 'unknown'}.`,
                    alerts: [
                        {
                            time: new Date().toISOString(),
                            severity: triage.severity || 'high',
                            description: `Email phishing alert - sandbox verdict: ${
                                sandbox.verdict || 'n/a'
                            }. Containment applied: ${containment.containmentApplied ? 'yes' : 'no'}.`,
                            status: 'handled',
                        },
                    ],
                    incidents: jiraTicket.issueKey
                        ? [
                              {
                                  id: jiraTicket.issueKey,
                                  title: `Email phishing - ${triage.subject || jiraTicket.issueKey}`,
                                  status: 'open',
                                  severity: triage.severity || 'high',
                                  description: `Tracked in Jira as ${jiraTicket.issueKey}`,
                              },
                          ]
                        : [],
                    actions: containment.actions || [],
                    notes: 'Logged automatically by Cipher Guard Agentic SOC email_response workflow.',
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
            id: 'emit_workflow_completed_event',
            description:
                'Emit a workflow:email_response:completed event with key metadata for downstream consumers.',
            async run(context, helpers) {
                const triage = context.stepResults.l1_email_triage || {};
                const sandbox = context.stepResults.sandbox_detonation || {};
                const containment = context.stepResults.containment || {};
                const jiraTicket = context.stepResults.jira_ticket || {};

                await helpers.emitEvent('workflow:email_response:completed', {
                    severity: triage.severity || 'unknown',
                    confidence: triage.confidence,
                    sender: triage.sender,
                    subject: triage.subject,
                    sandboxVerdict: sandbox.verdict || 'n/a',
                    containmentApplied: Boolean(containment.containmentApplied),
                    jiraIssueKey: jiraTicket.issueKey || null,
                    timestamp: new Date().toISOString(),
                });

                return {
                    emitted: true,
                };
            },
        },
    ],
};

module.exports = emailResponseWorkflow;