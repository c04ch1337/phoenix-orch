use crate::{Threat, IncidentReport, Reporter};
use async_trait::async_trait;
use std::error::Error;
use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock};
use std::sync::Arc;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: uuid::Uuid,
    pub severity: AlertSeverity,
    pub title: String,
    pub description: String,
    pub source: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: HashMap<String, String>,
    pub status: AlertStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AlertSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AlertStatus {
    New,
    Acknowledged,
    InProgress,
    Resolved,
    Dismissed,
}

pub struct AlertManager {
    alerts: Arc<RwLock<HashMap<uuid::Uuid, Alert>>>,
    alert_tx: mpsc::Sender<Alert>,
    notification_channels: Vec<Box<dyn NotificationChannel + Send + Sync>>,
}

#[async_trait]
pub trait NotificationChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<(), Box<dyn Error + Send + Sync>>;
}

pub struct WebhookChannel {
    url: String,
    headers: HashMap<String, String>,
}

pub struct EmailChannel {
    smtp_config: SmtpConfig,
    recipients: Vec<String>,
}

#[derive(Clone)]
struct SmtpConfig {
    host: String,
    port: u16,
    username: String,
    password: String,
    from_address: String,
}

impl AlertManager {
    pub fn new(alert_tx: mpsc::Sender<Alert>) -> Self {
        Self {
            alerts: Arc::new(RwLock::new(HashMap::new())),
            alert_tx,
            notification_channels: Vec::new(),
        }
    }

    pub fn add_notification_channel<T: NotificationChannel + Send + Sync + 'static>(&mut self, channel: T) {
        self.notification_channels.push(Box::new(channel));
    }

    async fn create_alert(&self, threat: &Threat) -> Alert {
        Alert {
            id: uuid::Uuid::new_v4(),
            severity: match threat.severity {
                crate::ThreatSeverity::Critical => AlertSeverity::Critical,
                crate::ThreatSeverity::High => AlertSeverity::High,
                crate::ThreatSeverity::Medium => AlertSeverity::Medium,
                crate::ThreatSeverity::Low => AlertSeverity::Low,
            },
            title: format!("Security Threat Detected: {}", threat.source),
            description: threat.description.clone(),
            source: threat.source.clone(),
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
            status: AlertStatus::New,
        }
    }

    async fn store_alert(&self, alert: Alert) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut alerts = self.alerts.write().await;
        alerts.insert(alert.id, alert.clone());
        self.alert_tx.send(alert).await?;
        Ok(())
    }

    async fn notify_channels(&self, alert: &Alert) -> Result<(), Box<dyn Error + Send + Sync>> {
        for channel in &self.notification_channels {
            if let Err(e) = channel.send_notification(alert).await {
                tracing::error!("Failed to send notification through channel: {}", e);
            }
        }
        Ok(())
    }

    pub async fn update_alert_status(&self, alert_id: uuid::Uuid, status: AlertStatus) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut alerts = self.alerts.write().await;
        if let Some(alert) = alerts.get_mut(&alert_id) {
            alert.status = status;
            self.alert_tx.send(alert.clone()).await?;
        }
        Ok(())
    }

    pub async fn get_active_alerts(&self) -> Vec<Alert> {
        let alerts = self.alerts.read().await;
        alerts.values()
            .filter(|alert| alert.status != AlertStatus::Resolved && alert.status != AlertStatus::Dismissed)
            .cloned()
            .collect()
    }
}

#[async_trait]
impl NotificationChannel for WebhookChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<(), Box<dyn Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let mut request = client.post(&self.url);
        
        for (key, value) in &self.headers {
            request = request.header(key, value);
        }

        request.json(alert).send().await?;
        Ok(())
    }
}

#[async_trait]
impl NotificationChannel for EmailChannel {
    async fn send_notification(&self, alert: &Alert) -> Result<(), Box<dyn Error + Send + Sync>> {
        // In a real implementation, this would use an SMTP client to send emails
        tracing::info!(
            "Would send email alert to {:?}: {} - {}",
            self.recipients,
            alert.title,
            alert.description
        );
        Ok(())
    }
}

#[async_trait]
impl Reporter for AlertManager {
    async fn generate_report(&self, _incident: &IncidentReport) -> Result<String, Box<dyn Error + Send + Sync>> {
        // Report generation is handled by the metrics module
        Ok(String::new())
    }

    async fn alert(&self, threat: &Threat) -> Result<(), Box<dyn Error + Send + Sync>> {
        let alert = self.create_alert(threat).await;
        self.store_alert(alert.clone()).await?;
        self.notify_channels(&alert).await?;
        Ok(())
    }

    async fn update_metrics(&self, _incident: &IncidentReport) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Metrics updates are handled by the metrics module
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ThreatSeverity;

    #[tokio::test]
    async fn test_alert_creation() {
        let (tx, mut rx) = mpsc::channel(100);
        let manager = AlertManager::new(tx);

        let threat = Threat {
            id: uuid::Uuid::new_v4(),
            severity: ThreatSeverity::High,
            description: "Test threat".to_string(),
            timestamp: chrono::Utc::now(),
            source: "test_source".to_string(),
        };

        manager.alert(&threat).await.unwrap();

        let alert = rx.recv().await.unwrap();
        assert_eq!(alert.severity, AlertSeverity::High);
        assert_eq!(alert.status, AlertStatus::New);
    }

    #[tokio::test]
    async fn test_alert_status_update() {
        let (tx, _rx) = mpsc::channel(100);
        let manager = AlertManager::new(tx);

        let alert = Alert {
            id: uuid::Uuid::new_v4(),
            severity: AlertSeverity::High,
            title: "Test Alert".to_string(),
            description: "Test description".to_string(),
            source: "test_source".to_string(),
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
            status: AlertStatus::New,
        };

        manager.store_alert(alert.clone()).await.unwrap();
        manager.update_alert_status(alert.id, AlertStatus::Acknowledged).await.unwrap();

        let alerts = manager.alerts.read().await;
        let updated_alert = alerts.get(&alert.id).unwrap();
        assert_eq!(updated_alert.status, AlertStatus::Acknowledged);
    }
}