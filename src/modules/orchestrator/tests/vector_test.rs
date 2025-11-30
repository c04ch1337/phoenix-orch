//! Tests for vector search functionality
//!
//! This module contains tests for the vector search implementation.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use crate::modules::orchestrator::agent::{OrchestratorConfig, SystemConfig};
use crate::modules::orchestrator::context::{KnowledgeBaseType, MemoryEntry, PhoenixContext};
use crate::modules::orchestrator::vector::{VectorEngine, VectorSearchConfig, SearchResult};

/// Test configuration for vector search tests
#[tokio::test]
async fn test_vector_search_config() {
    // Create default config
    let config = VectorSearchConfig::default();
    
    // Verify default settings
    assert_eq!(config.model_type, "sentence");
    assert_eq!(config.dimensions, 384);
    assert!(config.similarity_threshold.is_some());
    assert_eq!(config.similarity_threshold.unwrap(), 0.6);
    
    // Verify KB weights
    assert!(config.kb_weights.contains_key(&KnowledgeBaseType::Working));
    assert!(config.kb_weights.contains_key(&KnowledgeBaseType::Episodic));
    assert!(config.kb_weights.contains_key(&KnowledgeBaseType::Semantic));
    assert!(config.kb_weights.contains_key(&KnowledgeBaseType::Procedural));
    
    // Working memory should have highest priority
    let working_weight = config.kb_weights.get(&KnowledgeBaseType::Working).unwrap();
    let episodic_weight = config.kb_weights.get(&KnowledgeBaseType::Episodic).unwrap();
    assert!(working_weight > episodic_weight);
}

/// Test the embedding generation process
#[tokio::test]
async fn test_embedding_generation() {
    // Create test context
    let system_config = SystemConfig::default();
    let context = PhoenixContext::new(system_config).await.unwrap();
    let context_arc = Arc::new(RwLock::new(context));
    
    // Create vector engine
    let config = VectorSearchConfig::default();
    let engine = VectorEngine::new(context_arc, config).await.unwrap();
    
    // Generate embeddings for sample texts
    let text1 = "This is a test of the embedding system";
    let text2 = "This is another test of the embedding system";
    let text3 = "Something completely different";
    
    let embedding1 = engine.generate_embedding(text1).await.unwrap();
    let embedding2 = engine.generate_embedding(text2).await.unwrap();
    let embedding3 = engine.generate_embedding(text3).await.unwrap();
    
    // Verify embedding dimensions
    assert_eq!(embedding1.len(), 384);
    assert_eq!(embedding2.len(), 384);
    assert_eq!(embedding3.len(), 384);
    
    // Calculate similarities
    let sim_1_2 = engine.calculate_similarity(&embedding1, &embedding2).await.unwrap();
    let sim_1_3 = engine.calculate_similarity(&embedding1, &embedding3).await.unwrap();
    
    // Similar texts should have higher similarity than dissimilar ones
    assert!(sim_1_2 > sim_1_3);
}

/// Test storing and retrieving memories with embeddings
#[tokio::test]
async fn test_memory_storage_retrieval() {
    // Create test system config with temporary directory
    let mut system_config = SystemConfig::default();
    let temp_dir = std::env::temp_dir().join("phoenix_test_vector_search");
    system_config.memory_path = temp_dir.clone();
    
    // Create clean test directory
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir).unwrap();
    }
    std::fs::create_dir_all(&temp_dir).unwrap();
    
    // Create context
    let context = PhoenixContext::new(system_config).await.unwrap();
    let context_arc = Arc::new(RwLock::new(context));
    
    // Create vector engine
    let config = VectorSearchConfig::default();
    let engine = VectorEngine::new(context_arc.clone(), config).await.unwrap();
    
    // Add test memories to different KBs
    let mut metadata = HashMap::new();
    metadata.insert("source".to_string(), "test".to_string());
    
    // Generate embeddings for test memories
    let memory1 = "Facts about planets in our solar system";
    let memory2 = "How to cook pasta al dente";
    let memory3 = "My trip to the planetarium last weekend";
    let memory4 = "Current conversation about astronomy";
    
    let embedding1 = engine.generate_embedding(memory1).await.unwrap();
    let embedding2 = engine.generate_embedding(memory2).await.unwrap();
    let embedding3 = engine.generate_embedding(memory3).await.unwrap();
    let embedding4 = engine.generate_embedding(memory4).await.unwrap();
    
    // Store memories in appropriate KBs
    let context_guard = context_arc.read().unwrap();
    context_guard.store_memory(
        KnowledgeBaseType::Semantic,
        memory1.to_string(),
        metadata.clone(),
        Some(embedding1)
    ).await.unwrap();
    
    context_guard.store_memory(
        KnowledgeBaseType::Procedural,
        memory2.to_string(),
        metadata.clone(),
        Some(embedding2)
    ).await.unwrap();
    
    context_guard.store_memory(
        KnowledgeBaseType::Episodic,
        memory3.to_string(),
        metadata.clone(),
        Some(embedding3)
    ).await.unwrap();
    
    context_guard.store_memory(
        KnowledgeBaseType::Working,
        memory4.to_string(),
        metadata.clone(),
        Some(embedding4)
    ).await.unwrap();
    
    // Test search functionality
    let results = engine.search_all("planets astronomy", 10, None).await.unwrap();
    
    // Should find at least 2 relevant memories (semantic and working)
    assert!(results.len() >= 2);
    
    // Working memory (highest priority) should be in results
    assert!(results.iter().any(|r| r.kb_type == KnowledgeBaseType::Working));
    
    // Semantic memory (about planets) should be in results
    assert!(results.iter().any(|r| r.kb_type == KnowledgeBaseType::Semantic));
    
    // Results should be ordered by weighted score (descending)
    for i in 1..results.len() {
        assert!(results[i-1].weighted_score >= results[i].weighted_score);
    }
    
    // Clean up test directory
    std::fs::remove_dir_all(temp_dir).unwrap_or(());
}

/// Test search across specific knowledge bases
#[tokio::test]
async fn test_kb_specific_search() {
    // Create test system config with temporary directory
    let mut system_config = SystemConfig::default();
    let temp_dir = std::env::temp_dir().join("phoenix_test_vector_search_kb");
    system_config.memory_path = temp_dir.clone();
    
    // Create clean test directory
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir).unwrap();
    }
    std::fs::create_dir_all(&temp_dir).unwrap();
    
    // Create context
    let context = PhoenixContext::new(system_config).await.unwrap();
    let context_arc = Arc::new(RwLock::new(context));
    
    // Create vector engine
    let config = VectorSearchConfig::default();
    let engine = VectorEngine::new(context_arc.clone(), config).await.unwrap();
    
    // Add test memories to Semantic KB
    let context_guard = context_arc.read().unwrap();
    
    let memories = [
        "The Milky Way is a barred spiral galaxy",
        "Jupiter is the largest planet in our solar system",
        "DNA contains genetic instructions for development",
        "Photosynthesis is the process used by plants to convert light into energy"
    ];
    
    let mut metadata = HashMap::new();
    metadata.insert("source".to_string(), "test".to_string());
    
    // Store all memories in semantic KB
    for memory in &memories {
        let embedding = engine.generate_embedding(memory).await.unwrap();
        context_guard.store_memory(
            KnowledgeBaseType::Semantic,
            memory.to_string(),
            metadata.clone(),
            Some(embedding)
        ).await.unwrap();
    }
    
    // Test KB-specific search
    let results = engine.search_kb("planet galaxy astronomy", KnowledgeBaseType::Semantic, 10, None).await.unwrap();
    
    // Should find the astronomy-related memories
    assert!(results.len() >= 2);
    
    // All results should be from the Semantic KB
    for result in &results {
        assert_eq!(result.kb_type, KnowledgeBaseType::Semantic);
    }
    
    // Astronomy-related memories should be ranked higher
    let first_result = &results[0];
    assert!(
        first_result.content.contains("galaxy") || 
        first_result.content.contains("Jupiter") ||
        first_result.content.contains("planet")
    );
    
    // Clean up test directory
    std::fs::remove_dir_all(temp_dir).unwrap_or(());
}