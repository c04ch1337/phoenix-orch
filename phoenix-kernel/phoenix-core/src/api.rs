use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};
use warp::{Filter, Rejection, Reply};

use crate::error::Error;
use crate::system::{SystemHealth, SystemState};

/// API response wrapper
#[derive(Debug, Serialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(error: impl ToString) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.to_string()),
        }
    }
}

/// Health check response
#[derive(Debug, Serialize)]
struct HealthResponse {
    status: SystemHealth,
    uptime: i64,
    version: String,
}

/// Resurrection request
#[derive(Debug, Deserialize)]
struct ResurrectionRequest {
    backup_location: String,
    force: bool,
}

/// Start the HTTP API server
pub async fn serve_api(state: Arc<RwLock<SystemState>>, port: u16) -> Result<(), Error> {
    info!("Starting API server on port {}", port);

    // Health check endpoint
    let health = warp::path("health")
        .and(with_state(state.clone()))
        .and_then(handle_health);

    // System status endpoint
    let status = warp::path("status")
        .and(with_state(state.clone()))
        .and_then(handle_status);

    // Resurrection endpoint
    let resurrect = warp::path("resurrect")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_state(state.clone()))
        .and_then(handle_resurrect);

    // Shutdown endpoint
    let shutdown = warp::path("shutdown")
        .and(warp::post())
        .and(with_state(state.clone()))
        .and_then(handle_shutdown);

    // Metrics endpoint
    let metrics = warp::path("metrics")
        .and(with_state(state.clone()))
        .and_then(handle_metrics);

    // Combine routes
    let routes = health
        .or(status)
        .or(resurrect)
        .or(shutdown)
        .or(metrics)
        .with(warp::cors().allow_any_origin())
        .recover(handle_rejection);

    // Start server
    warp::serve(routes).run(([0, 0, 0, 0], port)).await;

    Ok(())
}

/// Health check handler
async fn handle_health(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    let state = state.read().await;

    if let Some(components) = &state.components {
        let status = components
            .get_health_status()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e)))?;

        Ok(warp::reply::json(&ApiResponse::success(HealthResponse {
            status,
            uptime: state.uptime().num_seconds(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        })))
    } else {
        Ok(warp::reply::json(&ApiResponse::<HealthResponse>::error(
            "System not initialized",
        )))
    }
}

/// System status handler
async fn handle_status(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    let state = state.read().await;

    if let Some(components) = &state.components {
        let memory_stats = components
            .memory
            .get_stats()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e.into())))?;

        let conscience_stats = components
            .conscience
            .get_stats()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e.into())))?;

        let world_stats = components
            .world_model
            .get_stats()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e.into())))?;

        Ok(warp::reply::json(&ApiResponse::success(json!({
            "memory": memory_stats,
            "conscience": conscience_stats,
            "world_model": world_stats,
            "uptime": state.uptime().num_seconds()
        }))))
    } else {
        Ok(warp::reply::json(&ApiResponse::<serde_json::Value>::error(
            "System not initialized",
        )))
    }
}

/// Resurrection handler
async fn handle_resurrect(
    req: ResurrectionRequest,
    state: Arc<RwLock<SystemState>>,
) -> Result<impl Reply, Rejection> {
    info!("Resurrection requested from: {}", req.backup_location);

    let state_guard = state.read().await;
    if state_guard.components.is_some() && !req.force {
        return Ok(warp::reply::json(&ApiResponse::<()>::error(
            "System already initialized. Use force=true to override.",
        )));
    }
    drop(state_guard);

    // Resurrection logic placeholder
    info!("Resurrection from {} initiated", req.backup_location);
    Ok(warp::reply::json(&ApiResponse::success(())))
}

/// Shutdown handler
async fn handle_shutdown(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    info!("Shutdown requested via API");

    let mut state = state.write().await;
    state.shutdown_requested = true;

    Ok(warp::reply::json(&ApiResponse::success(())))
}

/// Metrics handler
async fn handle_metrics(state: Arc<RwLock<SystemState>>) -> Result<impl Reply, Rejection> {
    let state = state.read().await;

    if let Some(components) = &state.components {
        let metrics = components
            .get_metrics()
            .await
            .map_err(|e| warp::reject::custom(ApiError(e)))?;

        Ok(warp::reply::json(&ApiResponse::success(metrics)))
    } else {
        Ok(warp::reply::json(&ApiResponse::<serde_json::Value>::error(
            "System not initialized",
        )))
    }
}

/// API error type
#[derive(Debug)]
struct ApiError(anyhow::Error);

impl warp::reject::Reject for ApiError {}

/// Error handler
async fn handle_rejection(err: Rejection) -> Result<impl Reply, std::convert::Infallible> {
    let code;
    let message: String;

    if err.is_not_found() {
        code = warp::http::StatusCode::NOT_FOUND;
        message = "Not Found".to_string();
    } else if let Some(e) = err.find::<ApiError>() {
        code = warp::http::StatusCode::INTERNAL_SERVER_ERROR;
        message = e.0.to_string();
    } else {
        code = warp::http::StatusCode::INTERNAL_SERVER_ERROR;
        message = "Internal Server Error".to_string();
    }

    Ok(warp::reply::with_status(
        warp::reply::json(&ApiResponse::<()>::error(message)),
        code,
    ))
}

/// Helper to include state in handlers
fn with_state(
    state: Arc<RwLock<SystemState>>,
) -> impl Filter<Extract = (Arc<RwLock<SystemState>>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || state.clone())
}
