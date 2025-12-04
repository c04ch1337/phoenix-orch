//! Knowledge Base management for Cipher Guard
//!
//! Provides functionality to store, index, retrieve, and search personal knowledge repositories

use crate::error::Error as CipherGuardError;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use chrono::{DateTime, Utc};
use regex::Regex;

/// Types of content that can be stored in the Knowledge Base
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContentType {
    /// Plain text content
    Text,
    /// Structured data in JSON format
    Json,
    /// Markdown formatted text
    Markdown,
    /// Binary data
    Binary,
}

/// A search result from the Knowledge Base
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// The ID of the entry
    pub entry_id: String,
    /// The title of the entry
    pub title: String,
    /// The content that matched
    pub matching_content: String,
    /// The context around the match
    pub context: String,
    /// The match position in the content
    pub position: usize,
    /// The relevance score
    pub relevance_score: f32,
    /// The content type
    pub content_type: ContentType,
    /// Timestamp when the entry was last updated
    pub last_updated: DateTime<Utc>,
}

/// A Knowledge Base entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeBaseEntry {
    /// Unique identifier for the entry
    pub id: String,
    /// Entry title
    pub title: String,
    /// Main content of the entry
    pub content: String,
    /// Type of the content
    pub content_type: ContentType,
    /// Tags associated with this entry
    pub tags: HashSet<String>,
    /// Additional metadata as key-value pairs
    pub metadata: HashMap<String, String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

/// A Knowledge Base repository
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeBaseRepository {
    /// Unique identifier for the repository
    pub id: String,
    /// Repository name
    pub name: String,
    /// Repository description
    pub description: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

/// The Knowledge Base system
pub struct KnowledgeBase {
    /// Repositories in this Knowledge Base
    repositories: HashMap<String, KnowledgeBaseRepository>,
    /// Entries indexed by repository_id and entry_id
    entries: HashMap<String, HashMap<String, KnowledgeBaseEntry>>,
}

impl KnowledgeBase {
    /// Create a new Knowledge Base
    pub fn new() -> Self {
        Self {
            repositories: HashMap::new(),
            entries: HashMap::new(),
        }
    }

    /// Create a new repository
    pub fn create_repository(
        &mut self,
        name: &str,
        description: &str,
    ) -> Result<String, CipherGuardError> {
        let id = format!("{}-{}", name.to_lowercase().replace(' ', "-"), uuid::Uuid::new_v4());
        
        let repository = KnowledgeBaseRepository {
            id: id.clone(),
            name: name.to_string(),
            description: description.to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        self.repositories.insert(id.clone(), repository);
        self.entries.insert(id.clone(), HashMap::new());
        
        Ok(id)
    }

    /// Add an entry to a repository
    pub fn add_entry(
        &mut self,
        repository_id: &str,
        title: &str,
        content: &str,
        content_type: ContentType,
        tags: HashSet<String>,
        metadata: HashMap<String, String>,
    ) -> Result<String, CipherGuardError> {
        // Verify repository exists
        if !self.repositories.contains_key(repository_id) {
            return Err(CipherGuardError::RepositoryNotFound(repository_id.to_string()));
        }
        
        let entry_id = format!("{}-{}", title.to_lowercase().replace(' ', "-"), uuid::Uuid::new_v4());
        
        let entry = KnowledgeBaseEntry {
            id: entry_id.clone(),
            title: title.to_string(),
            content: content.to_string(),
            content_type,
            tags,
            metadata,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        // Update repository's updated_at timestamp
        if let Some(repo) = self.repositories.get_mut(repository_id) {
            repo.updated_at = Utc::now();
        }
        
        // Add entry to repository
        if let Some(repo_entries) = self.entries.get_mut(repository_id) {
            repo_entries.insert(entry_id.clone(), entry);
        }
        
        Ok(entry_id)
    }

    /// Search for entries in a repository
    pub fn search(
        &self,
        repository_name: &str,
        query: &str,
        exact_match: bool,
    ) -> Result<Vec<SearchResult>, CipherGuardError> {
        // Find repository by name (case insensitive)
        let repository_id = self.find_repository_by_name(repository_name)?;
        
        // Get entries from repository
        let entries = self.entries.get(&repository_id)
            .ok_or_else(|| CipherGuardError::RepositoryNotFound(repository_id.clone()))?;
        
        let mut results = Vec::new();
        
        // Compile regex for exact or partial match
        let regex = if exact_match {
            Regex::new(&format!(r"\b{}\b", regex::escape(query)))
                .map_err(|e| CipherGuardError::InvalidRegex(e.to_string()))?
        } else {
            Regex::new(&regex::escape(query))
                .map_err(|e| CipherGuardError::InvalidRegex(e.to_string()))?
        };
        
        // Search in each entry
        for entry in entries.values() {
            for mat in regex.find_iter(&entry.content) {
                let position = mat.start();
                let match_text = mat.as_str();
                
                // Extract context (50 characters before and after)
                let context_start = position.saturating_sub(50);
                let context_end = (position + match_text.len() + 50).min(entry.content.len());
                let context = entry.content[context_start..context_end].to_string();
                
                // Calculate simple relevance score (1.0 for exact match, 0.8 for partial)
                let relevance_score = if exact_match { 1.0 } else { 0.8 };
                
                results.push(SearchResult {
                    entry_id: entry.id.clone(),
                    title: entry.title.clone(),
                    matching_content: match_text.to_string(),
                    context,
                    position,
                    relevance_score,
                    content_type: entry.content_type.clone(),
                    last_updated: entry.updated_at,
                });
            }
        }
        
        // Sort by relevance
        results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        
        Ok(results)
    }

    /// Find a repository by name (case insensitive)
    fn find_repository_by_name(&self, name: &str) -> Result<String, CipherGuardError> {
        // Normalize the name for comparison
        let normalized_name = name.to_lowercase();
        
        for (id, repo) in &self.repositories {
            if repo.name.to_lowercase() == normalized_name {
                return Ok(id.clone());
            }
        }
        
        Err(CipherGuardError::RepositoryNotFound(name.to_string()))
    }
    
    /// Get a knowledge base repository by name
    pub fn get_repository_by_name(&self, name: &str) -> Result<KnowledgeBaseRepository, CipherGuardError> {
        let repo_id = self.find_repository_by_name(name)?;
        self.repositories.get(&repo_id)
            .cloned()
            .ok_or_else(|| CipherGuardError::RepositoryNotFound(name.to_string()))
    }
    
    /// Get all repositories in the knowledge base
    pub fn list_repositories(&self) -> Vec<KnowledgeBaseRepository> {
        self.repositories.values().cloned().collect()
    }
    
    /// Get all entries in a repository
    pub fn list_entries(&self, repository_name: &str) -> Result<Vec<KnowledgeBaseEntry>, CipherGuardError> {
        let repo_id = self.find_repository_by_name(repository_name)?;
        
        Ok(self.entries.get(&repo_id)
            .map(|entries| entries.values().cloned().collect())
            .unwrap_or_else(Vec::new))
    }
    
    /// Get a specific entry
    pub fn get_entry(&self, repository_name: &str, entry_id: &str) -> Result<KnowledgeBaseEntry, CipherGuardError> {
        let repo_id = self.find_repository_by_name(repository_name)?;
        
        if let Some(repo_entries) = self.entries.get(&repo_id) {
            if let Some(entry) = repo_entries.get(entry_id) {
                return Ok(entry.clone());
            }
        }
        
        Err(CipherGuardError::EntryNotFound(entry_id.to_string()))
    }
    
    /// Delete an entry from a repository
    pub fn delete_entry(&mut self, repository_name: &str, entry_id: &str) -> Result<(), CipherGuardError> {
        let repo_id = self.find_repository_by_name(repository_name)?;
        
        if let Some(repo_entries) = self.entries.get_mut(&repo_id) {
            if repo_entries.remove(entry_id).is_none() {
                return Err(CipherGuardError::EntryNotFound(entry_id.to_string()));
            }
            
            // Update repository's updated_at timestamp
            if let Some(repo) = self.repositories.get_mut(&repo_id) {
                repo.updated_at = Utc::now();
            }
            
            Ok(())
        } else {
            Err(CipherGuardError::RepositoryNotFound(repository_name.to_string()))
        }
    }
    
    /// Delete a repository and all its entries
    pub fn delete_repository(&mut self, name: &str) -> Result<(), CipherGuardError> {
        let repo_id = self.find_repository_by_name(name)?;
        
        self.repositories.remove(&repo_id);
        self.entries.remove(&repo_id);
        
        Ok(())
    }
    
    /// Update an entry in a repository
    pub fn update_entry(
        &mut self,
        repository_name: &str,
        entry_id: &str,
        title: Option<String>,
        content: Option<String>,
        tags: Option<HashSet<String>>,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<(), CipherGuardError> {
        let repo_id = self.find_repository_by_name(repository_name)?;
        
        if let Some(repo_entries) = self.entries.get_mut(&repo_id) {
            if let Some(entry) = repo_entries.get_mut(entry_id) {
                if let Some(new_title) = title {
                    entry.title = new_title;
                }
                
                if let Some(new_content) = content {
                    entry.content = new_content;
                }
                
                if let Some(new_tags) = tags {
                    entry.tags = new_tags;
                }
                
                if let Some(new_metadata) = metadata {
                    entry.metadata = new_metadata;
                }
                
                entry.updated_at = Utc::now();
                
                // Update repository's updated_at timestamp
                if let Some(repo) = self.repositories.get_mut(&repo_id) {
                    repo.updated_at = Utc::now();
                }
                
                Ok(())
            } else {
                Err(CipherGuardError::EntryNotFound(entry_id.to_string()))
            }
        } else {
            Err(CipherGuardError::RepositoryNotFound(repository_name.to_string()))
        }
    }
}

// Singleton instance for the Knowledge Base
lazy_static::lazy_static! {
    static ref KNOWLEDGE_BASE: Arc<RwLock<KnowledgeBase>> = Arc::new(RwLock::new(KnowledgeBase::new()));
}

/// Get the global Knowledge Base instance
pub fn get_knowledge_base() -> Arc<RwLock<KnowledgeBase>> {
    KNOWLEDGE_BASE.clone()
}

/// Initialize the Knowledge Base with some default repositories if needed
pub fn initialize() -> Result<(), CipherGuardError> {
    let mut kb = KNOWLEDGE_BASE.write().unwrap();
    
    // Create default repositories if they don't exist
    if kb.repositories.is_empty() {
        // Heart KB is one of the requested repositories
        let heart_kb_id = kb.create_repository(
            "Heart KB", 
            "Personal repository for important information and memories"
        )?;
        
        // Add some sample entries to Heart KB
        kb.add_entry(
            &heart_kb_id,
            "Core Memories",
            "These are the memories that will stay with me forever. \
            The moments that defined me and shaped my journey. \
            From childhood to adulthood, these experiences form the foundation of who I am.",
            ContentType::Text,
            ["memories", "personal", "core"].iter().map(|&s| s.to_string()).collect(),
            HashMap::new(),
        )?;
        
        kb.add_entry(
            &heart_kb_id,
            "Guiding Principles",
            "1. Always act with integrity and honesty\n\
             2. Show compassion to yourself and others\n\
             3. Continuously learn and grow\n\
             4. Find balance in all aspects of life\n\
             5. Practice gratitude daily",
            ContentType::Markdown,
            ["principles", "values", "guidance"].iter().map(|&s| s.to_string()).collect(),
            HashMap::new(),
        )?;
        
        // Create a Work KB as well
        let work_kb_id = kb.create_repository(
            "Work KB", 
            "Professional knowledge and information"
        )?;
        
        kb.add_entry(
            &work_kb_id,
            "Project Timeline",
            "Q1: Research and Planning\nQ2: Development\nQ3: Testing\nQ4: Deployment",
            ContentType::Text,
            ["project", "timeline", "planning"].iter().map(|&s| s.to_string()).collect(),
            HashMap::new(),
        )?;
    }
    
    Ok(())
}