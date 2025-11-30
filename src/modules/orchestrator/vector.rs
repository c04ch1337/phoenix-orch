//! Vector Search Engine Implementation
//!
//! This module contains the Vector Search Engine implementation for the OrchestratorAgent.
//! It provides functionality for generating embeddings and performing vector searches
//! across all four memory knowledge bases.

use std::path::PathBuf;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use std::cmp::Ordering;

use crate::modules::orchestrator::errors::{PhoenixResult, PhoenixError, AgentErrorKind};
use crate::modules::orchestrator::context::{PhoenixContext, KnowledgeBaseType, MemoryEntry};

/// Maximum number of results to return per knowledge base
const MAX_RESULTS_PER_KB: usize = 50;

/// Default similarity threshold for vector searches
const DEFAULT_SIMILARITY_THRESHOLD: f32 = 0.6;

/// Configuration for vector search
#[derive(Debug, Clone)]
pub struct VectorSearchConfig {
    /// Type of embedding model ("transformer", "sentence", etc.)
    pub model_type: String,
    
    /// Path to the model file
    pub model_path: PathBuf,
    
    /// Dimensions of the embedding vectors
    pub dimensions: usize,
    
    /// Similarity threshold for vector searches (0.0 to 1.0)
    pub similarity_threshold: Option<f32>,
    
    /// Knowledge base priority weights (higher values mean higher priority)
    pub kb_weights: HashMap<KnowledgeBaseType, f32>,
}

impl Default for VectorSearchConfig {
    fn default() -> Self {
        let mut kb_weights = HashMap::new();
        kb_weights.insert(KnowledgeBaseType::Working, 1.0);
        kb_weights.insert(KnowledgeBaseType::Episodic, 0.8);
        kb_weights.insert(KnowledgeBaseType::Semantic, 0.7);
        kb_weights.insert(KnowledgeBaseType::Procedural, 0.6);
        
        Self {
            model_type: "sentence".to_string(),
            model_path: PathBuf::from("models/embeddings"),
            dimensions: 384, // Default for many sentence embedding models
            similarity_threshold: Some(DEFAULT_SIMILARITY_THRESHOLD),
            kb_weights,
        }
    }
}

/// Vector search engine for semantic memory retrieval across all knowledge bases
pub struct VectorEngine {
    /// Configuration options for vector search
    config: VectorSearchConfig,
    
    /// Reference to the Phoenix context (for accessing KBs)
    context: Arc<RwLock<PhoenixContext>>,
    
    /// Embedding model (mock for now, would be an actual embedding model in production)
    _embedding_model: Option<()>, // Placeholder for an actual embedding model
}

impl VectorEngine {
    /// Create a new VectorEngine instance
    pub async fn new(
        context: Arc<RwLock<PhoenixContext>>,
        config: VectorSearchConfig,
    ) -> PhoenixResult<Self> {
        // In a real implementation, this would initialize the embedding model
        // using the provided configuration
        
        Ok(Self {
            config,
            context,
            _embedding_model: Some(()),
        })
    }
    
    /// Generate an embedding for a text string
    ///
    /// This function converts text into a vector representation (embedding)
    /// that can be used for semantic similarity comparisons.
    ///
    /// # Arguments
    ///
    /// * `text` - The text to generate an embedding for
    ///
    /// # Returns
    ///
    /// A vector of floating point values representing the text embedding
    pub async fn generate_embedding(&self, text: &str) -> PhoenixResult<Vec<f32>> {
        // In a real implementation, this would call the embedding model to generate
        // an actual embedding vector. For this mock implementation, we'll generate
        // a simple deterministic vector based on the text content.
        
        // Create a simple deterministic embedding based on character values
        // This is NOT a real embedding, just a mock for demonstration
        let mut embedding = vec![0.0; self.config.dimensions];
        
        for (i, c) in text.chars().enumerate() {
            let idx = i % self.config.dimensions;
            embedding[idx] += (c as u32 % 10) as f32 / 100.0;
        }
        
        // Normalize the embedding vector to unit length
        let magnitude = (embedding.iter().map(|x| x * x).sum::<f32>()).sqrt();
        if magnitude > 0.0 {
            for i in 0..embedding.len() {
                embedding[i] /= magnitude;
            }
        }
        
        Ok(embedding)
    }
    
    /// Calculate the cosine similarity between two embedding vectors
    ///
    /// # Arguments
    ///
    /// * `embedding1` - First embedding vector
    /// * `embedding2` - Second embedding vector
    ///
    /// # Returns
    ///
    /// A float between -1.0 and 1.0, where 1.0 means identical vectors
    pub fn calculate_similarity(
        &self,
        embedding1: &[f32],
        embedding2: &[f32],
    ) -> PhoenixResult<f32> {
        if embedding1.len() != embedding2.len() {
            return Err(PhoenixError::Agent {
                kind: AgentErrorKind::InvalidParameters,
                message: format!(
                    "Embedding dimensions do not match: {} vs {}",
                    embedding1.len(),
                    embedding2.len()
                ),
                component: "VectorEngine".to_string(),
            });
        }
        
        // Calculate dot product
        let dot_product: f32 = embedding1.iter().zip(embedding2.iter()).map(|(a, b)| a * b).sum();
        
        // Calculate magnitudes
        let magnitude1: f32 = embedding1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let magnitude2: f32 = embedding2.iter().map(|x| x * x).sum::<f32>().sqrt();
        
        // Calculate cosine similarity
        let similarity = if magnitude1 > 0.0 && magnitude2 > 0.0 {
            dot_product / (magnitude1 * magnitude2)
        } else {
            0.0
        };
        
        Ok(similarity)
    }
    
    /// Search for memories similar to the query across all knowledge bases
    ///
    /// # Arguments
    ///
    /// * `query` - The search query string
    /// * `limit` - Maximum number of results to return
    /// * `kb_types` - Optional list of specific knowledge base types to search
    /// * `similarity_threshold` - Optional minimum similarity threshold (overrides config)
    ///
    /// # Returns
    ///
    /// A vector of search results, ordered by relevance
    pub async fn search(
        &self,
        query: &str,
        limit: usize,
        kb_types: Option<Vec<KnowledgeBaseType>>,
        similarity_threshold: Option<f32>,
    ) -> PhoenixResult<Vec<SearchResult>> {
        // Generate embedding for the query
        let query_embedding = self.generate_embedding(query).await?;
        
        // Determine which knowledge bases to search
        let kb_types_to_search = match kb_types {
            Some(types) => types.into_iter().collect::<HashSet<_>>(),
            None => {
                // If no specific types provided, search all KBs
                vec![
                    KnowledgeBaseType::Working,
                    KnowledgeBaseType::Episodic,
                    KnowledgeBaseType::Semantic,
                    KnowledgeBaseType::Procedural,
                ].into_iter().collect()
            }
        };
        
        // Use provided threshold or default from config
        let similarity_threshold = similarity_threshold
            .or(self.config.similarity_threshold)
            .unwrap_or(DEFAULT_SIMILARITY_THRESHOLD);
        
        // Collect results from all requested knowledge bases
        let mut all_results = Vec::new();
        
        let context = self.context.read().unwrap();
        
        // Search each knowledge base
        for kb_type in &kb_types_to_search {
            if let Some(kb) = context.knowledge_bases.get(kb_type) {
                let kb_guard = kb.read().unwrap();
                
                // Search this knowledge base
                for memory in kb_guard.memories.values() {
                    // Skip memories without embeddings
                    if let Some(memory_embedding) = &memory.embedding {
                        // Calculate similarity
                        let similarity = self.calculate_similarity(&query_embedding, memory_embedding)?;
                        
                        // If similarity is above threshold, add to results
                        if similarity >= similarity_threshold {
                            // Get the weight for this knowledge base
                            let kb_weight = self.config.kb_weights.get(kb_type).unwrap_or(&1.0);
                            
                            // Calculate weighted score
                            let weighted_score = similarity * kb_weight;
                            
                            // Create search result
                            let mut metadata = memory.metadata.clone();
                            metadata.insert("kb_type".to_string(), kb_type.to_string());
                            metadata.insert("query".to_string(), query.to_string());
                            
                            let result = SearchResult {
                                id: memory.id.clone(),
                                content: memory.content.clone(),
                                similarity,
                                weighted_score,
                                kb_type: *kb_type,
                                metadata,
                            };
                            
                            all_results.push(result);
                        }
                    }
                }
            }
        }
        
        // Sort results by weighted score (descending)
        all_results.sort_by(|a, b| {
            b.weighted_score.partial_cmp(&a.weighted_score).unwrap_or(Ordering::Equal)
        });
        
        // Limit results
        let limited_results = all_results.into_iter().take(limit).collect();
        
        Ok(limited_results)
    }
    
    /// Search a specific knowledge base for memories similar to the query
    ///
    /// # Arguments
    ///
    /// * `query` - The search query string
    /// * `kb_type` - Knowledge base type to search
    /// * `limit` - Maximum number of results to return
    /// * `similarity_threshold` - Optional minimum similarity threshold (overrides config)
    ///
    /// # Returns
    ///
    /// A vector of search results from the specified knowledge base
    pub async fn search_kb(
        &self,
        query: &str,
        kb_type: KnowledgeBaseType,
        limit: usize,
        similarity_threshold: Option<f32>,
    ) -> PhoenixResult<Vec<SearchResult>> {
        self.search(query, limit, Some(vec![kb_type]), similarity_threshold).await
    }
    
    /// Search all knowledge bases with different weights and combine results
    ///
    /// This is the primary search method that should be used by the OrchestratorAgent.
    /// It searches across all memory knowledge bases and returns a consolidated result.
    ///
    /// # Arguments
    ///
    /// * `query` - The search query string
    /// * `limit` - Maximum number of results to return
    /// * `similarity_threshold` - Optional minimum similarity threshold
    ///
    /// # Returns
    ///
    /// A vector of search results across all knowledge bases
    pub async fn search_all(
        &self,
        query: &str,
        limit: usize,
        similarity_threshold: Option<f32>,
    ) -> PhoenixResult<Vec<SearchResult>> {
        // Search all knowledge bases (no filter)
        self.search(query, limit, None, similarity_threshold).await
    }
}

/// Search result
#[derive(Debug, Clone)]
pub struct SearchResult {
    /// Memory ID
    pub id: String,
    
    /// Memory content
    pub content: String,
    
    /// Raw similarity score (0.0 to 1.0)
    pub similarity: f32,
    
    /// Weighted score (adjusted by knowledge base priority)
    pub weighted_score: f32,
    
    /// Knowledge base type
    pub kb_type: KnowledgeBaseType,
    
    /// Metadata
    pub metadata: HashMap<String, String>,
}