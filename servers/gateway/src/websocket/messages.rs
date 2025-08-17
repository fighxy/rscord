use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

// Сообщения от клиента к серверу
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ClientMessage {
    // Аутентификация
    Authenticate { token: String },
    
    // Присоединение к гильдии/каналу
    JoinGuild { guild_id: String },
    LeaveGuild { guild_id: String },
    SubscribeChannel { channel_id: String },
    UnsubscribeChannel { channel_id: String },
    
    // Сообщения
    SendMessage {
        channel_id: String,
        content: String,
    },
    
    // Typing indicator
    StartTyping { channel_id: String },
    StopTyping { channel_id: String },
    
    // Presence
    UpdateStatus { status: String }, // online, idle, dnd, invisible
    
    // Heartbeat
    Ping,
}

// Сообщения от сервера к клиенту
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ServerMessage {
    // Connection
    Connected {
        user_id: String,
        session_id: String,
    },
    
    // Errors
    Error {
        code: String,
        message: String,
    },
    
    // Messages
    MessageCreate {
        id: String,
        channel_id: String,
        author_id: String,
        author_name: String,
        content: String,
        timestamp: DateTime<Utc>,
    },
    
    MessageUpdate {
        id: String,
        channel_id: String,
        content: String,
        edited_at: DateTime<Utc>,
    },
    
    MessageDelete {
        id: String,
        channel_id: String,
    },
    
    // Typing
    TypingStart {
        channel_id: String,
        user_id: String,
        username: String,
    },
    
    TypingStop {
        channel_id: String,
        user_id: String,
    },
    
    // Presence
    PresenceUpdate {
        user_id: String,
        status: String,
        timestamp: DateTime<Utc>,
    },
    
    // Guild events
    GuildMemberAdd {
        guild_id: String,
        user_id: String,
        username: String,
    },
    
    GuildMemberRemove {
        guild_id: String,
        user_id: String,
    },
    
    // Channel events
    ChannelCreate {
        id: String,
        guild_id: String,
        name: String,
        channel_type: String,
    },
    
    ChannelUpdate {
        id: String,
        name: String,
    },
    
    ChannelDelete {
        id: String,
        guild_id: String,
    },
    
    // Heartbeat
    Pong,
    
    // Initial data
    Ready {
        user: UserData,
        guilds: Vec<GuildData>,
        session_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserData {
    pub id: String,
    pub username: String,
    pub email: String,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuildData {
    pub id: String,
    pub name: String,
    pub owner_id: String,
    pub icon: Option<String>,
    pub channels: Vec<ChannelData>,
    pub members: Vec<MemberData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelData {
    pub id: String,
    pub name: String,
    pub channel_type: String, // text, voice
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberData {
    pub user_id: String,
    pub username: String,
    pub status: String,
}

// Общая структура WebSocket сообщения
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsMessage {
    pub op: i32,    // Operation code
    pub d: serde_json::Value,  // Data payload
    pub s: Option<i64>,  // Sequence number (для синхронизации)
    pub t: Option<String>,  // Event type
}

impl WsMessage {
    pub fn new(op: i32, data: serde_json::Value) -> Self {
        Self {
            op,
            d: data,
            s: None,
            t: None,
        }
    }
    
    pub fn event(event_type: &str, data: serde_json::Value) -> Self {
        Self {
            op: 0,  // 0 = dispatch event
            d: data,
            s: None,
            t: Some(event_type.to_string()),
        }
    }
}
