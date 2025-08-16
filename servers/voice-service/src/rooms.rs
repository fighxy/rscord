use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use anyhow::Result;

#[derive(Debug, Clone)]
pub struct Participant {
    pub user_id: String,
    pub muted: bool,
    pub deafened: bool,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub struct VoiceRoom {
    pub room_id: String,
    pub channel_id: String,
    pub participants: Arc<RwLock<HashSet<String>>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl VoiceRoom {
    pub fn new(channel_id: String) -> Self {
        Self {
            room_id: Uuid::new_v4().to_string(),
            channel_id,
            participants: Arc::new(RwLock::new(HashSet::new())),
            created_at: chrono::Utc::now(),
        }
    }

    pub async fn add_participant(&self, user_id: String) -> Result<()> {
        let mut participants = self.participants.write().await;
        participants.insert(user_id);
        Ok(())
    }

    pub async fn remove_participant(&self, user_id: &str) -> Result<bool> {
        let mut participants = self.participants.write().await;
        Ok(participants.remove(user_id))
    }

    pub async fn participant_count(&self) -> usize {
        let participants = self.participants.read().await;
        participants.len()
    }

    pub async fn is_empty(&self) -> bool {
        let participants = self.participants.read().await;
        participants.is_empty()
    }

    pub async fn get_participants(&self) -> Vec<String> {
        let participants = self.participants.read().await;
        participants.iter().cloned().collect()
    }
}

pub struct VoiceRoomManager {
    // channel_id -> VoiceRoom
    rooms_by_channel: Arc<DashMap<String, Arc<VoiceRoom>>>,
    // room_id -> VoiceRoom
    rooms_by_id: Arc<DashMap<String, Arc<VoiceRoom>>>,
    // user_id -> room_id
    user_rooms: Arc<DashMap<String, String>>,
}

impl VoiceRoomManager {
    pub fn new() -> Self {
        Self {
            rooms_by_channel: Arc::new(DashMap::new()),
            rooms_by_id: Arc::new(DashMap::new()),
            user_rooms: Arc::new(DashMap::new()),
        }
    }

    pub async fn join_or_create_room(&self, channel_id: &str, user_id: &str) -> Result<String> {
        // Check if user is already in a room
        if let Some(existing_room_id) = self.user_rooms.get(user_id) {
            return Ok(existing_room_id.clone());
        }

        // Get or create room for channel
        let room = match self.rooms_by_channel.get(channel_id) {
            Some(room) => room.clone(),
            None => {
                let new_room = Arc::new(VoiceRoom::new(channel_id.to_string()));
                self.rooms_by_channel.insert(channel_id.to_string(), new_room.clone());
                self.rooms_by_id.insert(new_room.room_id.clone(), new_room.clone());
                new_room
            }
        };

        // Add participant to room
        room.add_participant(user_id.to_string()).await?;
        self.user_rooms.insert(user_id.to_string(), room.room_id.clone());

        Ok(room.room_id.clone())
    }

    pub async fn leave_room(&self, room_id: &str, user_id: &str) -> Result<()> {
        // Remove user from tracking
        self.user_rooms.remove(user_id);

        // Remove from room
        if let Some(room) = self.rooms_by_id.get(room_id) {
            room.remove_participant(user_id).await?;
            
            // Clean up empty rooms
            if room.is_empty().await {
                self.rooms_by_id.remove(room_id);
                self.rooms_by_channel.remove(&room.channel_id);
            }
        }

        Ok(())
    }

    pub async fn get_room(&self, room_id: &str) -> Option<Arc<VoiceRoom>> {
        self.rooms_by_id.get(room_id).map(|r| r.clone())
    }

    pub async fn get_room_participants(&self, room_id: &str) -> Option<Vec<String>> {
        if let Some(room) = self.rooms_by_id.get(room_id) {
            Some(room.get_participants().await)
        } else {
            None
        }
    }

    pub async fn list_rooms(&self) -> Vec<super::RoomInfo> {
        let mut rooms = Vec::new();
        for room in self.rooms_by_id.iter() {
            rooms.push(super::RoomInfo {
                room_id: room.room_id.clone(),
                channel_id: room.channel_id.clone(),
                participant_count: room.participant_count().await,
            });
        }
        rooms
    }
}
