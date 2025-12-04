//! Phoenix Notifications Module
//! 
//! A cross-platform notification system for Phoenix Orch that provides:
//! - OS-native toast notifications
//! - Neuralink direct alerts
//! - Voice notifications for critical events
//! - Work-KB logging of all notification events

use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{info, warn, error, debug};
use async_trait::async_trait;
use std::collections::HashMap;
use std::path::PathBuf;

// Type definitions for our notification system

/// The priority level of a notification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum NotificationPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// The type of notification to be sent
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum NotificationType {
    Toast,
    Voice,
    Neuralink,
    WorkKB,
    All,
}

/// The source of a notification
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum NotificationSource {
    AgentManager,
    PlanningSystem,
    TerminalAgent,
    BrowserAgent,
    ArtifactSystem,
    System,
    Custom(String),
}

/// Structure representing a single notification
#[derive(Debug, Clone)]
pub struct Notification {
    pub id: String,
    pub title: String,
    pub message: String,
    pub priority: NotificationPriority,
    pub source: NotificationSource,
    pub notification_type: NotificationType,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: HashMap<String, String>,
}

impl Notification {
    pub fn new(
        title: impl Into<String>,
        message: impl Into<String>,
        priority: NotificationPriority,
        source: NotificationSource,
        notification_type: NotificationType,
    ) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        Self {
            id,
            title: title.into(),
            message: message.into(),
            priority,
            source,
            notification_type,
            timestamp: chrono::Utc::now(),
            metadata: HashMap::new(),
        }
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }
    
    pub fn is_critical(&self) -> bool {
        self.priority == NotificationPriority::Critical
    }
}

/// Trait for notification providers (cross-platform)
#[async_trait]
trait NotificationProvider: Send + Sync {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError>;
    fn name(&self) -> &str;
    fn supported_platforms(&self) -> Vec<&str>;
}

/// Windows toast notification provider
struct WindowsNotificationProvider {
    app_id: String,
}

#[async_trait]
impl NotificationProvider for WindowsNotificationProvider {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        // Implementation for Windows toast notifications
        #[cfg(target_os = "windows")]
        {
            debug!("Sending Windows toast notification: {}", notification.title);
            // Here we would use the windows-rs crate or similar to send native Windows notifications
            // For now, we'll just log it
            info!("Windows Toast: {} - {}", notification.title, notification.message);
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On non-Windows platforms, we'll just log that we would have sent a notification
            debug!("Would send Windows notification if on Windows: {}", notification.title);
            Err(NotificationError::UnsupportedPlatform("Windows".to_string()))
        }
    }

    fn name(&self) -> &str {
        "Windows Toast"
    }

    fn supported_platforms(&self) -> Vec<&str> {
        vec!["windows"]
    }
}

/// macOS notification provider
struct MacOSNotificationProvider;

#[async_trait]
impl NotificationProvider for MacOSNotificationProvider {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        #[cfg(target_os = "macos")]
        {
            debug!("Sending macOS notification: {}", notification.title);
            // Use macOS-specific notification APIs
            info!("macOS Notification: {} - {}", notification.title, notification.message);
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            debug!("Would send macOS notification if on macOS: {}", notification.title);
            Err(NotificationError::UnsupportedPlatform("macOS".to_string()))
        }
    }

    fn name(&self) -> &str {
        "macOS Notification"
    }

    fn supported_platforms(&self) -> Vec<&str> {
        vec!["macos"]
    }
}

/// Linux notification provider using D-Bus
struct LinuxNotificationProvider;

#[async_trait]
impl NotificationProvider for LinuxNotificationProvider {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        #[cfg(target_os = "linux")]
        {
            debug!("Sending Linux notification: {}", notification.title);
            // Use D-Bus to send notifications on Linux
            info!("Linux Notification: {} - {}", notification.title, notification.message);
            Ok(())
        }

        #[cfg(not(target_os = "linux"))]
        {
            debug!("Would send Linux notification if on Linux: {}", notification.title);
            Err(NotificationError::UnsupportedPlatform("Linux".to_string()))
        }
    }

    fn name(&self) -> &str {
        "Linux Notification"
    }

    fn supported_platforms(&self) -> Vec<&str> {
        vec!["linux"]
    }
}

/// Neuralink direct brain interface notification
struct NeuralinkNotificationProvider {
    api_key: String,
    connection_url: String,
}

#[async_trait]
impl NotificationProvider for NeuralinkNotificationProvider {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        debug!("Sending Neuralink alert: {}", notification.title);
        
        // In a real implementation, we'd make API calls to the Neuralink API
        // For now, we'll just log it
        match notification.priority {
            NotificationPriority::Critical => {
                info!("CRITICAL NEURALINK ALERT: {}", notification.message);
            },
            NotificationPriority::High => {
                info!("HIGH PRIORITY NEURALINK: {}", notification.message);
            },
            _ => {
                debug!("Standard Neuralink notification: {}", notification.message);
            }
        }
        
        Ok(())
    }

    fn name(&self) -> &str {
        "Neuralink Direct Interface"
    }

    fn supported_platforms(&self) -> Vec<&str> {
        vec!["neuralink-compatible"]
    }
}

/// Voice notification provider
struct VoiceNotificationProvider {
    voice_id: String,
}

#[async_trait]
impl NotificationProvider for VoiceNotificationProvider {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        // Only send voice notifications for critical alerts
        if notification.priority != NotificationPriority::Critical {
            return Ok(());
        }
        
        debug!("Sending voice alert: {}", notification.title);
        
        // In a real implementation, we'd use a text-to-speech engine
        // For now, we'll just log it
        info!("VOICE ALERT: {}", notification.message);
        
        Ok(())
    }

    fn name(&self) -> &str {
        "Voice Alert"
    }

    fn supported_platforms(&self) -> Vec<&str> {
        vec!["windows", "macos", "linux"] // Supported on all platforms
    }
}

/// Work-KB logging provider
struct WorkKBNotificationProvider {
    kb_path: PathBuf,
}

#[async_trait]
impl NotificationProvider for WorkKBNotificationProvider {
    async fn send(&self, notification: &Notification) -> Result<(), NotificationError> {
        debug!("Logging notification to Work-KB: {}", notification.title);
        
        // Format the notification for KB storage
        let kb_entry = format!(
            "[{}] [{}] [{}] {}: {}\n",
            notification.timestamp.format("%Y-%m-%d %H:%M:%S"),
            notification.priority.to_string(),
            notification.source.to_string(),
            notification.title,
            notification.message
        );
        
        // In a real implementation, we'd write to the KB storage
        // For now, we'll just log it
        debug!("KB Entry: {}", kb_entry);
        
        Ok(())
    }

    fn name(&self) -> &str {
        "Work-KB Logger"
    }

    fn supported_platforms(&self) -> Vec<&str> {
        vec!["windows", "macos", "linux"] // Supported on all platforms
    }
}

impl std::fmt::Display for NotificationPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            NotificationPriority::Low => "LOW",
            NotificationPriority::Medium => "MEDIUM",
            NotificationPriority::High => "HIGH",
            NotificationPriority::Critical => "CRITICAL",
        };
        write!(f, "{}", str)
    }
}

impl std::fmt::Display for NotificationSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            NotificationSource::AgentManager => "AgentManager",
            NotificationSource::PlanningSystem => "PlanningSystem",
            NotificationSource::TerminalAgent => "TerminalAgent",
            NotificationSource::BrowserAgent => "BrowserAgent",
            NotificationSource::ArtifactSystem => "ArtifactSystem",
            NotificationSource::System => "System",
            NotificationSource::Custom(name) => return write!(f, "Custom:{}", name),
        };
        write!(f, "{}", str)
    }
}

// Error handling for notifications
#[derive(Debug, thiserror::Error)]
pub enum NotificationError {
    #[error("Failed to send notification: {0}")]
    SendError(String),
    
    #[error("Notification provider not available")]
    ProviderUnavailable,
    
    #[error("Platform not supported: {0}")]
    UnsupportedPlatform(String),
    
    #[error("Notification channel closed")]
    ChannelClosed,
    
    #[error("Invalid notification: {0}")]
    InvalidNotification(String),
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

/// Main notification manager that handles all notification operations
pub struct NotificationManager {
    providers: Arc<Mutex<Vec<Box<dyn NotificationProvider>>>>,
    tx: mpsc::Sender<Notification>,
    rx: Arc<Mutex<mpsc::Receiver<Notification>>>,
    history: Arc<Mutex<Vec<Notification>>>,
    max_history: usize,
}

impl NotificationManager {
    pub async fn new() -> Result<Self, NotificationError> {
        let (tx, rx) = mpsc::channel(100);
        
        let manager = Self {
            providers: Arc::new(Mutex::new(Vec::new())),
            tx,
            rx: Arc::new(Mutex::new(rx)),
            history: Arc::new(Mutex::new(Vec::new())),
            max_history: 1000,
        };
        
        // Initialize default providers
        manager.initialize_providers().await?;
        
        // Start the notification processing loop
        manager.start_notification_processor().await?;
        
        Ok(manager)
    }
    
    async fn initialize_providers(&self) -> Result<(), NotificationError> {
        let mut providers = self.providers.lock().await;
        
        // Add all our notification providers
        // OS-specific providers
        #[cfg(target_os = "windows")]
        providers.push(Box::new(WindowsNotificationProvider {
            app_id: "Phoenix.Orch.Notifications".to_string(),
        }));
        
        #[cfg(target_os = "macos")]
        providers.push(Box::new(MacOSNotificationProvider));
        
        #[cfg(target_os = "linux")]
        providers.push(Box::new(LinuxNotificationProvider));
        
        // Advanced providers - always add these regardless of platform
        providers.push(Box::new(NeuralinkNotificationProvider {
            api_key: "neuralink_api_key".to_string(),
            connection_url: "https://api.neuralink.com/v1/notifications".to_string(),
        }));
        
        providers.push(Box::new(VoiceNotificationProvider {
            voice_id: "default".to_string(),
        }));
        
        providers.push(Box::new(WorkKBNotificationProvider {
            kb_path: PathBuf::from("work-kb/notifications"),
        }));
        
        info!("Notification providers initialized: {} providers", providers.len());
        
        Ok(())
    }
    
    async fn start_notification_processor(&self) -> Result<(), NotificationError> {
        let providers = self.providers.clone();
        let rx = self.rx.clone();
        let history = self.history.clone();
        let max_history = self.max_history;
        
        tokio::spawn(async move {
            let mut rx = rx.lock().await;
            
            loop {
                match rx.recv().await {
                    Some(notification) => {
                        debug!("Processing notification: {}", notification.title);
                        
                        // Add to history
                        let mut history = history.lock().await;
                        history.push(notification.clone());
                        
                        // Trim history if needed
                        if history.len() > max_history {
                            history.remove(0);
                        }
                        
                        // Send via all appropriate providers
                        let providers = providers.lock().await;
                        for provider in providers.iter() {
                            match provider.send(&notification).await {
                                Ok(_) => {
                                    debug!("Notification sent via {}", provider.name());
                                }
                                Err(e) => {
                                    warn!("Failed to send notification via {}: {:?}", provider.name(), e);
                                }
                            }
                        }
                    }
                    None => {
                        // Channel closed, exit loop
                        error!("Notification channel closed, exiting processor");
                        break;
                    }
                }
            }
        });
        
        Ok(())
    }
    
    pub async fn send(&self, notification: Notification) -> Result<(), NotificationError> {
        debug!("Queuing notification: {}", notification.title);
        
        // Send the notification to our channel
        self.tx.send(notification).await
            .map_err(|_| NotificationError::ChannelClosed)
    }
    
    pub async fn notify(
        &self,
        title: impl Into<String>,
        message: impl Into<String>,
        priority: NotificationPriority,
        source: NotificationSource,
        notification_type: NotificationType,
    ) -> Result<(), NotificationError> {
        let notification = Notification::new(
            title,
            message,
            priority,
            source,
            notification_type,
        );
        
        self.send(notification).await
    }
    
    pub async fn notify_critical(
        &self,
        title: impl Into<String>,
        message: impl Into<String>,
        source: NotificationSource,
    ) -> Result<(), NotificationError> {
        let title = title.into();
        let message = message.into();
        
        // Critical notifications are sent to all channels
        self.notify(
            title, 
            message, 
            NotificationPriority::Critical, 
            source, 
            NotificationType::All,
        ).await
    }
    
    pub async fn get_history(&self) -> Result<Vec<Notification>, NotificationError> {
        let history = self.history.lock().await;
        Ok(history.clone())
    }
}

// Public API for the notification system

/// Create a new notification manager
pub async fn create_notification_manager() -> Result<NotificationManager, NotificationError> {
    NotificationManager::new().await
}

/// Send a notification
pub async fn send_notification(
    manager: &NotificationManager,
    notification: Notification,
) -> Result<(), NotificationError> {
    manager.send(notification).await
}

/// Create and send a notification in one step
pub async fn notify(
    manager: &NotificationManager,
    title: impl Into<String>,
    message: impl Into<String>,
    priority: NotificationPriority,
    source: NotificationSource,
    notification_type: NotificationType,
) -> Result<(), NotificationError> {
    manager.notify(title, message, priority, source, notification_type).await
}

/// Send a critical notification to all channels
pub async fn notify_critical(
    manager: &NotificationManager,
    title: impl Into<String>,
    message: impl Into<String>,
    source: NotificationSource,
) -> Result<(), NotificationError> {
    manager.notify_critical(title, message, source).await
}

/// Helper function for agent errors
pub async fn notify_agent_error(
    manager: &NotificationManager,
    agent_name: impl Into<String>,
    error_message: impl Into<String>,
) -> Result<(), NotificationError> {
    let agent_name = agent_name.into();
    let error_message = error_message.into();
    
    let title = format!("Agent Error: {}", agent_name);
    
    manager.notify(
        title,
        error_message,
        NotificationPriority::High,
        NotificationSource::AgentManager,
        NotificationType::Toast,
    ).await
}

/// Helper function for approval requests
pub async fn notify_approval_request(
    manager: &NotificationManager,
    request_id: impl Into<String>,
    request_details: impl Into<String>,
) -> Result<(), NotificationError> {
    let request_id = request_id.into();
    let request_details = request_details.into();
    
    let title = format!("Approval Request: {}", request_id);
    
    manager.notify(
        title,
        request_details,
        NotificationPriority::Medium,
        NotificationSource::PlanningSystem,
        NotificationType::Toast,
    ).await
}

/// Helper for terminal agent notifications
pub async fn notify_terminal_result(
    manager: &NotificationManager,
    command: impl Into<String>,
    result_summary: impl Into<String>,
) -> Result<(), NotificationError> {
    let command = command.into();
    let result_summary = result_summary.into();
    
    let title = format!("Terminal Command Completed: {}", command);
    
    manager.notify(
        title,
        result_summary,
        NotificationPriority::Low,
        NotificationSource::TerminalAgent,
        NotificationType::Toast,
    ).await
}

/// Helper for browser agent notifications
pub async fn notify_browser_event(
    manager: &NotificationManager,
    event_type: impl Into<String>,
    details: impl Into<String>,
) -> Result<(), NotificationError> {
    let event_type = event_type.into();
    let details = details.into();
    
    let title = format!("Browser Event: {}", event_type);
    
    manager.notify(
        title,
        details,
        NotificationPriority::Low,
        NotificationSource::BrowserAgent,
        NotificationType::WorkKB,
    ).await
}

// Module tests
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_notification_creation() {
        let notification = Notification::new(
            "Test Title",
            "Test Message",
            NotificationPriority::Medium,
            NotificationSource::System,
            NotificationType::Toast,
        );
        
        assert_eq!(notification.title, "Test Title");
        assert_eq!(notification.message, "Test Message");
        assert_eq!(notification.priority, NotificationPriority::Medium);
    }
    
    #[tokio::test]
    async fn test_notification_manager() {
        let manager = NotificationManager::new().await.unwrap();
        
        // Test sending a notification
        let result = manager.notify(
            "Test Notification",
            "This is a test notification",
            NotificationPriority::Low,
            NotificationSource::System,
            NotificationType::Toast,
        ).await;
        
        assert!(result.is_ok());
        
        // Give a little time for async processing
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Check history
        let history = manager.get_history().await.unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].title, "Test Notification");
    }
}