use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChatEvent {
    MessageCreated {
        channel_id: String,
        message_id: String,
        author_id: String,
        content: String,
    },
    MessageUpdated {
        channel_id: String,
        message_id: String,
        author_id: String,
        content: String,
    },
    MessageDeleted {
        channel_id: String,
        message_id: String,
        author_id: String,
    },
    UserJoined {
        guild_id: String,
        user_id: String,
    },
    UserLeft {
        guild_id: String,
        user_id: String,
    },
    TypingStarted {
        channel_id: String,
        user_id: String,
    },
    TypingEnded {
        channel_id: String,
        user_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VoiceEvent {
    UserJoinedVoice {
        room_id: String,
        user_id: String,
        channel_id: String,
    },
    UserLeftVoice {
        room_id: String,
        user_id: String,
        channel_id: String,
    },
    AudioStreamStarted {
        room_id: String,
        user_id: String,
        stream_id: String,
    },
    AudioStreamEnded {
        room_id: String,
        user_id: String,
        stream_id: String,
    },
    UserMuted {
        room_id: String,
        user_id: String,
        muted: bool,
    },
    UserDeafened {
        room_id: String,
        user_id: String,
        deafened: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PresenceEvent {
    StatusChanged {
        user_id: String,
        old_status: String,
        new_status: String,
        guild_id: Option<String>,
    },
    ActivityChanged {
        user_id: String,
        activity: Option<String>,
        guild_id: Option<String>,
    },
    UserOnline {
        user_id: String,
        guild_id: Option<String>,
    },
    UserOffline {
        user_id: String,
        guild_id: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServiceEvent {
    Chat(ChatEvent),
    Voice(VoiceEvent),
    Presence(PresenceEvent),
}

impl From<ChatEvent> for ServiceEvent {
    fn from(event: ChatEvent) -> Self {
        ServiceEvent::Chat(event)
    }
}

impl From<VoiceEvent> for ServiceEvent {
    fn from(event: VoiceEvent) -> Self {
        ServiceEvent::Voice(event)
    }
}

impl From<PresenceEvent> for ServiceEvent {
    fn from(event: PresenceEvent) -> Self {
        ServiceEvent::Presence(event)
    }
}

// Re-export for convenience
pub use ChatEvent::*;
pub use VoiceEvent::*;
pub use PresenceEvent::*;
