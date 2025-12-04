//! Tests for natural language processing module

use super::*;
use crate::commands::nlp::{
    NLPEngine, IntentClassifier, EntityExtractor, ContextManager,
    Disambiguator, ConversationTracker, SemanticAnalyzer,
    NLPResult, Intent, Entity, Semantics, Context
};
use std::sync::Arc;
use tokio::test;
use mockall::predicate::*;

#[test]
async fn test_nlp_engine_initialization() -> Result<(), Box<dyn Error>> {
    let engine = NLPEngine::new()?;
    engine.initialize().await?;
    Ok(())
}

#[test]
async fn test_text_processing() -> Result<(), Box<dyn Error>> {
    let engine = NLPEngine::new()?;
    engine.initialize().await?;
    
    // Process test text
    let result = engine.process_text("Run security scan on network").await?;
    
    assert!(!result.intent.name.is_empty());
    assert!(result.confidence > 0.0);
    assert!(!result.entities.is_empty());
    
    Ok(())
}

#[test]
async fn test_intent_classification() -> Result<(), Box<dyn Error>> {
    let classifier = IntentClassifier::new()?;
    classifier.initialize().await?;
    
    // Test context
    let context = Context::default();
    
    // Classify intent
    let intent = classifier.classify("Run security scan", &context).await?;
    
    assert_eq!(intent.name, "security_scan");
    assert!(intent.confidence > 0.8);
    
    Ok(())
}

#[test]
async fn test_entity_extraction() -> Result<(), Box<dyn Error>> {
    let extractor = EntityExtractor::new()?;
    extractor.initialize().await?;
    
    // Test context
    let context = Context::default();
    
    // Extract entities
    let entities = extractor.extract("Scan network 192.168.1.0/24", &context).await?;
    
    assert!(!entities.is_empty());
    assert_eq!(entities[0].label, "network_address");
    
    Ok(())
}

#[test]
async fn test_context_management() -> Result<(), Box<dyn Error>> {
    let manager = ContextManager::new()?;
    manager.initialize().await?;
    
    // Get initial context
    let context = manager.get_current_context().await?;
    
    // Update context
    manager.update_context("Set target to internal network").await?;
    
    // Verify context update
    let updated = manager.get_current_context().await?;
    assert!(updated.references.contains_key("target"));
    
    Ok(())
}

#[test]
async fn test_disambiguation() -> Result<(), Box<dyn Error>> {
    let disambiguator = Disambiguator::new()?;
    disambiguator.initialize().await?;
    
    // Create ambiguous intent and entities
    let intent = Intent {
        name: "scan".to_string(),
        confidence: 0.6,
    };
    
    let entities = vec![
        Entity {
            text: "network".to_string(),
            label: "target".to_string(),
            start: 0,
            end: 7,
            confidence: 0.7,
        }
    ];
    
    // Test disambiguation
    let needs_disambiguation = disambiguator.needs_disambiguation(&intent, &entities).await?;
    assert!(needs_disambiguation);
    
    let context = Context::default();
    let (disambiguated_intent, disambiguated_entities) = disambiguator
        .disambiguate("Scan the network", intent, entities, &context)
        .await?;
    
    assert!(disambiguated_intent.confidence > 0.8);
    assert!(disambiguated_entities[0].confidence > 0.8);
    
    Ok(())
}

#[test]
async fn test_conversation_tracking() -> Result<(), Box<dyn Error>> {
    let tracker = ConversationTracker::new()?;
    tracker.initialize().await?;
    
    // Add utterances
    tracker.add_utterance("What is the system status?").await?;
    tracker.add_utterance("Show me the alerts").await?;
    
    // Verify history
    let history = tracker.history.read().await;
    assert_eq!(history.len(), 2);
    
    Ok(())
}

#[test]
async fn test_semantic_analysis() -> Result<(), Box<dyn Error>> {
    let analyzer = SemanticAnalyzer::new()?;
    analyzer.initialize().await?;
    
    // Test input
    let text = "Urgently scan the network for vulnerabilities";
    let intent = Intent {
        name: "security_scan".to_string(),
        confidence: 0.95,
    };
    let entities = vec![
        Entity {
            text: "network".to_string(),
            label: "target".to_string(),
            start: 0,
            end: 7,
            confidence: 0.9,
        }
    ];
    let context = Context::default();
    
    // Analyze semantics
    let semantics = analyzer.analyze(text, &intent, &entities, &context).await?;
    
    assert!(!semantics.relations.is_empty());
    assert!(semantics.sentiment != 0.0);
    assert!(semantics.confidence > 0.8);
    
    Ok(())
}

#[test]
async fn test_concurrent_processing() -> Result<(), Box<dyn Error>> {
    let engine = Arc::new(NLPEngine::new()?);
    engine.initialize().await?;
    
    let mut handles = Vec::new();
    
    // Process multiple inputs concurrently
    for text in ["Run scan", "Show alerts", "Check status"].iter() {
        let engine = Arc::clone(&engine);
        let text = text.to_string();
        let handle = tokio::spawn(async move {
            engine.process_text(&text).await
        });
        handles.push(handle);
    }
    
    // Wait for all processors to complete
    for handle in handles {
        let result = handle.await??;
        assert!(result.confidence > 0.0);
    }
    
    Ok(())
}

#[test]
async fn test_error_handling() -> Result<(), Box<dyn Error>> {
    let engine = NLPEngine::new()?;
    engine.initialize().await?;
    
    // Test empty input
    let result = engine.process_text("").await;
    assert!(result.is_err());
    
    Ok(())
}

// Mock implementations for testing
mock! {
    NLPEngine {
        fn new() -> Result<Self, Box<dyn Error>>;
        async fn initialize(&self) -> Result<(), Box<dyn Error>>;
        async fn process_text(&self, text: &str) -> Result<NLPResult, Box<dyn Error>>;
    }
}

#[test]
async fn test_with_mocks() -> Result<(), Box<dyn Error>> {
    let mut mock = MockNLPEngine::new();
    
    mock.expect_initialize()
        .times(1)
        .returning(|| Ok(()));
        
    mock.expect_process_text()
        .with(predicate::eq("test input"))
        .times(1)
        .returning(|_| Ok(NLPResult {
            intent: Intent {
                name: "test_intent".to_string(),
                confidence: 0.95,
            },
            entities: vec![],
            semantics: Semantics {
                relations: vec![],
                sentiment: 0.0,
                confidence: 0.95,
            },
            confidence: 0.95,
        }));
        
    mock.initialize().await?;
    
    let result = mock.process_text("test input").await?;
    assert_eq!(result.intent.name, "test_intent");
    
    Ok(())
}