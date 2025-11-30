//! Rate limiting middleware for Phoenix API
//!
//! Implements token bucket algorithm for rate limiting requests per IP address.

use actix_web::{
    dev::{ServiceRequest, ServiceResponse},
    Error, HttpMessage, HttpResponse,
};
use actix_web_lab::middleware::Next;
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Rate limit configuration
#[derive(Clone, Debug)]
pub struct RateLimitConfig {
    /// Maximum requests per window
    pub max_requests: u32,
    /// Time window in seconds
    pub window_seconds: u64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_requests: 100, // 100 requests
            window_seconds: 60, // per minute
        }
    }
}

/// Rate limit entry tracking requests per IP
struct RateLimitEntry {
    count: u32,
    window_start: Instant,
}

/// Rate limiter using token bucket algorithm
pub struct RateLimiter {
    entries: Arc<DashMap<String, RateLimitEntry>>,
    config: RateLimitConfig,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            entries: Arc::new(DashMap::new()),
            config,
        }
    }

    /// Check if request should be allowed
    pub fn check(&self, key: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();
        
        // Clean up old entries periodically (every 100 checks)
        if self.entries.len() > 1000 {
            self.cleanup_old_entries(now);
        }

        let mut entry = self.entries
            .entry(key.to_string())
            .or_insert_with(|| RateLimitEntry {
                count: 0,
                window_start: now,
            });

        // Reset window if expired
        if now.duration_since(entry.window_start).as_secs() >= self.config.window_seconds {
            entry.count = 0;
            entry.window_start = now;
        }

        // Check limit
        if entry.count >= self.config.max_requests {
            return Err(RateLimitError::RateLimitExceeded {
                limit: self.config.max_requests,
                window: self.config.window_seconds,
            });
        }

        entry.count += 1;
        Ok(())
    }

    fn cleanup_old_entries(&self, now: Instant) {
        let window_duration = Duration::from_secs(self.config.window_seconds);
        self.entries.retain(|_, entry| {
            now.duration_since(entry.window_start) < window_duration * 2
        });
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RateLimitError {
    #[error("Rate limit exceeded: {} requests per {} seconds", limit, window)]
    RateLimitExceeded { limit: u32, window: u64 },
}

/// Extract client IP from request
fn extract_client_ip(req: &ServiceRequest) -> String {
    // Try to get real IP from X-Forwarded-For header (for proxies)
    if let Some(forwarded_for) = req.headers().get("x-forwarded-for") {
        if let Ok(ip_str) = forwarded_for.to_str() {
            // Take first IP in chain
            if let Some(ip) = ip_str.split(',').next() {
                return ip.trim().to_string();
            }
        }
    }

    // Fall back to connection info
    req.connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string()
}

/// Rate limiting middleware
pub async fn rate_limit_middleware(
    req: ServiceRequest,
    next: Next<ServiceResponse>,
) -> Result<ServiceResponse, Error> {
    // Get rate limiter from app data
    if let Some(limiter) = req.app_data::<actix_web::web::Data<RateLimiter>>() {
        let client_ip = extract_client_ip(&req);
        
        match limiter.check(&client_ip) {
            Ok(()) => {
                // Add rate limit headers
                let mut res = next.call(req).await?;
                if let Ok(header_value) = limiter.config.max_requests.to_string().parse() {
                    res.headers_mut().insert("X-RateLimit-Limit", header_value);
                }
                if let Ok(header_value) = limiter.config.window_seconds.to_string().parse() {
                    res.headers_mut().insert("X-RateLimit-Window", header_value);
                }
                Ok(res)
            }
            Err(e) => {
                tracing::warn!("Rate limit exceeded for IP: {} - {}", client_ip, e);
                let mut res = HttpResponse::TooManyRequests()
                    .json(serde_json::json!({
                        "error": "Rate limit exceeded",
                        "message": format!("{}", e),
                        "retry_after": limiter.config.window_seconds
                    }));
                if let Ok(header_value) = limiter.config.window_seconds.to_string().parse() {
                    res.headers_mut().insert("Retry-After", header_value);
                }
                Ok(res.into())
            }
        }
    } else {
        // No rate limiter configured, allow request
        next.call(req).await
    }
}
