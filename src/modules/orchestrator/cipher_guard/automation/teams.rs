use std::sync::Arc;
use tokio::sync::RwLock;
use reqwest::Client;
use serde_json::json;
use chrono::{DateTime, Utc, Local};
use tokio::time::{Duration, sleep};
use std::collections::HashMap;

use crate::modules::orchestrator::cipher_guard::automation::{
    config::AutomationConfig,
    types::{DailyBriefing, Incident, Vulnerability, Severity},
};

pub struct TeamsIntegration {
    config: Arc<RwLock<AutomationConfig>>,
    client: Client,
    message_queue: Arc<RwLock<Vec<TeamsMessage>>>,
}

#[derive(Debug, Clone)]
struct TeamsMessage {
    content: serde_json::Value,
    priority: MessagePriority,
    timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum MessagePriority {
    Low,
    Normal,
    High,
    Urgent,
}

impl TeamsIntegration {
    pub async fn new(config: Arc<RwLock<AutomationConfig>>) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            config,
            client: Client::new(),
            message_queue: Arc::new(RwLock::new(Vec::new())),
        })
    }

    pub async fn connect(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Start message processing loop
        let message_queue = self.message_queue.clone();
        let config = self.config.clone();
        let client = self.client.clone();

        tokio::spawn(async move {
            loop {
                Self::process_message_queue(&client, &config, &message_queue).await;
                sleep(Duration::from_secs(1)).await;
            }
        });

        Ok(())
    }

    pub async fn disconnect(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Wait for message queue to empty
        while !self.message_queue.read().await.is_empty() {
            sleep(Duration::from_secs(1)).await;
        }
        Ok(())
    }

    pub async fn post_daily_briefing(&self, briefing: &DailyBriefing) -> Result<(), Box<dyn std::error::Error>> {
        let card = self.create_briefing_card(briefing);
        self.queue_message(card, MessagePriority::Normal).await?;
        Ok(())
    }

    pub async fn post_incident_alert(&self, incident: &Incident) -> Result<(), Box<dyn std::error::Error>> {
        let card = self.create_incident_card(incident);
        let priority = match incident.severity {
            Severity::Critical | Severity::High => MessagePriority::Urgent,
            Severity::Medium => MessagePriority::High,
            Severity::Low => MessagePriority::Normal,
        };
        self.queue_message(card, priority).await?;
        Ok(())
    }

    pub async fn post_vulnerability_alert(&self, vuln: &Vulnerability) -> Result<(), Box<dyn std::error::Error>> {
        let card = self.create_vulnerability_card(vuln);
        let priority = match vuln.severity {
            Severity::Critical | Severity::High => MessagePriority::Urgent,
            Severity::Medium => MessagePriority::High,
            Severity::Low => MessagePriority::Normal,
        };
        self.queue_message(card, priority).await?;
        Ok(())
    }

    async fn queue_message(&self, content: serde_json::Value, priority: MessagePriority) -> Result<(), Box<dyn std::error::Error>> {
        let message = TeamsMessage {
            content,
            priority,
            timestamp: Utc::now(),
        };
        self.message_queue.write().await.push(message);
        Ok(())
    }

    async fn process_message_queue(
        client: &Client,
        config: &Arc<RwLock<AutomationConfig>>,
        queue: &Arc<RwLock<Vec<TeamsMessage>>>,
    ) {
        let config = config.read().await;
        let webhook_url = &config.teams.webhook_url;
        let rate_limit = &config.teams.rate_limit;

        // Get messages to process
        let mut messages = queue.write().await;
        if messages.is_empty() {
            return;
        }

        // Sort by priority
        messages.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Process up to rate limit
        let mut processed = 0;
        while processed < rate_limit.messages_per_minute && !messages.is_empty() {
            if let Some(message) = messages.pop() {
                if let Err(e) = Self::send_teams_message(client, webhook_url, message.content.clone()).await {
                    eprintln!("Error sending Teams message: {}", e);
                    // Re-queue failed message
                    messages.push(message);
                }
                processed += 1;
                sleep(Duration::from_millis(100)).await;
            }
        }
    }

    async fn send_teams_message(
        client: &Client,
        webhook_url: &str,
        content: serde_json::Value,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let response = client
            .post(webhook_url)
            .json(&content)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!(
                "Teams API error: {} - {}",
                response.status(),
                response.text().await?
            ).into());
        }

        Ok(())
    }

    fn create_briefing_card(&self, briefing: &DailyBriefing) -> serde_json::Value {
        json!({
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Large",
                    "weight": "Bolder",
                    "text": "Daily Security Briefing"
                },
                {
                    "type": "TextBlock",
                    "text": format!("Generated: {}", 
                        briefing.generated_at.with_timezone(&Local).format("%Y-%m-%d %H:%M:%S %Z"))
                },
                {
                    "type": "Container",
                    "items": self.create_incident_section(&briefing.incidents)
                },
                {
                    "type": "Container",
                    "items": self.create_vulnerability_section(&briefing.vulnerabilities)
                },
                {
                    "type": "Container",
                    "items": self.create_phishing_section(&briefing.phishing_stats)
                },
                {
                    "type": "Container",
                    "items": self.create_edr_section(&briefing.edr_alerts)
                },
                {
                    "type": "Container",
                    "items": self.create_recommendations_section(&briefing.recommendations)
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "title": "View Full Report",
                    "url": "https://security-dashboard/briefings"  // TODO: Make configurable
                }
            ]
        })
    }

    fn create_incident_card(&self, incident: &Incident) -> serde_json::Value {
        json!({
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Large",
                    "weight": "Bolder",
                    "text": format!("🚨 New {} Incident", incident.severity)
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {
                            "title": "ID",
                            "value": incident.id
                        },
                        {
                            "title": "Title",
                            "value": incident.title
                        },
                        {
                            "title": "Status",
                            "value": incident.status
                        },
                        {
                            "title": "Created",
                            "value": incident.created_at
                                .with_timezone(&Local)
                                .format("%Y-%m-d %H:%M:%S %Z")
                                .to_string()
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "title": "View Incident",
                    "url": format!("https://security-dashboard/incidents/{}", incident.id)
                }
            ]
        })
    }

    fn create_vulnerability_card(&self, vuln: &Vulnerability) -> serde_json::Value {
        json!({
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Large",
                    "weight": "Bolder",
                    "text": format!("⚠️ New {} Vulnerability", vuln.severity)
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {
                            "title": "ID",
                            "value": vuln.id
                        },
                        {
                            "title": "Title",
                            "value": vuln.title
                        },
                        {
                            "title": "CVSS Score",
                            "value": format!("{:.1}", vuln.cvss_score)
                        },
                        {
                            "title": "Discovered",
                            "value": vuln.discovered_at
                                .with_timezone(&Local)
                                .format("%Y-%m-d %H:%M:%S %Z")
                                .to_string()
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "title": "View Details",
                    "url": format!("https://security-dashboard/vulnerabilities/{}", vuln.id)
                }
            ]
        })
    }

    fn create_incident_section(&self, incidents: &[Incident]) -> Vec<serde_json::Value> {
        let mut items = vec![
            json!({
                "type": "TextBlock",
                "weight": "Bolder",
                "text": "Active Incidents"
            })
        ];

        for incident in incidents.iter().take(5) {
            items.push(json!({
                "type": "TextBlock",
                "text": format!("• [{} | {}] {}", incident.severity, incident.id, incident.title)
            }));
        }

        items
    }

    fn create_vulnerability_section(&self, vulnerabilities: &[Vulnerability]) -> Vec<serde_json::Value> {
        let mut items = vec![
            json!({
                "type": "TextBlock",
                "weight": "Bolder",
                "text": "New High/Critical Vulnerabilities"
            })
        ];

        for vuln in vulnerabilities {
            if matches!(vuln.severity, Severity::High | Severity::Critical) {
                items.push(json!({
                    "type": "TextBlock",
                    "text": format!("• [CVSS: {}] {}", vuln.cvss_score, vuln.title)
                }));
            }
        }

        items
    }

    fn create_phishing_section(&self, stats: &crate::modules::orchestrator::cipher_guard::automation::types::PhishingStats) -> Vec<serde_json::Value> {
        vec![
            json!({
                "type": "TextBlock",
                "weight": "Bolder",
                "text": "Phishing Statistics"
            }),
            json!({
                "type": "FactSet",
                "facts": [
                    {
                        "title": "Total Attempts",
                        "value": stats.total_attempts.to_string()
                    },
                    {
                        "title": "Blocked",
                        "value": stats.blocked_attempts.to_string()
                    },
                    {
                        "title": "Reported",
                        "value": stats.reported_attempts.to_string()
                    },
                    {
                        "title": "Click Rate",
                        "value": format!("{:.2}%", stats.click_rate * 100.0)
                    }
                ]
            })
        ]
    }

    fn create_edr_section(&self, alerts: &[crate::modules::orchestrator::cipher_guard::automation::types::EdrAlert]) -> Vec<serde_json::Value> {
        let mut items = vec![
            json!({
                "type": "TextBlock",
                "weight": "Bolder",
                "text": "EDR Alerts"
            })
        ];

        for alert in alerts {
            items.push(json!({
                "type": "TextBlock",
                "text": format!("• [{} | {}] {}", alert.severity, alert.status, alert.title)
            }));
        }

        items
    }

    fn create_recommendations_section(&self, recommendations: &[String]) -> Vec<serde_json::Value> {
        let mut items = vec![
            json!({
                "type": "TextBlock",
                "weight": "Bolder",
                "text": "Recommendations"
            })
        ];

        for recommendation in recommendations {
            items.push(json!({
                "type": "TextBlock",
                "text": format!("• {}", recommendation)
            }));
        }

        items
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_teams_integration() {
        // Test implementation will go here
    }
}