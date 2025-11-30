use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use anyhow::Result;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use async_trait::async_trait;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCommand {
    pub tool_id: Uuid,
    pub command_type: String,
    pub parameters: serde_json::Value,
    pub context: ExecutionContext,
    pub timeout: std::time::Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResponse {
    pub status: ResponseStatus,
    pub data: Option<serde_json::Value>,
    pub metrics: ExecutionMetrics,
    pub errors: Vec<ToolError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub ember_phase: Option<String>,
    pub cipher_phase: Option<String>,
    pub security_context: SecurityContext,
    pub resource_limits: ResourceLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityContext {
    pub permissions: Vec<String>,
    pub restrictions: Vec<String>,
    pub audit_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_cpu: f32,
    pub max_memory: u64,
    pub max_time: std::time::Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionMetrics {
    pub duration: std::time::Duration,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub error_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseStatus {
    Success,
    Partial,
    Failed,
    Timeout,
    Unauthorized,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

#[async_trait]
pub trait ToolBridge: Send + Sync {
    async fn execute_command(&self, command: ToolCommand) -> Result<ToolResponse>;
    async fn register_tool(&self, tool_id: Uuid, capabilities: Vec<String>) -> Result<()>;
    async fn unregister_tool(&self, tool_id: Uuid) -> Result<()>;
}

pub struct UniversalToolBridge {
    ember_client: Arc<EmberUnitClient>,
    cipher_client: Arc<CipherGuardClient>,
    tools: Arc<RwLock<Tools>>,
    command_tx: mpsc::Sender<BridgeCommand>,
}

struct Tools {
    registered: std::collections::HashMap<Uuid, ToolInfo>,
}

struct ToolInfo {
    capabilities: Vec<String>,
    status: ToolStatus,
    last_seen: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
enum ToolStatus {
    Active,
    Suspended,
    Error(String),
}

enum BridgeCommand {
    Execute(ToolCommand, oneshot::Sender<Result<ToolResponse>>),
    Register(Uuid, Vec<String>, oneshot::Sender<Result<()>>),
    Unregister(Uuid, oneshot::Sender<Result<()>>),
}

impl UniversalToolBridge {
    pub fn new(ember_url: &str, cipher_url: &str) -> Result<Self> {
        let (command_tx, mut command_rx) = mpsc::channel(100);
        
        let bridge = Self {
            ember_client: Arc::new(EmberUnitClient::new(ember_url)?),
            cipher_client: Arc::new(CipherGuardClient::new(cipher_url)?),
            tools: Arc::new(RwLock::new(Tools {
                registered: std::collections::HashMap::new(),
            })),
            command_tx,
        };

        // Spawn command processor
        let bridge_clone = bridge.clone();
        tokio::spawn(async move {
            while let Some(cmd) = command_rx.recv().await {
                match cmd {
                    BridgeCommand::Execute(cmd, resp) => {
                        let result = bridge_clone.handle_command(cmd).await;
                        let _ = resp.send(result);
                    }
                    BridgeCommand::Register(id, caps, resp) => {
                        let result = bridge_clone.handle_registration(id, caps).await;
                        let _ = resp.send(result);
                    }
                    BridgeCommand::Unregister(id, resp) => {
                        let result = bridge_clone.handle_unregistration(id).await;
                        let _ = resp.send(result);
                    }
                }
            }
        });

        Ok(bridge)
    }

    async fn handle_command(&self, command: ToolCommand) -> Result<ToolResponse> {
        // Validate tool is registered
        let tools = self.tools.read().await;
        let tool_info = tools.registered.get(&command.tool_id)
            .ok_or_else(|| anyhow::anyhow!("Tool not registered"))?;

        // Check capabilities
        if !self.validate_capabilities(&command, &tool_info.capabilities) {
            return Ok(ToolResponse {
                status: ResponseStatus::Unauthorized,
                data: None,
                metrics: ExecutionMetrics {
                    duration: std::time::Duration::from_secs(0),
                    cpu_usage: 0.0,
                    memory_usage: 0,
                    error_count: 1,
                },
                errors: vec![ToolError {
                    code: "UNAUTHORIZED".to_string(),
                    message: "Tool lacks required capabilities".to_string(),
                    details: None,
                }],
            });
        }

        // Route command to appropriate module
        let response = if command.context.ember_phase.is_some() {
            self.ember_client.execute_command(command).await?
        } else if command.context.cipher_phase.is_some() {
            self.cipher_client.execute_command(command).await?
        } else {
            anyhow::bail!("Command context must specify either ember_phase or cipher_phase");
        };

        Ok(response)
    }

    async fn handle_registration(&self, tool_id: Uuid, capabilities: Vec<String>) -> Result<()> {
        let mut tools = self.tools.write().await;
        
        tools.registered.insert(tool_id, ToolInfo {
            capabilities,
            status: ToolStatus::Active,
            last_seen: chrono::Utc::now(),
        });

        // Register with modules
        self.ember_client.register_tool(tool_id).await?;
        self.cipher_client.register_tool(tool_id).await?;

        Ok(())
    }

    async fn handle_unregistration(&self, tool_id: Uuid) -> Result<()> {
        let mut tools = self.tools.write().await;
        tools.registered.remove(&tool_id);

        // Unregister from modules
        self.ember_client.unregister_tool(tool_id).await?;
        self.cipher_client.unregister_tool(tool_id).await?;

        Ok(())
    }

    fn validate_capabilities(&self, command: &ToolCommand, capabilities: &[String]) -> bool {
        // Implement capability validation logic
        true // Simplified for example
    }
}

#[async_trait]
impl ToolBridge for UniversalToolBridge {
    async fn execute_command(&self, command: ToolCommand) -> Result<ToolResponse> {
        let (tx, rx) = oneshot::channel();
        self.command_tx.send(BridgeCommand::Execute(command, tx)).await?;
        rx.await?
    }

    async fn register_tool(&self, tool_id: Uuid, capabilities: Vec<String>) -> Result<()> {
        let (tx, rx) = oneshot::channel();
        self.command_tx.send(BridgeCommand::Register(tool_id, capabilities, tx)).await?;
        rx.await?
    }

    async fn unregister_tool(&self, tool_id: Uuid) -> Result<()> {
        let (tx, rx) = oneshot::channel();
        self.command_tx.send(BridgeCommand::Unregister(tool_id, tx)).await?;
        rx.await?
    }
}

impl Clone for UniversalToolBridge {
    fn clone(&self) -> Self {
        Self {
            ember_client: self.ember_client.clone(),
            cipher_client: self.cipher_client.clone(),
            tools: self.tools.clone(),
            command_tx: self.command_tx.clone(),
        }
    }
}