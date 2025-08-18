    }

    fn create_timeout_error<E>(&self) -> E 
    where 
        E: Default,
    {
        E::default()
    }

    /// Get current circuit breaker state
    pub async fn get_circuit_state(&self) -> CircuitState {
        self.circuit_state.read().await.state
    }

    /// Get current metrics
    pub async fn get_metrics(&self) -> RetryMetrics {
        self.metrics.read().await.clone()
    }

    /// Reset circuit breaker manually
    pub async fn reset_circuit_breaker(&self) {
        let mut state = self.circuit_state.write().await;
        *state = CircuitBreakerState::default();
        info!("Circuit breaker manually reset");
    }

    /// Force circuit breaker open (for testing/maintenance)
    pub async fn force_circuit_open(&self) {
        let mut state = self.circuit_state.write().await;
        state.state = CircuitState::Open;
        state.last_failure_time = Some(std::time::Instant::now());
        warn!("Circuit breaker forced open");
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EnhancedRetryError<E> {
    #[error("Circuit breaker is open")]
    CircuitBreakerOpen,
    #[error("Maximum retry attempts exceeded: {0:?}")]
    MaxAttemptsExceeded(E),
    #[error("Non-retryable error: {0:?}")]
    NonRetryableError(E),
    #[error("Operation timeout")]
    Timeout,
    #[error("Configuration error: {0}")]
    ConfigError(String),
}

// Database operations with enhanced retry
pub struct DatabaseRetryWrapper {
    retry_client: EnhancedRetryClient,
}

impl DatabaseRetryWrapper {
    pub fn new() -> Self {
        let retry_config = RetryConfig {
            max_attempts: 5,
            base_delay: Duration::from_millis(200),
            max_delay: Duration::from_secs(10),
            exponential_base: 1.5,
            jitter: true,
        };

        let circuit_config = CircuitBreakerConfig {
            failure_threshold: 3,
            success_threshold: 2,
            timeout: Duration::from_secs(30),
            half_open_max_calls: 2,
        };

        Self {
            retry_client: EnhancedRetryClient::new(retry_config, circuit_config),
        }
    }

    pub async fn execute_query<F, Fut, T>(&self, operation: F) -> Result<T, EnhancedRetryError<mongodb::error::Error>>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, mongodb::error::Error>>,
    {
        self.retry_client.execute_with_retry(operation).await
    }
}

// HTTP operations with enhanced retry
pub struct HttpRetryWrapper {
    retry_client: EnhancedRetryClient,
    client: reqwest::Client,
}

impl HttpRetryWrapper {
    pub fn new() -> Self {
        let retry_config = RetryConfig {
            max_attempts: 4,
            base_delay: Duration::from_millis(500),
            max_delay: Duration::from_secs(30),
            exponential_base: 2.0,
            jitter: true,
        };

        let circuit_config = CircuitBreakerConfig {
            failure_threshold: 5,
            success_threshold: 3,
            timeout: Duration::from_secs(60),
            half_open_max_calls: 3,
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            retry_client: EnhancedRetryClient::new(retry_config, circuit_config),
            client,
        }
    }

    pub async fn get(&self, url: &str) -> Result<reqwest::Response, EnhancedRetryError<reqwest::Error>> {
        let url = url.to_string();
        self.retry_client.execute_with_retry(|| async {
            self.client.get(&url).send().await
        }).await
    }

    pub async fn post<T: serde::Serialize>(&self, url: &str, json: &T) -> Result<reqwest::Response, EnhancedRetryError<reqwest::Error>> {
        let url = url.to_string();
        let json_str = serde_json::to_string(json).unwrap();
        
        self.retry_client.execute_with_retry(|| async {
            self.client
                .post(&url)
                .header("Content-Type", "application/json")
                .body(json_str.clone())
                .send()
                .await
        }).await
    }
}

// LiveKit operations with enhanced retry
pub struct LiveKitRetryWrapper {
    retry_client: EnhancedRetryClient,
}

impl LiveKitRetryWrapper {
    pub fn new() -> Self {
        let retry_config = RetryConfig {
            max_attempts: 3,
            base_delay: Duration::from_millis(1000),
            max_delay: Duration::from_secs(15),
            exponential_base: 2.0,
            jitter: true,
        };

        let circuit_config = CircuitBreakerConfig {
            failure_threshold: 3,
            success_threshold: 2,
            timeout: Duration::from_secs(45),
            half_open_max_calls: 2,
        };

        Self {
            retry_client: EnhancedRetryClient::new(retry_config, circuit_config),
        }
    }

    pub async fn create_room<F, Fut, T, E>(&self, operation: F) -> Result<T, EnhancedRetryError<E>>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        E: std::fmt::Debug + Clone,
    {
        self.retry_client.execute_with_retry(operation).await
    }

    pub async fn delete_room<F, Fut, T, E>(&self, operation: F) -> Result<T, EnhancedRetryError<E>>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, E>>,
        E: std::fmt::Debug + Clone,
    {
        self.retry_client.execute_with_policy(operation, RetryPolicy::FixedDelay, Some(2)).await
    }
}

// Health check system with automatic recovery
pub struct HealthCheckManager {
    checks: std::collections::HashMap<String, Box<dyn HealthCheck + Send + Sync>>,
    recovery_actions: std::collections::HashMap<String, Box<dyn RecoveryAction + Send + Sync>>,
    check_interval: Duration,
}

#[async_trait::async_trait]
pub trait HealthCheck {
    async fn check(&self) -> HealthStatus;
    fn name(&self) -> &str;
}

#[async_trait::async_trait]
pub trait RecoveryAction {
    async fn execute(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    fn name(&self) -> &str;
}

#[derive(Debug, Clone, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Unhealthy(String),
    Degraded(String),
}

impl HealthCheckManager {
    pub fn new(check_interval: Duration) -> Self {
        Self {
            checks: std::collections::HashMap::new(),
            recovery_actions: std::collections::HashMap::new(),
            check_interval,
        }
    }

    pub fn add_health_check(&mut self, check: Box<dyn HealthCheck + Send + Sync>) {
        self.checks.insert(check.name().to_string(), check);
    }

    pub fn add_recovery_action(&mut self, action: Box<dyn RecoveryAction + Send + Sync>) {
        self.recovery_actions.insert(action.name().to_string(), action);
    }

    pub async fn start_monitoring(&self) {
        let mut interval = tokio::time::interval(self.check_interval);
        
        loop {
            interval.tick().await;
            self.run_health_checks().await;
        }
    }

    async fn run_health_checks(&self) {
        for (name, check) in &self.checks {
            let status = check.check().await;
            
            match status {
                HealthStatus::Healthy => {
                    debug!("Health check '{}' is healthy", name);
                }
                HealthStatus::Degraded(reason) => {
                    warn!("Health check '{}' is degraded: {}", name, reason);
                    // Could trigger alerts here
                }
                HealthStatus::Unhealthy(reason) => {
                    error!("Health check '{}' is unhealthy: {}", name, reason);
                    
                    // Try recovery action
                    if let Some(recovery) = self.recovery_actions.get(name) {
                        info!("Attempting recovery for '{}'", name);
                        match recovery.execute().await {
                            Ok(()) => info!("Recovery successful for '{}'", name),
                            Err(e) => error!("Recovery failed for '{}': {}", name, e),
                        }
                    }
                }
            }
        }
    }
}

// MongoDB Health Check
pub struct MongoDbHealthCheck {
    db: mongodb::Database,
}

impl MongoDbHealthCheck {
    pub fn new(db: mongodb::Database) -> Self {
        Self { db }
    }
}

#[async_trait::async_trait]
impl HealthCheck for MongoDbHealthCheck {
    async fn check(&self) -> HealthStatus {
        match self.db.run_command(mongodb::bson::doc! { "ping": 1 }).await {
            Ok(_) => HealthStatus::Healthy,
            Err(e) => HealthStatus::Unhealthy(format!("MongoDB ping failed: {}", e)),
        }
    }

    fn name(&self) -> &str {
        "mongodb"
    }
}

// LiveKit Health Check
pub struct LiveKitHealthCheck {
    livekit_client: std::sync::Arc<crate::enhanced_livekit_client::EnhancedLiveKitClient>,
}

impl LiveKitHealthCheck {
    pub fn new(livekit_client: std::sync::Arc<crate::enhanced_livekit_client::EnhancedLiveKitClient>) -> Self {
        Self { livekit_client }
    }
}

#[async_trait::async_trait]
impl HealthCheck for LiveKitHealthCheck {
    async fn check(&self) -> HealthStatus {
        if self.livekit_client.health_check_with_recovery().await {
            HealthStatus::Healthy
        } else {
            HealthStatus::Unhealthy("LiveKit health check failed".to_string())
        }
    }

    fn name(&self) -> &str {
        "livekit"
    }
}

// Redis Health Check
pub struct RedisHealthCheck {
    redis_client: redis::Client,
}

impl RedisHealthCheck {
    pub fn new(redis_client: redis::Client) -> Self {
        Self { redis_client }
    }
}

#[async_trait::async_trait]
impl HealthCheck for RedisHealthCheck {
    async fn check(&self) -> HealthStatus {
        match self.redis_client.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                match redis::cmd("PING").query_async::<_, String>(&mut conn).await {
                    Ok(_) => HealthStatus::Healthy,
                    Err(e) => HealthStatus::Unhealthy(format!("Redis ping failed: {}", e)),
                }
            }
            Err(e) => HealthStatus::Unhealthy(format!("Redis connection failed: {}", e)),
        }
    }

    fn name(&self) -> &str {
        "redis"
    }
}

// Recovery Actions
pub struct RestartServiceRecovery {
    service_name: String,
}

impl RestartServiceRecovery {
    pub fn new(service_name: String) -> Self {
        Self { service_name }
    }
}

#[async_trait::async_trait]
impl RecoveryAction for RestartServiceRecovery {
    async fn execute(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        warn!("Attempting to restart service: {}", self.service_name);
        
        // In a real implementation, this would restart the actual service
        // For now, we'll just log and simulate recovery
        sleep(Duration::from_secs(2)).await;
        
        info!("Service restart completed: {}", self.service_name);
        Ok(())
    }

    fn name(&self) -> &str {
        &self.service_name
    }
}

// Error recovery middleware for Axum
pub async fn error_recovery_middleware<S>(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, axum::http::StatusCode> {
    let retry_client = EnhancedRetryClient::new(RetryConfig::default(), CircuitBreakerConfig::default());
    
    match retry_client.execute_with_retry(|| async {
        Ok(next.run(request).await)
    }).await {
        Ok(response) => Ok(response),
        Err(e) => {
            error!("Request failed after retries: {:?}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_retry_success_after_failures() {
        let retry_client = EnhancedRetryClient::new(RetryConfig::default(), CircuitBreakerConfig::default());
        
        let mut attempt_count = 0;
        let result = retry_client.execute_with_retry(|| async {
            attempt_count += 1;
            if attempt_count < 3 {
                Err("Simulated failure")
            } else {
                Ok("Success")
            }
        }).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Success");
        assert_eq!(attempt_count, 3);
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens() {
        let retry_client = EnhancedRetryClient::new(
            RetryConfig { max_attempts: 1, ..Default::default() },
            CircuitBreakerConfig { failure_threshold: 2, ..Default::default() }
        );

        // Fail twice to open circuit breaker
        for _ in 0..2 {
            let _ = retry_client.execute_with_retry(|| async {
                Err::<(), _>("Failure")
            }).await;
        }

        // Next request should be blocked by circuit breaker
        let result = retry_client.execute_with_retry(|| async {
            Ok::<_, &str>("Should not execute")
        }).await;

        assert!(matches!(result, Err(EnhancedRetryError::CircuitBreakerOpen)));
    }

    #[tokio::test]
    async fn test_non_retryable_error() {
        let retry_client = EnhancedRetryClient::new(RetryConfig::default(), CircuitBreakerConfig::default());
        
        let result = retry_client.execute_with_retry(|| async {
            Err("401 Unauthorized") // Non-retryable error
        }).await;

        assert!(matches!(result, Err(EnhancedRetryError::NonRetryableError(_))));
    }
}