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

#[derive(Error, Debug)]
pub enum LiveKitError {
    #[error("LiveKit API error: {0}")]
    Api(#[from] livekit_api::AccessTokenError),
    #[error("Token generation error: {0}")]
    Token(String),
    #[error("Room creation failed: {0}")]
    RoomCreation(String),
    #[error("Room not found: {0}")]
    RoomNotFound(String),
    #[error("Invalid configuration: {0}")]
    Config(String),
}

#[derive(Debug, Clone)]
pub struct EnhancedLiveKitClient {
    pub client: Arc<RoomClient>,
    pub webhook_receiver: Arc<WebhookReceiver>,
    pub api_key: String,
    pub api_secret: String,
    pub server_url: String,
    pub room_cache: Arc<RwLock<HashMap<String, LiveKitRoomInfo>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveKitRoomInfo {
    pub name: String,
    pub sid: String,
    pub num_participants: u32,
    pub max_participants: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub empty_timeout: u32,
    pub departure_timeout: u32,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceRoomConfig {
    pub max_participants: Option<u32>,
    pub empty_timeout: Option<u32>,   // seconds to keep room open when empty
    pub departure_timeout: Option<u32>, // seconds to keep room open after last participant leaves
    pub audio_codecs: Vec<String>,
    pub video_codecs: Vec<String>,
    pub enable_audio: bool,
    pub enable_video: bool,
    pub enable_screen_share: bool,
}

impl Default for VoiceRoomConfig {
    fn default() -> Self {
        Self {
            max_participants: Some(50),
            empty_timeout: Some(300), // 5 minutes
            departure_timeout: Some(60), // 1 minute
            audio_codecs: vec!["audio/opus".to_string(), "audio/red".to_string()],
            video_codecs: vec!["video/h264".to_string(), "video/vp8".to_string()],
            enable_audio: true,
            enable_video: false, // Voice only by default
            enable_screen_share: true,
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
}

impl Default for VoicePermissions {
    fn default() -> Self {
        Self {
            can_publish_audio: true,
            can_publish_video: false, // Voice only by default
            can_publish_data: true,
            can_subscribe: true,
            can_update_own_metadata: true,
            admin: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantInfo {
    pub identity: String,
    pub name: String,
    pub sid: String,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub is_publisher: bool,
    pub audio_enabled: bool,
    pub video_enabled: bool,
    pub metadata: String,
}

impl EnhancedLiveKitClient {
    pub fn new(
        server_url: String,
        api_key: String,
        api_secret: String,
    ) -> Result<Self, LiveKitError> {
        // Validate configuration
        if api_key.is_empty() || api_secret.is_empty() {
            return Err(LiveKitError::Config("API key and secret are required".to_string()));
        }

        if server_url.is_empty() {
            return Err(LiveKitError::Config("Server URL is required".to_string()));
        }

        let client = RoomClient::new(&server_url, &api_key, &api_secret)
            .map_err(|e| LiveKitError::Api(e.into()))?;
        
        let webhook_receiver = WebhookReceiver::new(&api_key, &api_secret);

        Ok(Self {
            client: Arc::new(client),
            webhook_receiver: Arc::new(webhook_receiver),
            api_key,
            api_secret,
            server_url,
            room_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Create a new voice room
    pub async fn create_voice_room(
        &self,
        room_name: &str,
        config: VoiceRoomConfig,
    ) -> Result<LiveKitRoomInfo, LiveKitError> {
        let options = CreateRoomOptions {
            name: room_name.to_string(),
            empty_timeout: config.empty_timeout,
            departure_timeout: config.departure_timeout,
            max_participants: config.max_participants,
            node_id: None,
            metadata: Some(serde_json::to_string(&config).unwrap_or_default()),
        };

        match self.client.create_room(room_name, options).await {
            Ok(room) => {
                let room_info = LiveKitRoomInfo {
                    name: room.name.clone(),
                    sid: room.sid.clone(),
                    num_participants: room.num_participants,
                    max_participants: room.max_participants,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    empty_timeout: room.empty_timeout.unwrap_or(300),
                    departure_timeout: room.departure_timeout.unwrap_or(60),
                    is_active: true,
                };

                // Cache room info
                self.room_cache.write().await.insert(room_name.to_string(), room_info.clone());
                
                info!("Created LiveKit room: {} (sid: {})", room_name, room.sid);
                Ok(room_info)
            },
            Err(e) => {
                // If room already exists, try to get info
                if let Ok(rooms) = self.client.list_rooms(ListRoomsRequest { 
                    names: vec![room_name.to_string()]
                }).await {
                    if let Some(room) = rooms.into_iter().next() {
                        let room_info = LiveKitRoomInfo {
                            name: room.name.clone(),
                            sid: room.sid.clone(),
                            num_participants: room.num_participants,
                            max_participants: room.max_participants,
                            created_at: chrono::DateTime::from_timestamp(room.creation_time as i64, 0).unwrap_or_else(chrono::Utc::now),
                            updated_at: chrono::Utc::now(),
                            empty_timeout: room.empty_timeout.unwrap_or(300),
                            departure_timeout: room.departure_timeout.unwrap_or(60),
                            is_active: room.num_participants > 0,
                        };
                        
                        self.room_cache.write().await.insert(room_name.to_string(), room_info.clone());
                        warn!("Room {} already exists, returning existing info", room_name);
                        return Ok(room_info);
                    }
                }
                
                error!("Failed to create room {}: {:?}", room_name, e);
                Err(LiveKitError::RoomCreation(format!("Failed to create room {}: {:?}", room_name, e)))
            }
        }
    }

    /// Generate access token for participant
    pub fn generate_access_token(
        &self,
        room_name: &str,
        identity: &str,
        name: &str,
        permissions: VoicePermissions,
    ) -> Result<String, LiveKitError> {
        let mut token = AccessToken::with_api_key(&self.api_key, &self.api_secret)
            .with_identity(identity)
            .with_name(name)
            .with_ttl(Duration::from_hours(12)); // 12 hour token
        
        let grants = VideoGrants {
            room: Some(room_name.to_string()),
            room_join: Some(true),
            can_publish: Some(permissions.can_publish_audio || permissions.can_publish_video),
            can_subscribe: Some(permissions.can_subscribe),
            can_publish_data: Some(permissions.can_publish_data),
            can_update_own_metadata: Some(permissions.can_update_own_metadata),
            admin: Some(permissions.admin),
            ..Default::default()
        };
        
        token.add_grant(&grants);
        
        token.to_jwt().map_err(|e| {
            error!("Failed to generate access token for {}: {:?}", identity, e);
            LiveKitError::Token(format!("Failed to generate token: {:?}", e))
        })
    }

    /// Delete a room
    pub async fn delete_room(&self, room_name: &str) -> Result<(), LiveKitError> {
        let request = DeleteRoomRequest {
            room: room_name.to_string(),
        };

        match self.client.delete_room(request).await {
            Ok(_) => {
                // Remove from cache
                self.room_cache.write().await.remove(room_name);
                info!("Deleted LiveKit room: {}", room_name);
                Ok(())
            },
            Err(e) => {
                warn!("Failed to delete room {} (might already be deleted): {:?}", room_name, e);
                // Remove from cache anyway
                self.room_cache.write().await.remove(room_name);
                Ok(()) // Not a critical error
            }
        }
    }

    /// Get room information
    pub async fn get_room_info(&self, room_name: &str) -> Result<Option<LiveKitRoomInfo>, LiveKitError> {
        // Check cache first
        if let Some(room) = self.room_cache.read().await.get(room_name) {
            return Ok(Some(room.clone()));
        }

        // Query LiveKit server
        match self.client.list_rooms(ListRoomsRequest {
            names: vec![room_name.to_string()]
        }).await {
            Ok(rooms) => {
                if let Some(room) = rooms.into_iter().next() {
                    let room_info = LiveKitRoomInfo {
                        name: room.name.clone(),
                        sid: room.sid.clone(),
                        num_participants: room.num_participants,
                        max_participants: room.max_participants,
                        created_at: chrono::DateTime::from_timestamp(room.creation_time as i64, 0).unwrap_or_else(chrono::Utc::now),
                        updated_at: chrono::Utc::now(),
                        empty_timeout: room.empty_timeout.unwrap_or(300),
                        departure_timeout: room.departure_timeout.unwrap_or(60),
                        is_active: room.num_participants > 0,
                    };
                    
                    // Update cache
                    self.room_cache.write().await.insert(room_name.to_string(), room_info.clone());
                    Ok(Some(room_info))
                } else {
                    Ok(None)
                }
            },
            Err(e) => {
                error!("Failed to get room info for {}: {:?}", room_name, e);
                Ok(None)
            }
        }
    }

    /// List all rooms
    pub async fn list_rooms(&self) -> Result<Vec<LiveKitRoomInfo>, LiveKitError> {
        match self.client.list_rooms(ListRoomsRequest { names: vec![] }).await {
            Ok(rooms) => {
                let mut room_infos = Vec::new();
                for room in rooms {
                    let room_info = LiveKitRoomInfo {
                        name: room.name.clone(),
                        sid: room.sid.clone(),
                        num_participants: room.num_participants,
                        max_participants: room.max_participants,
                        created_at: chrono::DateTime::from_timestamp(room.creation_time as i64, 0).unwrap_or_else(chrono::Utc::now),
                        updated_at: chrono::Utc::now(),
                        empty_timeout: room.empty_timeout.unwrap_or(300),
                        departure_timeout: room.departure_timeout.unwrap_or(60),
                        is_active: room.num_participants > 0,
                    };
                    room_infos.push(room_info);
                }
                Ok(room_infos)
            },
            Err(e) => {
                error!("Failed to list rooms: {:?}", e);
                Err(LiveKitError::Api(e.into()))
            }
        }
    }

    /// Process webhook events
    pub fn process_webhook(&self, body: &str, auth_header: &str) -> Result<Option<WebhookEvent>, LiveKitError> {
        match self.webhook_receiver.verify(body, auth_header) {
            Ok(event) => {
                info!("Processed LiveKit webhook event: {:?}", event);
                Ok(Some(event))
            },
            Err(e) => {
                error!("Failed to verify webhook: {:?}", e);
                Err(LiveKitError::Token(format!("Webhook verification failed: {:?}", e)))
            }
        }
    }

    /// Update room cache on participant events
    pub async fn update_room_participants(&self, room_name: &str, participant_count: u32) {
        if let Some(room) = self.room_cache.write().await.get_mut(room_name) {
            room.num_participants = participant_count;
            room.updated_at = chrono::Utc::now();
            room.is_active = participant_count > 0;
        }
    }

    /// Get server health status
    pub async fn health_check(&self) -> bool {
        match self.client.list_rooms(ListRoomsRequest { names: vec![] }).await {
            Ok(_) => {
                info!("LiveKit health check passed");
                true
            },
            Err(e) => {
                error!("LiveKit health check failed: {:?}", e);
                false
            }
        }
    }

    /// Clean up inactive rooms
    pub async fn cleanup_inactive_rooms(&self, max_age_hours: i64) -> Result<usize, LiveKitError> {
        let cutoff_time = chrono::Utc::now() - chrono::Duration::hours(max_age_hours);
        let mut cleaned_count = 0;

        let rooms_to_check: Vec<String> = {
            self.room_cache.read().await.keys().cloned().collect()
        };

        for room_name in rooms_to_check {
            if let Some(room_info) = self.get_room_info(&room_name).await? {
                if !room_info.is_active && room_info.updated_at < cutoff_time {
                    if let Err(e) = self.delete_room(&room_name).await {
                        warn!("Failed to cleanup room {}: {:?}", room_name, e);
                    } else {
                        cleaned_count += 1;
                        info!("Cleaned up inactive room: {}", room_name);
                    }
                }
            }
        }

        Ok(cleaned_count)
    }
}
