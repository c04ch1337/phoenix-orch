use crate::{Threat, IncidentReport, Evidence};
use futures_util::{SinkExt, StreamExt};
use serde::{Serialize, Deserialize};
use std::error::Error;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};
use warp::ws::{WebSocket, Ws};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum MonitoringMessage {
    ThreatDetected(Threat),
    IncidentUpdate(IncidentReport),
    EvidenceCollected(Evidence),
    SystemStatus(SystemStatus),
    AgentStatus(AgentStatus),
    MetricsUpdate(MetricsUpdate),
    Alert(AlertMessage),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub status: String,
    pub active_monitors: u32,
    pub active_defenders: u32,
    pub threat_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatus {
    pub agent_id: uuid::Uuid,
    pub agent_type: String,
    pub status: String,
    pub last_active: chrono::DateTime<chrono::Utc>,
    pub current_task: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsUpdate {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub active_connections: u32,
    pub threats_detected: u32,
    pub incidents_resolved: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertMessage {
    pub id: uuid::Uuid,
    pub severity: String,
    pub message: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub source: String,
}

pub struct WebSocketServer {
    clients: Arc<RwLock<HashMap<uuid::Uuid, mpsc::Sender<Message>>>>,
    broadcast_tx: mpsc::Sender<MonitoringMessage>,
    broadcast_rx: Arc<RwLock<mpsc::Receiver<MonitoringMessage>>>,
}

impl WebSocketServer {
    pub fn new() -> Self {
        let (broadcast_tx, broadcast_rx) = mpsc::channel(100);
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            broadcast_tx,
            broadcast_rx: Arc::new(RwLock::new(broadcast_rx)),
        }
    }

    pub fn get_broadcast_sender(&self) -> mpsc::Sender<MonitoringMessage> {
        self.broadcast_tx.clone()
    }

    pub async fn handle_websocket_upgrade(self: Arc<Self>, ws: Ws) -> Result<impl warp::Reply, warp::Rejection> {
        Ok(ws.on_upgrade(move |socket| self.handle_websocket_client(socket)))
    }

    async fn handle_websocket_client(self: Arc<Self>, ws: WebSocket) {
        let client_id = uuid::Uuid::new_v4();
        let (mut client_ws_tx, mut client_ws_rx) = ws.split();
        let (client_tx, mut client_rx) = mpsc::channel(100);

        // Store the sender for this client
        self.clients.write().await.insert(client_id, client_tx);

        // Handle incoming messages from the client
        let clients = self.clients.clone();
        tokio::spawn(async move {
            while let Some(result) = client_ws_rx.next().await {
                match result {
                    Ok(msg) => {
                        if msg.is_close() {
                            break;
                        }
                        // Handle client messages if needed
                    }
                    Err(e) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                }
            }

            // Client disconnected
            clients.write().await.remove(&client_id);
        });

        // Send messages to the client
        while let Some(msg) = client_rx.recv().await {
            if let Err(e) = client_ws_tx.send(msg).await {
                tracing::error!("Failed to send message to client {}: {}", client_id, e);
                break;
            }
        }
    }

    pub async fn broadcast(&self, message: MonitoringMessage) -> Result<(), Box<dyn Error + Send + Sync>> {
        let msg = serde_json::to_string(&message)?;
        let clients = self.clients.read().await;
        
        for client_tx in clients.values() {
            if let Err(e) = client_tx.send(Message::Text(msg.clone())).await {
                tracing::error!("Failed to broadcast message: {}", e);
            }
        }
        
        Ok(())
    }

    pub async fn start_broadcast_handler(self: Arc<Self>) {
        let mut rx = self.broadcast_rx.write().await;
        
        while let Some(message) = rx.recv().await {
            if let Err(e) = self.broadcast(message).await {
                tracing::error!("Broadcast error: {}", e);
            }
        }
    }

    pub async fn send_system_status(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let status = SystemStatus {
            timestamp: chrono::Utc::now(),
            status: "operational".to_string(),
            active_monitors: 5,
            active_defenders: 3,
            threat_level: "normal".to_string(),
        };

        self.broadcast(MonitoringMessage::SystemStatus(status)).await
    }

    pub async fn send_metrics_update(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let metrics = MetricsUpdate {
            timestamp: chrono::Utc::now(),
            cpu_usage: 45.5,
            memory_usage: 60.2,
            active_connections: 12,
            threats_detected: 5,
            incidents_resolved: 3,
        };

        self.broadcast(MonitoringMessage::MetricsUpdate(metrics)).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_tungstenite::connect_async;
    use url::Url;

    #[tokio::test]
    async fn test_websocket_server() {
        let server = Arc::new(WebSocketServer::new());
        let server_clone = server.clone();

        // Start the WebSocket server
        tokio::spawn(async move {
            server_clone.start_broadcast_handler().await;
        });

        // Create a test client
        let url = Url::parse("ws://localhost:8080/ws").unwrap();
        let (mut ws_stream, _) = connect_async(url).await.unwrap();

        // Send a test message
        let test_message = MonitoringMessage::SystemStatus(SystemStatus {
            timestamp: chrono::Utc::now(),
            status: "test".to_string(),
            active_monitors: 1,
            active_defenders: 1,
            threat_level: "low".to_string(),
        });

        server.broadcast(test_message).await.unwrap();

        // Receive the message
        if let Some(Ok(msg)) = ws_stream.next().await {
            assert!(msg.is_text());
            let received: MonitoringMessage = serde_json::from_str(msg.to_text().unwrap()).unwrap();
            match received {
                MonitoringMessage::SystemStatus(status) => {
                    assert_eq!(status.status, "test");
                }
                _ => panic!("Unexpected message type"),
            }
        }
    }
}