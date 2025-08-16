pub mod handlers;
pub mod models;
pub mod app;

use axum::Router;
use mongodb::Client as MongoClient;
use rscord_common::AppConfig;

#[derive(Clone)]
pub struct AuthState {
    pub mongo: MongoClient,
    pub jwt_secret: String,
}

pub async fn create_app(state: AuthState) -> Router {
    app::create_auth_app(state).await
}

// Re-export for testing
pub use handlers::*;
pub use models::*;
