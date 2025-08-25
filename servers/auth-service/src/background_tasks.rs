use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use chrono::Utc;
use tracing::{info, debug};

/// Background task to clean up expired auth codes
pub async fn cleanup_expired_codes(
    auth_codes: Arc<RwLock<std::collections::HashMap<String, crate::AuthCode>>>,
) {
    let mut interval = interval(Duration::from_secs(60)); // Check every minute
    
    loop {
        interval.tick().await;
        
        let now = Utc::now();
        let mut codes = auth_codes.write().await;
        
        let initial_count = codes.len();
        codes.retain(|code, auth| {
            let is_valid = now < auth.expires_at;
            if !is_valid {
                debug!("Removing expired code: {} for user: {}", code, auth.username);
            }
            is_valid
        });
        
        let removed_count = initial_count - codes.len();
        if removed_count > 0 {
            info!("Cleaned up {} expired auth codes", removed_count);
        }
    }
}

/// Monitor system health and log statistics
pub async fn monitor_system_health(
    auth_codes: Arc<RwLock<std::collections::HashMap<String, crate::AuthCode>>>,
) {
    let mut interval = interval(Duration::from_secs(300)); // Log stats every 5 minutes
    
    loop {
        interval.tick().await;
        
        let codes = auth_codes.read().await;
        info!(
            "System stats: Active auth codes: {}, Memory usage: {} MB",
            codes.len(),
            get_memory_usage_mb()
        );
    }
}

fn get_memory_usage_mb() -> f64 {
    // Simple memory usage estimation (in production, use proper system metrics)
    use std::alloc::{GlobalAlloc, Layout, System};
    
    // This is a simplified version - in production use proper metrics
    let usage = std::mem::size_of::<usize>() * 1000; // Placeholder
    (usage as f64) / 1_048_576.0
}
