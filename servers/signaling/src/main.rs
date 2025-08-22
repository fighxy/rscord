use std::{net::SocketAddr, sync::Arc};

use axum::{extract::{Query, State}, response::IntoResponse, routing::get, Router};
use radiate_common::{verify_jwt, load_config};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use dashmap::DashMap;
// Remove this line or the unused parts:
// use futures::{SinkExt, StreamExt};
// If neither is used, remove the entire line.
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tracing::{error, info};

#[derive(Clone)]
struct AppState {
    rooms: Arc<DashMap<String, broadcast::Sender<SignalMessage>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    Join { room: String, peer_id: String },
    Signal { room: String, from: String, to: String, data: serde_json::Value },
    Broadcast { room: String, from: String, data: serde_json::Value },
    Leave { room: String, peer_id: String },
    // Ping monitoring messages
    Ping { timestamp: u64, sequence: u32 },
    StatsRequest { room: String, peer_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage {
    PeerJoined { peer_id: String },
    PeerLeft { peer_id: String },
    Signal { from: String, to: String, data: serde_json::Value },
    Broadcast { from: String, data: serde_json::Value },
    Joined { room: String },
    Error { message: String },
    // Ping monitoring responses
    Pong { timestamp: u64, sequence: u32, server_timestamp: u64 },
    Stats { 
        peer_id: String,
        network_rtt: Option<u32>,
        webrtc_rtt: Option<u32>, 
        audio_latency: Option<u32>,
        jitter: Option<u32>,
        packet_loss: Option<f32>,
        connection_quality: String, // "excellent", "good", "poor", "disconnected"
    },
}

#[derive(Debug, Clone)]
struct SignalMessage {
    room: String,
    payload: ServerMessage,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let state = AppState { rooms: Arc::new(DashMap::new()) };

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws_handler))
        .route("/api/voice/stats/:room_id", get(get_voice_stats))
        .route("/api/voice/ping", get(ping_test))
        .with_state(state);

    let addr: SocketAddr = ([127, 0, 0, 1], 8787).into();
    info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> impl IntoResponse {
    "ok"
}

use axum::extract::Path;
use axum::response::Json;

#[derive(Serialize)]
struct VoiceStatsResponse {
    room_id: String,
    participants: Vec<ParticipantStats>,
    server_stats: ServerStats,
}

#[derive(Serialize)]
struct ParticipantStats {
    peer_id: String,
    network_rtt: u32,
    webrtc_rtt: u32,
    audio_latency: u32,
    jitter: u32,
    packet_loss: f32,
    connection_quality: String,
    audio_level: f32, // 0.0 - 1.0
    is_speaking: bool,
}

#[derive(Serialize)]
struct ServerStats {
    server_rtt: u32,
    server_load: f32,
    active_rooms: usize,
    total_participants: usize,
}

#[derive(Serialize)]
struct PingResponse {
    server_timestamp: u64,
    server_rtt: u32,
    status: String,
}

async fn get_voice_stats(
    State(state): State<AppState>,
    Path(room_id): Path<String>,
) -> impl IntoResponse {
    // Mock data for now - would integrate with LiveKit in production
    let participants = vec![
        ParticipantStats {
            peer_id: "user123".to_string(),
            network_rtt: 45,
            webrtc_rtt: 52,
            audio_latency: 38,
            jitter: 3,
            packet_loss: 0.1,
            connection_quality: "good".to_string(),
            audio_level: 0.7,
            is_speaking: true,
        },
        ParticipantStats {
            peer_id: "user456".to_string(),
            network_rtt: 67,
            webrtc_rtt: 74,
            audio_latency: 45,
            jitter: 8,
            packet_loss: 0.3,
            connection_quality: "fair".to_string(),
            audio_level: 0.0,
            is_speaking: false,
        }
    ];

    let server_stats = ServerStats {
        server_rtt: 12,
        server_load: 0.35,
        active_rooms: state.rooms.len(),
        total_participants: participants.len(),
    };

    Json(VoiceStatsResponse {
        room_id,
        participants,
        server_stats,
    })
}

async fn ping_test() -> impl IntoResponse {
    let server_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    Json(PingResponse {
        server_timestamp,
        server_rtt: 15, // Mock server processing time
        status: "ok".to_string(),
    })
}

#[derive(serde::Deserialize)]
struct WsQuery { token: Option<String> }

async fn ws_handler(State(state): State<AppState>, Query(q): Query<WsQuery>, ws: WebSocketUpgrade) -> impl IntoResponse {
    if let Some(token) = q.token.as_deref() {
        let cfg = load_config("RADIATE").ok();
        if let Some(secret) = cfg.and_then(|c| c.jwt_secret) {
            if verify_jwt(token, &secret).is_err() {
                return axum::http::StatusCode::UNAUTHORIZED.into_response();
            }
        }
    }
    ws.on_upgrade(|socket| handle_socket(state, socket))
}

async fn handle_socket(state: AppState, mut socket: WebSocket) {
    // Each connection has its own optional room and peer id
    let mut joined_room: Option<String> = None;
    let mut peer_id: Option<String> = None;
    // Each room uses broadcast channel for fanout
    let mut room_rx: Option<broadcast::Receiver<SignalMessage>> = None;

    loop {
        tokio::select! {
            // Incoming from the websocket
            maybe_msg = socket.recv() => {
                match maybe_msg {
                    Some(Ok(msg)) => {
                        if let Err(err) = on_ws_message(&state, &mut joined_room, &mut peer_id, &mut room_rx, msg, &mut socket).await {
                            error!(?err, "error handling ws message");
                            if let Ok(text) = serde_json::to_string(&ServerMessage::Error { message: err.to_string() }) {
        let _ = socket.send(Message::Text(text)).await;
    }
                        }
                    }
                    Some(Err(e)) => {
                        error!(?e, "ws recv error");
                        break;
                    }
                    None => break,
                }
            }
            // Fanout from the room broadcast
            Some(rx) = async { room_rx.as_mut() } , if room_rx.is_some() => {
                match rx.recv().await {
                    Ok(SignalMessage { room: _room, payload }) => {
                        if let Ok(txt) = serde_json::to_string(&payload) {
                            if socket.send(Message::Text(txt)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {}
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }

    // Cleanup on disconnect
    if let (Some(room), Some(self_id)) = (joined_room, peer_id) {
        if let Some(sender) = state.rooms.get(&room) {
            let _ = sender.send(SignalMessage { room: room.clone(), payload: ServerMessage::PeerLeft { peer_id: self_id } });
        }
    }
}

async fn on_ws_message(
    state: &AppState,
    joined_room: &mut Option<String>,
    peer_id: &mut Option<String>,
    room_rx: &mut Option<broadcast::Receiver<SignalMessage>>,
    msg: Message,
    socket: &mut WebSocket,
) -> anyhow::Result<()> {
    match msg {
        Message::Text(txt) => {
            let client_msg: ClientMessage = serde_json::from_str(&txt)?;
            match client_msg {
                ClientMessage::Join { room, peer_id: id } => {
                    let tx = state.rooms.entry(room.clone()).or_insert_with(|| {
                        let (tx, _rx) = broadcast::channel::<SignalMessage>(256);
                        tx
                    }).clone();

                    let rx = tx.subscribe();
                    *joined_room = Some(room.clone());
                    *peer_id = Some(id.clone());
                    *room_rx = Some(rx);

                    // notify joined
                    let _ = socket.send(Message::Text(serde_json::to_string(&ServerMessage::Joined { room: room.clone() })?)).await;
                    let _ = tx.send(SignalMessage { room: room.clone(), payload: ServerMessage::PeerJoined { peer_id: id } });
                }
                ClientMessage::Signal { room, from, to, data } => {
                    if let Some(sender) = state.rooms.get(&room) {
                        let _ = sender.send(SignalMessage { room, payload: ServerMessage::Signal { from, to, data } });
                    }
                }
                ClientMessage::Broadcast { room, from, data } => {
                    if let Some(sender) = state.rooms.get(&room) {
                        let _ = sender.send(SignalMessage { room, payload: ServerMessage::Broadcast { from, data } });
                    }
                }
                ClientMessage::Leave { room, peer_id: id } => {
                    if let Some(sender) = state.rooms.get(&room) {
                        let _ = sender.send(SignalMessage { room, payload: ServerMessage::PeerLeft { peer_id: id } });
                    }
                }
                ClientMessage::Ping { timestamp, sequence } => {
                    let server_timestamp = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64;
                    
                    let pong_response = ServerMessage::Pong { 
                        timestamp, 
                        sequence, 
                        server_timestamp 
                    };
                    let _ = socket.send(Message::Text(serde_json::to_string(&pong_response)?)).await;
                }
                ClientMessage::StatsRequest { room, peer_id: id } => {
                    // Mock stats for now - in production would integrate with LiveKit API
                    let stats = ServerMessage::Stats {
                        peer_id: id.clone(),
                        network_rtt: Some(45), // ms
                        webrtc_rtt: Some(52),  // ms
                        audio_latency: Some(38), // ms
                        jitter: Some(3),       // ms
                        packet_loss: Some(0.1), // %
                        connection_quality: "good".to_string(),
                    };
                    let _ = socket.send(Message::Text(serde_json::to_string(&stats)?)).await;
                }
            }
        }
        Message::Binary(_) | Message::Ping(_) | Message::Pong(_) | Message::Close(_) => {}
    }
    Ok(())
}


