use axum::{
    routing::{get, post},
    Router,
};
use mongodb::{bson::doc, options::IndexOptions, Collection, IndexModel};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};

use crate::{handlers, AuthState, UserDoc};

pub async fn create_auth_app(state: AuthState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Create unique indexes for Telegram-only auth
    if let Err(e) = create_indexes(&state).await {
        warn!("Failed to create database indexes: {}", e);
    }

    Router::new()
        .route("/health", get(|| async { "Auth service is healthy" }))
        // Telegram-only authentication endpoints
        .route("/api/auth/telegram/register", post(handlers::telegram_register))
        .route("/api/auth/telegram/login", post(handlers::telegram_login))
        .route("/api/auth/telegram/request-code", post(handlers::telegram_request_code))
        .route("/api/auth/telegram/verify-code", post(handlers::telegram_verify_code))
        .route("/api/auth/me", get(handlers::get_current_user))
        .route("/api/auth/verify", get(handlers::verify_token))
        .route("/api/auth/refresh", post(handlers::refresh_token))
        .route("/api/auth/logout", post(handlers::logout))
        .route("/api/auth/check-username", post(handlers::check_username))
        .route("/api/auth/suggest-username", post(handlers::suggest_username_endpoint))
        .route("/api/auth/telegram", post(handlers::telegram_auth))
        .route("/api/users/@:username", get(handlers::find_user_by_username))
        .route("/api/users/telegram/:telegram_id", get(handlers::find_user_by_telegram_id))
        .with_state(state)
        .layer(cors)
}

async fn create_indexes(state: &AuthState) -> Result<(), mongodb::error::Error> {
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    
    // Removed email index - using Telegram-only auth
    
    // Create unique index on username
    match users
        .create_index(
            IndexModel::builder()
                .keys(doc! {"username": 1})
                .options(IndexOptions::builder().unique(true).build())
                .build(),
        )
        .await
    {
        Ok(_) => info!("Created unique index on users.username"),
        Err(e) => warn!("Failed to create index on users.username: {}", e),
    }
    
    // Create unique index on telegram_id (required for Telegram-only auth)
    match users
        .create_index(
            IndexModel::builder()
                .keys(doc! {"telegram_id": 1})
                .options(IndexOptions::builder().unique(true).build())
                .build(),
        )
        .await
    {
        Ok(_) => {
            info!("Created unique index on users.telegram_id");
            Ok(())
        }
        Err(e) => {
            warn!("Failed to create index on users.telegram_id: {}", e);
            Err(e)
        }
    }
}
