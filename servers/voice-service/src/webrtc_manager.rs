use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerConnection {
    pub user_id: String,
    pub room_id: String,
    pub session_id: String,
    pub ice_candidates: Vec<IceCandidate>,
    pub offer: Option<SessionDescription>,
    pub answer: Option<SessionDescription>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDescription {
    pub sdp: String,
    pub sdp_type: String, // "offer" or "answer"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceCandidate {
    pub candidate: String,
    pub sdp_mid: Option<String>,
    pub sdp_m_line_index: Option<u16>,
}

#[derive(Clone)]
pub struct Connection {
    pub user_id: String,
    pub room_id: String,
    pub session_id: String,
    pub sender: broadcast::Sender<SignalingEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SignalingEvent {
    UserJoined {
        user_id: String,
        session_id: String,
    },
    UserLeft {
        user_id: String,
        session_id: String,
    },
    Offer {
        from_user: String,
        to_user: String,
        sdp: String,
        session_id: String,
    },
    Answer {
        from_user: String,
        to_user: String,
        sdp: String,
        session_id: String,
    },
    IceCandidate {
        from_user: String,
        to_user: String,
        candidate: IceCandidate,
        session_id: String,
    },
    RoomState {
        room_id: String,
        participants: Vec<ParticipantInfo>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantInfo {
    pub user_id: String,
    pub session_id: String,
    pub muted: bool,
    pub deafened: bool,
    pub video_enabled: bool,
    pub screen_sharing: bool,
}

pub struct WebRTCManager {
    // session_id -> Connection
    connections: Arc<DashMap<String, Connection>>,
    // room_id -> Vec<session_id>
    room_sessions: Arc<DashMap<String, Vec<String>>>,
    // user_id -> session_id
    user_sessions: Arc<DashMap<String, String>>,
}

impl WebRTCManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(DashMap::new()),
            room_sessions: Arc::new(DashMap::new()),
            user_sessions: Arc::new(DashMap::new()),
        }
    }

    pub fn create_session(&self, user_id: String, room_id: String) -> (String, broadcast::Receiver<SignalingEvent>) {
        let session_id = Uuid::new_v4().to_string();
        let (tx, rx) = broadcast::channel(100);
        
        let connection = Connection {
            user_id: user_id.clone(),
            room_id: room_id.clone(),
            session_id: session_id.clone(),
            sender: tx.clone(),
        };
        
        // Store connection
        self.connections.insert(session_id.clone(), connection);
        self.user_sessions.insert(user_id.clone(), session_id.clone());
        
        // Add to room sessions
        self.room_sessions
            .entry(room_id.clone())
            .or_insert_with(Vec::new)
            .push(session_id.clone());
        
        // Notify other participants in the room
        self.broadcast_to_room(
            &room_id,
            SignalingEvent::UserJoined {
                user_id,
                session_id: session_id.clone(),
            },
            Some(&session_id),
        );
        
        (session_id, rx)
    }

    pub fn remove_session(&self, session_id: &str) {
        if let Some((_, connection)) = self.connections.remove(session_id) {
            // Remove from user sessions
            self.user_sessions.remove(&connection.user_id);
            
            // Remove from room sessions
            if let Some(mut sessions) = self.room_sessions.get_mut(&connection.room_id) {
                sessions.retain(|s| s != session_id);
            }
            
            // Notify other participants
            self.broadcast_to_room(
                &connection.room_id,
                SignalingEvent::UserLeft {
                    user_id: connection.user_id,
                    session_id: session_id.to_string(),
                },
                Some(session_id),
            );
        }
    }

    pub fn forward_offer(&self, from_session: &str, to_user: &str, sdp: String) -> Result<(), String> {
        let from_conn = self.connections.get(from_session)
            .ok_or("From session not found")?;
        
        let to_session = self.user_sessions.get(to_user)
            .ok_or("To user not found")?;
        
        let to_conn = self.connections.get(to_session.as_str())
            .ok_or("To session not found")?;
        
        let event = SignalingEvent::Offer {
            from_user: from_conn.user_id.clone(),
            to_user: to_user.to_string(),
            sdp,
            session_id: from_session.to_string(),
        };
        
        to_conn.sender.send(event).map_err(|_| "Failed to send offer")?;
        Ok(())
    }

    pub fn forward_answer(&self, from_session: &str, to_user: &str, sdp: String) -> Result<(), String> {
        let from_conn = self.connections.get(from_session)
            .ok_or("From session not found")?;
        
        let to_session = self.user_sessions.get(to_user)
            .ok_or("To user not found")?;
        
        let to_conn = self.connections.get(to_session.as_str())
            .ok_or("To session not found")?;
        
        let event = SignalingEvent::Answer {
            from_user: from_conn.user_id.clone(),
            to_user: to_user.to_string(),
            sdp,
            session_id: from_session.to_string(),
        };
        
        to_conn.sender.send(event).map_err(|_| "Failed to send answer")?;
        Ok(())
    }

    pub fn forward_ice_candidate(&self, from_session: &str, to_user: &str, candidate: IceCandidate) -> Result<(), String> {
        let from_conn = self.connections.get(from_session)
            .ok_or("From session not found")?;
        
        let to_session = self.user_sessions.get(to_user)
            .ok_or("To user not found")?;
        
        let to_conn = self.connections.get(to_session.as_str())
            .ok_or("To session not found")?;
        
        let event = SignalingEvent::IceCandidate {
            from_user: from_conn.user_id.clone(),
            to_user: to_user.to_string(),
            candidate,
            session_id: from_session.to_string(),
        };
        
        to_conn.sender.send(event).map_err(|_| "Failed to send ICE candidate")?;
        Ok(())
    }

    pub fn get_room_participants(&self, room_id: &str) -> Vec<ParticipantInfo> {
        let mut participants = Vec::new();
        
        if let Some(sessions) = self.room_sessions.get(room_id) {
            for session_id in sessions.iter() {
                if let Some(conn) = self.connections.get(session_id) {
                    participants.push(ParticipantInfo {
                        user_id: conn.user_id.clone(),
                        session_id: session_id.clone(),
                        muted: false, // Would be tracked separately
                        deafened: false,
                        video_enabled: false,
                        screen_sharing: false,
                    });
                }
            }
        }
        
        participants
    }

    fn broadcast_to_room(&self, room_id: &str, event: SignalingEvent, exclude_session: Option<&str>) {
        if let Some(sessions) = self.room_sessions.get(room_id) {
            for session_id in sessions.iter() {
                if let Some(exclude) = exclude_session {
                    if session_id == exclude {
                        continue;
                    }
                }
                
                if let Some(conn) = self.connections.get(session_id) {
                    let _ = conn.sender.send(event.clone());
                }
            }
        }
    }
}
