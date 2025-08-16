use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info, warn};
use uuid::Uuid;
use webrtc::api::APIBuilder;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::peer_connection::RTCPeerConnection;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IceServerConfig {
    pub urls: Vec<String>,
    pub username: Option<String>,
    pub credential: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PeerConnectionInfo {
    pub id: String,
    pub user_id: String,
    pub room_id: String,
    pub connection: Arc<RTCPeerConnection>,
    pub local_description: Option<RTCSessionDescription>,
    pub remote_description: Option<RTCSessionDescription>,
    pub connection_state: ConnectionState,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub audio_track: Option<Arc<TrackLocalStaticRTP>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionState {
    New,
    Connecting,
    Connected,
    Disconnected,
    Failed,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTrackInfo {
    pub id: String,
    pub user_id: String,
    pub enabled: bool,
    pub muted: bool,
}

pub struct WebRTCManager {
    api: Arc<webrtc::api::API>,
    ice_servers: Vec<RTCIceServer>,
    // Active peer connections
    connections: Arc<DashMap<String, PeerConnectionInfo>>,
    // User connections mapping
    user_connections: Arc<DashMap<String, Vec<String>>>,
    // Room connections mapping
    room_connections: Arc<DashMap<String, Vec<String>>>,
    // Audio tracks
    audio_tracks: Arc<DashMap<String, AudioTrackInfo>>,
    // Event broadcaster
    event_tx: broadcast::Sender<WebRTCEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebRTCEvent {
    PeerConnected {
        connection_id: String,
        user_id: String,
        room_id: String,
    },
    PeerDisconnected {
        connection_id: String,
        user_id: String,
        room_id: String,
    },
    AudioTrackAdded {
        track_id: String,
        user_id: String,
        room_id: String,
    },
    AudioTrackRemoved {
        track_id: String,
        user_id: String,
        room_id: String,
    },
    IceCandidateGenerated {
        connection_id: String,
        candidate: String,
    },
    ConnectionStateChanged {
        connection_id: String,
        old_state: String,
        new_state: String,
    },
}

impl WebRTCManager {
    pub fn new() -> Self {
        let api = APIBuilder::new().build();
        let (event_tx, _) = broadcast::channel(1000);
        
        let ice_servers = vec![
            RTCIceServer {
                urls: vec![
                    "stun:stun.l.google.com:19302".to_string(),
                    "stun:stun1.l.google.com:19302".to_string(),
                    "stun:stun2.l.google.com:19302".to_string(),
                ],
                ..Default::default()
            },
            // Add TURN servers for production
            // RTCIceServer {
            //     urls: vec!["turn:your-turn-server.com:3478".to_string()],
            //     username: Some("username".to_string()),
            //     credential: Some("password".to_string()),
            //     ..Default::default()
            // },
        ];

        Self {
            api: Arc::new(api),
            ice_servers,
            connections: Arc::new(DashMap::new()),
            user_connections: Arc::new(DashMap::new()),
            room_connections: Arc::new(DashMap::new()),
            audio_tracks: Arc::new(DashMap::new()),
            event_tx,
        }
    }

    pub fn get_ice_servers(&self) -> Vec<RTCIceServer> {
        self.ice_servers.clone()
    }
    
    pub fn get_ice_servers_config(&self) -> Vec<IceServerConfig> {
        self.ice_servers.iter().map(|server| {
            IceServerConfig {
                urls: server.urls.clone(),
                username: server.username.clone(),
                credential: server.credential.clone(),
            }
        }).collect()
    }

    pub async fn create_peer_connection(&self, user_id: String, room_id: String) -> Result<String> {
        let connection_id = Uuid::new_v4().to_string();
        
        let config = RTCConfiguration {
            ice_servers: self.ice_servers.clone(),
            ..Default::default()
        };

        let peer_connection = Arc::new(self.api.new_peer_connection(config).await?);
        
        // Set up event handlers
        let connection_id_clone = connection_id.clone();
        let event_tx = self.event_tx.clone();
        
        peer_connection.on_ice_candidate(Box::new(move |candidate| {
            let connection_id = connection_id_clone.clone();
            let event_tx = event_tx.clone();
            Box::pin(async move {
                if let Some(candidate) = candidate {
                    let _ = event_tx.send(WebRTCEvent::IceCandidateGenerated {
                        connection_id,
                        candidate: candidate.to_json().unwrap_or_default().candidate,
                    });
                }
            })
        }));
        
        let connection_info = PeerConnectionInfo {
            id: connection_id.clone(),
            user_id: user_id.clone(),
            room_id: room_id.clone(),
            connection: peer_connection,
            local_description: None,
            remote_description: None,
            connection_state: ConnectionState::New,
            created_at: chrono::Utc::now(),
            audio_track: None,
        };
        
        // Store connection
        self.connections.insert(connection_id.clone(), connection_info);
        
        // Update user connections
        self.user_connections
            .entry(user_id.clone())
            .or_insert_with(Vec::new)
            .push(connection_id.clone());
        
        // Update room connections
        self.room_connections
            .entry(room_id.clone())
            .or_insert_with(Vec::new)
            .push(connection_id.clone());
        
        // Broadcast event
        let _ = self.event_tx.send(WebRTCEvent::PeerConnected {
            connection_id: connection_id.clone(),
            user_id,
            room_id,
        });
        
        info!("Created peer connection: {}", connection_id);
        Ok(connection_id)
    }
    
    pub async fn set_local_description(
        &self,
        connection_id: &str,
        sdp: RTCSessionDescription,
    ) -> Result<()> {
        if let Some(mut connection_info) = self.connections.get_mut(connection_id) {
            connection_info.connection.set_local_description(sdp.clone()).await?;
            connection_info.local_description = Some(sdp);
            connection_info.connection_state = ConnectionState::Connecting;
            info!("Set local description for connection: {}", connection_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Connection not found: {}", connection_id))
        }
    }
    
    pub async fn set_remote_description(
        &self,
        connection_id: &str,
        sdp: RTCSessionDescription,
    ) -> Result<()> {
        if let Some(mut connection_info) = self.connections.get_mut(connection_id) {
            connection_info.connection.set_remote_description(sdp.clone()).await?;
            connection_info.remote_description = Some(sdp);
            info!("Set remote description for connection: {}", connection_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Connection not found: {}", connection_id))
        }
    }
    
    pub async fn add_ice_candidate(
        &self,
        connection_id: &str,
        candidate: webrtc::ice_transport::ice_candidate::RTCIceCandidate,
    ) -> Result<()> {
        if let Some(connection_info) = self.connections.get(connection_id) {
            connection_info.connection.add_ice_candidate(candidate).await?;
            info!("Added ICE candidate for connection: {}", connection_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Connection not found: {}", connection_id))
        }
    }
    
    pub fn set_connection_state(&self, connection_id: &str, state: ConnectionState) -> Result<()> {
        if let Some(mut connection_info) = self.connections.get_mut(connection_id) {
            let old_state = connection_info.connection_state.clone();
            connection_info.connection_state = state.clone();
            
            // Broadcast state change event
            let _ = self.event_tx.send(WebRTCEvent::ConnectionStateChanged {
                connection_id: connection_id.to_string(),
                old_state: format!("{:?}", old_state),
                new_state: format!("{:?}", state),
            });
            
            if state == ConnectionState::Connected && old_state != ConnectionState::Connected {
                info!("Peer connection established: {}", connection_id);
            }
            
            Ok(())
        } else {
            Err(anyhow::anyhow!("Connection not found: {}", connection_id))
        }
    }
    
    pub async fn close_connection(&self, connection_id: &str) -> Result<()> {
        if let Some((_, connection_info)) = self.connections.remove(connection_id) {
            // Close the WebRTC connection
            connection_info.connection.close().await?;
            
            // Remove from user connections
            if let Some(mut user_conns) = self.user_connections.get_mut(&connection_info.user_id) {
                user_conns.retain(|id| id != connection_id);
            }
            
            // Remove from room connections
            if let Some(mut room_conns) = self.room_connections.get_mut(&connection_info.room_id) {
                room_conns.retain(|id| id != connection_id);
            }
            
            // Remove associated audio tracks
            self.audio_tracks.retain(|_, track| {
                if track.user_id == connection_info.user_id {
                    let _ = self.event_tx.send(WebRTCEvent::AudioTrackRemoved {
                        track_id: track.id.clone(),
                        user_id: track.user_id.clone(),
                        room_id: connection_info.room_id.clone(),
                    });
                    false
                } else {
                    true
                }
            });
            
            // Broadcast disconnection event
            let _ = self.event_tx.send(WebRTCEvent::PeerDisconnected {
                connection_id: connection_id.to_string(),
                user_id: connection_info.user_id,
                room_id: connection_info.room_id,
            });
            
            info!("Closed peer connection: {}", connection_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Connection not found: {}", connection_id))
        }
    }
    
    pub async fn add_audio_track(
        &self,
        connection_id: &str,
        track: Arc<TrackLocalStaticRTP>,
    ) -> Result<String> {
        if let Some(mut connection_info) = self.connections.get_mut(connection_id) {
            let track_id = Uuid::new_v4().to_string();
            
            // Add track to peer connection
            connection_info.connection.add_track(track.clone()).await?;
            connection_info.audio_track = Some(track);
            
            let audio_track_info = AudioTrackInfo {
                id: track_id.clone(),
                user_id: connection_info.user_id.clone(),
                enabled: true,
                muted: false,
            };
            
            self.audio_tracks.insert(track_id.clone(), audio_track_info);
            
            // Broadcast event
            let _ = self.event_tx.send(WebRTCEvent::AudioTrackAdded {
                track_id: track_id.clone(),
                user_id: connection_info.user_id.clone(),
                room_id: connection_info.room_id.clone(),
            });
            
            info!("Added audio track {} for connection: {}", track_id, connection_id);
            Ok(track_id)
        } else {
            Err(anyhow::anyhow!("Connection not found: {}", connection_id))
        }
    }
    
    pub fn mute_audio_track(&self, track_id: &str, muted: bool) -> Result<()> {
        if let Some(mut track) = self.audio_tracks.get_mut(track_id) {
            track.muted = muted;
            info!("Audio track {} muted: {}", track_id, muted);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Audio track not found: {}", track_id))
        }
    }
    
    pub fn get_room_connections(&self, room_id: &str) -> Vec<String> {
        self.room_connections
            .get(room_id)
            .map(|conns| conns.clone())
            .unwrap_or_else(Vec::new)
    }
    
    pub fn get_user_connections(&self, user_id: &str) -> Vec<String> {
        self.user_connections
            .get(user_id)
            .map(|conns| conns.clone())
            .unwrap_or_else(Vec::new)
    }
    
    pub fn get_connection(&self, connection_id: &str) -> Option<Arc<RTCPeerConnection>> {
        self.connections.get(connection_id).map(|conn| conn.connection.clone())
    }
    
    pub fn get_connection_info(&self, connection_id: &str) -> Option<PeerConnectionInfo> {
        self.connections.get(connection_id).map(|conn| conn.clone())
    }
    
    pub fn subscribe_to_events(&self) -> broadcast::Receiver<WebRTCEvent> {
        self.event_tx.subscribe()
    }
    
    pub fn get_room_audio_tracks(&self, room_id: &str) -> Vec<AudioTrackInfo> {
        let room_connections = self.get_room_connections(room_id);
        let mut tracks = Vec::new();
        
        for conn_id in room_connections {
            if let Some(connection_info) = self.connections.get(&conn_id) {
                for track in self.audio_tracks.iter() {
                    if track.user_id == connection_info.user_id {
                        tracks.push(track.clone());
                    }
                }
            }
        }
        
        tracks
    }
    
    // Cleanup inactive connections periodically
    pub async fn cleanup_inactive_connections(&self) {
        let now = chrono::Utc::now();
        let timeout_duration = chrono::Duration::minutes(10);
        
        let mut to_remove = Vec::new();
        
        for entry in self.connections.iter() {
            let connection_info = entry.value();
            if now.signed_duration_since(connection_info.created_at) > timeout_duration
                && (connection_info.connection_state == ConnectionState::Disconnected
                    || connection_info.connection_state == ConnectionState::Failed)
            {
                to_remove.push(connection_info.id.clone());
            }
        }
        
        for connection_id in to_remove {
            if let Err(e) = self.close_connection(&connection_id).await {
                error!("Failed to cleanup connection {}: {}", connection_id, e);
            }
        }
    }
    
    pub fn get_connection_stats(&self) -> ConnectionStats {
        let mut stats = ConnectionStats {
            total_connections: self.connections.len(),
            active_connections: 0,
            total_rooms: self.room_connections.len(),
            total_audio_tracks: self.audio_tracks.len(),
            connections_by_state: std::collections::HashMap::new(),
        };
        
        for entry in self.connections.iter() {
            let connection_info = entry.value();
            
            if connection_info.connection_state == ConnectionState::Connected {
                stats.active_connections += 1;
            }
            
            *stats.connections_by_state
                .entry(format!("{:?}", connection_info.connection_state))
                .or_insert(0) += 1;
        }
        
        stats
    }
}

#[derive(Debug, Serialize)]
pub struct ConnectionStats {
    pub total_connections: usize,
    pub active_connections: usize,
    pub total_rooms: usize,
    pub total_audio_tracks: usize,
    pub connections_by_state: std::collections::HashMap<String, usize>,
}
