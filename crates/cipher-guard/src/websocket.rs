use actix::{Actor, ActorContext, AsyncContext, Handler, Message, StreamHandler};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::broadcast::{self, Sender};
use tokio::sync::RwLock;

use crate::ethics::EthicalEvaluation;
use crate::orchestration::DefenseStatus;

/// WebSocket connection actor
pub struct CipherGuardWs {
    /// Client ID
    id: String,
    /// Broadcast channel for defense events
    defense_tx: Sender<DefenseEvent>,
    /// Active defense engagements
    engagements: Arc<RwLock<HashMap<String, DefenseStatus>>>,
}

impl CipherGuardWs {
    pub fn new(
        id: String,
        defense_tx: Sender<DefenseEvent>,
        engagements: Arc<RwLock<HashMap<String, DefenseStatus>>>,
    ) -> Self {
        Self {
            id,
            defense_tx,
            engagements,
        }
    }
}

impl Actor for CipherGuardWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to defense events
        let mut rx = self.defense_tx.subscribe();
        let addr = ctx.address();

        // Handle incoming defense events
        actix::spawn(async move {
            while let Ok(event) = rx.recv().await {
                addr.do_send(event);
            }
        });
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for CipherGuardWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                if let Ok(command) = serde_json::from_str::<WsCommand>(&text) {
                    self.handle_command(command, ctx);
                }
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

impl Handler<DefenseEvent> for CipherGuardWs {
    type Result = ();

    fn handle(&mut self, event: DefenseEvent, ctx: &mut Self::Context) {
        // Send event to client
        if let Ok(event_json) = serde_json::to_string(&event) {
            ctx.text(event_json);
        }
    }
}

impl CipherGuardWs {
    fn handle_command(&mut self, command: WsCommand, ctx: &mut ws::WebsocketContext<Self>) {
        match command {
            WsCommand::Subscribe { engagement_id } => {
                if let Ok(event_json) = serde_json::to_string(&WsResponse::Subscribed {
                    engagement_id: engagement_id.clone(),
                }) {
                    ctx.text(event_json);
                }
            }
            WsCommand::Unsubscribe { engagement_id } => {
                if let Ok(event_json) = serde_json::to_string(&WsResponse::Unsubscribed {
                    engagement_id: engagement_id.clone(),
                }) {
                    ctx.text(event_json);
                }
            }
            WsCommand::GetStatus { engagement_id } => {
                let engagements = self.engagements.clone();
                let ctx_addr = ctx.address();
                
                actix::spawn(async move {
                    if let Ok(engagements) = engagements.read().await {
                        if let Some(status) = engagements.get(&engagement_id) {
                            if let Ok(event_json) = serde_json::to_string(&WsResponse::Status {
                                engagement_id: engagement_id.clone(),
                                status: status.clone(),
                            }) {
                                ctx_addr.do_send(ws::Message::Text(event_json));
                            }
                        }
                    }
                });
            }
        }
    }
}

/// WebSocket commands from clients
#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsCommand {
    Subscribe { engagement_id: String },
    Unsubscribe { engagement_id: String },
    GetStatus { engagement_id: String },
}

/// WebSocket responses to clients
#[derive(Debug, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsResponse {
    Subscribed { engagement_id: String },
    Unsubscribed { engagement_id: String },
    Status { engagement_id: String, status: DefenseStatus },
    Error { message: String },
}

/// Defense events for real-time updates
#[derive(Debug, Clone, Serialize, Message)]
#[rtype(result = "()")]
pub enum DefenseEvent {
    EngagementStarted {
        engagement_id: String,
        timestamp: i64,
        ethical_evaluation: EthicalEvaluation,
    },
    DefenseActivated {
        engagement_id: String,
        timestamp: i64,
        defense_type: String,
    },
    ThreatDetected {
        engagement_id: String,
        timestamp: i64,
        threat_details: ThreatDetails,
    },
    DefenseExecuted {
        engagement_id: String,
        timestamp: i64,
        action_details: ActionDetails,
    },
    EvidenceCollected {
        engagement_id: String,
        timestamp: i64,
        evidence_id: String,
    },
    EngagementCompleted {
        engagement_id: String,
        timestamp: i64,
        summary: EngagementSummary,
    },
    EngagementTerminated {
        engagement_id: String,
        timestamp: i64,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct ThreatDetails {
    pub threat_type: String,
    pub severity: String,
    pub indicators: Vec<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionDetails {
    pub action_type: String,
    pub target: String,
    pub result: String,
    pub impact: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EngagementSummary {
    pub duration: i64,
    pub threats_detected: i32,
    pub actions_taken: i32,
    pub evidence_collected: i32,
    pub overall_effectiveness: f64,
}

/// WebSocket service for managing connections
pub struct WebSocketService {
    defense_tx: Sender<DefenseEvent>,
    engagements: Arc<RwLock<HashMap<String, DefenseStatus>>>,
}

impl WebSocketService {
    pub fn new() -> Self {
        let (defense_tx, _) = broadcast::channel(100);
        let engagements = Arc::new(RwLock::new(HashMap::new()));
        
        Self {
            defense_tx,
            engagements,
        }
    }

    pub fn get_defense_sender(&self) -> Sender<DefenseEvent> {
        self.defense_tx.clone()
    }

    pub fn create_websocket(&self, id: String) -> CipherGuardWs {
        CipherGuardWs::new(
            id,
            self.defense_tx.clone(),
            self.engagements.clone(),
        )
    }

    pub async fn update_engagement_status(&self, id: String, status: DefenseStatus) {
        let mut engagements = self.engagements.write().await;
        engagements.insert(id, status);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};
    use actix_web_actors::ws::WsResponseBuilder;

    #[actix_rt::test]
    async fn test_websocket_connection() {
        let ws_service = web::Data::new(WebSocketService::new());
        
        let app = test::init_service(
            App::new()
                .app_data(ws_service.clone())
                .route("/ws", web::get().to(|ws_service: web::Data<WebSocketService>| async move {
                    let resp = WsResponseBuilder::new()
                        .protocol("cipher-guard-protocol")
                        .start_with_actor(ws_service.create_websocket("test-client".to_string()));
                    Ok::<_, actix_web::Error>(resp)
                }))
        ).await;

        let req = test::TestRequest::get().uri("/ws").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}