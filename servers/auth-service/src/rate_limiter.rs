use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration};

#[derive(Clone)]
pub struct RateLimiter {
    attempts: Arc<RwLock<HashMap<String, AttemptTracker>>>,
    max_attempts: u32,
    window_minutes: i64,
    lockout_minutes: i64,
}

#[derive(Clone)]
struct AttemptTracker {
    count: u32,
    first_attempt: DateTime<Utc>,
    locked_until: Option<DateTime<Utc>>,
}

impl RateLimiter {
    pub fn new(max_attempts: u32, window_minutes: i64, lockout_minutes: i64) -> Self {
        Self {
            attempts: Arc::new(RwLock::new(HashMap::new())),
            max_attempts,
            window_minutes,
            lockout_minutes,
        }
    }

    pub async fn check_rate_limit(&self, key: &str) -> Result<(), RateLimitError> {
        let mut attempts = self.attempts.write().await;
        let now = Utc::now();
        
        // Clean up old entries
        attempts.retain(|_, tracker| {
            if let Some(locked_until) = tracker.locked_until {
                now < locked_until
            } else {
                now - tracker.first_attempt < Duration::minutes(self.window_minutes)
            }
        });
        
        // Check if key exists
        if let Some(tracker) = attempts.get_mut(key) {
            // Check if locked out
            if let Some(locked_until) = tracker.locked_until {
                if now < locked_until {
                    let remaining = (locked_until - now).num_seconds();
                    return Err(RateLimitError::LockedOut { seconds_remaining: remaining });
                } else {
                    // Lockout expired, reset
                    tracker.locked_until = None;
                    tracker.count = 1;
                    tracker.first_attempt = now;
                }
            } else {
                // Check if within window
                if now - tracker.first_attempt < Duration::minutes(self.window_minutes) {
                    tracker.count += 1;
                    
                    if tracker.count > self.max_attempts {
                        // Lock out the key
                        tracker.locked_until = Some(now + Duration::minutes(self.lockout_minutes));
                        return Err(RateLimitError::TooManyAttempts);
                    }
                } else {
                    // Window expired, reset
                    tracker.count = 1;
                    tracker.first_attempt = now;
                }
            }
        } else {
            // First attempt
            attempts.insert(key.to_string(), AttemptTracker {
                count: 1,
                first_attempt: now,
                locked_until: None,
            });
        }
        
        Ok(())
    }
    
    pub async fn record_success(&self, key: &str) {
        let mut attempts = self.attempts.write().await;
        attempts.remove(key);
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RateLimitError {
    #[error("Too many attempts. Account locked for {lockout_minutes} minutes")]
    TooManyAttempts,
    
    #[error("Account locked. Try again in {seconds_remaining} seconds")]
    LockedOut { seconds_remaining: i64 },
}

// Helper function to create rate limit key
pub fn create_rate_limit_key(prefix: &str, identifier: &str) -> String {
    format!("{}:{}", prefix, identifier)
}

pub fn create_ip_rate_limit_key(prefix: &str, ip: IpAddr) -> String {
    format!("{}:ip:{}", prefix, ip)
}
