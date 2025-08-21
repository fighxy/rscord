pub mod handlers;
pub mod models;
pub mod app;
pub mod username_validator;

use axum::Router;
use mongodb::Client as MongoClient;
use std::sync::Arc;


#[derive(Clone)]
pub struct AuthState {
    pub mongo: MongoClient,
    pub jwt_secret: String,
    pub auth_codes: Arc<tokio::sync::RwLock<std::collections::HashMap<String, AuthCode>>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AuthCode {
    pub code: String,
    pub telegram_id: i64,
    pub username: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create_app(state: AuthState) -> Router {
    app::create_auth_app(state).await
}

// Re-export for testing
pub use handlers::*;
pub use models::*;
