/**
 * CrowdStrike / Falcon IOA Incident Workflow
 *
 * Triggered by CrowdStrike/Falcon IOA alerts. Orchestrates L1 triage,
 * auto-containment, L2 investigation, hunting, and RCA reporting.
 *
 * This module defines a pure workflow definition object. All external systems
 * are accessed through helpers provided by the WorkflowEngine at runtime.
 */

/**
 * @type {import('../workflow_engine').WorkflowDefinition}
 */
const threatContainmentWorkflow = {
    name: 'threat_containment',
    trigger: ['crowdstrike:ioa'],
    description: 'End-to-end response workflow for CrowdStrike/Falcon IOA alerts.',
    steps: [
        {
            id: 'l1_alert_triage',
            description: 'Route alert to L1 Alert Triage agent for normalization and severity assessment.',
            retry: 1,
            timeoutMs: 15000,
            async run(context, helpers) {
                const alert = context.eventPayload || context.alert || {};
                const host = alert.host || alert.hostname;

                try {
                    await helpers.invokeAgent('l1_alert_triage', {
                        type: 'alert_triage',
                        source: alert.source || 'crowdstrike',
                        rawAlert: alert,
                    });
                } catch (err) {
                    if (helpers.messageBus) {
                        await helpers.messageBus.publish('workflow:warning', {
                            workflow: 'threat_containment',
                            step: 'l1_alert_triage',
                            message: `Error invoking L1 alert triage agent: ${err.message}`,
                        });
                    }
                }

                return {
                    severity: alert.severity || 'high',
                    confidence: alert.confidence || 0.9,
                    host,
                    user: alert.user || alert.username,
                    processes: alert.processes || [],
                    iocs: alert.iocs || [],
                    description: alert.description || 'CrowdStrike IOA alert',
                    alertId: alert.id || alert.alertId || `cs-${Date.now()}`,
                };
            },
        },
        {
            id: 'auto_containment',
            description:
                'If severity/confidence exceed thresholds, isolate host, kill processes, and collect memory dump.',
            retry: 1,
            timeoutMs: 20000,
            async run(context, helpers) {
                const triage = context.stepResults.l1_alert_triage || {};
                const severity = (triage.severity || 'medium').toLowerCase();
                const confidence = typeof triage.confidence === 'number' ? triage.confidence : 0.5;

                const shouldContain =
                    severity === 'critical' ||
                    severity === 'high' ||
                    (severity === 'medium' && confidence >= 0.85);

                if (!shouldContain) {
                    return {
                        containmentExecuted: false,
                        reason: 'Risk below auto-containment threshold',
                    };
                }

                const actions = [];

                if (triage.host) {
                    await helpers.emitEvent('endpoint:isolate_host', {
                        host: triage.host,
                        reason: 'Auto-containment from CrowdStrike IOA workflow',
                    });
                    actions.push(`Isolated host ${triage.host}`);
                }

                if (triage.processes && triage.processes.length > 0) {
                    await helpers.emitEvent('endpoint:kill_processes', {
                        host: triage.host,
                        processes: triage.processes,
                    });
                    actions.push(`Killed ${triage.processes.length} suspicious processes`);
                }

                await helpers.emitEvent('forensics:collect_memory_dump', {
                    host: triage.host,
                    alertId: triage.alertId,
                });
                actions.push('Requested memory dump collection for host');

                return {
                    containmentExecuted: true,
                    actions,
                };
            },
        },
        {
            id: 'l2_incident_response',
            description:
                'Escalate to L2 Incident Response agent for deeper investigation and MITRE technique mapping.',
            retry: 1,
            timeoutMs: 30000,
            async run(context, helpers) {
                const triage = context.stepResults.l1_alert_triage || {};
                const containment = context.stepResults.auto_containment || {};

                let summary;
                try {
                    await helpers.invokeAgent('l2_incident_response', {
                        type: 'incident_response',
                        alert: triage,
                        containment,
                    });
                    // Simulated investigation summary
                    summary = {
                        findings: 'Suspicious PowerShell activity and lateral movement attempts detected.',
                        mitreTechniques: ['T1059.001', 'T1021.001'],
                        impactedHosts: [triage.host].filter(Boolean),
                        impactedUsers: [triage.user].filter(Boolean),
                    };
                } catch (err) {
                    summary = {
                        findings: `Investigation could not be fully executed: ${err.message}`,
                        mitreTechniques: [],
                        impactedHosts: [triage.host].filter(Boolean),
                        impactedUsers: [triage.user].filter(Boolean),
                    };
                }

                return summary;
            },
        },
        {
            id: 'hunt_same_ttp',
            description:
                'Trigger a hunt for the same TTPs across the environment using Threat Hunter / Threat Intel capabilities.',
            timeoutMs: 15000,
            async run(context, helpers) {
                const irSummary = context.stepResults.l2_incident_response || {};
                const mitreTechniques = irSummary.mitreTechniques || [];

                if (mitreTechniques.length === 0) {
                    return {
                        huntTriggered: false,
                        reason: 'No MITRE techniques identified during investigation',
                    };
                }

                await helpers.emitEvent('hunt:ttp', {
                    techniques: mitreTechniques,
                    timeframe: 'last_7_days',
                    source: 'threat_containment_workflow',
                });

                // Simulate a small number of additional hits.
                const hits = [
                    { host: 'host-alpha', user: 'user1', technique: mitreTechniques[0] },
                    { host: 'host-beta', user: 'user2', technique: mitreTechniques[0] },
                ];

                return {
                    huntTriggered: true,
                    mitreTechniques,
                    hits,
                };
            },
        },
        {
            id: 'rca_generation',
            description:
                'Request RCA generation from L3 Incident Manager / IR and emit a report:incident_rca event.',
            retry: 1,
            timeoutMs: 20000,
            async run(context, helpers) {
                const triage = context.stepResults.l1_alert_triage || {};
                const irSummary = context.stepResults.l2_incident_response || {};
                const hunt = context.stepResults.hunt_same_ttp || {};

                let rca;
                try {
                    await helpers.invokeAgent('l3_incident_manager', {
                        type: 'incident_manager',
                        alert: triage,
                        investigation: irSummary,
                        hunt,
                    });

                    rca = {
                        rootCause: 'Compromised user account leveraged to execute malicious PowerShell.',
                        contributingFactors: [
                            'Lack of MFA on administrative account',
                            'Insufficient monitoring of PowerShell downgrade attacks',
                        ],
                        lessonsLearned: [
                            'Enforce MFA for all privileged accounts',
                            'Enhance logging and detections for script downgrade activity',
                        ],
                    };
                } catch (err) {
                    rca = {
                        rootCause: 'RCA generation failed',
                        contributingFactors: [err.message],
                        lessonsLearned: [],
                    };
                }

                await helpers.emitEvent('report:incident_rca', {
                    alertId: triage.alertId,
                    host: triage.host,
                    user: triage.user,
                    rca,
                    mitreTechniques: irSummary.mitreTechniques || [],
                    timestamp: new Date().toISOString(),
                });

                return rca;
            },
        },
    ],
};

module.exports = threatContainmentWorkflow;