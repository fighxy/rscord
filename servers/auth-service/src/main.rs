use mongodb::Client as MongoClient;
use radiate_auth_service::{create_app, AuthState};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::info;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let bind_address = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0".to_string());
    let auth_port = std::env::var("AUTH_PORT").unwrap_or_else(|_| "14701".to_string());
    let addr: SocketAddr = format!("{}:{}", bind_address, auth_port).parse().expect("bind addr");

    // Connect to MongoDB using environment variable
    let mongo_uri = std::env::var("MONGO_URI").unwrap_or_else(|_| "mongodb://localhost:27017/radiate".to_string());
    let mongo = MongoClient::with_uri_str(&mongo_uri)
        .await
        .expect("Failed to connect to MongoDB");

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "default-jwt-secret-change-in-production".to_string());

    let state = AuthState {
        mongo: mongo.clone(),
        jwt_secret,
        auth_codes: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        rate_limiter: radiate_auth_service::rate_limiter::RateLimiter::new(
            5,  // max 5 attempts
            5,  // within 5 minutes window
            10  // 10 minutes lockout
        ),
    };

    let app = create_app(state).await;

    // Start background tasks
    let cleanup_codes = state.auth_codes.clone();
    tokio::spawn(async move {
        radiate_auth_service::background_tasks::cleanup_expired_codes(cleanup_codes).await;
    });

    info!("Auth service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}


