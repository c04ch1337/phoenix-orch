use crate::knowledge_base::{KnowledgeBase, ContentType};
use std::collections::{HashMap, HashSet};

#[tokio::test]
async fn test_knowledge_base_basic_operations() {
    // Create a new knowledge base
    let mut kb = KnowledgeBase::new();
    
    // Test repository creation
    let repo_id = kb.create_repository("Test KB", "A test knowledge base").unwrap();
    assert!(!repo_id.is_empty(), "Repository ID should be non-empty");
    
    // Add a test entry
    let tags = ["test", "example", "documentation"].iter().map(|&s| s.to_string()).collect();
    let entry_id = kb.add_entry(
        &repo_id,
        "Test Document",
        "This is a sample document to test the knowledge base functionality.",
        ContentType::Text,
        tags,
        HashMap::new(),
    ).unwrap();
    
    // Verify we can get the entry back
    let entry = kb.get_entry("Test KB", &entry_id).unwrap();
    assert_eq!(entry.title, "Test Document");
    
    // List all repositories
    let repositories = kb.list_repositories();
    assert_eq!(repositories.len(), 1);
    assert_eq!(repositories[0].name, "Test KB");
    
    // List all entries in repository
    let entries = kb.list_entries("Test KB").unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].title, "Test Document");
}

#[tokio::test]
async fn test_knowledge_base_search() {
    let mut kb = KnowledgeBase::new();
    
    // Create a test repository
    let repo_id = kb.create_repository("Heart KB", "Personal memories and information").unwrap();
    
    // Add some test entries
    let entry1_tags: HashSet<String> = ["memories", "personal"].iter().map(|&s| s.to_string()).collect();
    let entry1_id = kb.add_entry(
        &repo_id,
        "Childhood Memories",
        "I remember playing in the park near my grandmother's house every summer. \
         Those were the days I cherish forever. The sunlight, the trees, the laughter - \
         all etched in my mind as precious memories from my childhood.",
        ContentType::Text,
        entry1_tags,
        HashMap::new(),
    ).unwrap();
    
    let entry2_tags: HashSet<String> = ["values", "principles"].iter().map(|&s| s.to_string()).collect();
    let entry2_id = kb.add_entry(
        &repo_id,
        "Personal Values",
        "I believe that honesty and integrity are the foundation of all relationships. \
         Trust is earned through consistent actions and transparent communication.",
        ContentType::Text,
        entry2_tags,
        HashMap::new(),
    ).unwrap();
    
    // Test simple word search
    let results = kb.search("Heart KB", "forever", false).unwrap();
    assert_eq!(results.len(), 1, "Should find one result for 'forever'");
    assert_eq!(results[0].entry_id, entry1_id);
    
    // Test exact phrase search
    let results = kb.search("Heart KB", "precious memories", true).unwrap();
    assert_eq!(results.len(), 1);
    assert!(results[0].context.contains("precious memories"));
    
    // Test word that should be in multiple entries
    let results = kb.search("Heart KB", "personal", false).unwrap();
    assert!(results.len() >= 1, "Should find at least one result for 'personal'");
    
    // Test word that shouldn't be in any entries
    let results = kb.search("Heart KB", "xyzabc123", false).unwrap();
    assert_eq!(results.len(), 0, "Should find no results for a nonsense word");
    
    // Test case insensitivity
    let results = kb.search("Heart KB", "MEMORIES", false).unwrap();
    assert!(results.len() >= 1, "Search should be case insensitive");
}