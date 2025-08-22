mod presence;
mod events;

use axum::{
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};

use presence::{PresenceManager, UserPresence, UserStatus};
use radiate_common::{load_config, AppConfig};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[derive(Clone)]
struct PresenceState {
    presence_manager: Arc<PresenceManager>,
    config: AppConfig,
}

#[derive(Deserialize)]
struct UpdatePresenceRequest {
    status: UserStatus,
    activity: Option<String>,
}

#[derive(Serialize)]
struct PresenceResponse {
    user_id: String,
    status: UserStatus,
    activity: Option<String>,
    last_seen: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
struct GuildPresenceResponse {
    guild_id: String,
    users: Vec<PresenceResponse>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RSCORD").expect("load config");
    let bind_address = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0".to_string());
    let presence_port = std::env::var("PRESENCE_PORT").unwrap_or_else(|_| "14706".to_string());
    let addr: SocketAddr = format!("{}:{}", bind_address, presence_port).parse().expect("bind addr");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let presence_manager = Arc::new(PresenceManager::new().await.expect("Failed to create presence manager"));

    let state = PresenceState {
        presence_manager,
        config: cfg,
    };

    let app = Router::new()
        .route("/health", get(|| async { "Presence service is healthy" }))
        .route("/presence/update", post(update_presence))
        .route("/presence/:user_id", get(get_user_presence))
        .route("/presence/guild/:guild_id", get(get_guild_presence))
        .route("/presence/ws", get(websocket_handler))
        .route("/presence/bulk", post(get_bulk_presence))
        .with_state(state)
        .layer(cors);

    info!("Presence service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn update_presence(
    State(state): State<PresenceState>,
    Path(user_id): Path<String>,
    Json(body): Json<UpdatePresenceRequest>,
) -> Result<Json<PresenceResponse>, StatusCode> {
    let presence = UserPresence {
        user_id: user_id.clone(),
        status: body.status,
        activity: body.activity,
        last_seen: chrono::Utc::now(),
        guild_id: None, // Will be set by the presence manager
    };

    state
        .presence_manager
        .update_presence(presence)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let current_presence = state
        .presence_manager
        .get_presence(&user_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(PresenceResponse {
        user_id: current_presence.user_id,
        status: current_presence.status,
        activity: current_presence.activity,
        last_seen: current_presence.last_seen,
    }))
}

async fn get_user_presence(
    State(state): State<PresenceState>,
    Path(user_id): Path<String>,
) -> Result<Json<PresenceResponse>, StatusCode> {
    let presence = state
        .presence_manager
        .get_presence(&user_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(PresenceResponse {
        user_id: presence.user_id,
        status: presence.status,
        activity: presence.activity,
        last_seen: presence.last_seen,
    }))
}

async fn get_guild_presence(
    State(state): State<PresenceState>,
    Path(guild_id): Path<String>,
) -> Result<Json<GuildPresenceResponse>, StatusCode> {
    let guild_presence = state
        .presence_manager
        .get_guild_presence(&guild_id)
        .await;

    let users: Vec<PresenceResponse> = guild_presence
        .into_iter()
        .map(|p| PresenceResponse {
            user_id: p.user_id,
            status: p.status,
            activity: p.activity,
            last_seen: p.last_seen,
        })
        .collect();

    Ok(Json(GuildPresenceResponse { guild_id, users }))
}

#[derive(Deserialize)]
struct BulkPresenceRequest {
    user_ids: Vec<String>,
}

async fn get_bulk_presence(
    State(state): State<PresenceState>,
    Json(body): Json<BulkPresenceRequest>,
) -> Result<Json<Vec<PresenceResponse>>, StatusCode> {
    let mut responses = Vec::new();

    for user_id in body.user_ids {
        if let Some(presence) = state.presence_manager.get_presence(&user_id).await {
            responses.push(PresenceResponse {
                user_id: presence.user_id,
                status: presence.status,
                activity: presence.activity,
                last_seen: presence.last_seen,
            });
        }
    }

    Ok(Json(responses))
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<PresenceState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| presence::handle_websocket(socket, state.presence_manager))
}
