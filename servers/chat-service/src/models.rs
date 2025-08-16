use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guild {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: String,
    pub icon: Option<String>,
    pub created_at: DateTime<Utc>,
    pub member_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuildMember {
    #[serde(rename = "_id")]
    pub id: String,
    pub guild_id: String,
    pub user_id: String,
    pub joined_at: DateTime<Utc>,
    pub roles: Vec<String>,
    pub nickname: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    #[serde(rename = "_id")]
    pub id: String,
    pub guild_id: String,
    pub name: String,
    pub description: Option<String>,
    pub channel_type: ChannelType,
    pub position: u32,
    pub created_at: DateTime<Utc>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChannelType {
    Text,
    Voice,
    Category,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    #[serde(rename = "_id")]
    pub id: String,
    pub channel_id: String,
    pub author_id: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
    pub message_type: MessageType,
    pub attachments: Vec<Attachment>,
    pub mentions: Vec<String>,
    pub reactions: Vec<Reaction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Default,
    System,
    UserJoin,
    UserLeave,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub filename: String,
    pub content_type: Option<String>,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reaction {
    pub emoji: String,
    pub count: u32,
    pub users: Vec<String>,
}

// Request/Response DTOs
#[derive(Debug, Deserialize)]
pub struct CreateGuildRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChannelRequest {
    pub guild_id: String,
    pub name: String,
    pub description: Option<String>,
    pub channel_type: ChannelType,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessageRequest {
    pub content: String,
    pub message_type: Option<MessageType>,
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    pub limit: Option<u32>,
    pub before: Option<String>,
    pub after: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GuildResponse {
    pub guild: Guild,
    pub channels: Vec<Channel>,
    pub member_count: u32,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: Message,
    pub author: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub display_name: String,
}

impl Guild {
    pub fn new(name: String, description: Option<String>, owner_id: String) -> Self {
        Self {
            id: Ulid::new().to_string(),
            name,
            description,
            owner_id,
            icon: None,
            created_at: Utc::now(),
            member_count: 1,
        }
    }
}

impl Channel {
    pub fn new(
        guild_id: String,
        name: String,
        description: Option<String>,
        channel_type: ChannelType,
        parent_id: Option<String>,
    ) -> Self {
        Self {
            id: Ulid::new().to_string(),
            guild_id,
            name,
            description,
            channel_type,
            position: 0,
            created_at: Utc::now(),
            parent_id,
        }
    }
}

impl Message {
    pub fn new(channel_id: String, author_id: String, content: String) -> Self {
        Self {
            id: Ulid::new().to_string(),
            channel_id,
            author_id,
            content,
            created_at: Utc::now(),
            edited_at: None,
            message_type: MessageType::Default,
            attachments: Vec::new(),
            mentions: Vec::new(),
            reactions: Vec::new(),
        }
    }
}

impl GuildMember {
    pub fn new(guild_id: String, user_id: String) -> Self {
        Self {
            id: Ulid::new().to_string(),
            guild_id,
            user_id,
            joined_at: Utc::now(),
            roles: Vec::new(),
            nickname: None,
        }
    }
}
