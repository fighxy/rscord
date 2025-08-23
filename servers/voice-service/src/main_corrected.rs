mod types;
mod livekit_client;
mod room_manager;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use livekit_client::{LiveKitClient, VoiceRoomConfig};
use mongodb::Client as MongoClient;
use room_manager::VoiceRoomManager;
use radiate_common::{load_config, AppConfig, EnhancedJwtValidator};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

#[derive(Clone)]
struct VoiceServiceState {
    room_manager: Arc<VoiceRoomManager>,
    livekit_client: Arc<LiveKitClient>,
    config: AppConfig,
    jwt_validator: Arc<EnhancedJwtValidator>,
}

#[derive(Debug, Deserialize)]
struct CreateVoiceRoomRequest {
    pub name: String,
    pub guild_id: String,
    pub channel_id: String,
    pub max_participants: Option<u32>,
    pub enable_recording: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct JoinVoiceRoomRequest {
    pub user_id: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
struct JoinVoiceRoomResponse {
    pub access_token: String,
    pub livekit_url: String,
    pub room_name: String,
    pub session_id: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    pub status: String,
    pub version: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Load configuration
    let cfg: AppConfig = load_config("RADIATE").expect("Failed to load config");
    let bind_address = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0".to_string());
    let voice_port = std::env::var("VOICE_PORT").unwrap_or_else(|_| "14705".to_string());
    let addr: SocketAddr = format!("{}:{}", bind_address, voice_port)
        .parse()
        .expect("Invalid bind address");

    // Initialize LiveKit client
    let livekit_host = std::env::var("LIVEKIT_HOST").unwrap_or_else(|_| "http://localhost:7880".to_string());
    let livekit_api_key = std::env::var("LIVEKIT_API_KEY").unwrap_or_else(|_| "APIKey".to_string());
    let livekit_api_secret = std::env::var("LIVEKIT_API_SECRET").unwrap_or_else(|_| "APISecret".to_string());
    
    let livekit_client = Arc::new(
        LiveKitClient::new(livekit_host.clone(), livekit_api_key, livekit_api_secret)
            .expect("Failed to create LiveKit client")
    );

    // Initialize MongoDB
    let mongo_uri = cfg.mongodb_uri.clone()
        .unwrap_or_else(|| "mongodb://localhost:27017".to_string());
    let mongo_client = MongoClient::with_uri_str(mongo_uri)
        .await
        .expect("Failed to connect to MongoDB");

    // Initialize JWT validator
    let jwt_validator = Arc::new(EnhancedJwtValidator::new(
        cfg.jwt_secret.clone().unwrap_or_else(|| "secret".to_string()),
        cfg.jwt_issuer.clone(),
        cfg.jwt_audience.clone(),
    ));

    // Initialize room manager
    let room_manager = Arc::new(VoiceRoomManager::new(livekit_client.clone(), mongo_client));

    let state = VoiceServiceState {
        room_manager,
        livekit_client,
        config: cfg,
        jwt_validator,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/voice/rooms", post(create_voice_room))
        .route("/api/voice/rooms/:room_id/join", post(join_voice_room))
        .route("/api/voice/rooms/:room_id/leave", post(leave_voice_room))
        .route("/api/voice/rooms/:room_id", delete(delete_voice_room))
        .with_state(state)
        .layer(cors);

    info!("🚀 Voice service listening on {}", addr);
    info!("🎛️ LiveKit server: {}", livekit_host);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: "1.0.0".to_string(),
    })
}

async fn create_voice_room(
    State(state): State<VoiceServiceState>,
    Json(request): Json<CreateVoiceRoomRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if request.name.is_empty() || request.guild_id.is_empty() || request.channel_id.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let config = VoiceRoomConfig {
        max_participants: request.max_participants.unwrap_or(50),
        enable_recording: request.enable_recording.unwrap_or(false),
        ..Default::default()
    };

    match state.room_manager.create_voice_room(
        &request.guild_id,
        &request.channel_id,
        &request.name,
        "system", // TODO: Extract from JWT
        Some(config),
    ).await {
        Ok(room) => Ok(Json(serde_json::json!(room))),
        Err(e) => {
            error!("Failed to create voice room: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn join_voice_room(
    State(state): State<VoiceServiceState>,
    Path(room_id): Path<String>,
    Json(request): Json<JoinVoiceRoomRequest>,
) -> Result<Json<JoinVoiceRoomResponse>, StatusCode> {
    if request.user_id.is_empty() || request.username.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    match state.room_manager.join_voice_room(&room_id, &request.user_id, &request.username).await {
        Ok(session) => {
            let livekit_url = std::env::var("LIVEKIT_WS_URL")
                .unwrap_or_else(|_| "ws://localhost:7880".to_string());

            Ok(Json(JoinVoiceRoomResponse {
                access_token: session.access_token,
                livekit_url,
                room_name: session.livekit_room_name,
                session_id: session.id,
            }))
        }
        Err(e) => {
            error!("Failed to join voice room: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn leave_voice_room(
    State(state): State<VoiceServiceState>,
    Path(room_id): Path<String>,
    Json(request): Json<serde_json::Value>,
) -> Result<StatusCode, StatusCode> {
    let user_id = request.get("user_id")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;

    match state.room_manager.leave_voice_room(&room_id, user_id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            error!("Failed to leave voice room: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn delete_voice_room(
    State(_state): State<VoiceServiceState>,
    Path(_room_id): Path<String>,
) -> StatusCode {
    // TODO: Implement room deletion
    StatusCode::NO_CONTENT
}