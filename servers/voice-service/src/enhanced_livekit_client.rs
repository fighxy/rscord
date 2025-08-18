use livekit_api::{
    services::room::{CreateRoomRequest, DeleteRoomRequest, ListRoomsRequest, RoomServiceClient},
    AccessToken, VideoGrant,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::{Mutex, RwLock};
use tracing::{error, info, warn};
use dashmap::DashMap;

// Connection pool for LiveKit clients
pub struct LiveKitConnectionPool {
    clients: Arc<DashMap<String, Arc<RoomServiceClient>>>,
    config: LiveKitConfig,
    max_connections: usize,
    current_connections: Arc<Mutex<usize>>,
}

#[derive(Clone)]
pub struct LiveKitConfig {
    pub host: String,
    pub api_key: String,
    pub api_secret: String,
    pub max_retries: u32,
    pub retry_delay: Duration,
    pub connection_timeout: Duration,
}

impl LiveKitConnectionPool {
    pub fn new(config: LiveKitConfig, max_connections: usize) -> Self {
        Self {
            clients: Arc::new(DashMap::new()),
            config,
            max_connections,
            current_connections: Arc::new(Mutex::new(0)),
        }
    }

    pub async fn get_client(&self) -> Result<Arc<RoomServiceClient>, Box<dyn std::error::Error + Send + Sync>> {
        let pool_id = format!("{}:{}", self.config.host, self.config.api_key);
        
        if let Some(client) = self.clients.get(&pool_id) {
            return Ok(client.clone());
        }

        let mut current = self.current_connections.lock().await;
        if *current >= self.max_connections {
            // Wait for available connection or use existing
            drop(current);
            tokio::time::sleep(Duration::from_millis(100)).await;
            return self.get_client().await;
        }

        let client = RoomServiceClient::new(&self.config.host, &self.config.api_key, &self.config.api_secret)?;
        let client_arc = Arc::new(client);
        
        self.clients.insert(pool_id, client_arc.clone());
        *current += 1;
        
        info!("Created new LiveKit client connection ({}/{})", *current, self.max_connections);
        Ok(client_arc)
    }

    pub async fn health_check(&self) -> bool {
        match self.get_client().await {
            Ok(client) => {
                // Try to list rooms as health check
                match client.list_rooms(ListRoomsRequest::default()).await {
                    Ok(_) => true,
                    Err(e) => {
                        warn!("LiveKit health check failed: {}", e);
                        false
                    }
                }
            }
            Err(e) => {
                error!("Failed to get LiveKit client for health check: {}", e);
                false
            }
        }
    }
}

#[derive(Clone)]
pub struct EnhancedLiveKitClient {
    pool: Arc<LiveKitConnectionPool>,
    config: LiveKitConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoiceRoomConfig {
    pub max_participants: u32,
    pub enable_recording: bool,
    pub empty_timeout: Duration,
    pub auto_record: bool,
    // VAD Configuration
    pub voice_activation: VoiceActivationConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceActivationConfig {
    pub enabled: bool,
    pub threshold: f32,           // -60.0 to 0.0 dB
    pub gate_threshold: f32,      // Noise gate threshold
    pub attack_time: f32,         // Time to open gate (ms)
    pub release_time: f32,        // Time to close gate (ms)
    pub min_speech_duration: f32, // Minimum duration to consider speech (ms)
}

impl Default for VoiceActivationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            threshold: -45.0,        // -45dB is good for normal speaking
            gate_threshold: -60.0,   // Noise gate at -60dB
            attack_time: 10.0,       // 10ms attack
            release_time: 100.0,     // 100ms release
            min_speech_duration: 150.0, // 150ms minimum speech
        }
    }
}

impl Default for VoiceRoomConfig {
    fn default() -> Self {
        Self {
            max_participants: 50,
            enable_recording: false,
            empty_timeout: Duration::from_secs(300),
            auto_record: false,
            voice_activation: VoiceActivationConfig::default(),
        }
    }
}

impl EnhancedLiveKitClient {
    pub fn new(config: LiveKitConfig) -> Self {
        let pool = Arc::new(LiveKitConnectionPool::new(config.clone(), 10)); // Max 10 connections
        
        Self {
            pool,
            config,
        }
    }

    /// Create voice room with retry mechanism
    pub async fn create_voice_room_with_retry(
        &self,
        room_name: &str,
        config: VoiceRoomConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut attempts = 0;
        let max_retries = self.config.max_retries;

        while attempts <= max_retries {
            match self.create_voice_room(room_name, config.clone()).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    attempts += 1;
                    if attempts > max_retries {
                        error!("Failed to create voice room after {} attempts: {}", max_retries, e);
                        return Err(e);
                    }
                    
                    warn!("Attempt {} failed, retrying in {:?}: {}", attempts, self.config.retry_delay, e);
                    tokio::time::sleep(self.config.retry_delay).await;
                }
            }
        }

        Err("Max retries exceeded".into())
    }

    /// Create a new voice room in LiveKit with VAD configuration
    pub async fn create_voice_room(
        &self,
        room_name: &str,
        config: VoiceRoomConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get_client().await?;

        // Enhanced room metadata with VAD settings
        let metadata = serde_json::json!({
            "type": "voice_chat",
            "created_by": "rscord",
            "auto_record": config.auto_record,
            "voice_activation": {
                "enabled": config.voice_activation.enabled,
                "threshold": config.voice_activation.threshold,
                "gate_threshold": config.voice_activation.gate_threshold,
                "attack_time": config.voice_activation.attack_time,
                "release_time": config.voice_activation.release_time,
                "min_speech_duration": config.voice_activation.min_speech_duration
            }
        });

        let request = CreateRoomRequest {
            name: room_name.to_string(),
            empty_timeout: config.empty_timeout.as_secs() as u32,
            max_participants: config.max_participants,
            metadata: metadata.to_string(),
            ..Default::default()
        };

        match client.create_room(request).await {
            Ok(room) => {
                info!("Created LiveKit room with VAD: {} ({})", room.name, room.sid);
                Ok(())
            }
            Err(e) => {
                error!("Failed to create LiveKit room: {}", e);
                Err(e.into())
            }
        }
    }

    /// Generate access token with VAD permissions
    pub fn generate_access_token_with_vad(
        &self,
        room_name: &str,
        user_id: &str,
        username: &str,
        permissions: VoicePermissions,
        vad_config: &VoiceActivationConfig,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let video_grant = VideoGrant {
            room_join: true,
            room: room_name.to_string(),
            can_publish: permissions.can_speak,
            can_subscribe: true,
            can_publish_data: permissions.can_send_data,
            hidden: false,
            recorder: permissions.is_recorder,
            ..Default::default()
        };

        // Add VAD configuration to token metadata
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut token = AccessToken::new(&self.config.api_key, &self.config.api_secret)
            .with_identity(user_id)
            .with_name(username)
            .with_video_grant(video_grant)
            .with_ttl(Duration::from_secs(3600)) // 1 hour
            .with_metadata(&serde_json::json!({
                "vad_enabled": vad_config.enabled,
                "vad_threshold": vad_config.threshold,
                "user_preferences": {
                    "auto_mute_on_join": false,
                    "voice_activation": vad_config.enabled
                }
            }).to_string());

        match token.to_jwt() {
            Ok(jwt) => Ok(jwt),
            Err(e) => {
                error!("Failed to generate access token: {}", e);
                Err(e.into())
            }
        }
    }

    /// Enhanced room deletion with retry
    pub async fn delete_voice_room_with_retry(
        &self,
        room_name: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut attempts = 0;
        let max_retries = self.config.max_retries;

        while attempts <= max_retries {
            match self.delete_voice_room(room_name).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    attempts += 1;
                    if attempts > max_retries {
                        error!("Failed to delete voice room after {} attempts: {}", max_retries, e);
                        return Err(e);
                    }
                    
                    warn!("Delete attempt {} failed, retrying: {}", attempts, e);
                    tokio::time::sleep(self.config.retry_delay).await;
                }
            }
        }

        Err("Max retries exceeded".into())
    }

    async fn delete_voice_room(
        &self,
        room_name: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = self.pool.get_client().await?;
        
        let request = DeleteRoomRequest {
            room: room_name.to_string(),
        };

        match client.delete_room(request).await {
            Ok(_) => {
                info!("Deleted LiveKit room: {}", room_name);
                Ok(())
            }
            Err(e) => {
                error!("Failed to delete LiveKit room: {}", e);
                Err(e.into())
            }
        }
    }

    /// Health check with automatic recovery
    pub async fn health_check_with_recovery(&self) -> bool {
        if !self.pool.health_check().await {
            warn!("LiveKit health check failed, attempting recovery...");
            
            // Clear connection pool to force reconnection
            self.pool.clients.clear();
            
            // Wait a bit and try again
            tokio::time::sleep(Duration::from_secs(2)).await;
            
            return self.pool.health_check().await;
        }
        
        true
    }
}

#[derive(Debug, Clone)]
pub struct VoicePermissions {
    pub can_speak: bool,
    pub can_send_data: bool,
    pub is_recorder: bool,
    pub is_admin: bool,
    pub voice_activation_override: bool, // Can override VAD settings
}

impl Default for VoicePermissions {
    fn default() -> Self {
        Self {
            can_speak: true,
            can_send_data: true,
            is_recorder: false,
            is_admin: false,
            voice_activation_override: false,
        }
    }
}
