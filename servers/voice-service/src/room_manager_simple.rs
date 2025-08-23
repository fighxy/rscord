use mongodb::{Client as MongoClient, Collection, bson::doc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use crate::types::{VoiceRoom, VoiceSession};
use crate::livekit_client::{LiveKitClient, VoiceRoomConfig, VoicePermissions};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStats {
    pub room_id: String,
    pub active_participants: usize,
    pub total_participants: usize,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct VoiceRoomManager {
    livekit_client: Arc<LiveKitClient>,
    db: MongoClient,
    active_rooms: Arc<RwLock<HashMap<String, VoiceRoom>>>,
    user_sessions: Arc<RwLock<HashMap<String, VoiceSession>>>,
}

impl VoiceRoomManager {
    pub fn new(livekit_client: Arc<LiveKitClient>, db: MongoClient) -> Self {
        Self {
            livekit_client,
            db,
            active_rooms: Arc::new(RwLock::new(HashMap::new())),
            user_sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new voice room
    pub async fn create_voice_room(
        &self,
        guild_id: &str,
        channel_id: &str,
        name: &str,
        created_by: &str,
        config: Option<VoiceRoomConfig>,
    ) -> Result<VoiceRoom, Box<dyn std::error::Error + Send + Sync>> {
        let room_id = format!("{}_{}", guild_id, channel_id);
        let livekit_room_name = format!("room_{}", room_id);
        
        let room_config = config.unwrap_or_default();
        
        // Create room in LiveKit
        self.livekit_client.create_voice_room(&livekit_room_name, room_config).await?;
        
        // Create room record
        let room = VoiceRoom {
            id: room_id.clone(),
            name: name.to_string(),
            guild_id: guild_id.to_string(),
            channel_id: channel_id.to_string(),
            created_by: created_by.to_string(),
            created_at: chrono::Utc::now(),
            current_participants: Vec::new(),
            max_participants: 50,
            is_active: true,
        };

        // Store in database
        let rooms_collection: Collection<VoiceRoom> = self.db.database("radiate").collection("voice_rooms");
        rooms_collection.insert_one(&room, None).await?;

        // Update cache
        self.active_rooms.write().await.insert(room_id, room.clone());

        info!("Created voice room: {}", name);
        Ok(room)
    }

    /// Join a voice room
    pub async fn join_voice_room(
        &self,
        room_id: &str,
        user_id: &str,
        username: &str,
    ) -> Result<VoiceSession, Box<dyn std::error::Error + Send + Sync>> {
        let room = self.get_room_by_id(room_id).await?
            .ok_or("Room not found")?;

        let livekit_room_name = format!("room_{}", room_id);
        let permissions = VoicePermissions::default();
        
        // Generate access token
        let access_token = self.livekit_client.generate_access_token(
            &livekit_room_name,
            user_id,
            username,
            permissions,
        )?;

        // Create session
        let session = VoiceSession {
            id: format!("{}_{}", room_id, user_id),
            room_id: room_id.to_string(),
            user_id: user_id.to_string(),
            username: username.to_string(),
            joined_at: chrono::Utc::now(),
            left_at: None,
            is_muted: false,
            is_deafened: false,
            access_token,
            livekit_room_name,
        };

        // Store session
        let sessions_collection: Collection<VoiceSession> = self.db.database("radiate").collection("voice_sessions");
        sessions_collection.insert_one(&session, None).await?;

        // Update user sessions cache
        self.user_sessions.write().await.insert(user_id.to_string(), session.clone());

        info!("User {} joined voice room {}", username, room_id);
        Ok(session)
    }

    /// Leave a voice room
    pub async fn leave_voice_room(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Update session end time
        let sessions_collection: Collection<VoiceSession> = self.db.database("radiate").collection("voice_sessions");
        sessions_collection.update_one(
            doc! { "user_id": user_id, "room_id": room_id },
            doc! { "$set": { "left_at": chrono::Utc::now() } },
            None
        ).await?;

        // Remove from active sessions
        self.user_sessions.write().await.remove(user_id);

        info!("User {} left voice room {}", user_id, room_id);
        Ok(())
    }

    /// Get room by ID
    pub async fn get_room_by_id(&self, room_id: &str) -> Result<Option<VoiceRoom>, Box<dyn std::error::Error + Send + Sync>> {
        // Check cache first
        if let Some(room) = self.active_rooms.read().await.get(room_id) {
            return Ok(Some(room.clone()));
        }

        // Check database
        let rooms_collection: Collection<VoiceRoom> = self.db.database("radiate").collection("voice_rooms");
        let room = rooms_collection.find_one(doc! { "id": room_id }, None).await?;
        
        Ok(room)
    }

    /// Get room statistics
    pub async fn get_room_stats(&self, room_id: &str) -> Result<RoomStats, Box<dyn std::error::Error + Send + Sync>> {
        let room = self.get_room_by_id(room_id).await?
            .ok_or("Room not found")?;

        Ok(RoomStats {
            room_id: room_id.to_string(),
            active_participants: room.current_participants.len(),
            total_participants: room.current_participants.len(),
            is_active: room.is_active,
            created_at: room.created_at,
        })
    }

    /// Get room participants
    pub async fn get_room_participants(&self, room_id: &str) -> Result<Vec<VoiceSession>, Box<dyn std::error::Error + Send + Sync>> {
        let sessions_collection: Collection<VoiceSession> = self.db.database("radiate").collection("voice_sessions");
        let cursor = sessions_collection.find(
            doc! { "room_id": room_id, "left_at": { "$exists": false } }, 
            None
        ).await?;
        
        let mut participants = Vec::new();
        let mut cursor = cursor;
        while let Some(session) = cursor.try_next().await? {
            participants.push(session);
        }
        
        Ok(participants)
    }

    /// Cleanup inactive rooms
    pub async fn cleanup_inactive_rooms(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Cleaning up inactive rooms...");
        
        // This would implement cleanup logic
        // For now, just log
        Ok(())
    }
}