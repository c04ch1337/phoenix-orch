use anyhow::Result;
use phoenix_kernel::{PhoenixKernel, SystemConfig};
use std::path::PathBuf;
use tracing::{error, info};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("Starting Phoenix AGI Kernel daemon");

    // Load configuration
    let config = SystemConfig::default();

    // Initialize kernel
    let kernel = match PhoenixKernel::new(config).await {
        Ok(k) => k,
        Err(e) => {
            error!("Failed to initialize kernel: {}", e);
            return Err(e);
        }
    };

    // Set up data directory
    let data_dir = PathBuf::from("data");
    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir)?;
    }

    // Start daemon mode
    if let Err(e) = kernel.start_daemon(data_dir).await {
        error!("Daemon failed: {}", e);
        return Err(e);
    }

    // Wait for shutdown signal
    tokio::signal::ctrl_c().await?;
    info!("Received shutdown signal");

    // Initiate graceful shutdown
    kernel.shutdown().await?;
    info!("Shutdown complete");

    Ok(())
}
