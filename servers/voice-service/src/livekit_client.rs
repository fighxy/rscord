use livekit_api::{
    services::room::{CreateRoomRequest, DeleteRoomRequest, ListRoomsRequest, RoomServiceClient},
    AccessToken, VideoGrant,
};
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{error, info, warn};

#[derive(Clone)]
pub struct LiveKitClient {
    client: RoomServiceClient,
    api_key: String,
    api_secret: String,
    host: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoiceRoomConfig {
    pub max_participants: u32,
    pub enable_recording: bool,
    pub empty_timeout: Duration,
    pub auto_record: bool,
}

impl Default for VoiceRoomConfig {
    fn default() -> Self {
        Self {
            max_participants: 50,
            enable_recording: false,
            empty_timeout: Duration::from_secs(300), // 5 minutes
            auto_record: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoiceParticipant {
    pub user_id: String,
    pub username: String,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub is_muted: bool,
    pub is_speaking: bool,
}

impl LiveKitClient {
    pub fn new(host: String, api_key: String, api_secret: String) -> Self {
        let client = RoomServiceClient::new(&host, &api_key, &api_secret)
            .expect("Failed to create LiveKit client");

        Self {
            client,
            api_key,
            api_secret,
            host,
        }
    }

    /// Create a new voice room in LiveKit
    pub async fn create_voice_room(
        &self,
        room_name: &str,
        config: VoiceRoomConfig,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let request = CreateRoomRequest {
            name: room_name.to_string(),
            empty_timeout: config.empty_timeout.as_secs() as u32,
            max_participants: config.max_participants,
            metadata: serde_json::json!({
                "type": "voice_chat",
                "created_by": "rscord",
                "auto_record": config.auto_record
            })
            .to_string(),
            ..Default::default()
        };

        match self.client.create_room(request).await {
            Ok(room) => {
                info!("Created LiveKit room: {} ({})", room.name, room.sid);
                Ok(())
            }
            Err(e) => {
                error!("Failed to create LiveKit room: {}", e);
                Err(e.into())
            }
        }
    }

    /// Delete a voice room
    pub async fn delete_voice_room(
        &self,
        room_name: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let request = DeleteRoomRequest {
            room: room_name.to_string(),
        };

        match self.client.delete_room(request).await {
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

    /// Generate access token for user to join room
    pub fn generate_access_token(
        &self,
        room_name: &str,
        user_id: &str,
        username: &str,
        permissions: VoicePermissions,
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

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut token = AccessToken::new(&self.api_key, &self.api_secret)
            .with_identity(user_id)
            .with_name(username)
            .with_video_grant(video_grant)
            .with_ttl(Duration::from_secs(3600)); // 1 hour

        match token.to_jwt() {
            Ok(jwt) => Ok(jwt),
            Err(e) => {
                error!("Failed to generate access token: {}", e);
                Err(e.into())
            }
        }
    }

    /// List all active rooms
    pub async fn list_rooms(&self) -> Result<Vec<RoomInfo>, Box<dyn std::error::Error + Send + Sync>> {
        let request = ListRoomsRequest::default();

        match self.client.list_rooms(request).await {
            Ok(response) => {
                let rooms: Vec<RoomInfo> = response
                    .rooms
                    .into_iter()
                    .map(|room| RoomInfo {
                        name: room.name,
                        sid: room.sid,
                        num_participants: room.num_participants,
                        creation_time: room.creation_time,
                        metadata: room.metadata,
                    })
                    .collect();

                Ok(rooms)
            }
            Err(e) => {
                error!("Failed to list rooms: {}", e);
                Err(e.into())
            }
        }
    }

    /// Get participants in a room
    pub async fn get_room_participants(
        &self,
        room_name: &str,
    ) -> Result<Vec<ParticipantInfo>, Box<dyn std::error::Error + Send + Sync>> {
        use livekit_api::services::room::ListParticipantsRequest;

        let request = ListParticipantsRequest {
            room: room_name.to_string(),
        };

        match self.client.list_participants(request).await {
            Ok(response) => {
                let participants: Vec<ParticipantInfo> = response
                    .participants
                    .into_iter()
                    .map(|p| ParticipantInfo {
                        sid: p.sid,
                        identity: p.identity,
                        name: p.name,
                        is_publisher: p.permission.unwrap_or_default().can_publish,
                        joined_at: p.joined_at,
                    })
                    .collect();

                Ok(participants)
            }
            Err(e) => {
                error!("Failed to get room participants: {}", e);
                Err(e.into())
            }
        }
    }

    /// Mute/unmute participant
    pub async fn set_participant_mute(
        &self,
        room_name: &str,
        participant_identity: &str,
        muted: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use livekit_api::services::room::{MuteRoomTrackRequest, TrackSource};

        let request = MuteRoomTrackRequest {
            room: room_name.to_string(),
            identity: participant_identity.to_string(),
            track_sid: String::new(), // Empty for audio track
            muted,
        };

        match self.client.mute_published_track(request).await {
            Ok(_) => {
                info!(
                    "Set participant {} mute status to {} in room {}",
                    participant_identity, muted, room_name
                );
                Ok(())
            }
            Err(e) => {
                error!("Failed to set participant mute status: {}", e);
                Err(e.into())
            }
        }
    }

    /// Remove participant from room
    pub async fn remove_participant(
        &self,
        room_name: &str,
        participant_identity: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use livekit_api::services::room::RemoveParticipantRequest;

        let request = RemoveParticipantRequest {
            room: room_name.to_string(),
            identity: participant_identity.to_string(),
        };

        match self.client.remove_participant(request).await {
            Ok(_) => {
                info!(
                    "Removed participant {} from room {}",
                    participant_identity, room_name
                );
                Ok(())
            }
            Err(e) => {
                error!("Failed to remove participant: {}", e);
                Err(e.into())
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct VoicePermissions {
    pub can_speak: bool,
    pub can_send_data: bool,
    pub is_recorder: bool,
    pub is_admin: bool,
}

impl Default for VoicePermissions {
    fn default() -> Self {
        Self {
            can_speak: true,
            can_send_data: true,
            is_recorder: false,
            is_admin: false,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RoomInfo {
    pub name: String,
    pub sid: String,
    pub num_participants: u32,
    pub creation_time: i64,
    pub metadata: String,
}

#[derive(Debug, Serialize)]
pub struct ParticipantInfo {
    pub sid: String,
    pub identity: String,
    pub name: String,
    pub is_publisher: bool,
    pub joined_at: i64,
}
