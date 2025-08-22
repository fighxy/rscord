use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info, warn};
use dashmap::DashMap;

use crate::AppState;
use super::chat_client::{ChatServiceClient, CreateMessageRequest};
use super::auth::{JwtValidator, simple_token_validation};
use super::presence_client::{PresenceServiceClient, UserStatus};

pub type SharedState = Arc<ConnectionManager>;

#[derive(Clone)]
pub struct ConnectionManager {
    // user_id -> connection info
    pub connections: Arc<DashMap<String, ConnectionInfo>>,
    // channel_id -> broadcast sender
    pub channels: Arc<DashMap<String, broadcast::Sender<String>>>,
}

#[derive(Clone)]
pub struct ConnectionInfo {
    pub user_id: String,
    pub username: String,
    pub current_channel: Option<String>,
    pub sender: broadcast::Sender<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum WsMessage {
    // Client -> Server
    #[serde(rename = "join_channel")]
    JoinChannel { channel_id: String },
    
    #[serde(rename = "leave_channel")]
    LeaveChannel { channel_id: String },
    
    #[serde(rename = "send_message")]
    SendMessage { 
        channel_id: String, 
        content: String 
    },
    
    #[serde(rename = "typing_start")]
    TypingStart { channel_id: String },
    
    #[serde(rename = "typing_stop")]
    TypingStop { channel_id: String },
    
    #[serde(rename = "presence_update")]
    PresenceUpdate {
        status: String,
        activity: Option<String>,
    },
    
    // Server -> Client
    #[serde(rename = "message_received")]
    MessageReceived {
        channel_id: String,
        user_id: String,
        username: String,
        content: String,
        timestamp: i64,
    },
    
    #[serde(rename = "user_joined")]
    UserJoined {
        channel_id: String,
        user_id: String,
        username: String,
    },
    
    #[serde(rename = "user_left")]
    UserLeft {
        channel_id: String,
        user_id: String,
    },
    
    #[serde(rename = "typing_indicator")]
    TypingIndicator {
        channel_id: String,
        user_id: String,
        username: String,
        is_typing: bool,
    },
    
    #[serde(rename = "error")]
    Error { message: String },
    
    #[serde(rename = "pong")]
    Pong,
}

pub struct WebSocketHandler {
    app_state: AppState,
    connection_manager: SharedState,
    chat_client: ChatServiceClient,
    presence_client: PresenceServiceClient,
    jwt_validator: JwtValidator,
}

impl WebSocketHandler {
    pub fn new(app_state: AppState) -> Self {
        let chat_service_url = "http://127.0.0.1:14703".to_string(); // chat-service URL
        let presence_service_url = "http://127.0.0.1:14706".to_string(); // presence-service URL
        let jwt_secret = app_state.jwt_secret.clone();
        
        Self {
            app_state,
            connection_manager: Arc::new(ConnectionManager {
                connections: Arc::new(DashMap::new()),
                channels: Arc::new(DashMap::new()),
            }),
            chat_client: ChatServiceClient::new(chat_service_url),
            presence_client: PresenceServiceClient::new(presence_service_url),
            jwt_validator: JwtValidator::new(jwt_secret),
        }
    }

    pub async fn handle_socket(self, socket: WebSocket, token: String) {
        // Валидация JWT токена
        let (user_id, username) = match self.jwt_validator.extract_user_info(&token) {
            Ok((uid, uname)) => (uid, uname),
            Err(e) => {
                warn!("JWT validation failed: {}, falling back to simple validation", e);
                match simple_token_validation(&token) {
                    Ok((uid, uname)) => (uid, uname),
                    Err(e) => {
                        error!("Token validation failed: {}", e);
                        return;
                    }
                }
            }
        };
        
        info!("WebSocket connection established for user: {}", user_id);
        
        // Обновляем presence на Online
        if let Err(e) = self.presence_client.update_presence(
            &user_id,
            UserStatus::Online,
            None,
            &token,
        ).await {
            warn!("Failed to update presence to online: {}", e);
        }
        
        let (mut sender, mut receiver) = socket.split();
        let (tx, mut rx) = broadcast::channel::<String>(100);
        
        // Добавляем соединение в менеджер
        let connection_info = ConnectionInfo {
            user_id: user_id.clone(),
            username: username.clone(),
            current_channel: None,
            sender: tx.clone(),
        };
        
        self.connection_manager.connections.insert(user_id.clone(), connection_info);
        
        // Таск для отправки сообщений клиенту
        let tx_task = tokio::spawn(async move {
            while let Ok(msg) = rx.recv().await {
                if sender.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        });
        
        // Обработка входящих сообщений
        let user_id_clone = user_id.clone();
        let manager_clone = self.connection_manager.clone();
        let app_state_clone = self.app_state.clone();
        let chat_client_clone = self.chat_client.clone();
        let token_clone = token.clone();
        
        let rx_task = tokio::spawn(async move {
            while let Some(msg) = receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Err(e) = Self::handle_message(
                            &text, 
                            &user_id_clone, 
                            &manager_clone,
                            &app_state_clone,
                            &chat_client_clone,
                            &token_clone,
                        ).await {
                            error!("Error handling message: {}", e);
                        }
                    }
                    Ok(Message::Ping(_payload)) => {
                        // Отвечаем на ping
                        if let Some(conn) = manager_clone.connections.get(&user_id_clone) {
                            let pong_msg = serde_json::to_string(&WsMessage::Pong).unwrap();
                            let _ = conn.sender.send(pong_msg);
                        }
                    }
                    Ok(Message::Close(_)) => {
                        info!("WebSocket closed for user: {}", user_id_clone);
                        break;
                    }
                    Err(e) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });
        
        // Ждем завершения любого из тасков
        tokio::select! {
            _ = tx_task => {
                info!("TX task completed for user: {}", user_id);
            }
            _ = rx_task => {
                info!("RX task completed for user: {}", user_id);
            }
        }
        
        // Очищаем соединение
        self.cleanup_connection(&user_id).await;
    }
    
    async fn handle_message(
        text: &str,
        user_id: &str,
        manager: &SharedState,
        app_state: &AppState,
        chat_client: &ChatServiceClient,
        token: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let ws_message: WsMessage = serde_json::from_str(text)?;
        
        match ws_message {
            WsMessage::JoinChannel { channel_id } => {
                Self::handle_join_channel(user_id, &channel_id, manager).await;
            }
            
            WsMessage::LeaveChannel { channel_id } => {
                Self::handle_leave_channel(user_id, &channel_id, manager).await;
            }
            
            WsMessage::SendMessage { channel_id, content } => {
                Self::handle_send_message(user_id, &channel_id, &content, manager, app_state, chat_client, token).await;
            }
            
            WsMessage::TypingStart { channel_id } => {
                Self::handle_typing_indicator(user_id, &channel_id, true, manager).await;
            }
            
            WsMessage::TypingStop { channel_id } => {
                Self::handle_typing_indicator(user_id, &channel_id, false, manager).await;
            }
            
            WsMessage::PresenceUpdate { status: _, activity: _ } => {
                // Нужно передать presence_client через параметры
                warn!("Presence update received but handler not fully implemented yet");
            }
            
            _ => {
                warn!("Unhandled message type from user: {}", user_id);
            }
        }
        
        Ok(())
    }
    
    async fn handle_join_channel(user_id: &str, channel_id: &str, manager: &SharedState) {
        info!("User {} joining channel {}", user_id, channel_id);
        
        if let Some(mut conn) = manager.connections.get_mut(user_id) {
            // Покидаем предыдущий канал если есть
            if let Some(prev_channel) = &conn.current_channel {
                Self::broadcast_to_channel(
                    prev_channel,
                    &WsMessage::UserLeft {
                        channel_id: prev_channel.clone(),
                        user_id: user_id.to_string(),
                    },
                    manager,
                    Some(user_id),
                ).await;
            }
            
            conn.current_channel = Some(channel_id.to_string());
            
            // Создаем канал если не существует
            if !manager.channels.contains_key(channel_id) {
                let (tx, _) = broadcast::channel::<String>(100);
                manager.channels.insert(channel_id.to_string(), tx);
            }
            
            // Уведомляем других пользователей о присоединении
            Self::broadcast_to_channel(
                channel_id,
                &WsMessage::UserJoined {
                    channel_id: channel_id.to_string(),
                    user_id: user_id.to_string(),
                    username: conn.username.clone(),
                },
                manager,
                Some(user_id),
            ).await;
        }
    }
    
    async fn handle_leave_channel(user_id: &str, channel_id: &str, manager: &SharedState) {
        info!("User {} leaving channel {}", user_id, channel_id);
        
        if let Some(mut conn) = manager.connections.get_mut(user_id) {
            conn.current_channel = None;
            
            Self::broadcast_to_channel(
                channel_id,
                &WsMessage::UserLeft {
                    channel_id: channel_id.to_string(),
                    user_id: user_id.to_string(),
                },
                manager,
                Some(user_id),
            ).await;
        }
    }
    
    async fn handle_send_message(
        user_id: &str,
        channel_id: &str,
        content: &str,
        manager: &SharedState,
        _app_state: &AppState,
        chat_client: &ChatServiceClient,
        token: &str,
    ) {
        if let Some(conn) = manager.connections.get(user_id) {
            // Сохраняем сообщение в базу данных через chat-service API
            let create_request = CreateMessageRequest {
                channel_id: channel_id.to_string(),
                content: content.to_string(),
                author_id: user_id.to_string(),
            };
            
            match chat_client.create_message(create_request, token).await {
                Ok(saved_message) => {
                    // Отправляем сохраненное сообщение всем пользователям в канале
                    let message = WsMessage::MessageReceived {
                        channel_id: channel_id.to_string(),
                        user_id: user_id.to_string(),
                        username: saved_message.author_username,
                        content: saved_message.content,
                        timestamp: chrono::Utc::now().timestamp(),
                    };
                    
                    Self::broadcast_to_channel(channel_id, &message, manager, None).await;
                }
                Err(e) => {
                    error!("Failed to save message to chat-service: {}", e);
                    
                    // Отправляем ошибку пользователю
                    let error_msg = WsMessage::Error {
                        message: "Failed to send message".to_string(),
                    };
                    
                    if let Ok(error_json) = serde_json::to_string(&error_msg) {
                        let _ = conn.sender.send(error_json);
                    }
                }
            }
        }
    }
    
    async fn handle_typing_indicator(
        user_id: &str,
        channel_id: &str,
        is_typing: bool,
        manager: &SharedState,
    ) {
        if let Some(conn) = manager.connections.get(user_id) {
            let message = WsMessage::TypingIndicator {
                channel_id: channel_id.to_string(),
                user_id: user_id.to_string(),
                username: conn.username.clone(),
                is_typing,
            };
            
            Self::broadcast_to_channel(channel_id, &message, manager, Some(user_id)).await;
        }
    }
    
    async fn broadcast_to_channel(
        channel_id: &str,
        message: &WsMessage,
        manager: &SharedState,
        exclude_user: Option<&str>,
    ) {
        let message_json = match serde_json::to_string(message) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to serialize message: {}", e);
                return;
            }
        };
        
        // Находим всех пользователей в канале
        for conn_entry in manager.connections.iter() {
            let (conn_user_id, conn_info) = conn_entry.pair();
            
            // Пропускаем исключенного пользователя
            if let Some(exclude) = exclude_user {
                if conn_user_id == exclude {
                    continue;
                }
            }
            
            // Проверяем что пользователь в нужном канале
            if let Some(current_channel) = &conn_info.current_channel {
                if current_channel == channel_id {
                    if let Err(e) = conn_info.sender.send(message_json.clone()) {
                        warn!("Failed to send message to user {}: {}", conn_user_id, e);
                    }
                }
            }
        }
    }
    
    async fn cleanup_connection(&self, user_id: &str) {
        info!("Cleaning up connection for user: {}", user_id);
        
        // Обновляем presence на Offline
        if let Err(e) = self.presence_client.update_presence(
            user_id,
            UserStatus::Offline,
            None,
            "", // Токен не нужен для offline обновления
        ).await {
            warn!("Failed to update presence to offline: {}", e);
        }
        
        if let Some((_, conn_info)) = self.connection_manager.connections.remove(user_id) {
            // Уведомляем о выходе из канала если был подключен
            if let Some(channel_id) = &conn_info.current_channel {
                Self::broadcast_to_channel(
                    channel_id,
                    &WsMessage::UserLeft {
                        channel_id: channel_id.clone(),
                        user_id: user_id.to_string(),
                    },
                    &self.connection_manager,
                    Some(user_id),
                ).await;
            }
        }
    }
}
