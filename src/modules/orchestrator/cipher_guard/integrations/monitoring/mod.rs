use std::sync::Arc;
use tokio::sync::Mutex;
use metrics::{counter, gauge, histogram};
use tracing::{info, warn, error, Level, Subscriber};
use tracing_subscriber::{
    fmt::{self, format::FmtSpan},
    EnvFilter,
    Registry,
    layer::SubscriberExt,
};
use prometheus::{
    Registry as PrometheusRegistry,
    IntCounter,
    IntGauge,
    Histogram as PrometheusHistogram,
};

// Metrics Registry
#[derive(Clone)]
pub struct IntegrationMetrics {
    registry: Arc<PrometheusRegistry>,
    api_requests_total: IntCounter,
    api_request_duration: PrometheusHistogram,
    active_connections: IntGauge,
    authentication_failures: IntCounter,
    rate_limit_hits: IntCounter,
}

impl IntegrationMetrics {
    pub fn new() -> Self {
        let registry = PrometheusRegistry::new();

        let api_requests_total = IntCounter::new(
            "integration_api_requests_total",
            "Total number of API requests made by integrations",
        ).unwrap();

        let api_request_duration = PrometheusHistogram::with_opts(
            prometheus::HistogramOpts::new(
                "integration_api_request_duration_seconds",
                "API request duration in seconds",
            )
        ).unwrap();

        let active_connections = IntGauge::new(
            "integration_active_connections",
            "Number of active integration connections",
        ).unwrap();

        let authentication_failures = IntCounter::new(
            "integration_authentication_failures_total",
            "Total number of authentication failures",
        ).unwrap();

        let rate_limit_hits = IntCounter::new(
            "integration_rate_limit_hits_total",
            "Total number of rate limit hits",
        ).unwrap();

        registry.register(Box::new(api_requests_total.clone())).unwrap();
        registry.register(Box::new(api_request_duration.clone())).unwrap();
        registry.register(Box::new(active_connections.clone())).unwrap();
        registry.register(Box::new(authentication_failures.clone())).unwrap();
        registry.register(Box::new(rate_limit_hits.clone())).unwrap();

        Self {
            registry: Arc::new(registry),
            api_requests_total,
            api_request_duration,
            active_connections,
            authentication_failures,
            rate_limit_hits,
        }
    }

    pub fn record_api_request(&self, duration: f64) {
        self.api_requests_total.inc();
        self.api_request_duration.observe(duration);
    }

    pub fn record_connection_change(&self, delta: i64) {
        if delta > 0 {
            self.active_connections.inc();
        } else {
            self.active_connections.dec();
        }
    }

    pub fn record_authentication_failure(&self) {
        self.authentication_failures.inc();
    }

    pub fn record_rate_limit_hit(&self) {
        self.rate_limit_hits.inc();
    }

    pub fn get_registry(&self) -> Arc<PrometheusRegistry> {
        self.registry.clone()
    }
}

// Health Check Types
#[derive(Debug, Clone)]
pub struct HealthStatus {
    pub status: HealthState,
    pub message: String,
    pub last_check: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum HealthState {
    Healthy,
    Degraded,
    Unhealthy,
}

// Health Check Registry
pub struct HealthRegistry {
    checks: Arc<Mutex<HashMap<String, HealthStatus>>>,
}

impl HealthRegistry {
    pub fn new() -> Self {
        Self {
            checks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register_health_check(
        &self,
        integration_name: &str,
        status: HealthStatus,
    ) {
        let mut checks = self.checks.lock().await;
        checks.insert(integration_name.to_string(), status);
    }

    pub async fn get_health_status(&self, integration_name: &str) -> Option<HealthStatus> {
        let checks = self.checks.lock().await;
        checks.get(integration_name).cloned()
    }

    pub async fn get_all_health_statuses(&self) -> HashMap<String, HealthStatus> {
        let checks = self.checks.lock().await;
        checks.clone()
    }
}

// Logging Configuration
pub fn setup_logging() -> impl Subscriber {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    let formatting_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_file(true)
        .with_line_number(true)
        .with_span_events(FmtSpan::CLOSE)
        .with_timer(fmt::time::UtcTime::rfc_3339());

    Registry::default()
        .with(env_filter)
        .with(formatting_layer)
}

// Integration Monitor
pub struct IntegrationMonitor {
    metrics: IntegrationMetrics,
    health_registry: HealthRegistry,
}

impl IntegrationMonitor {
    pub fn new() -> Self {
        Self {
            metrics: IntegrationMetrics::new(),
            health_registry: HealthRegistry::new(),
        }
    }

    pub async fn monitor_integration<T: ExternalToolIntegration>(
        &self,
        integration_name: &str,
        integration: &T,
    ) {
        let start = std::time::Instant::now();
        
        match integration.health_check().await {
            Ok(true) => {
                let duration = start.elapsed().as_secs_f64();
                self.metrics.record_api_request(duration);
                
                self.health_registry.register_health_check(
                    integration_name,
                    HealthStatus {
                        status: HealthState::Healthy,
                        message: "Integration is healthy".to_string(),
                        last_check: chrono::Utc::now(),
                    },
                ).await;

                info!(
                    integration = integration_name,
                    duration_ms = duration * 1000.0,
                    "Integration health check successful"
                );
            }
            Ok(false) => {
                self.health_registry.register_health_check(
                    integration_name,
                    HealthStatus {
                        status: HealthState::Degraded,
                        message: "Integration is degraded".to_string(),
                        last_check: chrono::Utc::now(),
                    },
                ).await;

                warn!(
                    integration = integration_name,
                    "Integration health check indicates degraded state"
                );
            }
            Err(e) => {
                self.health_registry.register_health_check(
                    integration_name,
                    HealthStatus {
                        status: HealthState::Unhealthy,
                        message: format!("Integration health check failed: {}", e.message),
                        last_check: chrono::Utc::now(),
                    },
                ).await;

                error!(
                    integration = integration_name,
                    error = %e.message,
                    "Integration health check failed"
                );
            }
        }
    }

    pub fn get_metrics(&self) -> IntegrationMetrics {
        self.metrics.clone()
    }

    pub fn get_health_registry(&self) -> &HealthRegistry {
        &self.health_registry
    }
}

// Prometheus Metrics Endpoint
pub async fn metrics_endpoint() -> impl warp::Reply {
    use warp::http::StatusCode;
    
    let metrics = IntegrationMetrics::new();
    let encoder = prometheus::TextEncoder::new();
    
    match encoder.encode_to_string(&metrics.get_registry().gather()) {
        Ok(metrics_data) => {
            warp::reply::with_status(metrics_data, StatusCode::OK)
        }
        Err(e) => {
            error!("Failed to encode metrics: {}", e);
            warp::reply::with_status(
                "Failed to encode metrics".to_string(),
                StatusCode::INTERNAL_SERVER_ERROR,
            )
        }
    }
}

// Alert Configuration
#[derive(Debug, Serialize, Deserialize)]
pub struct AlertConfig {
    pub name: String,
    pub description: String,
    pub severity: AlertSeverity,
    pub threshold: f64,
    pub window: std::time::Duration,
    pub notification_channels: Vec<NotificationChannel>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum AlertSeverity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum NotificationChannel {
    Email(String),
    Slack(String),
    Teams(String),
}

// Alert Manager
pub struct AlertManager {
    configs: Arc<Mutex<Vec<AlertConfig>>>,
    metrics: IntegrationMetrics,
}

impl AlertManager {
    pub fn new(metrics: IntegrationMetrics) -> Self {
        Self {
            configs: Arc::new(Mutex::new(Vec::new())),
            metrics,
        }
    }

    pub async fn add_alert_config(&self, config: AlertConfig) {
        let mut configs = self.configs.lock().await;
        configs.push(config);
    }

    pub async fn check_alerts(&self) {
        let configs = self.configs.lock().await;
        
        for config in configs.iter() {
            // Example alert check based on API request duration
            let duration = self.metrics.api_request_duration.get_sample_sum();
            
            if duration > config.threshold {
                self.trigger_alert(config).await;
            }
        }
    }

    async fn trigger_alert(&self, config: &AlertConfig) {
        info!(
            alert = &config.name,
            severity = ?config.severity,
            "Alert triggered"
        );

        for channel in &config.notification_channels {
            match channel {
                NotificationChannel::Email(address) => {
                    // Implement email notification
                }
                NotificationChannel::Slack(webhook) => {
                    // Implement Slack notification
                }
                NotificationChannel::Teams(webhook) => {
                    // Implement Teams notification
                }
            }
        }
    }
}