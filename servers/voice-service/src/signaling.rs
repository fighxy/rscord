use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

use crate::rooms::VoiceRoomManager;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SignalingMessage {
    Join {
        room_id: String,
        user_id: String,
    },
    Leave {
        room_id: String,
        user_id: String,
    },
    Offer {
        sdp: String,
        from_user: String,
        to_user: String,
    },
    Answer {
        sdp: String,
        from_user: String,
        to_user: String,
    },
    IceCandidate {
        candidate: String,
        from_user: String,
        to_user: String,
    },
    Mute {
        user_id: String,
        muted: bool,
    },
    Deafen {
        user_id: String,
        deafened: bool,
    },
    UserJoined {
        user_id: String,
        room_id: String,
    },
    UserLeft {
        user_id: String,
        room_id: String,
    },
    Error {
        message: String,
    },
}

pub async fn handle_websocket(socket: WebSocket, room_manager: Arc<VoiceRoomManager>) {
    let (mut sender, mut receiver) = socket.split();
    
    info!("New WebSocket connection established");

    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<SignalingMessage>(&text) {
                    Ok(signal) => {
                        if let Err(e) = handle_signaling_message(signal, &mut sender, &room_manager).await {
                            error!("Error handling signaling message: {}", e);
                            let error_msg = SignalingMessage::Error {
                                message: format!("Error: {}", e),
                            };
                            let _ = sender.send(Message::Text(serde_json::to_string(&error_msg).unwrap())).await;
                        }
                    }
                    Err(e) => {
                        error!("Failed to parse signaling message: {}", e);
                        let error_msg = SignalingMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        let _ = sender.send(Message::Text(serde_json::to_string(&error_msg).unwrap())).await;
                    }
                }
            }
            Ok(Message::Close(_)) => {
                info!("WebSocket connection closed");
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

async fn handle_signaling_message(
    message: SignalingMessage,
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    room_manager: &Arc<VoiceRoomManager>,
) -> anyhow::Result<()> {
    match message {
        SignalingMessage::Join { room_id, user_id } => {
            info!("User {} joining room {}", user_id, room_id);
            
            // Notify other participants
            if let Some(participants) = room_manager.get_room_participants(&room_id).await {
                let join_msg = SignalingMessage::UserJoined {
                    user_id: user_id.clone(),
                    room_id: room_id.clone(),
                };
                
                // In a real implementation, you'd broadcast to all participants
                // For now, just acknowledge
                sender.send(Message::Text(serde_json::to_string(&join_msg)?)).await?;
            }
        }
        SignalingMessage::Leave { room_id, user_id } => {
            info!("User {} leaving room {}", user_id, room_id);
            room_manager.leave_room(&room_id, &user_id).await?;
            
            let leave_msg = SignalingMessage::UserLeft {
                user_id: user_id.clone(),
                room_id: room_id.clone(),
            };
            sender.send(Message::Text(serde_json::to_string(&leave_msg)?)).await?;
        }
        SignalingMessage::Offer { sdp, from_user, to_user } => {
            info!("Forwarding offer from {} to {}", from_user, to_user);
            // In a real implementation, forward to the specific user
            // For now, echo back
            sender.send(Message::Text(serde_json::to_string(&SignalingMessage::Offer {
                sdp,
                from_user,
                to_user,
            })?)).await?;
        }
        SignalingMessage::Answer { sdp, from_user, to_user } => {
            info!("Forwarding answer from {} to {}", from_user, to_user);
            // In a real implementation, forward to the specific user
            sender.send(Message::Text(serde_json::to_string(&SignalingMessage::Answer {
                sdp,
                from_user,
                to_user,
            })?)).await?;
        }
        SignalingMessage::IceCandidate { candidate, from_user, to_user } => {
            info!("Forwarding ICE candidate from {} to {}", from_user, to_user);
            // In a real implementation, forward to the specific user
            sender.send(Message::Text(serde_json::to_string(&SignalingMessage::IceCandidate {
                candidate,
                from_user,
                to_user,
            })?)).await?;
        }
        SignalingMessage::Mute { user_id, muted } => {
            info!("User {} muted: {}", user_id, muted);
            // Broadcast to room participants
            sender.send(Message::Text(serde_json::to_string(&SignalingMessage::Mute {
                user_id,
                muted,
            })?)).await?;
        }
        SignalingMessage::Deafen { user_id, deafened } => {
            info!("User {} deafened: {}", user_id, deafened);
            // Broadcast to room participants
            sender.send(Message::Text(serde_json::to_string(&SignalingMessage::Deafen {
                user_id,
                deafened,
            })?)).await?;
        }
        _ => {
            // Other message types are outbound only
        }
    }
    
    Ok(())
}
