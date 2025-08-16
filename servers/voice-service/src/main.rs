mod rooms;
mod signaling;
mod webrtc_manager;

use axum::{
    extract::{Path, State, WebSocketUpgrade},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use rscord_common::{load_config, AppConfig};
use rooms::VoiceRoomManager;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;


#[derive(Clone)]
struct VoiceState {
    room_manager: Arc<VoiceRoomManager>,
    config: AppConfig,
}

#[derive(Deserialize)]
struct JoinRoomRequest {
    user_id: String,
    channel_id: String,
}

#[derive(Serialize)]
struct JoinRoomResponse {
    room_id: String,
    ice_servers: Vec<IceServer>,
}

#[derive(Serialize)]
struct IceServer {
    urls: Vec<String>,
    username: Option<String>,
    credential: Option<String>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RSCORD").expect("load config");
    let bind_address = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0".to_string());
    let voice_port = std::env::var("VOICE_PORT").unwrap_or_else(|_| "14705".to_string());
    let addr: SocketAddr = format!("{}:{}", bind_address, voice_port).parse().expect("bind addr");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let room_manager = Arc::new(VoiceRoomManager::new());

    let state = VoiceState {
        room_manager,
        config: cfg,
    };

    let app = Router::new()
        .route("/health", get(|| async { "Voice service is healthy" }))
        .route("/voice/join", post(join_room))
        .route("/voice/leave", post(leave_room))
        .route("/voice/ws", get(websocket_handler))
        .route("/voice/ice-servers", get(get_ice_servers))
        .route("/voice/rooms", get(list_rooms))
        .route("/voice/rooms/:room_id/participants", get(get_room_participants))
        .with_state(state)
        .layer(cors);

    info!("Voice service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn join_room(
    State(state): State<VoiceState>,
    Json(body): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, StatusCode> {
    let room_id = state
        .room_manager
        .join_or_create_room(&body.channel_id, &body.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let ice_servers = vec![
        IceServer {
            urls: vec!["stun:stun.l.google.com:19302".to_string()],
            username: None,
            credential: None,
        },
        // Add TURN servers if configured
    ];

    Ok(Json(JoinRoomResponse {
        room_id,
        ice_servers,
    }))
}

#[derive(Deserialize)]
struct LeaveRoomRequest {
    user_id: String,
    room_id: String,
}

async fn leave_room(
    State(state): State<VoiceState>,
    Json(body): Json<LeaveRoomRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    state
        .room_manager
        .leave_room(&body.room_id, &body.user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({"success": true})))
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<VoiceState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| signaling::handle_websocket(socket, state.room_manager))
}

async fn get_ice_servers(State(_state): State<VoiceState>) -> Json<Vec<IceServer>> {
    Json(vec![
        IceServer {
            urls: vec!["stun:stun.l.google.com:19302".to_string()],
            username: None,
            credential: None,
        },
    ])
}

#[derive(Serialize)]
struct RoomInfo {
    room_id: String,
    channel_id: String,
    participant_count: usize,
}

async fn list_rooms(State(state): State<VoiceState>) -> Json<Vec<RoomInfo>> {
    let rooms = state.room_manager.list_rooms().await;
    Json(rooms)
}

async fn get_room_participants(
    State(state): State<VoiceState>,
    Path(room_id): Path<String>,
) -> Result<Json<Vec<String>>, StatusCode> {
    let participants = state
        .room_manager
        .get_room_participants(&room_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(participants))
}
