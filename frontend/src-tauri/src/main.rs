#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod modules;

use modules::{
    cipher::CipherModule,
    ember::EmberModule,
    orchestrator::{OrchestratorModule, invoke_orchestrator_task, submit_reviewed_task},
    security::SecurityModule,
    state::AppState,
};
use tauri::{
    Manager, State,
    async_runtime::spawn,
};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

// Command handler for SSE initialization
#[tauri::command]
async fn initialize_sse_connection(app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_handle_clone = app_handle.clone();
    
    spawn(async move {
        // Start SSE server on port 5001
        let sse_server = modules::sse::start_server(5001).await
            .map_err(|e| format!("Failed to start SSE server: {}", e))?;
            
        // Store SSE server in app state for later use
        app_handle_clone.manage(sse_server);
        
        Ok::<(), String>(())
    });
    
    Ok(())
}

// Cipher commands
#[tauri::command]
async fn analyze_cipher_pattern(
    state: State<'_, Arc<Mutex<AppState>>>,
    pattern: String,
) -> Result<String, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock app state".to_string())?;
    app_state.cipher.analyze_pattern(&pattern)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn encrypt_data(
    state: State<'_, Arc<Mutex<AppState>>>,
    data: String, 
    key: String
) -> Result<String, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock app state".to_string())?;
    app_state.security.encrypt(&data, &key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn decrypt_data(
    state: State<'_, Arc<Mutex<AppState>>>,
    encrypted_data: String, 
    key: String
) -> Result<String, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock app state".to_string())?;
    app_state.security.decrypt(&encrypted_data, &key)
        .map_err(|e| e.to_string())
}

// Ember unit commands
#[tauri::command]
async fn activate_ember_unit(
    state: State<'_, Arc<Mutex<AppState>>>,
    parameters: String
) -> Result<String, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock app state".to_string())?;
    app_state.ember.activate(&parameters)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn execute_ember_operation(
    state: State<'_, Arc<Mutex<AppState>>>,
    operation: String, 
    params: String
) -> Result<String, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock app state".to_string())?;
    app_state.ember.execute_operation(&operation, &params)
        .map_err(|e| e.to_string())
}

// Memory validation commands
#[tauri::command]
async fn validate_memory_integrity(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock app state".to_string())?;
    app_state.security.validate_memory_integrity()
        .map_err(|e| e.to_string())
}

// Phoenix ignition command - activates the system
#[tauri::command]
async fn ignite_phoenix(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<serde_json::Value, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock app state".to_string())?;
    
    // Validate global state integrity
    app_state.validate_global_state()
        .map_err(|e| format!("State validation failed: {}", e))?;
    
    // Get health information
    let health_info = app_state.get_health_info()
        .map_err(|e| format!("Failed to get health info: {}", e))?;
    
    // Parse health info to add ignition-specific data
    let mut health_data: serde_json::Value = serde_json::from_str(&health_info)
        .map_err(|e| format!("Failed to parse health data: {}", e))?;
    
    // Add ignition status
    health_data["ignited"] = serde_json::json!(true);
    health_data["ignition_timestamp"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    health_data["conscience_level"] = serde_json::json!(97); // Initial conscience level
    
    Ok(health_data)
}

// SSE event emitter helper function 
async fn emit_sse_event(app_handle: &tauri::AppHandle, event: &str, payload: &str) -> Result<(), String> {
    let sse = app_handle.state::<modules::sse::SseServer>();
    sse.emit_event(event, payload)
        .map_err(|e| format!("Failed to emit SSE event: {}", e))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize shared app state
            let app_state = Arc::new(Mutex::new(AppState::new()));
            
            app.manage(app_state.clone());
            
            // Initialize OrchestratorAgent in a background task
            let app_state_clone = app_state.clone();
            tauri::async_runtime::spawn(async move {
                // Initialize orchestrator agent
                if let Ok(mut state) = app_state_clone.lock() {
                    if let Err(e) = state.orchestrator.initialize().await {
                        log::error!("Failed to initialize OrchestratorAgent: {}", e);
                    } else {
                        // If initialization succeeded, extract the agent and manage it
                        // so it can be directly accessed by Tauri commands
                        if let Ok(agent) = state.orchestrator.get_agent() {
                            drop(state); // Release the lock before re-acquiring the app_handle
                            app.app_handle().manage(agent);
                            log::info!("OrchestratorAgent initialized and registered with Tauri");
                        }
                    }
                }
            });
            
            // Background task for health monitoring
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                loop {
                    // Emit health status event every 30 seconds
                    let health_status = serde_json::json!({
                        "status": "active",
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    }).to_string();
                    
                    let _ = emit_sse_event(&app_handle, "health_status", &health_status).await;
                    
                    tokio::time::sleep(Duration::from_secs(30)).await;
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            initialize_sse_connection,
            analyze_cipher_pattern,
            encrypt_data,
            decrypt_data,
            activate_ember_unit,
            execute_ember_operation,
            validate_memory_integrity,
            ignite_phoenix,
            // Add orchestrator commands
            invoke_orchestrator_task,
            submit_reviewed_task,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}