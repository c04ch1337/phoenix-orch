use cipher_guard::{
    agents::{MonitorAgent, DefenderAgent, ResponderAgent, AnalystAgent, AgentOrchestrator},
    detection::{NetworkIDS, HostIDS, AnomalyDetector},
    response::{ContainmentSystem, MitigationSystem, RecoverySystem},
    reporting::{AlertManager, MetricsCollector, ForensicsCollector},
    memory::{MemoryManager, MemoryConfig},
    integration::EmberUnitIntegration,
    websocket::WebSocketServer,
    Threat, ThreatSeverity, IncidentReport, Evidence,
};
use tokio::sync::mpsc;
use std::sync::Arc;
use tempfile::tempdir;
use std::time::Duration;

#[tokio::test]
async fn test_full_defense_pipeline() {
    // Set up memory system
    let temp_dir = tempdir().unwrap();
    let config = MemoryConfig {
        base_path: temp_dir.path().to_path_buf(),
        mirror_paths: vec![],
    };
    let memory_manager = Arc::new(MemoryManager::new(config).await.unwrap());

    // Set up channels
    let (threat_tx, threat_rx) = mpsc::channel(100);
    let (incident_tx, incident_rx) = mpsc::channel(100);
    let (evidence_tx, evidence_rx) = mpsc::channel(100);
    let (alert_tx, mut alert_rx) = mpsc::channel(100);
    let (report_tx, mut report_rx) = mpsc::channel(100);

    // Set up detection systems
    let network_ids = Arc::new(NetworkIDS::new(1, 60));
    let host_ids = Arc::new(HostIDS::new());
    let anomaly_detector = Arc::new(AnomalyDetector::new(2.0));

    // Set up response systems
    let containment = Arc::new(ContainmentSystem::new());
    let mitigation = Arc::new(MitigationSystem::new());
    let recovery = Arc::new(RecoverySystem::new());

    // Set up reporting systems
    let alert_manager = Arc::new(AlertManager::new(alert_tx));
    let metrics_collector = Arc::new(MetricsCollector::new(30));
    let forensics_collector = Arc::new(ForensicsCollector::new(temp_dir.path().to_path_buf()));

    // Set up WebSocket server
    let ws_server = Arc::new(WebSocketServer::new());

    // Set up Ember Unit integration
    let ember_config = EmberUnitConfig {
        base_url: "http://localhost:8080".to_string(),
        api_key: "test_key".to_string(),
        ws_url: "ws://localhost:8080/ws".to_string(),
    };
    let ember_unit = Arc::new(EmberUnitIntegration::new(ember_config, threat_tx.clone()));

    // Set up agents
    let monitor = MonitorAgent::new(threat_tx.clone());
    let defender = DefenderAgent::new(incident_tx.clone());
    let responder = ResponderAgent::new(evidence_tx.clone());
    let analyst = AnalystAgent::new(report_tx.clone());

    // Add detectors to monitor
    monitor.add_detector(network_ids.clone());
    monitor.add_detector(host_ids.clone());
    monitor.add_detector(anomaly_detector.clone());

    // Create agent orchestrator
    let orchestrator = AgentOrchestrator::new(
        monitor,
        defender,
        responder,
        analyst,
    );

    // Start the orchestrator
    orchestrator.start().await;

    // Simulate a threat detection
    let test_threat = Threat {
        id: uuid::Uuid::new_v4(),
        severity: ThreatSeverity::High,
        description: "Test network intrusion attempt".to_string(),
        timestamp: chrono::Utc::now(),
        source: "test_network".to_string(),
    };

    // Send threat through the pipeline
    threat_tx.send(test_threat.clone()).await.unwrap();

    // Wait for processing
    tokio::time::sleep(Duration::from_secs(1)).await;

    // Verify alert was generated
    if let Some(alert) = alert_rx.try_recv().ok() {
        assert_eq!(alert.severity, "high");
        assert!(alert.message.contains("network intrusion"));
    } else {
        panic!("No alert received");
    }

    // Verify incident was created and stored
    let stored_incident = memory_manager
        .query_incidents_by_status("analyzing")
        .await
        .unwrap();
    
    assert!(!stored_incident.is_empty());
    let incident = &stored_incident[0];
    assert_eq!(incident.threat.id, test_threat.id);

    // Verify evidence was collected
    let evidence = memory_manager
        .retrieve_evidence(&incident.evidence[0].id)
        .await
        .unwrap()
        .unwrap();
    
    assert_eq!(evidence.incident_id, incident.id);

    // Verify report was generated
    if let Some(report) = report_rx.try_recv().ok() {
        assert!(report.contains(&test_threat.description));
    } else {
        panic!("No report received");
    }

    // Test WebSocket notifications
    let ws_messages = ws_server.get_recent_messages().await;
    assert!(ws_messages.iter().any(|msg| msg.contains("threat_detected")));

    // Verify metrics were updated
    let metrics = metrics_collector.get_current_metrics().await.unwrap();
    assert!(metrics.threats_detected > 0);

    // Test Ember Unit integration
    let intel = ember_unit.analyze_threat(&test_threat).await.unwrap();
    assert!(intel.confidence > 0.0);

    // Verify system status
    let system_status = metrics_collector.get_system_status().await.unwrap();
    assert_eq!(system_status, "operational");

    // Clean up
    memory_manager.persist().await.unwrap();
    ws_server.shutdown().await;
}

#[tokio::test]
async fn test_recovery_process() {
    // Similar setup as above...
    
    // Test system recovery after incident
    let recovery = RecoverySystem::new();
    
    let incident = IncidentReport {
        id: uuid::Uuid::new_v4(),
        threat: Threat {
            id: uuid::Uuid::new_v4(),
            severity: ThreatSeverity::High,
            description: "Test threat for recovery".to_string(),
            timestamp: chrono::Utc::now(),
            source: "test".to_string(),
        },
        status: "contained".to_string(),
        actions_taken: vec!["Containment complete".to_string()],
        evidence: vec![],
        timestamp: chrono::Utc::now(),
    };

    recovery.respond(&incident).await.unwrap();

    // Verify system state after recovery
    assert!(recovery.verify_system_state().await.unwrap());
}

#[tokio::test]
async fn test_performance_under_load() {
    // Set up system components...
    
    // Generate multiple simultaneous threats
    let threats: Vec<_> = (0..100).map(|i| Threat {
        id: uuid::Uuid::new_v4(),
        severity: ThreatSeverity::Medium,
        description: format!("Load test threat {}", i),
        timestamp: chrono::Utc::now(),
        source: "load_test".to_string(),
    }).collect();

    // Process threats concurrently
    let results = futures::future::join_all(
        threats.iter().map(|threat| async {
            threat_tx.send(threat.clone()).await.unwrap();
            tokio::time::sleep(Duration::from_millis(10)).await;
        })
    ).await;

    // Verify system remained responsive
    let final_metrics = metrics_collector.get_current_metrics().await.unwrap();
    assert!(final_metrics.response_time < Duration::from_secs(1));
}