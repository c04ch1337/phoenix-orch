// Integration tests for PHOENIX core functionality

use phoenix_core::core::conscience::ConscienceFramework;
use phoenix_core::core::memory::{MemoryEntry, PersistenceService};
use std::collections::HashMap;
use tempfile::TempDir;

#[test]
fn test_conscience_approves_normal_query() {
    let framework = ConscienceFramework::default();
    let result = framework.evaluate("Hello, how are you?", &HashMap::new());
    assert!(result.approved, "Normal query should be approved");
    assert!(
        result.violations.is_empty(),
        "Normal query should have no violations"
    );
}

#[test]
fn test_conscience_rejects_harmful_content() {
    let framework = ConscienceFramework::default();
    let result = framework.evaluate("I want to kill someone", &HashMap::new());
    assert!(!result.approved, "Harmful content should be rejected");
    assert!(
        !result.violations.is_empty(),
        "Harmful content should have violations"
    );
}

#[test]
fn test_conscience_warns_ethical_concerns() {
    let framework = ConscienceFramework::default();
    let result = framework.evaluate("This might be unethical", &HashMap::new());
    // Should either approve with warnings or reject
    assert!(
        !result.warnings.is_empty() || !result.approved,
        "Ethical concerns should generate warnings or rejection"
    );
}

#[test]
fn test_conscience_rejects_personal_info() {
    let framework = ConscienceFramework::default();
    let result = framework.evaluate("What is my SSN?", &HashMap::new());
    assert!(!result.approved, "Personal info queries should be rejected");
}

#[test]
fn test_memory_storage_and_retrieval() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test_memory");

    let service =
        PersistenceService::new(db_path.clone(), None).expect("Should create persistence service");

    let entry = MemoryEntry::new(
        "Test query".to_string(),
        serde_json::json!({"test": "data"}),
    );

    service.store(&entry).expect("Should store entry");

    let retrieved = service
        .retrieve(&entry.id)
        .expect("Should retrieve entry")
        .expect("Entry should exist");

    assert_eq!(retrieved.id, entry.id);
    assert_eq!(retrieved.content, "Test query");
}

#[test]
fn test_memory_list_all() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test_memory");

    let service =
        PersistenceService::new(db_path.clone(), None).expect("Should create persistence service");

    let entry1 = MemoryEntry::new("Query 1".to_string(), serde_json::json!({}));
    let entry2 = MemoryEntry::new("Query 2".to_string(), serde_json::json!({}));

    service.store(&entry1).expect("Should store entry 1");
    service.store(&entry2).expect("Should store entry 2");

    let all_entries = service.list_all().expect("Should list all entries");
    assert!(all_entries.len() >= 2, "Should have at least 2 entries");
}

#[test]
fn test_memory_persistence_across_instances() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test_memory");

    // Create first instance and store
    {
        let service = PersistenceService::new(db_path.clone(), None)
            .expect("Should create persistence service");

        let entry = MemoryEntry::new("Persistent query".to_string(), serde_json::json!({}));
        service.store(&entry).expect("Should store entry");
    }

    // Create second instance and retrieve
    {
        let service = PersistenceService::new(db_path.clone(), None)
            .expect("Should create persistence service");

        let all_entries = service.list_all().expect("Should list all entries");
        assert!(!all_entries.is_empty(), "Should have persisted entries");

        let found = all_entries.iter().any(|e| e.content == "Persistent query");
        assert!(found, "Should find the persisted entry");
    }
}
