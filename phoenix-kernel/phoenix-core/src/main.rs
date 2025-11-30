use anyhow::Result;
use phoenix_kernel::{PhoenixKernel, SystemConfig};
use phoenix_core::api::server::start_server;
use phoenix_core::config::Config;
use phoenix_core::core::conscience::ConscienceFramework;
use phoenix_core::core::memory::PersistenceService;
use phoenix_core::PhoenixCore;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging with detailed settings
    let subscriber = FmtSubscriber::builder()
        .with_max_level(tracing::Level::DEBUG)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    info!("Starting Phoenix AGI Kernel daemon v1.0");
    
    // Verify database directories
    let db_paths = vec![
        "data/memory/db",
        "data/memory/merkle",
        "config/values",
        "config/keys",
        "data/backups/primary",
        "data/backups/secondary",
        "data/mirrors/1",
        "data/mirrors/2",
        "data/mirrors/3"
    ];

    for path in db_paths {
        let path = std::path::PathBuf::from(path);
        info!("Checking database directory: {:?}", path);
        if !path.exists() {
            info!("Creating database directory: {:?}", path);
            std::fs::create_dir_all(&path)?;
        }
    }

    // Load full configuration (includes API keys)
    let config_path = std::path::PathBuf::from("phoenix-kernel/config.toml");
    info!("Loading configuration from {:?}", config_path);
    
    let full_config = match Config::load(&config_path) {
        Ok(cfg) => {
            info!("Configuration loaded successfully");
            // Verify API key is configured
            if let Some(key) = cfg.get_openrouter_key() {
                info!("OpenRouter API key configured (length: {})", key.len());
            } else {
                error!("OpenRouter API key not found in config!");
            }
            cfg
        },
        Err(e) => {
            error!("Failed to load configuration: {}", e);
            return Err(e.into());
        }
    };

    // Verify data directories exist
    for dir in &[&full_config.system.data_dir, &full_config.system.config_dir, &full_config.system.plugin_dir] {
        let path = PathBuf::from(dir);
        info!("Checking directory: {:?}", path);
        if !path.exists() {
            info!("Creating directory: {:?}", path);
            std::fs::create_dir_all(&path)?;
        }
    }

    // Initialize kernel with system config
    info!("Initializing Phoenix Kernel");
    let system_config = full_config.system.clone();
    let kernel = match PhoenixKernel::new(system_config).await {
        Ok(k) => k,
        Err(e) => {
            error!("Failed to initialize kernel: {}", e);
            return Err(e);
        }
    };

    // Start daemon mode with enhanced logging
    info!("Starting daemon mode");
    info!("Starting daemon services...");
    let data_dir = PathBuf::from(&full_config.system.data_dir);
    if let Err(e) = kernel.start_daemon(data_dir.clone()).await {
        error!("Daemon failed: {}", e);
        // Continue anyway - daemon is optional
    } else {
        info!("Daemon services started successfully");
    }

    // Set up signal handlers
    let kernel_clone = kernel.clone();
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.unwrap_or_else(|e| {
            error!("Failed to listen for ctrl-c: {}", e);
        });
        info!("Received shutdown signal");
        
        if let Err(e) = kernel_clone.shutdown().await {
            error!("Error during shutdown: {}", e);
        } else {
            info!("Graceful shutdown completed");
        }
    });

    // Start API server
    info!("Starting API server on 127.0.0.1:5001");
    let api_config = Arc::new(full_config.clone());
    
    // Initialize API state
    let memory = Arc::new(Mutex::new(
        PersistenceService::new(
            PathBuf::from(&full_config.memory.storage_path),
            None
        ).map_err(|e| anyhow::anyhow!("Failed to create persistence service: {}", e))?
    ));
    let conscience = Arc::new(ConscienceFramework::default());
    
    // Create a minimal PhoenixCore for API
    let core = Arc::new(phoenix_core::PhoenixCore {
        components: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        config: Arc::new(tokio::sync::RwLock::new(full_config.clone())),
        health: Arc::new(tokio::sync::RwLock::new(phoenix_core::system::SystemHealth {
            score: 1.0,
            components: std::collections::HashMap::new(),
            warnings: Vec::new(),
        })),
    });
    
    let api_state = phoenix_core::api::server::ApiState::new(
        memory,
        conscience,
        core,
        api_config,
    );
    
    // Start the 7 eternal subconscious loops
    info!("Starting 7 Eternal Subconscious Loops...");
    api_state.start_subconscious_loops();
    info!("✅ Subconscious loops started - expect 7 'SUBCONSCIOUS LOOP ALIVE' messages within 2 minutes");
    
    // Start API server in background
    let api_state_clone = api_state.clone();
    tokio::spawn(async move {
        if let Err(e) = start_server("127.0.0.1", 5001, api_state_clone).await {
            error!("API server failed: {}", e);
        }
    });
    
    info!("API server started on http://127.0.0.1:5001");

    // Start health check monitoring
    let kernel_health = kernel.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            match kernel_health.get_health().await {
                Ok(status) => {
                    info!("Health check: score={}, components={:?}",
                          status.score,
                          status.components.keys().collect::<Vec<_>>());
                }
                Err(e) => {
                    error!("Health check failed: {}", e);
                }
            }
        }
    });

    // Keep the main thread alive - wait for Ctrl+C
    info!("Phoenix AGI Kernel running. Press Ctrl+C to shutdown.");
    tokio::signal::ctrl_c().await?;
    info!("Shutdown signal received");
    
    kernel.shutdown().await?;
    info!("Phoenix AGI Kernel terminated");

    Ok(())
}
