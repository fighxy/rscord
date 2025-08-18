api/chat/messages".to_string(),
                config: RateLimitConfig {
                    requests_per_window: 30,
                    window_duration_seconds: 60,
                    burst_allowance: 5,
                    reset_on_success: false,
                },
                user_specific: true,
                ip_specific: false,
            },
        );

        rules.insert(
            "/api/voice/rooms".to_string(),
            RateLimitRule {
                endpoint_pattern: "/api/voice/rooms".to_string(),
                config: RateLimitConfig {
                    requests_per_window: 10,
                    window_duration_seconds: 60,
                    burst_allowance: 3,
                    reset_on_success: false,
                },
                user_specific: true,
                ip_specific: false,
            },
        );

        rules.insert(
            "/api/files/upload".to_string(),
            RateLimitRule {
                endpoint_pattern: "/api/files/upload".to_string(),
                config: RateLimitConfig {
                    requests_per_window: 10,
                    window_duration_seconds: 300, // 5 minutes
                    burst_allowance: 2,
                    reset_on_success: false,
                },
                user_specific: true,
                ip_specific: true,
            },
        );

        // Global fallback rule
        rules.insert(
            "global".to_string(),
            RateLimitRule {
                endpoint_pattern: "*".to_string(),
                config: RateLimitConfig {
                    requests_per_window: 100,
                    window_duration_seconds: 60,
                    burst_allowance: 20,
                    reset_on_success: false,
                },
                user_specific: true,
                ip_specific: false,
            },
        );

        Self {
            redis,
            in_memory_store: Arc::new(RwLock::new(HashMap::new())),
            rules: Arc::new(rules),
        }
    }

    pub async fn check_rate_limit(
        &self,
        identifier: &str,
        endpoint: &str,
    ) -> Result<RateLimitResult, RateLimitError> {
        let rule = self.get_rule_for_endpoint(endpoint);
        let key = format!("rate_limit:{}:{}", endpoint, identifier);

        if let Some(ref mut redis_conn) = self.redis.clone() {
            self.check_rate_limit_redis(redis_conn, &key, &rule).await
        } else {
            self.check_rate_limit_memory(&key, &rule).await
        }
    }

    async fn check_rate_limit_redis(
        &self,
        redis_conn: &mut ConnectionManager,
        key: &str,
        rule: &RateLimitRule,
    ) -> Result<RateLimitResult, RateLimitError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Use Redis pipeline for atomic operations
        let pipe = redis::pipe();
        
        // Get current state
        let (current_count, window_start): (Option<u32>, Option<u64>) = redis_conn
            .mget(&[format!("{}:count", key), format!("{}:window", key)])
            .await
            .map_err(|e| RateLimitError::StorageError(e.to_string()))?;

        let current_count = current_count.unwrap_or(0);
        let window_start = window_start.unwrap_or(now);

        // Check if window has expired
        let window_expired = now.saturating_sub(window_start) >= rule.config.window_duration_seconds;

        if window_expired {
            // Reset window
            let _: () = redis_conn
                .set_multiple(&[
                    (format!("{}:count", key), 1u32),
                    (format!("{}:window", key), now),
                ])
                .await
                .map_err(|e| RateLimitError::StorageError(e.to_string()))?;

            let _: () = redis_conn
                .expire(&format!("{}:count", key), rule.config.window_duration_seconds as i64)
                .await
                .map_err(|e| RateLimitError::StorageError(e.to_string()))?;

            return Ok(RateLimitResult {
                allowed: true,
                requests_remaining: rule.config.requests_per_window.saturating_sub(1),
                reset_time: now + rule.config.window_duration_seconds,
                retry_after: None,
            });
        }

        // Check if rate limit exceeded
        if current_count >= rule.config.requests_per_window {
            let retry_after = rule.config.window_duration_seconds.saturating_sub(now.saturating_sub(window_start));
            
            return Ok(RateLimitResult {
                allowed: false,
                requests_remaining: 0,
                reset_time: window_start + rule.config.window_duration_seconds,
                retry_after: Some(retry_after),
            });
        }

        // Increment counter
        let new_count: u32 = redis_conn
            .incr(&format!("{}:count", key), 1)
            .await
            .map_err(|e| RateLimitError::StorageError(e.to_string()))?;

        Ok(RateLimitResult {
            allowed: true,
            requests_remaining: rule.config.requests_per_window.saturating_sub(new_count),
            reset_time: window_start + rule.config.window_duration_seconds,
            retry_after: None,
        })
    }

    async fn check_rate_limit_memory(
        &self,
        key: &str,
        rule: &RateLimitRule,
    ) -> Result<RateLimitResult, RateLimitError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut store = self.in_memory_store.write().await;
        
        let state = store.entry(key.to_string()).or_insert(RateLimitState {
            requests_made: 0,
            window_start: now,
            last_request: now,
            violation_count: 0,
        });

        // Check if window has expired
        let window_expired = now.saturating_sub(state.window_start) >= rule.config.window_duration_seconds;

        if window_expired {
            // Reset window
            state.requests_made = 1;
            state.window_start = now;
            state.last_request = now;

            return Ok(RateLimitResult {
                allowed: true,
                requests_remaining: rule.config.requests_per_window.saturating_sub(1),
                reset_time: now + rule.config.window_duration_seconds,
                retry_after: None,
            });
        }

        // Check if rate limit exceeded
        if state.requests_made >= rule.config.requests_per_window {
            state.violation_count += 1;
            let retry_after = rule.config.window_duration_seconds.saturating_sub(now.saturating_sub(state.window_start));
            
            return Ok(RateLimitResult {
                allowed: false,
                requests_remaining: 0,
                reset_time: state.window_start + rule.config.window_duration_seconds,
                retry_after: Some(retry_after),
            });
        }

        // Increment counter
        state.requests_made += 1;
        state.last_request = now;

        Ok(RateLimitResult {
            allowed: true,
            requests_remaining: rule.config.requests_per_window.saturating_sub(state.requests_made),
            reset_time: state.window_start + rule.config.window_duration_seconds,
            retry_after: None,
        })
    }

    fn get_rule_for_endpoint(&self, endpoint: &str) -> RateLimitRule {
        // Try exact match first
        if let Some(rule) = self.rules.get(endpoint) {
            return rule.clone();
        }

        // Try pattern matching
        for (pattern, rule) in self.rules.iter() {
            if endpoint.starts_with(pattern) {
                return rule.clone();
            }
        }

        // Return global fallback
        self.rules.get("global").unwrap().clone()
    }

    /// Clean up expired entries from in-memory store
    pub async fn cleanup_expired(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut store = self.in_memory_store.write().await;
        
        store.retain(|_, state| {
            now.saturating_sub(state.last_request) < 3600 // Keep entries for 1 hour
        });

        debug!("Cleaned up rate limit store, {} entries remaining", store.len());
    }
}

#[derive(Debug, Clone)]
pub struct RateLimitResult {
    pub allowed: bool,
    pub requests_remaining: u32,
    pub reset_time: u64,
    pub retry_after: Option<u64>,
}

#[derive(Debug, thiserror::Error)]
pub enum RateLimitError {
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Configuration error: {0}")]
    ConfigError(String),
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
}

// Rate limiting middleware
pub async fn rate_limit_middleware<S>(
    State(rate_limiter): State<Arc<RateLimiter>>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let uri = request.uri().path();
    
    // Extract identifier (IP or user ID)
    let identifier = extract_rate_limit_identifier(&headers, &request).await?;
    
    match rate_limiter.check_rate_limit(&identifier, uri).await {
        Ok(result) => {
            if !result.allowed {
                warn!("Rate limit exceeded for {} on {}", identifier, uri);
                
                // Create rate limit exceeded response
                let mut response = Response::builder()
                    .status(StatusCode::TOO_MANY_REQUESTS)
                    .header("X-RateLimit-Limit", result.requests_remaining.to_string())
                    .header("X-RateLimit-Remaining", "0")
                    .header("X-RateLimit-Reset", result.reset_time.to_string());

                if let Some(retry_after) = result.retry_after {
                    response = response.header("Retry-After", retry_after.to_string());
                }

                return Ok(response
                    .body("Rate limit exceeded".into())
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?);
            }

            // Add rate limit headers to successful response
            let mut response = next.run(request).await;
            let headers = response.headers_mut();
            
            headers.insert("X-RateLimit-Limit", result.requests_remaining.to_string().parse().unwrap());
            headers.insert("X-RateLimit-Remaining", result.requests_remaining.to_string().parse().unwrap());
            headers.insert("X-RateLimit-Reset", result.reset_time.to_string().parse().unwrap());

            Ok(response)
        }
        Err(e) => {
            error!("Rate limit check failed: {}", e);
            // On error, allow request but log the issue
            Ok(next.run(request).await)
        }
    }
}

async fn extract_rate_limit_identifier(headers: &HeaderMap, request: &Request) -> Result<String, StatusCode> {
    // Try to extract user ID from JWT first
    if let Some(auth_header) = headers.get("authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                // Simple JWT extraction (in production, use proper validation)
                if let Ok(claims) = extract_jwt_claims_simple(token) {
                    return Ok(format!("user:{}", claims.sub));
                }
            }
        }
    }

    // Fallback to IP address
    if let Some(forwarded) = headers.get("x-forwarded-for") {
        if let Ok(forwarded_str) = forwarded.to_str() {
            if let Some(ip) = forwarded_str.split(',').next() {
                return Ok(format!("ip:{}", ip.trim()));
            }
        }
    }

    if let Some(real_ip) = headers.get("x-real-ip") {
        if let Ok(ip_str) = real_ip.to_str() {
            return Ok(format!("ip:{}", ip_str));
        }
    }

    // Extract from connection info as last resort
    Ok("ip:unknown".to_string())
}

// Simplified JWT claims extraction for rate limiting
#[derive(Debug, Serialize, Deserialize)]
struct SimpleClaims {
    sub: String,
}

fn extract_jwt_claims_simple(token: &str) -> Result<SimpleClaims, Box<dyn std::error::Error>> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format".into());
    }

    let payload = parts[1];
    let decoded = base64::decode_config(payload, base64::URL_SAFE_NO_PAD)?;
    let claims: SimpleClaims = serde_json::from_slice(&decoded)?;
    Ok(claims)
}

// Background task for cleanup
pub async fn start_rate_limit_cleanup_task(rate_limiter: Arc<RateLimiter>) {
    let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
    
    loop {
        interval.tick().await;
        rate_limiter.cleanup_expired().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limit_basic() {
        let rate_limiter = RateLimiter::new(None);
        
        // First request should be allowed
        let result = rate_limiter
            .check_rate_limit("test_user", "/api/test")
            .await
            .unwrap();
        assert!(result.allowed);
        
        // Simulate many requests
        for _ in 0..99 {
            let result = rate_limiter
                .check_rate_limit("test_user", "/api/test")
                .await
                .unwrap();
            assert!(result.allowed);
        }
        
        // 101st request should be blocked
        let result = rate_limiter
            .check_rate_limit("test_user", "/api/test")
            .await
            .unwrap();
        assert!(!result.allowed);
    }

    #[tokio::test]
    async fn test_rate_limit_different_users() {
        let rate_limiter = RateLimiter::new(None);
        
        // Different users should have separate limits
        for i in 0..50 {
            let user_id = format!("user_{}", i);
            let result = rate_limiter
                .check_rate_limit(&user_id, "/api/test")
                .await
                .unwrap();
            assert!(result.allowed);
        }
    }
}
