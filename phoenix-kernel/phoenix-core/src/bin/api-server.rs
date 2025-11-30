//! Standalone API server for Phoenix ORCH
//!
//! This binary starts just the API server without requiring the full kernel initialization.

use anyhow::Result;
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
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(tracing::Level::INFO)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    info!("🔥 Starting Phoenix ORCH API Server");

    // Try to find config file (works from workspace root or phoenix-core directory)
    let config_path = if PathBuf::from("phoenix-kernel/config.toml").exists() {
        PathBuf::from("phoenix-kernel/config.toml")
    } else if PathBuf::from("../phoenix-kernel/config.toml").exists() {
        PathBuf::from("../phoenix-kernel/config.toml")
    } else if PathBuf::from("../config.toml").exists() {
        PathBuf::from("../config.toml")
    } else if PathBuf::from("config.toml").exists() {
        PathBuf::from("config.toml")
    } else {
        error!("Could not find config.toml in any expected location");
        error!("Searched: phoenix-kernel/config.toml, ../phoenix-kernel/config.toml, ../config.toml, config.toml");
        return Err(anyhow::anyhow!("Config file not found"));
    };

    info!("Loading configuration from {:?}", config_path);
    
    let full_config = match Config::load(&config_path) {
        Ok(cfg) => {
            info!("✅ Configuration loaded successfully");
            // Verify API key is configured
            if let Some(key) = cfg.get_openrouter_key() {
                info!("✅ OpenRouter API key configured (length: {})", key.len());
            } else {
                error!("❌ OpenRouter API key not found in config!");
                return Err(anyhow::anyhow!("OpenRouter API key required"));
            }
            info!("✅ Default model: {}", cfg.get_default_model());
            cfg
        },
        Err(e) => {
            error!("❌ Failed to load configuration: {}", e);
            return Err(e.into());
        }
    };

    // Create data directories if they don't exist
    let data_dir = PathBuf::from(&full_config.memory.storage_path);
    if !data_dir.exists() {
        info!("Creating data directory: {:?}", data_dir);
        std::fs::create_dir_all(&data_dir)?;
    }

    // Initialize API state
    info!("Initializing API state...");
    let memory = Arc::new(Mutex::new(
        PersistenceService::new(data_dir, None)
            .map_err(|e| anyhow::anyhow!("Failed to create persistence service: {}", e))?
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
    
    let api_config = Arc::new(full_config);
    let api_state = phoenix_core::api::server::ApiState::new(
        memory,
        conscience,
        core,
        api_config,
    );
    
    info!("✅ API state initialized");
    info!("🔥 Starting API server on http://127.0.0.1:5001");
    info!("   - WebSocket: ws://127.0.0.1:5001/ws/dad");
    info!("   - Health: http://127.0.0.1:5001/health");
    info!("   - Ready: http://127.0.0.1:5001/ready");
    info!("   - Telemetry: http://127.0.0.1:5001/api/v1/telemetry-stream");
    info!("");
    info!("Press Ctrl+C to shutdown");

    // Start the server (this blocks)
    if let Err(e) = start_server("127.0.0.1", 5001, api_state).await {
        error!("❌ API server failed: {}", e);
        return Err(e.into());
    }

    Ok(())
}

