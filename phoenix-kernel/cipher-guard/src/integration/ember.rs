use crate::{Threat, IncidentReport, Evidence};
use async_trait::async_trait;
use std::error::Error;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use serde::{Serialize, Deserialize};
use reqwest::Client;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmberUnitConfig {
    pub base_url: String,
    pub api_key: String,
    pub ws_url: String,
}

pub struct EmberUnitIntegration {
    config: EmberUnitConfig,
    client: Client,
    ws_sender: Arc<RwLock<Option<mpsc::Sender<Message>>>>,
    threat_tx: mpsc::Sender<Threat>,
}

#[derive(Debug, Serialize)]
struct ThreatIntelRequest {
    source: String,
    indicators: Vec<String>,
    context: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct ThreatIntelResponse {
    threat_level: String,
    confidence: f64,
    related_threats: Vec<RelatedThreat>,
    recommendations: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct RelatedThreat {
    id: String,
    description: String,
    severity: String,
    first_seen: String,
    last_seen: String,
}

impl EmberUnitIntegration {
    pub fn new(config: EmberUnitConfig, threat_tx: mpsc::Sender<Threat>) -> Self {
        Self {
            config,
            client: Client::new(),
            ws_sender: Arc::new(RwLock::new(None)),
            threat_tx,
        }
    }

    pub async fn connect(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Start WebSocket connection
        self.connect_websocket().await?;
        
        // Test HTTP connection
        self.health_check().await?;
        
        Ok(())
    }

    async fn health_check(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let url = format!("{}/health", self.config.base_url);
        let response = self.client
            .get(&url)
            .header("Authorization", &self.config.api_key)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err("Failed to connect to Ember Unit API".into());
        }

        Ok(())
    }

    async fn connect_websocket(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let ws_url = Url::parse(&self.config.ws_url)?;
        let (ws_stream, _) = connect_async(ws_url).await?;
        let (mut write, mut read) = ws_stream.split();

        // Create channel for sending WebSocket messages
        let (tx, mut rx) = mpsc::channel::<Message>(100);
        *self.ws_sender.write().await = Some(tx);

        // Handle incoming WebSocket messages
        let threat_tx = self.threat_tx.clone();
        tokio::spawn(async move {
            while let Some(message) = read.next().await {
                match message {
                    Ok(msg) => {
                        if let Ok(text) = msg.to_text() {
                            if let Ok(ws_msg) = serde_json::from_str::<EmberUnitWebSocketMessage>(text) {
                                match ws_msg {
                                    EmberUnitWebSocketMessage::FindingDiscovered { finding_id, severity, title, .. } => {
                                        let threat = Threat {
                                            id: uuid::Uuid::new_v4(),
                                            severity: match severity.as_str() {
                                                "critical" => crate::ThreatSeverity::Critical,
                                                "high" => crate::ThreatSeverity::High,
                                                "medium" => crate::ThreatSeverity::Medium,
                                                _ => crate::ThreatSeverity::Low,
                                            },
                                            description: title,
                                            timestamp: chrono::Utc::now(),
                                            source: "EmberUnit".to_string(),
                                        };
                                        
                                        if let Err(e) = threat_tx.send(threat).await {
                                            tracing::error!("Failed to send threat from Ember Unit: {}", e);
                                        }
                                    }
                                    EmberUnitWebSocketMessage::SafetyAlert { message, severity, .. } => {
                                        let threat = Threat {
                                            id: uuid::Uuid::new_v4(),
                                            severity: match severity.as_str() {
                                                "critical" => crate::ThreatSeverity::Critical,
                                                "high" => crate::ThreatSeverity::High,
                                                "medium" => crate::ThreatSeverity::Medium,
                                                _ => crate::ThreatSeverity::Low,
                                            },
                                            description: message,
                                            timestamp: chrono::Utc::now(),
                                            source: "EmberUnit-Safety".to_string(),
                                        };
                                        
                                        if let Err(e) = threat_tx.send(threat).await {
                                            tracing::error!("Failed to send safety alert from Ember Unit: {}", e);
                                        }
                                    }
                                    _ => {} // Handle other message types as needed
                                }
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                }
            }
        });

        // Handle outgoing WebSocket messages
        tokio::spawn(async move {
            while let Some(message) = rx.recv().await {
                if let Err(e) = write.send(message).await {
                    tracing::error!("Failed to send WebSocket message: {}", e);
                    break;
                }
            }
        });

        Ok(())
    }

    pub async fn analyze_threat(&self, threat: &Threat) -> Result<ThreatIntelResponse, Box<dyn Error + Send + Sync>> {
        let url = format!("{}/api/v1/analyze", self.config.base_url);
        
        let request = ThreatIntelRequest {
            source: threat.source.clone(),
            indicators: vec![threat.description.clone()],
            context: HashMap::from([
                ("severity".to_string(), format!("{:?}", threat.severity)),
                ("timestamp".to_string(), threat.timestamp.to_rfc3339()),
            ]),
        };

        let response = self.client
            .post(&url)
            .header("Authorization", &self.config.api_key)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Ember Unit analysis failed: {}", response.status()).into());
        }

        let intel: ThreatIntelResponse = response.json().await?;
        Ok(intel)
    }

    pub async fn submit_evidence(&self, evidence: &Evidence) -> Result<(), Box<dyn Error + Send + Sync>> {
        let url = format!("{}/api/v1/evidence", self.config.base_url);
        
        let response = self.client
            .post(&url)
            .header("Authorization", &self.config.api_key)
            .json(&evidence)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to submit evidence to Ember Unit: {}", response.status()).into());
        }

        Ok(())
    }

    pub async fn send_incident_report(&self, report: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        let url = format!("{}/api/v1/incidents", self.config.base_url);
        
        let response = self.client
            .post(&url)
            .header("Authorization", &self.config.api_key)
            .json(&report)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to send incident report to Ember Unit: {}", response.status()).into());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_ember_unit_integration() {
        let (tx, _rx) = mpsc::channel(100);
        
        let config = EmberUnitConfig {
            base_url: "http://localhost:8080".to_string(),
            api_key: "test_key".to_string(),
            ws_url: "ws://localhost:8080/ws/ember-unit".to_string(),
        };

        let integration = EmberUnitIntegration::new(config, tx);
        
        let threat = Threat {
            id: uuid::Uuid::new_v4(),
            severity: crate::ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: chrono::Utc::now(),
            source: "test_source".to_string(),
        };

        // Note: These tests would require a running Ember Unit instance
        // For now, they're just placeholders
        // integration.connect().await.unwrap();
        // let intel = integration.analyze_threat(&threat).await.unwrap();
        // assert!(intel.confidence > 0.0);
    }
}