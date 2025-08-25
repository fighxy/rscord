use axum::{
    extract::{ws::WebSocket, Path, Query, State, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json},
    routing::{delete, get, post, put},
    Router,
};
use axum_prometheus::PrometheusMetricLayer;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};

// Modules
pub mod redis_manager;
pub mod enhanced_livekit_client;
pub mod integrated_livekit_client;

use redis_manager::{RedisManager, RedisError, RoomData, ParticipantData, UserSession, VoiceServiceStats};
use integrated_livekit_client::{IntegratedLiveKitClient, LiveKitError, VoiceRoomConfig, VoicePermissions, LiveKitConfig, IceServerConfig, TurnServerConfig};

// State management
#[derive(Clone)]
pub struct VoiceServiceState {
    pub redis: RedisManager,
    pub livekit: Arc<EnhancedLiveKitClient>,
    pub websocket_broadcast: broadcast::Sender<VoiceEvent>,
    pub rate_limiter: Arc<RwLock<HashMap<String, RateLimitInfo>>>,
    pub metrics: Arc<VoiceMetrics>,
}

// Error types
#[derive(Debug, thiserror::Error)]
pub enum VoiceServiceError {
    #[error("Redis error: {0}")]
    Redis(#[from] RedisError),
    #[error("LiveKit error: {0}")]
    LiveKit(#[from] LiveKitError),
    #[error("Invalid request: {0}")]
    BadRequest(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Rate limit exceeded")]
    RateLimit,
    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for VoiceServiceError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            VoiceServiceError::Redis(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            VoiceServiceError::LiveKit(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            VoiceServiceError::BadRequest(e) => (StatusCode::BAD_REQUEST, e),
            VoiceServiceError::NotFound(e) => (StatusCode::NOT_FOUND, e),
            VoiceServiceError::Unauthorized(e) => (StatusCode::UNAUTHORIZED, e),
            VoiceServiceError::RateLimit => (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded".to_string()),
            VoiceServiceError::Internal(e) => (StatusCode::INTERNAL_SERVER_ERROR, e),
        };

        Json(serde_json::json!({
            "error": message,
            "status": status.as_u16()
        })).into_response()
    }
}

// Rate limiting
#[derive(Debug, Clone)]
pub struct RateLimitInfo {
    pub requests: u32,
    pub window_start: chrono::DateTime<chrono::Utc>,
    pub max_requests: u32,
    pub window_duration_secs: u64,
}

// Metrics
#[derive(Debug)]
pub struct VoiceMetrics {
    pub active_rooms: prometheus::IntGauge,
    pub active_participants: prometheus::IntGauge,
    pub total_requests: prometheus::IntCounter,
    pub redis_operations: prometheus::IntCounterVec,
    pub livekit_operations: prometheus::IntCounterVec,
}

impl VoiceMetrics {
    pub fn new() -> Result<Arc<Self>, Box<dyn std::error::Error>> {
        let registry = prometheus::Registry::new();
        
        let active_rooms = prometheus::IntGauge::new(
            "voice_active_rooms",
            "Number of active voice rooms"
        )?;
        
        let active_participants = prometheus::IntGauge::new(
            "voice_active_participants",
            "Number of active voice participants"
        )?;
        
        let total_requests = prometheus::IntCounter::new(
            "voice_total_requests",
            "Total number of voice service requests"
        )?;
        
        let redis_operations = prometheus::IntCounterVec::new(
            prometheus::opts!("voice_redis_operations", "Redis operations counter"),
            &["operation", "result"]
        )?;
        
        let livekit_operations = prometheus::IntCounterVec::new(
            prometheus::opts!("voice_livekit_operations", "LiveKit operations counter"),
            &["operation", "result"]
        )?;

        registry.register(Box::new(active_rooms.clone()))?;
        registry.register(Box::new(active_participants.clone()))?;
        registry.register(Box::new(total_requests.clone()))?;
        registry.register(Box::new(redis_operations.clone()))?;
        registry.register(Box::new(livekit_operations.clone()))?;

        Ok(Arc::new(Self {
            active_rooms,
            active_participants,
            total_requests,
            redis_operations,
            livekit_operations,
        }))
    }
}

// API Request/Response types
#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    pub channel_id: String,
    pub guild_id: Option<String>,
    pub name: Option<String>,
    pub max_participants: Option<u32>,
    pub enable_video: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct JoinRoomRequest {
    pub room_id: String,
    pub user_id: String,
    pub username: String,
    pub is_admin: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct JoinRoomResponse {
    pub access_token: String,
    pub server_url: String,
    pub room_name: String,
    pub ice_servers: Vec<IceServerConfig>,
    pub turn_servers: Vec<TurnServerConfig>,
}

#[derive(Debug, Serialize, Clone)]
pub struct IceServerConfig {
    pub urls: Vec<String>,
    pub username: Option<String>,
    pub credential: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TurnServerConfig {
    pub urls: Vec<String>,
    pub username: String,
    pub credential: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateParticipantRequest {
    pub is_muted: Option<bool>,
    pub is_deafened: Option<bool>,
    pub is_streaming: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RoomListQuery {
    pub guild_id: Option<String>,
    pub active_only: Option<bool>,
    pub limit: Option<usize>,
}

// WebSocket events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum VoiceEvent {
    ParticipantJoined {
        room_id: String,
        participant: ParticipantData,
    },
    ParticipantLeft {
        room_id: String,
        user_id: String,
    },
    ParticipantUpdated {
        room_id: String,
        user_id: String,
        is_muted: bool,
        is_deafened: bool,
        is_streaming: bool,
    },
    RoomCreated {
        room_id: String,
        room: RoomData,
    },
    RoomDeleted {
        room_id: String,
    },
    Error {
        message: String,
        code: Option<u16>,
    },
}

impl VoiceServiceState {
    pub async fn new(
        redis_url: String,
        livekit_url: String,
        livekit_api_key: String,
        livekit_api_secret: String,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        // Initialize Redis
        let redis = RedisManager::new(&redis_url).await?;
        
        // Initialize LiveKit client
        let livekit = Arc::new(EnhancedLiveKitClient::new(
            livekit_url,
            livekit_api_key,
            livekit_api_secret,
        )?);
        
        // Create broadcast channel for WebSocket events
        let (websocket_broadcast, _) = broadcast::channel(1000);
        
        // Initialize metrics
        let metrics = VoiceMetrics::new()?;
        
        Ok(Self {
            redis,
            livekit,
            websocket_broadcast,
            rate_limiter: Arc::new(RwLock::new(HashMap::new())),
            metrics,
        })
    }

    async fn check_rate_limit(&self, user_id: &str) -> Result<(), VoiceServiceError> {
        let mut limiter = self.rate_limiter.write().await;
        let now = chrono::Utc::now();
        
        let rate_info = limiter.entry(user_id.to_string()).or_insert(RateLimitInfo {
            requests: 0,
            window_start: now,
            max_requests: 60, // 60 requests per minute
            window_duration_secs: 60,
        });
        
        // Reset window if expired
        if now.timestamp() - rate_info.window_start.timestamp() > rate_info.window_duration_secs as i64 {
            rate_info.requests = 0;
            rate_info.window_start = now;
        }
        
        if rate_info.requests >= rate_info.max_requests {
            return Err(VoiceServiceError::RateLimit);
        }
        
        rate_info.requests += 1;
        Ok(())
    }

    async fn broadcast_event(&self, event: VoiceEvent) {
        if let Err(e) = self.websocket_broadcast.send(event) {
            warn!("Failed to broadcast WebSocket event: {:?}", e);
        }
    }
}

// Router creation
pub fn create_voice_router(state: VoiceServiceState) -> Router {
    let (prometheus_layer, metric_handle) = PrometheusMetricLayer::pair();
    
    Router::new()
        // Health and metrics
        .route("/health", get(health_check))
        .route("/metrics", get(move || async move { metric_handle.render() }))
        
        // Room management
        .route("/api/voice/rooms", post(create_room))
        .route("/api/voice/rooms", get(list_rooms))
        .route("/api/voice/rooms/:room_id", get(get_room))
        .route("/api/voice/rooms/:room_id", delete(delete_room))
        
        // Participant management
        .route("/api/voice/rooms/:room_id/join", post(join_room))
        .route("/api/voice/rooms/:room_id/leave/:user_id", post(leave_room))
        .route("/api/voice/rooms/:room_id/participants", get(get_room_participants))
        .route("/api/voice/rooms/:room_id/participants/:user_id", put(update_participant))
        
        // User sessions
        .route("/api/voice/sessions/:user_id", get(get_user_session))
        .route("/api/voice/sessions/:user_id", delete(end_user_session))
        
        // WebSocket
        .route("/ws/voice", get(voice_websocket_handler))
        
        // LiveKit webhooks
        .route("/webhook/livekit", post(livekit_webhook_handler))
        
        // ICE/TURN servers
        .route("/api/voice/ice-servers", get(get_ice_servers))
        
        // Statistics
        .route("/api/voice/stats", get(get_service_stats))
        
        .with_state(state)
        .layer(prometheus_layer)
        .layer(CorsLayer::permissive())
}

// Handler functions
async fn health_check(State(state): State<VoiceServiceState>) -> Result<Json<serde_json::Value>, VoiceServiceError> {
    let redis_healthy = match state.redis.get_stats().await {
        Ok(_) => true,
        Err(_) => false,
    };
    
    let livekit_healthy = state.livekit.health_check().await;
    
    Ok(Json(serde_json::json!({
        "status": if redis_healthy && livekit_healthy { "healthy" } else { "degraded" },
        "redis": redis_healthy,
        "livekit": livekit_healthy,
        "timestamp": chrono::Utc::now()
    })))
}

async fn create_room(
    State(state): State<VoiceServiceState>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<RoomData>, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    let room_id = format!("{}_{}", req.guild_id.as_deref().unwrap_or("global"), req.channel_id);
    let room_name = format!("voice_{}", room_id);
    
    // Create room configuration
    let mut config = VoiceRoomConfig::default();
    if let Some(max_participants) = req.max_participants {
        config.max_participants = Some(max_participants);
    }
    if let Some(enable_video) = req.enable_video {
        config.enable_video = enable_video;
    }
    
    // Create room in LiveKit
    state.livekit.create_voice_room(&room_name, config).await?;
    state.metrics.livekit_operations.with_label_values(&["create_room", "success"]).inc();
    
    // Create room data for Redis
    let room_data = RoomData {
        room_id: room_id.clone(),
        channel_id: req.channel_id.clone(),
        guild_id: req.guild_id.clone(),
        participants: Vec::new(),
        max_participants: req.max_participants.unwrap_or(50) as usize,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        is_active: true,
    };
    
    // Store in Redis
    state.redis.set_room(&room_id, &room_data).await?;
    state.metrics.redis_operations.with_label_values(&["set_room", "success"]).inc();
    state.metrics.active_rooms.inc();
    
    // Broadcast event
    state.broadcast_event(VoiceEvent::RoomCreated {
        room_id: room_id.clone(),
        room: room_data.clone(),
    }).await;
    
    info!("Created voice room: {} for channel: {}", room_id, req.channel_id);
    Ok(Json(room_data))
}

async fn list_rooms(
    State(state): State<VoiceServiceState>,
    Query(query): Query<RoomListQuery>,
) -> Result<Json<Vec<RoomData>>, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    let active_rooms = state.redis.get_active_rooms().await?;
    let mut rooms = Vec::new();
    
    for room_id in active_rooms {
        if let Some(room) = state.redis.get_room(&room_id).await? {
            // Filter by guild if specified
            if let Some(ref guild_id) = query.guild_id {
                if room.guild_id.as_ref() != Some(guild_id) {
                    continue;
                }
            }
            
            // Filter by active status if specified
            if query.active_only.unwrap_or(false) && !room.is_active {
                continue;
            }
            
            rooms.push(room);
        }
    }
    
    // Apply limit if specified
    if let Some(limit) = query.limit {
        rooms.truncate(limit);
    }
    
    Ok(Json(rooms))
}

async fn get_room(
    State(state): State<VoiceServiceState>,
    Path(room_id): Path<String>,
) -> Result<Json<RoomData>, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    let room = state.redis.get_room(&room_id).await?
        .ok_or_else(|| VoiceServiceError::NotFound(format!("Room {} not found", room_id)))?;
    
    Ok(Json(room))
}

async fn delete_room(
    State(state): State<VoiceServiceState>,
    Path(room_id): Path<String>,
) -> Result<StatusCode, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    // Check if room exists
    let room = state.redis.get_room(&room_id).await?
        .ok_or_else(|| VoiceServiceError::NotFound(format!("Room {} not found", room_id)))?;
    
    let room_name = format!("voice_{}", room_id);
    
    // Delete from LiveKit
    state.livekit.delete_room(&room_name).await?;
    state.metrics.livekit_operations.with_label_values(&["delete_room", "success"]).inc();
    
    // Delete from Redis
    state.redis.remove_room(&room_id).await?;
    state.metrics.redis_operations.with_label_values(&["remove_room", "success"]).inc();
    state.metrics.active_rooms.dec();
    
    // Broadcast event
    state.broadcast_event(VoiceEvent::RoomDeleted { room_id }).await;
    
    info!("Deleted voice room: {}", room_id);
    Ok(StatusCode::NO_CONTENT)
}

async fn join_room(
    State(state): State<VoiceServiceState>,
    Path(room_id): Path<String>,
    Json(req): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    // Rate limiting
    state.check_rate_limit(&req.user_id).await?;
    
    // Check if room exists
    let room = state.redis.get_room(&room_id).await?
        .ok_or_else(|| VoiceServiceError::NotFound(format!("Room {} not found", room_id)))?;
    
    // Check participant limit
    if room.participants.len() >= room.max_participants {
        return Err(VoiceServiceError::BadRequest("Room is full".to_string()));
    }
    
    let room_name = format!("voice_{}", room_id);
    let identity = format!("{}_{}", req.user_id, chrono::Utc::now().timestamp());
    
    // Generate permissions
    let permissions = VoicePermissions {
        admin: req.is_admin.unwrap_or(false),
        ..Default::default()
    };
    
    // Generate access token
    let access_token = state.livekit.generate_access_token(
        &room_name,
        &identity,
        &req.username,
        permissions,
    )?;
    
    // Create participant data
    let participant = ParticipantData {
        user_id: req.user_id.clone(),
        username: req.username.clone(),
        identity: identity.clone(),
        is_muted: false,
        is_deafened: false,
        is_streaming: false,
        joined_at: chrono::Utc::now(),
        last_activity: chrono::Utc::now(),
    };
    
    // Add participant to room
    state.redis.add_participant(&room_id, &participant).await?;
    state.metrics.active_participants.inc();
    
    // Create user session
    let session = UserSession {
        user_id: req.user_id.clone(),
        room_id: room_id.clone(),
        access_token: access_token.clone(),
        identity: identity.clone(),
        joined_at: chrono::Utc::now(),
        expires_at: chrono::Utc::now() + chrono::Duration::hours(12),
        is_active: true,
    };
    
    state.redis.set_user_session(&req.user_id, &session).await?;
    
    // Broadcast event
    state.broadcast_event(VoiceEvent::ParticipantJoined {
        room_id: room_id.clone(),
        participant: participant.clone(),
    }).await;
    
    info!("User {} joined room {}", req.username, room_id);
    
    Ok(Json(JoinRoomResponse {
        access_token,
        server_url: state.livekit.server_url.clone(),
        room_name,
        ice_servers: get_default_ice_servers(),
        turn_servers: get_default_turn_servers(),
    }))
}

async fn leave_room(
    State(state): State<VoiceServiceState>,
    Path((room_id, user_id)): Path<(String, String)>,
) -> Result<StatusCode, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    // Remove participant from room
    state.redis.remove_participant(&room_id, &user_id).await?;
    state.metrics.active_participants.dec();
    
    // Remove user session
    state.redis.remove_user_session(&user_id).await?;
    
    // Broadcast event
    state.broadcast_event(VoiceEvent::ParticipantLeft {
        room_id: room_id.clone(),
        user_id: user_id.clone(),
    }).await;
    
    info!("User {} left room {}", user_id, room_id);
    Ok(StatusCode::NO_CONTENT)
}

async fn get_room_participants(
    State(state): State<VoiceServiceState>,
    Path(room_id): Path<String>,
) -> Result<Json<Vec<ParticipantData>>, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    let room = state.redis.get_room(&room_id).await?
        .ok_or_else(|| VoiceServiceError::NotFound(format!("Room {} not found", room_id)))?;
    
    Ok(Json(room.participants))
}

async fn update_participant(
    State(state): State<VoiceServiceState>,
    Path((room_id, user_id)): Path<(String, String)>,
    Json(req): Json<UpdateParticipantRequest>,
) -> Result<StatusCode, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    // Update participant state
    state.redis.update_participant_state(
        &room_id,
        &user_id,
        req.is_muted,
        req.is_deafened,
        req.is_streaming,
    ).await?;
    
    // Broadcast event
    if req.is_muted.is_some() || req.is_deafened.is_some() || req.is_streaming.is_some() {
        // Get updated participant data
        if let Some(room) = state.redis.get_room(&room_id).await? {
            if let Some(participant) = room.participants.iter().find(|p| p.user_id == user_id) {
                state.broadcast_event(VoiceEvent::ParticipantUpdated {
                    room_id: room_id.clone(),
                    user_id: user_id.clone(),
                    is_muted: participant.is_muted,
                    is_deafened: participant.is_deafened,
                    is_streaming: participant.is_streaming,
                }).await;
            }
        }
    }
    
    Ok(StatusCode::NO_CONTENT)
}

async fn get_user_session(
    State(state): State<VoiceServiceState>,
    Path(user_id): Path<String>,
) -> Result<Json<UserSession>, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    let session = state.redis.get_user_session(&user_id).await?
        .ok_or_else(|| VoiceServiceError::NotFound(format!("Session for user {} not found", user_id)))?;
    
    Ok(Json(session))
}

async fn end_user_session(
    State(state): State<VoiceServiceState>,
    Path(user_id): Path<String>,
) -> Result<StatusCode, VoiceServiceError> {
    state.metrics.total_requests.inc();
    
    // Get user session to find room
    if let Some(session) = state.redis.get_user_session(&user_id).await? {
        // Remove from room
        let _ = state.redis.remove_participant(&session.room_id, &user_id).await;
        
        // Broadcast leave event
        state.broadcast_event(VoiceEvent::ParticipantLeft {
            room_id: session.room_id,
            user_id: user_id.clone(),
        }).await;
    }
    
    // Remove session
    state.redis.remove_user_session(&user_id).await?;
    
    Ok(StatusCode::NO_CONTENT)
}

async fn voice_websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<VoiceServiceState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_voice_websocket(socket, state))
}

async fn handle_voice_websocket(mut socket: WebSocket, state: VoiceServiceState) {
    info!("New voice WebSocket connection established");
    
    let mut event_receiver = state.websocket_broadcast.subscribe();
    
    loop {
        tokio::select! {
            // Handle incoming messages from client
            msg = socket.recv() => {
                match msg {
                    Some(Ok(axum::extract::ws::Message::Text(_text))) => {
                        // Handle client messages if needed
                    }
                    Some(Ok(axum::extract::ws::Message::Close(_))) => {
                        info!("WebSocket connection closed by client");
                        break;
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                    None => break,
                    _ => {}
                }
            }
            
            // Handle broadcast events
            event = event_receiver.recv() => {
                match event {
                    Ok(voice_event) => {
                        let event_json = match serde_json::to_string(&voice_event) {
                            Ok(json) => json,
                            Err(e) => {
                                error!("Failed to serialize voice event: {}", e);
                                continue;
                            }
                        };
                        
                        if socket.send(axum::extract::ws::Message::Text(event_json)).await.is_err() {
                            info!("Failed to send WebSocket message, connection probably closed");
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        info!("Broadcast channel closed");
                        break;
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        warn!("WebSocket consumer lagged behind");
                        // Continue processing
                    }
                }
            }
        }
    }
    
    info!("Voice WebSocket connection terminated");
}

async fn livekit_webhook_handler(
    State(state): State<VoiceServiceState>,
    headers: HeaderMap,
    body: String,
) -> Result<StatusCode, VoiceServiceError> {
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    
    match state.livekit.process_webhook(&body, auth_header) {
        Ok(Some(event)) => {
            info!("Processed LiveKit webhook event: {:?}", event);
            // Handle specific webhook events here if needed
            Ok(StatusCode::OK)
        }
        Ok(None) => Ok(StatusCode::OK),
        Err(e) => {
            error!("Failed to process webhook: {:?}", e);
            Err(VoiceServiceError::Unauthorized("Invalid webhook signature".to_string()))
        }
    }
}

async fn get_ice_servers() -> Json<Vec<IceServerConfig>> {
    Json(get_default_ice_servers())
}

async fn get_service_stats(State(state): State<VoiceServiceState>) -> Result<Json<VoiceServiceStats>, VoiceServiceError> {
    let stats = state.redis.get_stats().await?;
    Ok(Json(stats))
}

// Helper functions
fn get_default_ice_servers() -> Vec<IceServerConfig> {
    vec![
        IceServerConfig {
            urls: vec!["stun:stun.l.google.com:19302".to_string()],
            username: None,
            credential: None,
        },
        IceServerConfig {
            urls: vec!["stun:stun1.l.google.com:19302".to_string()],
            username: None,
            credential: None,
        },
    ]
}

fn get_default_turn_servers() -> Vec<TurnServerConfig> {
    vec![
        // Add your TURN servers here
        // TurnServerConfig {
        //     urls: vec!["turn:5.35.83.143:3478".to_string()],
        //     username: "radiate".to_string(),
        //     credential: "your-turn-password".to_string(),
        // },
    ]
}

// Background tasks
pub async fn start_background_tasks(state: VoiceServiceState) {
    let cleanup_state = state.clone();
    
    // Cleanup task
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
        
        loop {
            interval.tick().await;
            
            if let Err(e) = cleanup_state.redis.cleanup_expired_data().await {
                error!("Background cleanup failed: {}", e);
            }
            
            if let Err(e) = cleanup_state.livekit.cleanup_inactive_rooms(2).await {
                error!("LiveKit cleanup failed: {}", e);
            }
        }
    });
    
    // Metrics update task
    let metrics_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60)); // 1 minute
        
        loop {
            interval.tick().await;
            
            if let Ok(stats) = metrics_state.redis.get_stats().await {
                metrics_state.metrics.active_rooms.set(stats.active_rooms as i64);
                metrics_state.metrics.active_participants.set(stats.total_participants as i64);
            }
        }
    });
}
