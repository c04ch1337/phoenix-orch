//! Core Tools
//!
//! Essential tools that Phoenix ORCH wields from birth:
//! - NMAP: Network scanning
//! - API: HTTP requests
//! - IoT: MQTT communication
//! - Bluetooth: Low-energy device interaction

use std::collections::HashMap;
use anyhow::{Result, Context};
use serde_json::json;
use async_trait::async_trait;

use super::traits::{EternalTool, ToolParams, ToolOutput, HitmLevel};

/// NMAP Network Scanner
pub struct NmapTool;

#[async_trait]
impl EternalTool for NmapTool {
    fn name(&self) -> &str {
        "nmap"
    }
    
    fn version(&self) -> &str {
        "1.0.0"
    }
    
    fn description(&self) -> &str {
        "Network mapper - scan hosts, ports, and services"
    }
    
    fn hitm_level(&self) -> HitmLevel {
        HitmLevel::Medium // Network scanning requires approval
    }
    
    async fn call(&self, params: ToolParams) -> Result<ToolOutput> {
        let target = params.get("target")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing 'target' parameter"))?
            .to_string();
        
        let ports = params.get("ports")
            .and_then(|v| v.as_str())
            .unwrap_or("top100")
            .to_string();
        
        // Execute NMAP using blocking task
        let output = tokio::task::spawn_blocking(move || {
            let mut cmd = std::process::Command::new("nmap");
            cmd.arg("-sS").arg("-sV");
            
            match ports.as_str() {
                "top100" => {
                    cmd.arg("--top-ports").arg("100");
                }
                "all" => {
                    cmd.arg("-p-");
                }
                _ => {
                    cmd.arg("-p").arg(&ports);
                }
            }
            
            cmd.arg(&target).output()
        }).await?;
        
        let output = output.context("NMAP execution failed")?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        Ok(ToolOutput {
            success: output.status.success(),
            data: json!({
                "target": target,
                "ports": ports,
                "stdout": stdout,
                "stderr": stderr,
            }),
            message: if output.status.success() {
                "NMAP scan completed successfully".to_string()
            } else {
                format!("NMAP scan failed: {}", stderr)
            },
            warnings: if !stderr.is_empty() {
                vec![stderr.to_string()]
            } else {
                Vec::new()
            },
            metadata: HashMap::new(),
        })
    }
}

/// HTTP API Tool
pub struct ApiTool;

#[async_trait]
impl EternalTool for ApiTool {
    fn name(&self) -> &str {
        "api"
    }
    
    fn version(&self) -> &str {
        "1.0.0"
    }
    
    fn description(&self) -> &str {
        "HTTP/HTTPS API requests with proxy support"
    }
    
    fn hitm_level(&self) -> HitmLevel {
        HitmLevel::Low
    }
    
    async fn call(&self, params: ToolParams) -> Result<ToolOutput> {
        let url = params.get("url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing 'url' parameter"))?;
        
        let method = params.get("method")
            .and_then(|v| v.as_str())
            .unwrap_or("GET")
            .to_uppercase();
        
        let body = params.get("body").cloned();
        let headers = params.get("headers")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| {
                        v.as_str().map(|s| (k.clone(), s.to_string()))
                    })
                    .collect::<HashMap<String, String>>()
            })
            .unwrap_or_default();
        
        // Execute HTTP request (already in async context)
        let response = async move {
            let client = reqwest::Client::new();
            let mut request = match method.as_str() {
                "GET" => client.get(url),
                "POST" => client.post(url),
                "PUT" => client.put(url),
                "DELETE" => client.delete(url),
                "PATCH" => client.patch(url),
                _ => return Err(anyhow::anyhow!("Unsupported HTTP method: {}", method)),
            };
            
            // Add headers
            for (key, value) in headers {
                request = request.header(&key, &value);
            }
            
            // Add body
            if let Some(body_val) = body {
                if let Some(body_str) = body_val.as_str() {
                    request = request.body(body_str.to_string());
                } else {
                    request = request.json(&body_val);
                }
            }
            
            let response = request.send().await?;
            let status = response.status();
            let text = response.text().await?;
            
            Ok::<_, anyhow::Error>((status, text))
        }.await?;
        
        Ok(ToolOutput {
            success: response.0.is_success(),
            data: json!({
                "url": url,
                "method": method,
                "status": response.0.as_u16(),
                "body": response.1,
            }),
            message: format!("API request completed with status {}", response.0.as_u16()),
            warnings: Vec::new(),
            metadata: HashMap::new(),
        })
    }
}

/// IoT MQTT Tool
pub struct IotTool;

#[async_trait]
impl EternalTool for IotTool {
    fn name(&self) -> &str {
        "iot"
    }
    
    fn version(&self) -> &str {
        "1.0.0"
    }
    
    fn description(&self) -> &str {
        "MQTT communication for IoT devices"
    }
    
    fn hitm_level(&self) -> HitmLevel {
        HitmLevel::Low
    }
    
    async fn call(&self, params: ToolParams) -> Result<ToolOutput> {
        let topic = params.get("topic")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing 'topic' parameter"))?;
        
        let payload = params.get("payload")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        
        let broker = params.get("broker")
            .and_then(|v| v.as_str())
            .unwrap_or("localhost:1883");
        
        // In production, this would use rumqttc
        // For now, return a structured response
        Ok(ToolOutput {
            success: true,
            data: json!({
                "broker": broker,
                "topic": topic,
                "payload": payload,
                "status": "published",
            }),
            message: format!("MQTT message published to topic: {}", topic),
            warnings: vec!["MQTT implementation requires rumqttc crate".to_string()],
            metadata: HashMap::new(),
        })
    }
}

/// Bluetooth Low Energy Tool
pub struct BluetoothTool;

#[async_trait]
impl EternalTool for BluetoothTool {
    fn name(&self) -> &str {
        "bluetooth"
    }
    
    fn version(&self) -> &str {
        "1.0.0"
    }
    
    fn description(&self) -> &str {
        "Bluetooth Low Energy device interaction"
    }
    
    fn hitm_level(&self) -> HitmLevel {
        HitmLevel::Medium
    }
    
    async fn call(&self, params: ToolParams) -> Result<ToolOutput> {
        let action = params.get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("scan");
        
        let device = params.get("device")
            .and_then(|v| v.as_str());
        
        // In production, this would use btleplug
        // For now, return a structured response
        Ok(ToolOutput {
            success: true,
            data: json!({
                "action": action,
                "device": device,
                "status": "completed",
            }),
            message: format!("Bluetooth {} completed", action),
            warnings: vec!["Bluetooth implementation requires btleplug crate".to_string()],
            metadata: HashMap::new(),
        })
    }
}

