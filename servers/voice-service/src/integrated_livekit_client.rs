use livekit_api::{
    access_token::{AccessToken, VideoGrants},
    services::room::{CreateRoomOptions, DeleteRoomRequest, ListRoomsRequest, RoomClient},
    webhook::{WebhookEvent, WebhookReceiver},
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use thiserror::Error;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::redis_manager::RedisManager;

#[derive(Error, Debug)]
pub enum LiveKitError {
    #[error("LiveKit API error: {0}")]
    Api(String),
    #[error("Token generation error: {0}")]
    Token(String),
    #[error("Room creation failed: {0}")]
    RoomCreation(String),
    #[error("Room not found: {0}")]
    RoomNotFound(String),
    #[error("Invalid configuration: {0}")]
    Config(String),
    #[error("Webhook verification failed: {0}")]
    WebhookVerification(String),
    #[error("Redis error: {0}")]
    Redis(#[from] crate::redis_manager::RedisError),
}

#[derive(Debug, Clone)]
pub struct IntegratedLiveKitClient {
    pub client: Arc<RoomClient>,
    pub webhook_receiver: Arc<WebhookReceiver>,
    pub redis: RedisManager,
    pub config: LiveKitConfig,
    pub room_cache: Arc<RwLock<HashMap<String, CachedRoomInfo>>>,
    pub metrics: Arc<LiveKitMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveKitConfig {
    pub server_url: String,
    pub api_key: String,
    pub api_secret: String,
    pub external_ip: String,
    pub ice_servers: Vec<IceServerConfig>,
    pub turn_servers: Vec<TurnServerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedRoomInfo {
    pub name: String,
    pub sid: String,
    pub num_participants: u32,
    pub max_participants: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
    pub metadata: Option<RoomMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomMetadata {
    pub channel_id: String,
    pub guild_id: Option<String>,
    pub room_type: String,
    pub voice_config: VoiceRoomConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceRoomConfig {
    pub max_participants: u32,
    pub enable_video: bool,
    pub enable_screen_share: bool,
    pub audio_quality: AudioQuality,
    pub auto_gain_control: bool,
    pub noise_suppression: bool,
    pub echo_cancellation: bool,
}

impl Default for VoiceRoomConfig {
    fn default() -> Self {
        Self {
            max_participants: 50,
            enable_video: false,
            enable_screen_share: true,
            audio_quality: AudioQuality::High,
            auto_gain_control: true,
            noise_suppression: true,
            echo_cancellation: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AudioQuality {
    Low,    // 32kbps
    Medium, // 48kbps  
    High,   // 64kbps
    Ultra,  // 128kbps
}

impl AudioQuality {
    pub fn bitrate(&self) -> u32 {
        match self {
            AudioQuality::Low => 32000,
            AudioQuality::Medium => 48000,
            AudioQuality::High => 64000,
            AudioQuality::Ultra => 128000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePermissions {
    pub can_publish_audio: bool,
    pub can_publish_video: bool,
    pub can_publish_data: bool,
    pub can_subscribe: bool,
    pub can_update_own_metadata: bool,
    pub admin: bool,
    pub recorder: bool,
    pub mute_others: bool,
    pub kick_participants: bool,
}

impl Default for VoicePermissions {
    fn default() -> Self {
        Self {
            can_publish_audio: true,
            can_publish_video: false,
            can_publish_data: true,
            can_subscribe: true,
            can_update_own_metadata: true,
            admin: false,
            recorder: false,
            mute_others: false,
            kick_participants: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceServerConfig {
    pub urls: Vec<String>,
    pub username: Option<String>,
    pub credential: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnServerConfig {
    pub urls: Vec<String>,
    pub username: String,
    pub credential: String,
}

// Metrics for LiveKit integration
#[derive(Debug)]
pub struct LiveKitMetrics {
    pub rooms_created: prometheus::IntCounter,
    pub rooms_deleted: prometheus::IntCounter,
    pub participants_joined: prometheus::IntCounter,
    pub participants_left: prometheus::IntCounter,
    pub tokens_generated: prometheus::IntCounter,
    pub webhook_events_received: prometheus::IntCounterVec,
    pub api_requests_duration: prometheus::HistogramVec,
}

impl LiveKitMetrics {
    pub fn new() -> Result<Arc<Self>, Box<dyn std::error::Error>> {
        let rooms_created = prometheus::IntCounter::new(
            "livekit_rooms_created_total",
            "Total number of LiveKit rooms created"
        )?;

        let rooms_deleted = prometheus::IntCounter::new(
            "livekit_rooms_deleted_total", 
            "Total number of LiveKit rooms deleted"
        )?;

        let participants_joined = prometheus::IntCounter::new(
            "livekit_participants_joined_total",
            "Total number of participants joined"
        )?;

        let participants_left = prometheus::IntCounter::new(
            "livekit_participants_left_total",
            "Total number of participants left"
        )?;

        let tokens_generated = prometheus::IntCounter::new(
            "livekit_tokens_generated_total",
            "Total number of access tokens generated"
        )?;

        let webhook_events_received = prometheus::IntCounterVec::new(
            prometheus::opts!("livekit_webhook_events_total", "LiveKit webhook events received"),
            &["event_type", "status"]
        )?;

        let api_requests_duration = prometheus::HistogramVec::new(
            prometheus::HistogramOpts::new(
                "livekit_api_requests_duration_seconds",
                "Duration of LiveKit API requests"
            ),
            &["method", "status"]
        )?;

        Ok(Arc::new(Self {
            rooms_created,
            rooms_deleted,
            participants_joined,
            participants_left,
            tokens_generated,
            webhook_events_received,
            api_requests_duration,
        }))
    }
}

impl IntegratedLiveKitClient {
    pub async fn new(
        config: LiveKitConfig,
        redis: RedisManager,
    ) -> Result<Self, LiveKitError> {
        // Validate configuration
        if config.api_key.is_empty() || config.api_secret.is_empty() {
            return Err(LiveKitError::Config("API key and secret are required".to_string()));
        }

        if config.server_url.is_empty() {
            return Err(LiveKitError::Config("Server URL is required".to_string()));
        }

        let client = RoomClient::new(&config.server_url, &config.api_key, &config.api_secret)
            .map_err(|e| LiveKitError::Api(e.to_string()))?;
        
        let webhook_receiver = WebhookReceiver::new(&config.api_key, &config.api_secret);
        let metrics = LiveKitMetrics::new().map_err(|e| LiveKitError::Config(e.to_string()))?;

        info!("Initialized LiveKit client for server: {}", config.server_url);

        Ok(Self {
            client: Arc::new(client),
            webhook_receiver: Arc::new(webhook_receiver),
            redis,
            config,
            room_cache: Arc::new(RwLock::new(HashMap::new())),
            metrics,
        })
    }

    /// Create a voice room with full configuration and Redis integration
    pub async fn create_voice_room(
        &self,
        room_id: &str,
        channel_id: &str,
        guild_id: Option<&str>,
        config: Option<VoiceRoomConfig>,
    ) -> Result<CachedRoomInfo, LiveKitError> {
        let timer = self.metrics.api_requests_duration.with_label_values(&["create_room", "pending"]).start_timer();
        
        let room_name = format!("voice_{}_{}", 
            guild_id.unwrap_or("global"), 
            channel_id
        );
        
        let voice_config = config.unwrap_or_default();
        
        let metadata = RoomMetadata {
            channel_id: channel_id.to_string(),
            guild_id: guild_id.map(|s| s.to_string()),
            room_type: "voice_chat".to_string(),
            voice_config: voice_config.clone(),
        };

        let options = CreateRoomOptions {
            name: room_name.clone(),
            empty_timeout: Some(300), // 5 minutes
            departure_timeout: Some(60), // 1 minute
            max_participants: Some(voice_config.max_participants),
            node_id: None,
            metadata: Some(serde_json::to_string(&metadata).unwrap_or_default()),
        };

        match self.client.create_room(&room_name, options).await {
            Ok(room) => {
                timer.stop_and_record();
                self.metrics.rooms_created.inc();
                
                let room_info = CachedRoomInfo {
                    name: room.name.clone(),
                    sid: room.sid.clone(),
                    num_participants: room.num_participants,
                    max_participants: room.max_participants,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    is_active: true,
                    metadata: Some(metadata),
                };

                // Cache room info
                self.room_cache.write().await.insert(room_name.clone(), room_info.clone());
                
                // Store in Redis with mapping
                self.redis.set_room_livekit_mapping(room_id, &room_name, &room.sid).await?;
                
                // Publish room created event
                self.redis.publish_event("livekit:room:created", &serde_json::to_string(&room_info)?).await?;
                
                info!("Created LiveKit room: {} (sid: {}) for channel: {}", 
                      room_name, room.sid, channel_id);
                      
                Ok(room_info)
            },
            Err(e) => {
                timer.stop_and_record();
                
                // Check if room already exists
                if let Ok(rooms) = self.client.list_rooms(ListRoomsRequest { 
                    names: vec![room_name.clone()]
                }).await {
                    if let Some(room) = rooms.into_iter().next() {
                        let room_info = CachedRoomInfo {
                            name: room.name.clone(),
                            sid: room.sid.clone(),
                            num_participants: room.num_participants,
                            max_participants: room.max_participants,
                            created_at: chrono::DateTime::from_timestamp(room.creation_time as i64, 0)
                                .unwrap_or_else(chrono::Utc::now),
                            updated_at: chrono::Utc::now(),
                            is_active: room.num_participants > 0,
                            metadata: Some(metadata),
                        };
                        
                        self.room_cache.write().await.insert(room_name, room_info.clone());
                        warn!("Room already exists, returning existing info");
                        return Ok(room_info);
                    }
                }
                
                error!("Failed to create LiveKit room {}: {}", room_name, e);
                Err(LiveKitError::RoomCreation(format!("Failed to create room: {}", e)))
            }
        }
    }

    /// Generate access token with enhanced permissions and validation
    pub fn generate_access_token(
        &self,
        room_name: &str,
        user_id: &str,
        username: &str,
        permissions: VoicePermissions,
    ) -> Result<String, LiveKitError> {
        let grants = VideoGrants {
            room: Some(room_name.to_string()),
            room_join: Some(true),
            can_publish: Some(permissions.can_publish_audio || permissions.can_publish_video),
            can_subscribe: Some(permissions.can_subscribe),
            can_publish_data: Some(permissions.can_publish_data),
            can_update_own_metadata: Some(permissions.can_update_own_metadata),
            admin: Some(permissions.admin),
            hidden: Some(false),
            recorder: Some(permissions.recorder),
            ..Default::default()
        };

        let mut token = AccessToken::with_api_key(&self.config.api_key, &self.config.api_secret)
            .with_identity(user_id)
            .with_name(username)
            .with_ttl(Duration::from_hours(12)); // 12 hour token

        token.add_grant(&grants);

        match token.to_jwt() {
            Ok(jwt) => {
                self.metrics.tokens_generated.inc();
                info!("Generated access token for user {} in room {}", username, room_name);
                Ok(jwt)
            }
            Err(e) => {
                error!("Failed to generate access token for {}: {}", user_id, e);
                Err(LiveKitError::Token(format!("Failed to generate token: {}", e)))
            }
        }
    }

    /// Process LiveKit webhooks with full integration
    pub async fn process_webhook(
        &self,
        body: &str,
        auth_header: &str,
    ) -> Result<Option<ProcessedWebhookEvent>, LiveKitError> {
        match self.webhook_receiver.verify(body, auth_header) {
            Ok(event) => {
                self.metrics.webhook_events_received
                    .with_label_values(&[&self.get_event_type(&event), "success"])
                    .inc();
                
                info!("Received LiveKit webhook: {:?}", event);
                
                let processed_event = self.handle_webhook_event(event).await?;
                Ok(Some(processed_event))
            }
            Err(e) => {
                self.metrics.webhook_events_received
                    .with_label_values(&["unknown", "error"])
                    .inc();
                    
                error!("Failed to verify LiveKit webhook: {}", e);
                Err(LiveKitError::WebhookVerification(format!("Webhook verification failed: {}", e)))
            }
        }
    }

    /// Handle different types of webhook events
    async fn handle_webhook_event(&self, event: WebhookEvent) -> Result<ProcessedWebhookEvent, LiveKitError> {
        match &event {
            WebhookEvent::RoomStarted { room } => {
                self.handle_room_started(room).await?;
            }
            WebhookEvent::RoomFinished { room } => {
                self.handle_room_finished(room).await?;
            }
            WebhookEvent::ParticipantJoined { room, participant } => {
                self.handle_participant_joined(room, participant).await?;
                self.metrics.participants_joined.inc();
            }
            WebhookEvent::ParticipantLeft { room, participant } => {
                self.handle_participant_left(room, participant).await?;
                self.metrics.participants_left.inc();
            }
            WebhookEvent::TrackPublished { room, participant, track } => {
                self.handle_track_published(room, participant, track).await?;
            }
            WebhookEvent::TrackUnpublished { room, participant, track } => {
                self.handle_track_unpublished(room, participant, track).await?;
            }
            _ => {
                info!("Received unhandled webhook event type");
            }
        }
        
        Ok(ProcessedWebhookEvent::from(event))
    }

    /// Get ICE servers configuration for clients
    pub fn get_ice_servers(&self) -> Vec<IceServerConfig> {
        let mut ice_servers = self.config.ice_servers.clone();
        
        // Add default STUN servers if none configured
        if ice_servers.is_empty() {
            ice_servers.extend(vec![
                IceServerConfig {
                    urls: vec!["stun:stun.l.google.com:19302".to_string()],
                    username: None,
                    credential: None,
                },
                IceServerConfig {
                    urls: vec![format!("stun:{}:3478", self.config.external_ip)],
                    username: None,
                    credential: None,
                },
            ]);
        }
        
        ice_servers
    }

    /// Get TURN servers configuration for clients
    pub fn get_turn_servers(&self) -> Vec<TurnServerConfig> {
        self.config.turn_servers.clone()
    }

    /// Health check for LiveKit server with detailed status
    pub async fn health_check(&self) -> bool {
        match self.client.list_rooms(ListRoomsRequest { names: vec![] }).await {
            Ok(_) => {
                info!("LiveKit health check passed");
                true
            }
            Err(e) => {
                error!("LiveKit health check failed: {}", e);
                false
            }
        }
    }

    /// Delete room with cleanup
    pub async fn delete_room(&self, room_name: &str) -> Result<(), LiveKitError> {
        let request = DeleteRoomRequest {
            room: room_name.to_string(),
        };

        match self.client.delete_room(request).await {
            Ok(_) => {
                self.metrics.rooms_deleted.inc();
                
                // Remove from cache
                self.room_cache.write().await.remove(room_name);
                
                // Publish room deleted event
                self.redis.publish_event("livekit:room:deleted", 
                    &serde_json::json!({"room_name": room_name}).to_string()
                ).await?;
                
                info!("Deleted LiveKit room: {}", room_name);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to delete room {} (might already be deleted): {}", room_name, e);
                // Remove from cache anyway
                self.room_cache.write().await.remove(room_name);
                Ok(()) // Not a critical error
            }
        }
    }

    // Helper method to get event type string
    fn get_event_type(&self, event: &WebhookEvent) -> String {
        match event {
            WebhookEvent::RoomStarted { .. } => "room_started".to_string(),
            WebhookEvent::RoomFinished { .. } => "room_finished".to_string(),
            WebhookEvent::ParticipantJoined { .. } => "participant_joined".to_string(),
            WebhookEvent::ParticipantLeft { .. } => "participant_left".to_string(),
            WebhookEvent::TrackPublished { .. } => "track_published".to_string(),
            WebhookEvent::TrackUnpublished { .. } => "track_unpublished".to_string(),
            _ => "unknown".to_string(),
        }
    }

    // Webhook event handlers
    async fn handle_room_started(&self, room: &livekit_api::Room) -> Result<(), LiveKitError> {
        info!("LiveKit room started: {} ({})", room.name, room.sid);
        
        // Update cache
        if let Some(mut cached_room) = self.room_cache.write().await.get_mut(&room.name) {
            cached_room.is_active = true;
            cached_room.updated_at = chrono::Utc::now();
        }
        
        // Publish event
        self.redis.publish_event("livekit:room:started", &serde_json::to_string(room)?).await?;
        Ok(())
    }

    async fn handle_room_finished(&self, room: &livekit_api::Room) -> Result<(), LiveKitError> {
        info!("LiveKit room finished: {} ({})", room.name, room.sid);
        
        // Update cache
        if let Some(mut cached_room) = self.room_cache.write().await.get_mut(&room.name) {
            cached_room.is_active = false;
            cached_room.updated_at = chrono::Utc::now();
        }
        
        // Publish event
        self.redis.publish_event("livekit:room:finished", &serde_json::to_string(room)?).await?;
        Ok(())
    }

    async fn handle_participant_joined(&self, room: &livekit_api::Room, participant: &livekit_api::Participant) -> Result<(), LiveKitError> {
        info!("Participant joined: {} in room {}", participant.identity, room.name);
        
        // Update participant count in cache
        if let Some(mut cached_room) = self.room_cache.write().await.get_mut(&room.name) {
            cached_room.num_participants += 1;
            cached_room.updated_at = chrono::Utc::now();
        }
        
        let event = serde_json::json!({
            "room": room,
            "participant": participant,
            "event_type": "participant_joined"
        });
        
        self.redis.publish_event("livekit:participant:joined", &event.to_string()).await?;
        Ok(())
    }

    async fn handle_participant_left(&self, room: &livekit_api::Room, participant: &livekit_api::Participant) -> Result<(), LiveKitError> {
        info!("Participant left: {} from room {}", participant.identity, room.name);
        
        // Update participant count in cache
        if let Some(mut cached_room) = self.room_cache.write().await.get_mut(&room.name) {
            cached_room.num_participants = cached_room.num_participants.saturating_sub(1);
            cached_room.updated_at = chrono::Utc::now();
        }
        
        let event = serde_json::json!({
            "room": room,
            "participant": participant,
            "event_type": "participant_left"
        });
        
        self.redis.publish_event("livekit:participant:left", &event.to_string()).await?;
        Ok(())
    }

    async fn handle_track_published(&self, room: &livekit_api::Room, participant: &livekit_api::Participant, track: &livekit_api::TrackInfo) -> Result<(), LiveKitError> {
        info!("Track published: {} by {} in room {}", track.name, participant.identity, room.name);
        
        let event = serde_json::json!({
            "room": room,
            "participant": participant,
            "track": track,
            "event_type": "track_published"
        });
        
        self.redis.publish_event("livekit:track:published", &event.to_string()).await?;
        Ok(())
    }

    async fn handle_track_unpublished(&self, room: &livekit_api::Room, participant: &livekit_api::Participant, track: &livekit_api::TrackInfo) -> Result<(), LiveKitError> {
        info!("Track unpublished: {} by {} in room {}", track.name, participant.identity, room.name);
        
        let event = serde_json::json!({
            "room": room,
            "participant": participant,
            "track": track,
            "event_type": "track_unpublished"
        });
        
        self.redis.publish_event("livekit:track:unpublished", &event.to_string()).await?;
        Ok(())
    }

    /// Get comprehensive room statistics
    pub async fn get_room_stats(&self, room_name: &str) -> Result<RoomStats, LiveKitError> {
        if let Some(cached_room) = self.room_cache.read().await.get(room_name) {
            Ok(RoomStats {
                name: cached_room.name.clone(),
                sid: cached_room.sid.clone(),
                num_participants: cached_room.num_participants,
                max_participants: cached_room.max_participants,
                is_active: cached_room.is_active,
                created_at: cached_room.created_at,
                updated_at: cached_room.updated_at,
                uptime_seconds: (chrono::Utc::now() - cached_room.created_at).num_seconds() as u64,
            })
        } else {
            Err(LiveKitError::RoomNotFound(format!("Room {} not found in cache", room_name)))
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessedWebhookEvent {
    pub event_type: String,
    pub room_name: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub data: serde_json::Value,
}

impl From<WebhookEvent> for ProcessedWebhookEvent {
    fn from(event: WebhookEvent) -> Self {
        match event {
            WebhookEvent::RoomStarted { room } => ProcessedWebhookEvent {
                event_type: "room_started".to_string(),
                room_name: room.name,
                timestamp: chrono::Utc::now(),
                data: serde_json::to_value(&room).unwrap_or_default(),
            },
            WebhookEvent::RoomFinished { room } => ProcessedWebhookEvent {
                event_type: "room_finished".to_string(),
                room_name: room.name,
                timestamp: chrono::Utc::now(),
                data: serde_json::to_value(&room).unwrap_or_default(),
            },
            WebhookEvent::ParticipantJoined { room, participant } => ProcessedWebhookEvent {
                event_type: "participant_joined".to_string(), 
                room_name: room.name,
                timestamp: chrono::Utc::now(),
                data: serde_json::json!({ "room": room, "participant": participant }),
            },
            WebhookEvent::ParticipantLeft { room, participant } => ProcessedWebhookEvent {
                event_type: "participant_left".to_string(),
                room_name: room.name,
                timestamp: chrono::Utc::now(),
                data: serde_json::json!({ "room": room, "participant": participant }),
            },
            WebhookEvent::TrackPublished { room, participant, track } => ProcessedWebhookEvent {
                event_type: "track_published".to_string(),
                room_name: room.name,
                timestamp: chrono::Utc::now(),
                data: serde_json::json!({ "room": room, "participant": participant, "track": track }),
            },
            WebhookEvent::TrackUnpublished { room, participant, track } => ProcessedWebhookEvent {
                event_type: "track_unpublished".to_string(),
                room_name: room.name,
                timestamp: chrono::Utc::now(),
                data: serde_json::json!({ "room": room, "participant": participant, "track": track }),
            },
            _ => ProcessedWebhookEvent {
                event_type: "unknown".to_string(),
                room_name: "".to_string(),
                timestamp: chrono::Utc::now(),
                data: serde_json::Value::Null,
            }
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RoomStats {
    pub name: String,
    pub sid: String,
    pub num_participants: u32,
    pub max_participants: u32,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub uptime_seconds: u64,
}

// Redis extensions for LiveKit mapping
impl RedisManager {
    /// Set room to LiveKit mapping
    pub async fn set_room_livekit_mapping(
        &self,
        room_id: &str,
        livekit_room_name: &str,
        livekit_sid: &str,
    ) -> Result<(), crate::redis_manager::RedisError> {
        use redis::AsyncCommands;
        
        let mut conn = self.pool.get().await?;
        let mapping_key = format!("livekit:mapping:room:{}", room_id);
        let mapping_data = serde_json::json!({
            "room_id": room_id,
            "livekit_room_name": livekit_room_name,
            "livekit_sid": livekit_sid,
            "created_at": chrono::Utc::now(),
        });
        
        conn.set_ex(&mapping_key, mapping_data.to_string(), 3600).await?;
        Ok(())
    }

    /// Get LiveKit mapping for room
    pub async fn get_room_livekit_mapping(
        &self,
        room_id: &str,
    ) -> Result<Option<LiveKitRoomMapping>, crate::redis_manager::RedisError> {
        use redis::AsyncCommands;
        
        let mut conn = self.pool.get().await?;
        let mapping_key = format!("livekit:mapping:room:{}", room_id);
        
        let data: Option<String> = conn.get(&mapping_key).await?;
        match data {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LiveKitRoomMapping {
    pub room_id: String,
    pub livekit_room_name: String,
    pub livekit_sid: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
