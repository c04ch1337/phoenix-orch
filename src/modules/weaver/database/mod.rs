mod schema;
mod database_pool;

pub use schema::*;
pub use database_pool::{DatabasePool, DatabaseMetrics};

use sqlx::{sqlite::SqliteRow, Row};
use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use uuid::Uuid;
use std::sync::Arc;
use std::time::Duration;

// Number of retries for operations that might encounter locking
const MAX_RETRIES: u32 = 5;
// Default database URL
const DEFAULT_DB_URL: &str = "sqlite://weaver.db";

#[derive(Clone)]
pub struct Database {
    // Use the database pool for connection management
    pool: Arc<DatabasePool>,
}

impl Database {
    // Create a new database with pooled connections
    pub async fn new(path: &str, max_connections: Option<u32>) -> Result<Self, sqlx::Error> {
        // Format the SQLite connection string
        let db_url = format!("sqlite://{}", path);
        
        // Create the database pool with default or specified max connections
        let pool = Arc::new(
            DatabasePool::new(&db_url, max_connections.unwrap_or(10)).await?
        );
        
        // Run migrations to ensure schema is up-to-date
        pool.run_migrations().await?;
        
        Ok(Self { pool })
    }
    
    // Create a default database instance
    pub async fn default() -> Result<Self, sqlx::Error> {
        Self::new(DEFAULT_DB_URL, Some(10)).await
    }
    
    // Run health check
    pub async fn health_check(&self) -> bool {
        self.pool.health_check().await
    }
    
    // Get pool metrics
    pub async fn get_metrics(&self) -> DatabaseMetrics {
        self.pool.get_metrics().await
    }

    // Insert repository with retry logic to handle potential database locks
    pub async fn insert_repo(&self, repo: &AdoptedRepo) -> Result<(), sqlx::Error> {
        // Use retry mechanism for handling potential database locks
        database_pool::with_transaction(&self.pool.get_pool(), MAX_RETRIES, |tx| Box::pin(async move {
            sqlx::query(
                "INSERT INTO adopted_repos (id, name, repo_url, git_ref, adopted_at, metadata, status, health)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(repo.id.to_string())
            .bind(&repo.name)
            .bind(&repo.repo_url)
            .bind(&repo.git_ref)
            .bind(repo.adopted_at.to_rfc3339())
            .bind(serde_json::to_string(&repo.metadata).unwrap())
            .bind(serde_json::to_string(&repo.status).unwrap())
            .bind(serde_json::to_string(&repo.health).unwrap())
            .execute(&mut **tx)
            .await?;
            
            Ok(())
        })).await
    }

    // Get repository by ID
    pub async fn get_repo(&self, id: Uuid) -> Result<Option<AdoptedRepo>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT name, repo_url, git_ref, adopted_at, metadata, status, health 
            FROM adopted_repos WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool.get_pool())
        .await?;
        
        match row {
            Some(row) => {
                // Parse the data from the row
                let adopted_at = DateTime::parse_from_rfc3339(&row.get::<String, _>("adopted_at"))
                    .map_err(|e| sqlx::Error::ColumnDecode {
                        index: "adopted_at".to_string(),
                        source: Box::new(e),
                    })?
                    .with_timezone(&Utc);
                
                let metadata: Value = serde_json::from_str(&row.get::<String, _>("metadata"))
                    .map_err(|e| sqlx::Error::ColumnDecode { 
                        index: "metadata".to_string(), 
                        source: Box::new(e) 
                    })?;
                
                let status: RepoStatus = serde_json::from_str(&row.get::<String, _>("status"))
                    .map_err(|e| sqlx::Error::ColumnDecode { 
                        index: "status".to_string(), 
                        source: Box::new(e) 
                    })?;
                
                let health: HealthStatus = serde_json::from_str(&row.get::<String, _>("health"))
                    .map_err(|e| sqlx::Error::ColumnDecode { 
                        index: "health".to_string(), 
                        source: Box::new(e) 
                    })?;
                
                Ok(Some(AdoptedRepo {
                    id,
                    name: row.get("name"),
                    repo_url: row.get("repo_url"),
                    git_ref: row.get("git_ref"),
                    adopted_at,
                    metadata,
                    status,
                    health,
                }))
            }
            None => Ok(None),
        }
    }

    // Update repository status with retry logic
    pub async fn update_repo_status(&self, id: Uuid, status: RepoStatus) -> Result<(), sqlx::Error> {
        database_pool::with_transaction(&self.pool.get_pool(), MAX_RETRIES, |tx| Box::pin(async move {
            sqlx::query(
                "UPDATE adopted_repos SET status = ? WHERE id = ?"
            )
            .bind(serde_json::to_string(&status).unwrap())
            .bind(id.to_string())
            .execute(&mut **tx)
            .await?;
            
            Ok(())
        })).await
    }

    // Update repository health with retry logic
    pub async fn update_repo_health(&self, id: Uuid, health: HealthStatus) -> Result<(), sqlx::Error> {
        database_pool::with_transaction(&self.pool.get_pool(), MAX_RETRIES, |tx| Box::pin(async move {
            sqlx::query(
                "UPDATE adopted_repos SET health = ? WHERE id = ?"
            )
            .bind(serde_json::to_string(&health).unwrap())
            .bind(id.to_string())
            .execute(&mut **tx)
            .await?;
            
            Ok(())
        })).await
    }

    // List all repositories
    pub async fn list_repos(&self) -> Result<Vec<AdoptedRepo>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, name, repo_url, git_ref, adopted_at, metadata, status, health 
            FROM adopted_repos"
        )
        .fetch_all(&self.pool.get_pool())
        .await?;
        
        let mut repos = Vec::new();
        
        for row in rows {
            let id = Uuid::parse_str(&row.get::<String, _>("id"))
                .map_err(|e| sqlx::Error::ColumnDecode {
                    index: "id".to_string(),
                    source: Box::new(e),
                })?;
            
            let adopted_at = DateTime::parse_from_rfc3339(&row.get::<String, _>("adopted_at"))
                .map_err(|e| sqlx::Error::ColumnDecode {
                    index: "adopted_at".to_string(),
                    source: Box::new(e),
                })?
                .with_timezone(&Utc);
            
            let metadata: Value = serde_json::from_str(&row.get::<String, _>("metadata"))
                .map_err(|e| sqlx::Error::ColumnDecode { 
                    index: "metadata".to_string(), 
                    source: Box::new(e) 
                })?;
            
            let status: RepoStatus = serde_json::from_str(&row.get::<String, _>("status"))
                .map_err(|e| sqlx::Error::ColumnDecode { 
                    index: "status".to_string(), 
                    source: Box::new(e) 
                })?;
            
            let health: HealthStatus = serde_json::from_str(&row.get::<String, _>("health"))
                .map_err(|e| sqlx::Error::ColumnDecode { 
                    index: "health".to_string(), 
                    source: Box::new(e) 
                })?;
            
            repos.push(AdoptedRepo {
                id,
                name: row.get("name"),
                repo_url: row.get("repo_url"),
                git_ref: row.get("git_ref"),
                adopted_at,
                metadata,
                status,
                health,
            });
        }
        
        Ok(repos)
    }

    // Add functions for voice aliases with retry logic
    pub async fn add_voice_alias(
        &self, 
        id: Uuid, 
        repo_id: Uuid, 
        alias: &str, 
        command_pattern: &str, 
        parameters: &Value
    ) -> Result<(), sqlx::Error> {
        database_pool::with_transaction(&self.pool.get_pool(), MAX_RETRIES, |tx| Box::pin(async move {
            sqlx::query(
                "INSERT INTO voice_aliases (id, repo_id, alias, command_pattern, parameters, last_used) 
                VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(id.to_string())
            .bind(repo_id.to_string())
            .bind(alias)
            .bind(command_pattern)
            .bind(serde_json::to_string(parameters).unwrap())
            .bind(Utc::now().to_rfc3339())
            .execute(&mut **tx)
            .await?;
            
            Ok(())
        })).await
    }
    
    // Find voice alias by name
    pub async fn find_voice_alias(&self, alias: &str) -> Result<Option<VoiceAlias>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT id, repo_id, command_pattern, parameters, last_used 
            FROM voice_aliases WHERE alias = ?"
        )
        .bind(alias)
        .fetch_optional(&self.pool.get_pool())
        .await?;
        
        match row {
            Some(row) => {
                let id = Uuid::parse_str(&row.get::<String, _>("id"))
                    .map_err(|e| sqlx::Error::ColumnDecode {
                        index: "id".to_string(),
                        source: Box::new(e),
                    })?;
                
                let repo_id = Uuid::parse_str(&row.get::<String, _>("repo_id"))
                    .map_err(|e| sqlx::Error::ColumnDecode {
                        index: "repo_id".to_string(),
                        source: Box::new(e),
                    })?;
                
                let parameters: Value = serde_json::from_str(&row.get::<String, _>("parameters"))
                    .map_err(|e| sqlx::Error::ColumnDecode { 
                        index: "parameters".to_string(), 
                        source: Box::new(e) 
                    })?;
                
                let last_used = DateTime::parse_from_rfc3339(&row.get::<String, _>("last_used"))
                    .map_err(|e| sqlx::Error::ColumnDecode {
                        index: "last_used".to_string(),
                        source: Box::new(e),
                    })?
                    .with_timezone(&Utc);
                
                Ok(Some(VoiceAlias {
                    id,
                    repo_id,
                    alias: alias.to_string(),
                    command_pattern: row.get("command_pattern"),
                    parameters,
                    last_used,
                }))
            }
            None => Ok(None),
        }
    }

    // Update voice alias last used timestamp
    pub async fn update_voice_alias_usage(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE voice_aliases SET last_used = ? WHERE id = ?"
        )
        .bind(Utc::now().to_rfc3339())
        .bind(id.to_string())
        .execute(&self.pool.get_pool())
        .await?;
        
        Ok(())
    }

    // Runtime configuration management
    pub async fn add_runtime_config(
        &self, 
        id: Uuid, 
        repo_id: Uuid, 
        runtime_type: &str, 
        config: &Value, 
        container_id: Option<&str>, 
        wasm_module: Option<&str>
    ) -> Result<(), sqlx::Error> {
        database_pool::with_transaction(&self.pool.get_pool(), MAX_RETRIES, |tx| Box::pin(async move {
            sqlx::query(
                "INSERT INTO runtime_configs 
                (id, repo_id, runtime_type, config, container_id, wasm_module, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(id.to_string())
            .bind(repo_id.to_string())
            .bind(runtime_type)
            .bind(serde_json::to_string(config).unwrap())
            .bind(container_id)
            .bind(wasm_module)
            .bind(Utc::now().to_rfc3339())
            .execute(&mut **tx)
            .await?;
            
            Ok(())
        })).await
    }
    
    // Get runtime config by repo and type
    pub async fn get_runtime_config(
        &self, 
        repo_id: Uuid, 
        runtime_type: &str
    ) -> Result<Option<RuntimeConfig>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT id, config, container_id, wasm_module, updated_at 
            FROM runtime_configs WHERE repo_id = ? AND runtime_type = ?"
        )
        .bind(repo_id.to_string())
        .bind(runtime_type)
        .fetch_optional(&self.pool.get_pool())
        .await?;
        
        match row {
            Some(row) => {
                let id = Uuid::parse_str(&row.get::<String, _>("id"))
                    .map_err(|e| sqlx::Error::ColumnDecode {
                        index: "id".to_string(),
                        source: Box::new(e),
                    })?;
                
                let config: Value = serde_json::from_str(&row.get::<String, _>("config"))
                    .map_err(|e| sqlx::Error::ColumnDecode { 
                        index: "config".to_string(), 
                        source: Box::new(e) 
                    })?;
                
                let updated_at = DateTime::parse_from_rfc3339(&row.get::<String, _>("updated_at"))
                    .map_err(|e| sqlx::Error::ColumnDecode {
                        index: "updated_at".to_string(),
                        source: Box::new(e),
                    })?
                    .with_timezone(&Utc);
                
                Ok(Some(RuntimeConfig {
                    id,
                    repo_id,
                    runtime_type: runtime_type.to_string(),
                    config,
                    container_id: row.get("container_id"),
                    wasm_module: row.get("wasm_module"),
                    updated_at,
                }))
            }
            None => Ok(None),
        }
    }
    
    // Access to the underlying connection pool for direct queries
    pub fn pool(&self) -> &DatabasePool {
        &self.pool
    }
}

// Helper struct for voice alias commands
#[derive(Debug, Clone)]
pub struct VoiceAlias {
    pub id: Uuid,
    pub repo_id: Uuid,
    pub alias: String,
    pub command_pattern: String,
    pub parameters: Value,
    pub last_used: DateTime<Utc>,
}

// Helper struct for runtime configurations
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub id: Uuid,
    pub repo_id: Uuid,
    pub runtime_type: String,
    pub config: Value,
    pub container_id: Option<String>,
    pub wasm_module: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_database_connection() {
        // Use in-memory database for testing
        let db = Database::new("sqlite::memory:", Some(5)).await.unwrap();
        assert!(db.health_check().await);
    }
    
    #[tokio::test]
    async fn test_repo_operations() {
        let db = Database::new("sqlite::memory:", Some(5)).await.unwrap();
        
        let repo = AdoptedRepo {
            id: Uuid::new_v4(),
            name: "test-repo".to_string(),
            repo_url: "https://github.com/test/repo".to_string(),
            git_ref: "main".to_string(),
            adopted_at: Utc::now(),
            metadata: json!({"description": "Test repo"}),
            status: RepoStatus::Active,
            health: HealthStatus::Healthy,
        };
        
        // Insert repo
        db.insert_repo(&repo).await.unwrap();
        
        // Retrieve repo
        let retrieved = db.get_repo(repo.id).await.unwrap().unwrap();
        assert_eq!(retrieved.name, repo.name);
        assert_eq!(retrieved.repo_url, repo.repo_url);
        
        // Update status
        db.update_repo_status(repo.id, RepoStatus::Archived).await.unwrap();
        let updated = db.get_repo(repo.id).await.unwrap().unwrap();
        assert!(matches!(updated.status, RepoStatus::Archived));
        
        // List repos
        let repos = db.list_repos().await.unwrap();
        assert_eq!(repos.len(), 1);
    }
    
    #[tokio::test]
    async fn test_concurrent_access() {
        use futures::future::join_all;
        
        let db = Database::new("sqlite::memory:", Some(10)).await.unwrap();
        let db_arc = Arc::new(db);
        
        let mut handles = Vec::new();
        
        // Create 50 concurrent insert operations
        for i in 0..50 {
            let db_clone = db_arc.clone();
            let handle = tokio::spawn(async move {
                let repo = AdoptedRepo {
                    id: Uuid::new_v4(),
                    name: format!("test-repo-{}", i),
                    repo_url: format!("https://github.com/test/repo{}", i),
                    git_ref: "main".to_string(),
                    adopted_at: Utc::now(),
                    metadata: json!({"test": i}),
                    status: RepoStatus::Active,
                    health: HealthStatus::Healthy,
                };
                
                db_clone.insert_repo(&repo).await
            });
            
            handles.push(handle);
        }
        
        // Wait for all operations to complete
        let results = join_all(handles).await;
        
        // Check that all operations succeeded
        for result in results {
            assert!(result.unwrap().is_ok());
        }
        
        // Verify all repos were inserted
        let repos = db_arc.list_repos().await.unwrap();
        assert_eq!(repos.len(), 50);
    }
}