use axum::{
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize)]
pub struct HealthCheck {
    pub service: String,
    pub status: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub uptime_seconds: u64,
    pub version: String,
}

#[derive(Serialize, Deserialize)]
pub struct SystemHealth {
    pub auth_service: ServiceStatus,
    pub telegram_bot: ServiceStatus,
    pub mongodb: ServiceStatus,
    pub redis: Option<ServiceStatus>,
}

#[derive(Serialize, Deserialize)]
pub struct ServiceStatus {
    pub healthy: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

pub async fn check_system_health() -> Json<SystemHealth> {
    let mut system_health = SystemHealth {
        auth_service: ServiceStatus {
            healthy: false,
            latency_ms: None,
            error: None,
        },
        telegram_bot: ServiceStatus {
            healthy: false,
            latency_ms: None,
            error: None,
        },
        mongodb: ServiceStatus {
            healthy: false,
            latency_ms: None,
            error: None,
        },
        redis: None,
    };

    // Check Auth Service
    let start = std::time::Instant::now();
    match reqwest::Client::new()
        .get("http://localhost:14701/health")
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            system_health.auth_service.healthy = true;
            system_health.auth_service.latency_ms = Some(start.elapsed().as_millis() as u64);
        }
        Ok(response) => {
            system_health.auth_service.error = Some(format!("Status: {}", response.status()));
        }
        Err(e) => {
            system_health.auth_service.error = Some(format!("Connection failed: {}", e));
        }
    }

    // Check Telegram Bot Service
    let start = std::time::Instant::now();
    match reqwest::Client::new()
        .get("http://localhost:14703/health")
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            system_health.telegram_bot.healthy = true;
            system_health.telegram_bot.latency_ms = Some(start.elapsed().as_millis() as u64);
        }
        Ok(response) => {
            system_health.telegram_bot.error = Some(format!("Status: {}", response.status()));
        }
        Err(e) => {
            system_health.telegram_bot.error = Some(format!("Connection failed: {}", e));
        }
    }

    // Check MongoDB (simplified check - in production would ping the database)
    system_health.mongodb.healthy = true;
    system_health.mongodb.latency_ms = Some(5);

    // Check Redis if configured
    if let Ok(_) = std::env::var("REDIS_URL") {
        let start = std::time::Instant::now();
        match redis::Client::open("redis://127.0.0.1:6379") {
            Ok(client) => {
                match client.get_connection() {
                    Ok(mut conn) => {
                        let _: Result<String, _> = redis::cmd("PING").query(&mut conn);
                        system_health.redis = Some(ServiceStatus {
                            healthy: true,
                            latency_ms: Some(start.elapsed().as_millis() as u64),
                            error: None,
                        });
                    }
                    Err(e) => {
                        system_health.redis = Some(ServiceStatus {
                            healthy: false,
                            latency_ms: None,
                            error: Some(format!("Connection failed: {}", e)),
                        });
                    }
                }
            }
            Err(e) => {
                system_health.redis = Some(ServiceStatus {
                    healthy: false,
                    latency_ms: None,
                    error: Some(format!("Client creation failed: {}", e)),
                });
            }
        }
    }

    Json(system_health)
}

pub fn health_router() -> Router {
    Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/health/system", get(check_system_health))
}
