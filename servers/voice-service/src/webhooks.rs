use axum::{extract::State, http::StatusCode, response::Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use crate::VoiceServiceState;

#[derive(Debug, Deserialize)]
#[serde(tag = "event")]
pub enum LiveKitWebhookEvent {
    #[serde(rename = "room_started")]
    RoomStarted { room: RoomInfo },
    
    #[serde(rename = "room_finished")]
    RoomFinished { room: RoomInfo },
    
    #[serde(rename = "participant_joined")]
    ParticipantJoined {
        room: RoomInfo,
        participant: ParticipantInfo,
    },
    
    #[serde(rename = "participant_left")]
    ParticipantLeft {
        room: RoomInfo,
        participant: ParticipantInfo,
    },
    
    #[serde(rename = "track_published")]
    TrackPublished {
        room: RoomInfo,
        participant: ParticipantInfo,
        track: TrackInfo,
    },
    
    #[serde(rename = "track_unpublished")]
    TrackUnpublished {
        room: RoomInfo,
        participant: ParticipantInfo,
        track: TrackInfo,
    },
    
    #[serde(rename = "recording_started")]
    RecordingStarted {
        room: RoomInfo,
        recording: RecordingInfo,
    },
    
    #[serde(rename = "recording_finished")]
    RecordingFinished {
        room: RoomInfo,
        recording: RecordingInfo,
    },
}

#[derive(Debug, Deserialize)]
pub struct RoomInfo {
    pub sid: String,
    pub name: String,
    pub empty_timeout: u32,
    pub max_participants: u32,
    pub creation_time: i64,
    pub turn_password: String,
    pub enabled_codecs: Vec<CodecInfo>,
    pub metadata: String,
    pub num_participants: u32,
    pub num_publishers: u32,
    pub active_recording: bool,
}

#[derive(Debug, Deserialize)]
pub struct ParticipantInfo {
    pub sid: String,
    pub identity: String,
    pub state: String,
    pub tracks: Vec<TrackInfo>,
    pub metadata: String,
    pub joined_at: i64,
    pub name: String,
    pub version: u32,
    pub permission: Option<ParticipantPermission>,
    pub region: String,
    pub is_publisher: bool,
}

#[derive(Debug, Deserialize)]
pub struct ParticipantPermission {
    pub can_subscribe: bool,
    pub can_publish: bool,
    pub can_publish_data: bool,
    pub hidden: bool,
    pub recorder: bool,
}

#[derive(Debug, Deserialize)]
pub struct TrackInfo {
    pub sid: String,
    pub r#type: String,
    pub name: String,
    pub muted: bool,
    pub width: u32,
    pub height: u32,
    pub simulcast: bool,
    pub disable_dtx: bool,
    pub source: String,
    pub layers: Vec<VideoLayer>,
    pub mime_type: String,
    pub mid: String,
    pub codecs: Vec<CodecInfo>,
    pub stereo: bool,
    pub disable_red: bool,
    pub encryption: String,
    pub stream: String,
}

#[derive(Debug, Deserialize)]
pub struct VideoLayer {
    pub quality: String,
    pub width: u32,
    pub height: u32,
    pub bitrate: u32,
    pub ssrc: u32,
}

#[derive(Debug, Deserialize)]
pub struct CodecInfo {
    pub mime: String,
    pub fmtp_line: String,
}

#[derive(Debug, Deserialize)]
pub struct RecordingInfo {
    pub id: String,
    pub room_name: String,
    pub room_id: String,
    pub status: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration: Option<u64>,
    pub size: Option<u64>,
    pub download_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WebhookResponse {
    pub success: bool,
    pub message: String,
}

pub async fn handle_livekit_webhook(
    State(state): State<VoiceServiceState>,
    Json(event): Json<LiveKitWebhookEvent>,
) -> Result<Json<WebhookResponse>, StatusCode> {
    info!("Received LiveKit webhook: {:?}", event);

    match event {
        LiveKitWebhookEvent::RoomStarted { room } => {
            handle_room_started(&state, room).await?;
        }
        
        LiveKitWebhookEvent::RoomFinished { room } => {
            handle_room_finished(&state, room).await?;
        }
        
        LiveKitWebhookEvent::ParticipantJoined { room, participant } => {
            handle_participant_joined(&state, room, participant).await?;
        }
        
        LiveKitWebhookEvent::ParticipantLeft { room, participant } => {
            handle_participant_left(&state, room, participant).await?;
        }
        
        LiveKitWebhookEvent::TrackPublished { room, participant, track } => {
            handle_track_published(&state, room, participant, track).await?;
        }
        
        LiveKitWebhookEvent::TrackUnpublished { room, participant, track } => {
            handle_track_unpublished(&state, room, participant, track).await?;
        }
        
        LiveKitWebhookEvent::RecordingStarted { room, recording } => {
            handle_recording_started(&state, room, recording).await?;
        }
        
        LiveKitWebhookEvent::RecordingFinished { room, recording } => {
            handle_recording_finished(&state, room, recording).await?;
        }
    }

    Ok(Json(WebhookResponse {
        success: true,
        message: "Webhook processed successfully".to_string(),
    }))
}

async fn handle_room_started(
    _state: &VoiceServiceState,
    room: RoomInfo,
) -> Result<(), StatusCode> {
    info!("Room started: {} ({})", room.name, room.sid);
    // Room is already created in our system, just log the event
    Ok(())
}

async fn handle_room_finished(
    state: &VoiceServiceState,
    room: RoomInfo,
) -> Result<(), StatusCode> {
    info!("Room finished: {} ({})", room.name, room.sid);
    
    // Extract room ID from LiveKit room name (format: rscord_{guild_id}_{room_id})
    if let Some(room_id) = extract_room_id_from_livekit_name(&room.name) {
        // Mark room as inactive
        if let Err(e) = mark_room_inactive(&state, &room_id).await {
            error!("Failed to mark room as inactive: {}", e);
        }
    }
    
    Ok(())
}

async fn handle_participant_joined(
    state: &VoiceServiceState,
    room: RoomInfo,
    participant: ParticipantInfo,
) -> Result<(), StatusCode> {
    info!(
        "Participant joined: {} ({}) in room {} ({})",
        participant.name, participant.identity, room.name, room.sid
    );
    
    // Update participant status in our database if needed
    // The join logic is already handled in our join_voice_room API
    
    // TODO: Broadcast to other services that user joined voice
    // This could be used to update presence status, notify other users, etc.
    
    Ok(())
}

async fn handle_participant_left(
    state: &VoiceServiceState,
    room: RoomInfo,
    participant: ParticipantInfo,
) -> Result<(), StatusCode> {
    info!(
        "Participant left: {} ({}) from room {} ({})",
        participant.name, participant.identity, room.name, room.sid
    );
    
    // Extract room ID and trigger leave logic
    if let Some(room_id) = extract_room_id_from_livekit_name(&room.name) {
        if let Err(e) = state.room_manager.leave_voice_room(&room_id, &participant.identity).await {
            error!("Failed to handle participant leave: {}", e);
        }
    }
    
    Ok(())
}

async fn handle_track_published(
    _state: &VoiceServiceState,
    room: RoomInfo,
    participant: ParticipantInfo,
    track: TrackInfo,
) -> Result<(), StatusCode> {
    info!(
        "Track published: {} by {} ({}) in room {}",
        track.name, participant.name, participant.identity, room.name
    );
    
    // Handle different track types
    match track.r#type.as_str() {
        "audio" => {
            // User started speaking/unmuted
            info!("User {} started audio in room {}", participant.identity, room.name);
        }
        "video" => {
            // User started video (future feature)
            info!("User {} started video in room {}", participant.identity, room.name);
        }
        "data" => {
            // Data track published
            info!("User {} published data track in room {}", participant.identity, room.name);
        }
        _ => {
            warn!("Unknown track type: {}", track.r#type);
        }
    }
    
    Ok(())
}

async fn handle_track_unpublished(
    _state: &VoiceServiceState,
    room: RoomInfo,
    participant: ParticipantInfo,
    track: TrackInfo,
) -> Result<(), StatusCode> {
    info!(
        "Track unpublished: {} by {} ({}) in room {}",
        track.name, participant.name, participant.identity, room.name
    );
    
    // Handle track unpublishing
    match track.r#type.as_str() {
        "audio" => {
            // User stopped speaking/muted
            info!("User {} stopped audio in room {}", participant.identity, room.name);
        }
        "video" => {
            // User stopped video
            info!("User {} stopped video in room {}", participant.identity, room.name);
        }
        _ => {}
    }
    
    Ok(())
}

async fn handle_recording_started(
    _state: &VoiceServiceState,
    room: RoomInfo,
    recording: RecordingInfo,
) -> Result<(), StatusCode> {
    info!(
        "Recording started: {} for room {} ({})",
        recording.id, room.name, room.sid
    );
    
    // TODO: Store recording info in database
    // TODO: Notify room participants that recording started
    
    Ok(())
}

async fn handle_recording_finished(
    _state: &VoiceServiceState,
    room: RoomInfo,
    recording: RecordingInfo,
) -> Result<(), StatusCode> {
    info!(
        "Recording finished: {} for room {} ({})",
        recording.id, room.name, room.sid
    );
    
    // TODO: Process finished recording
    // TODO: Store recording metadata
    // TODO: Notify participants that recording is available
    
    Ok(())
}

// Helper functions

fn extract_room_id_from_livekit_name(livekit_room_name: &str) -> Option<String> {
    // Expected format: rscord_{guild_id}_{room_id}
    let parts: Vec<&str> = livekit_room_name.split('_').collect();
    if parts.len() >= 3 && parts[0] == "rscord" {
        Some(parts[2].to_string())
    } else {
        None
    }
}

async fn mark_room_inactive(
    state: &VoiceServiceState,
    room_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use mongodb::{bson::doc, Collection};
    
    let rooms_collection: Collection<crate::room_manager::VoiceRoom> = 
        state.room_manager.db.collection("voice_rooms");
    
    rooms_collection
        .update_one(
            doc! { "_id": room_id },
            doc! { "$set": { "is_active": false } }
        )
        .await?;
    
    info!("Marked room {} as inactive", room_id);
    Ok(())
}
