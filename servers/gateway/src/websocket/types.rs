use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "op", content = "d")]
pub enum GatewayPayload {
    /// Heartbeat - keep connection alive
    Heartbeat,
    
    /// Identify - authenticate with the gateway
    Identify {
        token: String,
        properties: ClientProperties,
    },
    
    /// Resume - resume a connection
    Resume {
        token: String,
        session_id: String,
        seq: u64,
    },
    
    /// Voice State Update
    VoiceStateUpdate {
        guild_id: Option<String>,
        channel_id: Option<String>,
        self_mute: bool,
        self_deaf: bool,
    },
    
    /// Ready event - sent after successful identify
    Ready {
        user: User,
        guilds: Vec<Guild>,
        session_id: String,
    },
    
    /// Message Create
    MessageCreate {
        id: String,
        channel_id: String,
        author: User,
        content: String,
        timestamp: String,
    },
    
    /// Typing Start
    TypingStart {
        channel_id: String,
        user_id: String,
        timestamp: i64,
    },
    
    /// Presence Update
    PresenceUpdate {
        user_id: String,
        status: String,
        activities: Vec<Activity>,
    },
    
    /// Invalid Session
    InvalidSession {
        resumable: bool,
    },
    
    /// Hello - sent immediately after connecting
    Hello {
        heartbeat_interval: u64,
    },
    
    /// Heartbeat ACK
    HeartbeatAck,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ClientProperties {
    pub os: String,
    pub browser: String,
    pub device: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub discriminator: String,
    pub avatar: Option<String>,
    pub bot: Option<bool>,
    pub system: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Guild {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub owner: bool,
    pub permissions: String,
    pub features: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Activity {
    pub name: String,
    pub r#type: u8,
    pub url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GatewayMessage {
    pub op: u8,
    pub d: Option<serde_json::Value>,
    pub s: Option<u64>,
    pub t: Option<String>,
}

// Opcodes для Gateway API (совместимо с Discord Gateway)
pub const DISPATCH: u8 = 0;
pub const HEARTBEAT: u8 = 1;
pub const IDENTIFY: u8 = 2;
pub const PRESENCE_UPDATE: u8 = 3;
pub const VOICE_STATE_UPDATE: u8 = 4;
pub const RESUME: u8 = 6;
pub const RECONNECT: u8 = 7;
pub const REQUEST_GUILD_MEMBERS: u8 = 8;
pub const INVALID_SESSION: u8 = 9;
pub const HELLO: u8 = 10;
pub const HEARTBEAT_ACK: u8 = 11;
