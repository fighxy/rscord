use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceRoom {
    pub id: String,
    pub name: String,
    pub guild_id: String,
    pub channel_id: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub current_participants: Vec<String>,
    pub max_participants: u32,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceSession {
    pub id: String,
    pub room_id: String,
    pub user_id: String,
    pub username: String,
    pub joined_at: DateTime<Utc>,
    pub left_at: Option<DateTime<Utc>>,
    pub is_muted: bool,
    pub is_deafened: bool,
    pub access_token: String,
    pub livekit_room_name: String,
}