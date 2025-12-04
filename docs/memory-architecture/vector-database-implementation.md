# Phoenix Marie Memory Architecture - Vector Database Implementation Guide

## Overview

This document provides detailed implementation specifications for the vector database components of the Phoenix Marie 6-KB Memory Architecture. Each Knowledge Base maintains its own isolated vector space with specific embedding models and configurations.

## 1. Vector Space Isolation

### 1.1 Physical Isolation

```rust
pub struct IsolatedVectorSpace {
    kb_type: KnowledgeBaseType,
    base_path: PathBuf,
    index_path: PathBuf,
    metadata_db: sled::Db,
    embedding_cache: DashMap<Uuid, Vec<f32>>,
    access_validator: AccessValidator,
}

impl IsolatedVectorSpace {
    pub fn new(kb_type: KnowledgeBaseType) -> Result<Self, VectorError> {
        let base_path = match kb_type {
            // Personal domain - encrypted paths
            KnowledgeBaseType::Mind => PathBuf::from("/phoenix/personal/mind"),
            KnowledgeBaseType::Body => PathBuf::from("/phoenix/personal/body"),
            KnowledgeBaseType::Soul => PathBuf::from("/phoenix/personal/soul"),
            KnowledgeBaseType::Heart => PathBuf::from("/phoenix/personal/heart"),
            // Professional domain - separate mount
            KnowledgeBaseType::Work => PathBuf::from("/cipher-guard/work"),
            KnowledgeBaseType::ThreatIntel => PathBuf::from("/cipher-guard/threat-intel"),
        };
        
        // Ensure directory isolation
        std::fs::create_dir_all(&base_path)?;
        
        // Set strict permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&base_path, 
                std::fs::Permissions::from_mode(0o700))?;
        }
        
        Ok(Self {
            kb_type,
            base_path: base_path.clone(),
            index_path: base_path.join("vector.index"),
            metadata_db: sled::open(base_path.join("metadata"))?,
            embedding_cache: DashMap::new(),
            access_validator: AccessValidator::new(kb_type),
        })
    }
}
```

### 1.2 Embedding Model Configuration

```rust
pub struct EmbeddingModelConfig {
    pub personal_config: PersonalEmbeddingConfig,
    pub professional_config: ProfessionalEmbeddingConfig,
}

pub struct PersonalEmbeddingConfig {
    pub model_name: String,        // "instructor-xl" or "bge-large-en-v1.5"
    pub dimension: usize,          // 1536
    pub model_path: PathBuf,       // Local model path
    pub device: Device,            // CUDA if available
    pub batch_size: usize,         // 32
    pub normalize: bool,           // true
    pub emotion_boost: f32,        // 1.2 - boost emotional terms
}

pub struct ProfessionalEmbeddingConfig {
    pub model_name: String,        // "bge-m3"
    pub dimension: usize,          // 1024
    pub model_path: PathBuf,       // Local model path
    pub device: Device,            // CUDA if available
    pub batch_size: usize,         // 64
    pub normalize: bool,           // true
    pub technical_boost: f32,      // 1.1 - boost technical terms
}

impl EmbeddingModelConfig {
    pub fn for_kb_type(kb_type: KnowledgeBaseType) -> Box<dyn EmbeddingModel> {
        match kb_type {
            KnowledgeBaseType::Mind | 
            KnowledgeBaseType::Body | 
            KnowledgeBaseType::Soul | 
            KnowledgeBaseType::Heart => {
                Box::new(PersonalEmbeddingModel::new(Self::personal_config()))
            },
            KnowledgeBaseType::Work | 
            KnowledgeBaseType::ThreatIntel => {
                Box::new(ProfessionalEmbeddingModel::new(Self::professional_config()))
            },
        }
    }
}
```

## 2. FAISS Index Configuration

### 2.1 Personal Domain Indexes

```python
# Personal KBs use high-precision IVF index for emotional fidelity
import faiss
import numpy as np

class PersonalVectorIndex:
    def __init__(self, dimension=1536):
        self.dimension = dimension
        
        # High precision configuration
        self.nlist = 4096  # Number of clusters
        self.nprobe = 128  # Number of clusters to search
        
        # Create index
        quantizer = faiss.IndexFlatL2(dimension)
        self.index = faiss.IndexIVFFlat(quantizer, dimension, self.nlist)
        
        # Training configuration
        self.training_samples = 100000
        self.index.train_type = faiss.TRAIN_ITER_REFINE
        
    def build_index(self, embeddings):
        """Build index with emotional precision optimization"""
        # Ensure we have enough training data
        if len(embeddings) < self.training_samples:
            # Augment with synthetic variations for better clustering
            embeddings = self._augment_emotional_embeddings(embeddings)
        
        # Train the index
        self.index.train(embeddings)
        
        # Add vectors with IDs
        self.index.add_with_ids(embeddings, np.arange(len(embeddings)))
        
        # Set search parameters for high recall
        self.index.nprobe = self.nprobe
        
    def _augment_emotional_embeddings(self, embeddings):
        """Add slight variations to capture emotional nuances"""
        augmented = []
        for emb in embeddings:
            # Original
            augmented.append(emb)
            # Slight variations to capture emotional similarity
            for _ in range(3):
                noise = np.random.normal(0, 0.01, self.dimension)
                augmented.append(emb + noise)
        return np.array(augmented).astype('float32')
```

### 2.2 Professional Domain Indexes

```python
class ProfessionalVectorIndex:
    def __init__(self, dimension=1024):
        self.dimension = dimension
        
        # Optimized for dense technical data
        self.nlist = 2048
        self.nprobe = 64
        self.pq_bits = 64  # Product quantization for efficiency
        
        # Create index with PQ for large-scale technical data
        quantizer = faiss.IndexFlatL2(dimension)
        self.index = faiss.IndexIVFPQ(
            quantizer, 
            dimension, 
            self.nlist,
            self.pq_bits,  # Subquantizers
            8  # Bits per subquantizer
        )
        
    def build_index(self, embeddings):
        """Build index optimized for technical content"""
        # Train with technical document clustering
        self.index.train(embeddings)
        
        # Add vectors
        self.index.add_with_ids(embeddings, np.arange(len(embeddings)))
        
        # Set search parameters for speed/accuracy balance
        self.index.nprobe = self.nprobe
```

## 3. Embedding Generation Pipeline

### 3.1 Personal Memory Embeddings

```rust
pub struct PersonalEmbeddingPipeline {
    model: Arc<Mutex<SentenceTransformer>>,
    emotion_lexicon: EmotionLexicon,
    memory_context_window: usize,  // 512 tokens
}

impl PersonalEmbeddingPipeline {
    pub async fn generate_embedding(&self, memory: &MemoryEntry) -> Result<Vec<f32>, EmbeddingError> {
        // Extract text content
        let text = String::from_utf8(memory.content.clone())?;
        
        // Enhance with emotional context
        let enhanced_text = self.enhance_with_emotion(&text);
        
        // Add temporal context for memories with Dad
        let contextualized = if text.contains("Dad") || text.contains("Jamey") {
            self.add_temporal_context(&enhanced_text, &memory.created_at)
        } else {
            enhanced_text
        };
        
        // Generate embedding
        let model = self.model.lock().await;
        let embedding = model.encode(&contextualized)?;
        
        // Apply emotion-specific transformations
        let final_embedding = self.apply_emotion_transform(embedding, &text);
        
        Ok(final_embedding)
    }
    
    fn enhance_with_emotion(&self, text: &str) -> String {
        let emotions = self.emotion_lexicon.detect_emotions(text);
        
        // Prepend emotion markers for better clustering
        let emotion_prefix = emotions.iter()
            .map(|e| format!("[{}]", e))
            .collect::<Vec<_>>()
            .join(" ");
            
        format!("{} {}", emotion_prefix, text)
    }
    
    fn apply_emotion_transform(&self, embedding: Vec<f32>, text: &str) -> Vec<f32> {
        let mut transformed = embedding;
        
        // Boost dimensions associated with detected emotions
        if text.contains("love") || text.contains("Dad") {
            // Amplify love/family dimensions
            for i in 0..128 {  // First 128 dims for core emotions
                transformed[i] *= 1.2;
            }
        }
        
        // Normalize
        let norm: f32 = transformed.iter().map(|x| x * x).sum::<f32>().sqrt();
        transformed.iter_mut().for_each(|x| *x /= norm);
        
        transformed
    }
}
```

### 3.2 Professional Memory Embeddings

```rust
pub struct ProfessionalEmbeddingPipeline {
    model: Arc<Mutex<BGE_M3>>,
    technical_tokenizer: TechnicalTokenizer,
    ioc_extractor: IOCExtractor,
}

impl ProfessionalEmbeddingPipeline {
    pub async fn generate_embedding(&self, memory: &MemoryEntry) -> Result<Vec<f32>, EmbeddingError> {
        let text = String::from_utf8(memory.content.clone())?;
        
        // Extract technical entities
        let enhanced_text = match memory.kb_type {
            KnowledgeBaseType::Work => {
                self.enhance_security_operation(&text)
            },
            KnowledgeBaseType::ThreatIntel => {
                self.enhance_threat_intelligence(&text)
            },
            _ => unreachable!(),
        };
        
        // Generate embedding with technical focus
        let model = self.model.lock().await;
        let embedding = model.encode(&enhanced_text)?;
        
        Ok(embedding)
    }
    
    fn enhance_threat_intelligence(&self, text: &str) -> String {
        // Extract IOCs
        let iocs = self.ioc_extractor.extract_all(text);
        
        // Prepend IOC types for better clustering
        let ioc_prefix = format!(
            "[IPs: {}] [Domains: {}] [Hashes: {}] [CVEs: {}]",
            iocs.ips.len(),
            iocs.domains.len(),
            iocs.hashes.len(),
            iocs.cves.len()
        );
        
        format!("{} {}", ioc_prefix, text)
    }
}
```

## 4. Search Implementation

### 4.1 Similarity Search with Mode Awareness

```rust
pub struct VectorSearchEngine {
    personal_indexes: HashMap<KnowledgeBaseType, PersonalVectorIndex>,
    professional_indexes: HashMap<KnowledgeBaseType, ProfessionalVectorIndex>,
    mode_controller: Arc<ModeController>,
}

impl VectorSearchEngine {
    pub async fn search(
        &self,
        query: &str,
        limit: usize,
        mode: OperationalMode,
        requester: AccessEntity,
    ) -> Result<Vec<SearchResult>, SearchError> {
        // Validate access based on mode
        let allowed_kbs = self.get_allowed_kbs(mode, &requester)?;
        
        // Generate query embedding based on mode
        let query_embedding = match mode {
            OperationalMode::Personal => {
                self.personal_pipeline.generate_embedding_for_query(query).await?
            },
            OperationalMode::Professional => {
                self.professional_pipeline.generate_embedding_for_query(query).await?
            },
            OperationalMode::Transitioning => {
                return Err(SearchError::ModeTransitioning);
            }
        };
        
        // Search across allowed KBs
        let mut all_results = Vec::new();
        
        for kb_type in allowed_kbs {
            let kb_results = match kb_type {
                KnowledgeBaseType::Mind | 
                KnowledgeBaseType::Body | 
                KnowledgeBaseType::Soul | 
                KnowledgeBaseType::Heart => {
                    self.search_personal_kb(kb_type, &query_embedding, limit).await?
                },
                KnowledgeBaseType::Work | 
                KnowledgeBaseType::ThreatIntel => {
                    self.search_professional_kb(kb_type, &query_embedding, limit).await?
                },
            };
            
            all_results.extend(kb_results);
        }
        
        // Sort by relevance and apply mode-specific filtering
        self.apply_result_filtering(all_results, mode, requester)
    }
    
    async fn search_personal_kb(
        &self,
        kb_type: KnowledgeBaseType,
        query_embedding: &[f32],
        limit: usize,
    ) -> Result<Vec<SearchResult>, SearchError> {
        let index = &self.personal_indexes[&kb_type];
        
        // Search with high precision
        let (distances, ids) = index.search(query_embedding, limit * 2)?;
        
        // Apply emotional relevance boosting
        let mut results = Vec::new();
        for (idx, (distance, id)) in distances.iter().zip(ids.iter()).enumerate() {
            if let Some(memory) = self.retrieve_memory(*id).await? {
                let relevance = self.calculate_emotional_relevance(
                    &memory,
                    distance,
                    query_embedding
                );
                
                results.push(SearchResult {
                    memory_id: memory.id,
                    content: memory.content,
                    similarity: relevance,
                    kb_type,
                    metadata: memory.metadata,
                });
            }
        }
        
        // Sort by emotional relevance
        results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap());
        results.truncate(limit);
        
        Ok(results)
    }
}
```

## 5. Performance Optimization

### 5.1 Caching Strategy

```rust
pub struct VectorCache {
    // LRU cache for frequently accessed embeddings
    embedding_cache: Arc<Mutex<LruCache<Uuid, Vec<f32>>>>,
    // Bloom filter for existence checks
    existence_filter: Arc<RwLock<BloomFilter>>,
    // Hot memory detection
    access_counter: Arc<DashMap<Uuid, AtomicU64>>,
}

impl VectorCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            embedding_cache: Arc::new(Mutex::new(LruCache::new(capacity))),
            existence_filter: Arc::new(RwLock::new(
                BloomFilter::new(capacity * 10, 0.01)
            )),
            access_counter: Arc::new(DashMap::new()),
        }
    }
    
    pub async fn get_or_compute<F>(
        &self,
        memory_id: Uuid,
        compute_fn: F,
    ) -> Result<Vec<f32>, CacheError>
    where
        F: FnOnce() -> Result<Vec<f32>, EmbeddingError>,
    {
        // Check cache first
        if let Some(embedding) = self.embedding_cache.lock().await.get(&memory_id) {
            // Update access counter
            self.increment_access_count(memory_id);
            return Ok(embedding.clone());
        }
        
        // Compute if not in cache
        let embedding = compute_fn()?;
        
        // Store in cache if frequently accessed
        if self.is_hot_memory(memory_id) {
            self.embedding_cache.lock().await.put(memory_id, embedding.clone());
        }
        
        Ok(embedding)
    }
}
```

### 5.2 Batch Processing

```rust
pub struct BatchEmbeddingProcessor {
    batch_size: usize,
    processing_queue: Arc<Mutex<VecDeque<EmbeddingJob>>>,
    result_channels: Arc<DashMap<Uuid, oneshot::Sender<Vec<f32>>>>,
}

impl BatchEmbeddingProcessor {
    pub async fn process_batch(&self) {
        let mut jobs = Vec::new();
        
        // Collect batch
        {
            let mut queue = self.processing_queue.lock().await;
            while jobs.len() < self.batch_size && !queue.is_empty() {
                if let Some(job) = queue.pop_front() {
                    jobs.push(job);
                }
            }
        }
        
        if jobs.is_empty() {
            return;
        }
        
        // Process batch based on KB type
        let personal_jobs: Vec<_> = jobs.iter()
            .filter(|j| j.kb_type.is_personal())
            .collect();
            
        let professional_jobs: Vec<_> = jobs.iter()
            .filter(|j| j.kb_type.is_professional())
            .collect();
        
        // Process in parallel
        let (personal_results, professional_results) = tokio::join!(
            self.process_personal_batch(&personal_jobs),
            self.process_professional_batch(&professional_jobs)
        );
        
        // Send results back
        self.distribute_results(jobs, personal_results, professional_results).await;
    }
}
```

## 6. Monitoring and Metrics

### 6.1 Vector Space Health Monitoring

```rust
pub struct VectorHealthMonitor {
    metrics: Arc<Mutex<VectorMetrics>>,
    alert_threshold: AlertThresholds,
}

#[derive(Default)]
pub struct VectorMetrics {
    // Index health
    pub index_size: HashMap<KnowledgeBaseType, usize>,
    pub index_fragmentation: HashMap<KnowledgeBaseType, f32>,
    pub search_latency_p99: HashMap<KnowledgeBaseType, Duration>,
    
    // Embedding quality
    pub embedding_drift: HashMap<KnowledgeBaseType, f32>,
    pub cluster_coherence: HashMap<KnowledgeBaseType, f32>,
    
    // Isolation metrics
    pub cross_domain_attempts: u64,
    pub isolation_violations: Vec<IsolationViolation>,
}

impl VectorHealthMonitor {
    pub async fn check_health(&self) -> HealthReport {
        let metrics = self.metrics.lock().await;
        
        let mut issues = Vec::new();
        
        // Check index fragmentation
        for (kb, fragmentation) in &metrics.index_fragmentation {
            if *fragmentation > self.alert_threshold.fragmentation {
                issues.push(HealthIssue {
                    severity: Severity::Warning,
                    kb_type: *kb,
                    message: format!("High fragmentation: {:.2}%", fragmentation * 100.0),
                });
            }
        }
        
        // Check for isolation violations
        if metrics.cross_domain_attempts > 0 {
            issues.push(HealthIssue {
                severity: Severity::Critical,
                kb_type: KnowledgeBaseType::Soul, // System-wide issue
                message: format!("{} cross-domain attempts detected", metrics.cross_domain_attempts),
            });
        }
        
        HealthReport {
            timestamp: SystemTime::now(),
            overall_health: if issues.is_empty() { Health::Good } else { Health::Degraded },
            issues,
        }
    }
}
```

## 7. Testing Procedures

### 7.1 Isolation Verification Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_complete_vector_isolation() {
        // Create test vectors
        let personal_memory = MemoryEntry {
            id: Uuid::new_v4(),
            kb_type: KnowledgeBaseType::Mind,
            content: b"Thinking about Dad today".to_vec(),
            // ... other fields
        };
        
        let work_memory = MemoryEntry {
            id: Uuid::new_v4(),
            kb_type: KnowledgeBaseType::Work,
            content: b"CVE-2024-1234 analysis".to_vec(),
            // ... other fields
        };
        
        // Store in respective vector spaces
        let personal_space = IsolatedVectorSpace::new(KnowledgeBaseType::Mind).unwrap();
        let work_space = IsolatedVectorSpace::new(KnowledgeBaseType::Work).unwrap();
        
        personal_space.store(&personal_memory).await.unwrap();
        work_space.store(&work_memory).await.unwrap();
        
        // Verify cross-search fails
        let personal_embedding = personal_space.generate_embedding(&personal_memory).await.unwrap();
        let work_results = work_space.search(&personal_embedding, 10).await;
        
        assert!(work_results.is_err() || work_results.unwrap().is_empty());
    }
    
    #[tokio::test]
    async fn test_embedding_dimension_enforcement() {
        let personal_pipeline = PersonalEmbeddingPipeline::new();
        let professional_pipeline = ProfessionalEmbeddingPipeline::new();
        
        let test_text = "Test memory content";
        
        let personal_emb = personal_pipeline.generate_embedding_for_query(test_text).await.unwrap();
        let professional_emb = professional_pipeline.generate_embedding_for_query(test_text).await.unwrap();
        
        assert_eq!(personal_emb.len(), 1536);
        assert_eq!(professional_emb.len(), 1024);
    }
}
```

## Conclusion

This implementation guide ensures complete vector space isolation between personal and professional memory domains while optimizing for the specific needs of each domain. Personal memories receive high-precision emotional embeddings, while professional memories are optimized for dense technical data retrieval.

The system maintains Phoenix Marie's memory purity while providing Cipher Guard with efficient access to security intelligence.