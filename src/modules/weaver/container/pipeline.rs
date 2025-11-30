use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use tokio::process::Command;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use wasmtime::{Engine, Module, Store};

#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerConfig {
    pub image_name: String,
    pub build_args: HashMap<String, String>,
    pub env_vars: HashMap<String, String>,
    pub ports: Vec<u16>,
    pub volumes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WasmConfig {
    pub memory_limit: u32,
    pub table_size: u32,
    pub allowed_imports: Vec<String>,
}

pub struct ContainerizationPipeline {
    container_registry: String,
    wasm_engine: Engine,
    build_cache: PathBuf,
}

impl ContainerizationPipeline {
    pub fn new(container_registry: &str, build_cache: &Path) -> Result<Self> {
        std::fs::create_dir_all(build_cache)?;
        
        Ok(Self {
            container_registry: container_registry.to_string(),
            wasm_engine: Engine::default(),
            build_cache: build_cache.to_path_buf(),
        })
    }

    pub async fn build_container(&self, source_path: &Path, config: &ContainerConfig) -> Result<String> {
        let build_context = self.build_cache.join(Uuid::new_v4().to_string());
        std::fs::create_dir_all(&build_context)?;

        // Generate Dockerfile
        let dockerfile_path = build_context.join("Dockerfile");
        self.generate_dockerfile(&dockerfile_path, config)?;

        // Copy source files
        tokio::fs::copy(source_path, &build_context.join("src"))?;

        // Build container image
        let image_tag = format!("{}/{}", self.container_registry, config.image_name);
        let status = Command::new("docker")
            .args(&[
                "build",
                "-t", &image_tag,
                "-f", dockerfile_path.to_str().unwrap(),
                "--cache-from", &format!("{}/cache", self.container_registry),
                ".",
            ])
            .current_dir(&build_context)
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("Container build failed");
        }

        // Push to registry
        let status = Command::new("docker")
            .args(&["push", &image_tag])
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("Failed to push container to registry");
        }

        Ok(image_tag)
    }

    pub async fn compile_wasm(&self, source_path: &Path, config: &WasmConfig) -> Result<Vec<u8>> {
        // Create build directory
        let build_dir = self.build_cache.join(Uuid::new_v4().to_string());
        std::fs::create_dir_all(&build_dir)?;

        // Copy source files
        tokio::fs::copy(source_path, &build_dir.join("src"))?;

        // Compile to WASM using wasm-pack
        let status = Command::new("wasm-pack")
            .args(&[
                "build",
                "--target", "web",
                "--out-dir", "pkg",
                ".",
            ])
            .current_dir(&build_dir)
            .status()
            .await?;

        if !status.success() {
            anyhow::bail!("WASM compilation failed");
        }

        // Read compiled WASM
        let wasm_path = build_dir.join("pkg").join("module_bg.wasm");
        let wasm_bytes = tokio::fs::read(&wasm_path).await?;

        // Validate WASM module
        self.validate_wasm(&wasm_bytes, config)?;

        Ok(wasm_bytes)
    }

    fn validate_wasm(&self, wasm_bytes: &[u8], config: &WasmConfig) -> Result<()> {
        // Create store with memory limits
        let mut store = Store::new(&self.wasm_engine, ());
        store.limiter(|_| {
            wasmtime::ResourceLimiter::new()
                .memory_size(config.memory_limit as usize)
                .table_elements(config.table_size as usize)
        });

        // Validate module can be instantiated
        let module = Module::new(&self.wasm_engine, wasm_bytes)?;

        // Validate imports
        for import in module.imports() {
            if !config.allowed_imports.contains(&import.name().to_string()) {
                anyhow::bail!("Disallowed import: {}", import.name());
            }
        }

        Ok(())
    }

    fn generate_dockerfile(&self, path: &Path, config: &ContainerConfig) -> Result<()> {
        let mut content = String::from("FROM rust:1.75 as builder\n");
        content.push_str("WORKDIR /usr/src/app\n");
        
        // Add build args
        for (key, value) in &config.build_args {
            content.push_str(&format!("ARG {}={}\n", key, value));
        }

        // Copy source and build
        content.push_str("COPY . .\n");
        content.push_str("RUN cargo build --release\n");

        // Create runtime image
        content.push_str("\nFROM debian:bullseye-slim\n");
        
        // Add environment variables
        for (key, value) in &config.env_vars {
            content.push_str(&format!("ENV {}={}\n", key, value));
        }

        // Copy binary from builder
        content.push_str("COPY --from=builder /usr/src/app/target/release/app /usr/local/bin/app\n");

        // Expose ports
        for port in &config.ports {
            content.push_str(&format!("EXPOSE {}\n", port));
        }

        // Add volumes
        for volume in &config.volumes {
            content.push_str(&format!("VOLUME {}\n", volume));
        }

        content.push_str("CMD [\"app\"]");

        std::fs::write(path, content)?;
        Ok(())
    }
}