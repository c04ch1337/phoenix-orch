# Vector Search Implementation for OrchestratorAgent

This document provides a comprehensive overview of the vector search implementation for the OrchestratorAgent, explaining how it works across all four memory knowledge bases, how embeddings are generated, and how to use the search functionality.

## Architecture Overview

The vector search functionality is designed to work with four distinct knowledge bases (KBs):

1. **Working Memory KB**: Stores short-term, current context information
2. **Episodic Memory KB**: Stores personal experiences and events
3. **Semantic Memory KB**: Stores facts, concepts and general knowledge
4. **Procedural Memory KB**: Stores skills, procedures and how-to knowledge

The implementation consists of three main components:

- `PhoenixContext`: Manages KB access and memory storage
- `VectorEngine`: Provides embedding generation and search capabilities
- `OrchestratorAgent`: Exposes high-level search APIs for clients

## Memory Knowledge Bases

Each knowledge base is implemented as a `KnowledgeBase` struct, which contains:

- `kb_type`: Identifier for the KB (Episodic, Semantic, Procedural, or Working)
- `memories`: HashMap of memory entries stored in this KB
- `storage_path`: Path to persistent storage for this KB

Memory entries (`MemoryEntry`) contain:

- `id`: Unique identifier for the memory
- `content`: The actual content of the memory
- `created_at`: When the memory was created
- `last_accessed`: When the memory was last accessed
- `kb_type`: Type of knowledge base this memory belongs to
- `metadata`: Additional properties associated with the memory
- `embedding`: Vector representation for similarity search

## Vector Search Engine

The `VectorEngine` provides:

1. **Embedding Generation**: Converts text into vector representations
2. **Similarity Calculation**: Computes cosine similarity between embeddings
3. **Search Across KBs**: Finds memories similar to a query across all KBs
4. **Prioritization**: Ranks results by both relevance and KB priority

### Embedding Generation

The embedding process converts text into fixed-size vector representations that capture semantic meaning:

1. Text is preprocessed (in a real implementation)
2. The embedding model converts text to fixed-dimensional vector
3. Vectors are normalized to unit length for cosine similarity calculations

Our implementation uses a mock embedding generator that creates deterministic embeddings based on character values. In a production system, this would be replaced with a real embedding model such as:

- Sentence transformers
- Universal Sentence Encoder
- Custom-trained embeddings model

### Search Process

When a search is performed:

1. The query is converted to an embedding vector
2. The embedding is compared with all stored memory embeddings using cosine similarity
3. Memories with similarity above the threshold are collected
4. Results are weighted by both similarity and KB priority
5. Results are combined, sorted, and returned

### Configurable Parameters

The vector search is highly configurable through the `VectorSearchConfig`:

- `model_type`: Type of embedding model to use
- `model_path`: Path to model files
- `dimensions`: Size of embedding vectors
- `similarity_threshold`: Minimum similarity score (defaults to 0.6)
- `kb_weights`: Priority weights for each KB type

## Using the Search Functionality

The OrchestratorAgent provides three main methods for working with vector search:

### 1. Search Across All Knowledge Bases

```rust
// Search across all KBs with default limit
let results_json = agent.search_memory("how does photosynthesis work", None).await?;

// Search with custom limit
let results_json = agent.search_memory("how does photosynthesis work", Some(20)).await?;
```

### 2. Search a Specific Knowledge Base

```rust
// Search only semantic memory
let results_json = agent.search_specific_kb(
    "how does photosynthesis work",
    KnowledgeBaseType::Semantic,
    Some(10),
    Some(0.7), // Higher similarity threshold
).await?;
```

### 3. Store a Memory with Embedding

```rust
// Store a new memory in episodic KB
let mut metadata = HashMap::new();
metadata.insert("source".to_string(), "personal experience".to_string());
metadata.insert("category".to_string(), "learning".to_string());

let memory_id = agent.store_memory(
    "I learned about photosynthesis in biology class today",
    KnowledgeBaseType::Episodic,
    Some(metadata),
).await?;
```

## Handling Multiple Knowledge Bases

When searching across multiple KBs, results are combined and ranked by:

1. **Raw Similarity Score**: How closely the memory matches the query
2. **KB Priority Weight**: Higher priority KBs get boosted scores
3. **Weighted Score**: Combination of similarity and KB priority

This ensures that:
- The most relevant memories are returned first
- High-priority knowledge bases (like Working Memory) get precedence
- Older or less relevant memories are pushed down in results

## Thread Safety Considerations

All components are designed to be thread-safe through the use of:

- `Arc<RwLock<T>>` for shared access to KBs and engines
- Proper read/write locking patterns
- Immutable references where possible
- Clone-on-read for memory retrieval

## Performance Considerations

The implementation includes several optimizations:

1. **Parallel KB Search**: Each KB can be searched independently
2. **Result Limiting**: Each KB search can be limited to a maximum result count
3. **Early Filtering**: Similarity threshold filtering happens during search
4. **Late Combination**: Only results above threshold are combined

## Future Enhancements

Potential future improvements include:

1. **Distributed Vector Storage**: Scaling to larger memory collections
2. **Disk-Based Vector Indexing**: For more efficient similarity search
3. **Approximate Nearest Neighbor**: For faster search with large collections
4. **Hybrid Search**: Combining vector + keyword search
5. **Embedding Caching**: Avoid re-computing embeddings for common queries

## Example Usage Scenarios

### 1. Retrieving Relevant Knowledge

```rust
// Find information about climate change
let results = agent.search_memory("impacts of climate change", Some(10)).await?;
```

### 2. Finding Procedural Knowledge

```rust
// Find instructions for a task
let results = agent.search_specific_kb(
    "how to make pasta", 
    KnowledgeBaseType::Procedural,
    Some(5),
    None
).await?;
```

### 3. Contextual Memory Recall

```rust
// Recall recent related information from working memory
let results = agent.search_specific_kb(
    "our conversation about quantum physics",
    KnowledgeBaseType::Working,
    Some(3),
    None
).await?;
```

### 4. Episodic Memory Exploration

```rust
// Recall personal experiences related to a topic
let results = agent.search_specific_kb(
    "my experience with machine learning projects",
    KnowledgeBaseType::Episodic,
    Some(10),
    None
).await?;
```

## Conclusion

The vector search implementation provides a powerful mechanism for retrieving relevant information across all knowledge bases. By combining similarity-based search with knowledge base prioritization, the system can efficiently locate the most relevant memories based on semantic meaning rather than just keyword matching.