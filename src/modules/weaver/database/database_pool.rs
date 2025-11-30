use sqlx::{Pool, Sqlite, sqlite::{SqlitePoolOptions, SqliteConnectOptions}};
use std::str::FromStr;
use std::time::Duration;
use std::sync::Arc;
use tokio::sync::Mutex;
use sqlx::migrate::MigrateDatabase;

#[derive(Clone)]
pub struct DatabasePool {
    pool: Pool<Sqlite>,
}

impl DatabasePool {
    pub async fn new(db_url: &str, max_connections: u32) -> Result<Self, sqlx::Error> {
        // Ensure the database exists
        if !Sqlite::database_exists(db_url).await.unwrap_or(false) {
            Sqlite::create_database(db_url).await?;
        }

        // Configure connection options with pragmas to prevent "database is locked" errors
        let conn_opts = SqliteConnectOptions::from_str(db_url)?
            .busy_timeout(Duration::from_secs(30))
            .pragma("journal_mode", "WAL")         // Write-Ahead Logging for better concurrency
            .pragma("synchronous", "NORMAL")       // Balance between durability and performance
            .pragma("foreign_keys", "ON")
            .pragma("cache_size", "8000")          // Increase cache size
            .create_if_missing(true);

        // Create connection pool with options
        let pool = SqlitePoolOptions::new()
            .max_connections(max_connections)
            .acquire_timeout(Duration::from_secs(5))
            .idle_timeout(Some(Duration::from_secs(300))) // 5 minutes
            .min_connections(2)
            .connect_with(conn_opts)
            .await?;

        Ok(Self { pool })
    }

    pub fn get_pool(&self) -> Pool<Sqlite> {
        self.pool.clone()
    }

    // Runs database migrations
    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        sqlx::migrate!("./src/modules/weaver/database/migrations")
            .run(&self.pool)
            .await?;

        Ok(())
    }

    // Health check method
    pub async fn health_check(&self) -> bool {
        match sqlx::query("SELECT 1").execute(&self.pool).await {
            Ok(_) => true,
            Err(err) => {
                eprintln!("Database health check failed: {}", err);
                false
            }
        }
    }

    // Get connection pool metrics
    pub async fn get_metrics(&self) -> DatabaseMetrics {
        DatabaseMetrics {
            connections_in_use: self.pool.size() as u32,
            connections_max: self.pool.options().get_max_connections() as u32,
            is_closed: self.pool.is_closed(),
            idle_connections: self.pool.num_idle() as u32,
        }
    }

    // Execute query with retry logic for handling temporary locking issues
    pub async fn execute_with_retry<T, E, F>(&self, operation: F, max_retries: u32) -> Result<T, E>
    where
        F: Fn() -> futures::future::BoxFuture<'static, Result<T, E>> + Send + Sync + 'static,
        E: std::fmt::Display + Send + Sync + 'static,
        T: Send + 'static,
    {
        let wrapped_op = Arc::new(operation);
        let mut attempt = 0;
        let mut last_error = None;

        while attempt < max_retries {
            let op = wrapped_op.clone();
            match op().await {
                Ok(result) => return Ok(result),
                Err(err) => {
                    attempt += 1;
                    last_error = Some(err);

                    // If this isn't the last attempt, wait before retrying
                    if attempt < max_retries {
                        // Exponential backoff: 100ms, 200ms, 400ms, etc.
                        let backoff = std::time::Duration::from_millis(100 * 2u64.pow(attempt - 1));
                        tokio::time::sleep(backoff).await;
                    }
                }
            }
        }

        // If we reach here, all attempts failed
        Err(last_error.unwrap())
    }
}

// Database metrics structure for monitoring
#[derive(Debug, Clone)]
pub struct DatabaseMetrics {
    pub connections_in_use: u32,
    pub connections_max: u32,
    pub is_closed: bool,
    pub idle_connections: u32,
}

// Acquire a connection with timeout and diagnostics
pub async fn get_connection_with_timeout(
    pool: &Pool<Sqlite>,
    timeout: Duration,
) -> Result<sqlx::pool::PoolConnection<Sqlite>, sqlx::Error> {
    let start = std::time::Instant::now();
    let result = tokio::time::timeout(timeout, pool.acquire()).await;

    match result {
        Ok(conn_result) => {
            let elapsed = start.elapsed();
            // Log connection acquisition time if it took too long
            if elapsed > Duration::from_millis(100) {
                eprintln!("Slow database connection acquisition: {}ms", elapsed.as_millis());
            }
            conn_result
        }
        Err(_) => {
            // Connection acquisition timed out
            eprintln!(
                "Database connection acquisition timed out after {}ms", 
                timeout.as_millis()
            );
            Err(sqlx::Error::PoolTimedOut)
        }
    }
}

// Transaction helper that handles retries for deadlocks
pub async fn with_transaction<T, F>(
    pool: &Pool<Sqlite>,
    max_retries: u32,
    operation: F,
) -> Result<T, sqlx::Error>
where
    F: for<'a> FnMut(&'a mut sqlx::Transaction<'a, Sqlite>) -> 
        futures::future::BoxFuture<'a, Result<T, sqlx::Error>> + Send + 'static,
    T: Send + 'static,
{
    let mut attempt = 0;
    let mut operation = operation;
    
    loop {
        match pool.begin().await {
            Ok(mut tx) => {
                match operation(&mut tx).await {
                    Ok(result) => {
                        match tx.commit().await {
                            Ok(_) => return Ok(result),
                            Err(e) => {
                                // If commit failed due to locking, retry
                                if is_locking_error(&e) && attempt < max_retries {
                                    attempt += 1;
                                    let backoff = std::time::Duration::from_millis(100 * 2u64.pow(attempt - 1));
                                    tokio::time::sleep(backoff).await;
                                    continue;
                                }
                                return Err(e);
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.rollback().await;
                        if is_locking_error(&e) && attempt < max_retries {
                            attempt += 1;
                            let backoff = std::time::Duration::from_millis(100 * 2u64.pow(attempt - 1));
                            tokio::time::sleep(backoff).await;
                            continue;
                        }
                        return Err(e);
                    }
                }
            }
            Err(e) => {
                if is_locking_error(&e) && attempt < max_retries {
                    attempt += 1;
                    let backoff = std::time::Duration::from_millis(100 * 2u64.pow(attempt - 1));
                    tokio::time::sleep(backoff).await;
                    continue;
                }
                return Err(e);
            }
        }
    }
}

// Helper to determine if an error is a locking error
fn is_locking_error(err: &sqlx::Error) -> bool {
    if let sqlx::Error::Database(db_err) = err {
        let err_string = db_err.to_string();
        
        err_string.contains("database is locked") || 
        err_string.contains("busy") ||
        err_string.contains("SQLITE_BUSY") ||
        err_string.contains("SQLITE_LOCKED")
    } else {
        false
    }
}