//! Tests for security commands module

use super::*;
use crate::commands::security::{
    SecurityCommands, OnCallManager, AlertHandler, TicketManager,
    ThreatHunter, ReportGenerator, HealthMonitor,
    Alert, AlertSeverity, Ticket, TicketPriority, TicketStatus,
    HuntingRule, HuntingParams, Finding
};
use std::sync::Arc;
use tokio::test;
use mockall::predicate::*;
use chrono::Utc;

#[test]
async fn test_security_commands_initialization() -> Result<(), Box<dyn Error>> {
    let commands = SecurityCommands::new()?;
    commands.initialize().await?;
    Ok(())
}

#[test]
async fn test_oncall_management() -> Result<(), Box<dyn Error>> {
    let manager = OnCallManager::new()?;
    manager.initialize().await?;
    
    // Test PagerDuty sync
    manager.sync_pagerduty_schedule().await?;
    
    // Get current on-call info
    let oncall = manager.get_current_oncall().await?;
    assert!(!oncall.engineer.is_empty());
    
    Ok(())
}

#[test]
async fn test_alert_handling() -> Result<(), Box<dyn Error>> {
    let handler = AlertHandler::new()?;
    handler.initialize().await?;
    
    // Test Proofpoint sync
    handler.sync_proofpoint_alerts().await?;
    
    // Handle test alert
    let alert = Alert {
        id: "ALERT-123".to_string(),
        severity: AlertSeverity::High,
        description: "Test alert".to_string(),
        timestamp: Utc::now(),
    };
    
    handler.handle_alert(alert).await?;
    
    // Verify alert was stored
    let alerts = handler.alerts.read().await;
    assert!(!alerts.is_empty());
    
    Ok(())
}

#[test]
async fn test_ticket_management() -> Result<(), Box<dyn Error>> {
    let manager = TicketManager::new()?;
    manager.initialize().await?;
    
    // Create test ticket
    let ticket = Ticket {
        title: "Test ticket".to_string(),
        description: "Test description".to_string(),
        priority: TicketPriority::High,
    };
    
    let ticket_id = manager.create_ticket(ticket).await?;
    assert!(!ticket_id.is_empty());
    
    // Update ticket
    let update = TicketUpdate {
        status: TicketStatus::InProgress,
        comment: "Working on it".to_string(),
    };
    
    manager.update_ticket(&ticket_id, update).await?;
    
    Ok(())
}

#[test]
async fn test_threat_hunting() -> Result<(), Box<dyn Error>> {
    let hunter = ThreatHunter::new()?;
    hunter.initialize().await?;
    
    // Load hunting rules
    hunter.load_hunting_rules().await?;
    
    // Execute hunt
    let params = HuntingParams {
        timeframe: "24h".to_string(),
        data_sources: vec!["logs".to_string(), "network".to_string()],
    };
    
    let findings = hunter.start_hunt(params).await?;
    assert!(!findings.is_empty());
    
    Ok(())
}

#[test]
async fn test_report_generation() -> Result<(), Box<dyn Error>> {
    let generator = ReportGenerator::new()?;
    generator.initialize().await?;
    
    // Load report templates
    generator.load_templates().await?;
    
    // Generate report
    let params = ReportParams {
        template_type: "security_incident".to_string(),
        start_date: Utc::now(),
        end_date: Utc::now(),
    };
    
    let report = generator.generate_report(params).await?;
    assert!(!report.content.is_empty());
    
    Ok(())
}

#[test]
async fn test_health_monitoring() -> Result<(), Box<dyn Error>> {
    let monitor = HealthMonitor::new()?;
    monitor.initialize().await?;
    
    // Run health check
    let status = monitor.run_health_check().await?;
    
    // Verify results
    assert!(!status.results.is_empty());
    
    Ok(())
}

#[test]
async fn test_concurrent_alert_processing() -> Result<(), Box<dyn Error>> {
    let handler = Arc::new(AlertHandler::new()?);
    handler.initialize().await?;
    
    let mut handles = Vec::new();
    
    // Create test alerts
    for i in 0..3 {
        let alert = Alert {
            id: format!("ALERT-{}", i),
            severity: AlertSeverity::High,
            description: format!("Test alert {}", i),
            timestamp: Utc::now(),
        };
        
        let handler = Arc::clone(&handler);
        let handle = tokio::spawn(async move {
            handler.handle_alert(alert).await
        });
        handles.push(handle);
    }
    
    // Wait for all handlers to complete
    for handle in handles {
        handle.await??;
    }
    
    // Verify all alerts were processed
    let alerts = handler.alerts.read().await;
    assert_eq!(alerts.len(), 3);
    
    Ok(())
}

#[test]
async fn test_error_handling() -> Result<(), Box<dyn Error>> {
    let commands = SecurityCommands::new()?;
    commands.initialize().await?;
    
    // Test invalid ticket update
    let manager = TicketManager::new()?;
    let update = TicketUpdate {
        status: TicketStatus::InProgress,
        comment: "Update".to_string(),
    };
    
    let result = manager.update_ticket("nonexistent-ticket", update).await;
    assert!(result.is_err());
    
    Ok(())
}

// Mock implementations for testing
mock! {
    SecurityCommands {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
    }
}

mock! {
    AlertHandler {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
        async fn handle_alert(&self, alert: Alert) -> Result<(), Box<dyn Error>>;
    }
}

#[test]
async fn test_with_mocks() -> Result<(), Box<dyn Error>> {
    let mut mock_handler = MockAlertHandler::new();
    
    mock_handler.expect_initialize()
        .times(1)
        .returning(|| Ok(()));
        
    mock_handler.expect_handle_alert()
        .with(predicate::always())
        .times(1)
        .returning(|_| Ok(()));
        
    mock_handler.initialize().await?;
    
    let alert = Alert {
        id: "MOCK-ALERT".to_string(),
        severity: AlertSeverity::High,
        description: "Mock alert".to_string(),
        timestamp: Utc::now(),
    };
    
    mock_handler.handle_alert(alert).await?;
    
    Ok(())
}

// Helper function to create test hunting rules
fn create_test_hunting_rule() -> HuntingRule {
    HuntingRule {
        name: "Test Rule".to_string(),
        description: "Test hunting rule".to_string(),
        query: "test query".to_string(),
    }
}

// Helper function to create test findings
fn create_test_finding() -> Finding {
    Finding {
        rule_name: "Test Rule".to_string(),
        description: "Test finding".to_string(),
        evidence: vec!["evidence1".to_string(), "evidence2".to_string()],
        timestamp: Utc::now(),
    }
}