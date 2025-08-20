use dashmap::DashMap;
use tokio::sync::broadcast;
use std::collections::HashSet;
use std::sync::Arc;
use serde::{Serialize, Deserialize};
use tracing::{info, debug};

use super::messages::ServerMessage;

#[derive(Clone)]
pub struct ConnectionManager {
    // user_id -> broadcast channel для отправки сообщений
    connections: Arc<DashMap<String, broadcast::Sender<ServerMessage>>>,
    
    // guild_id -> Set<user_id> - кто в какой гильдии
    guild_members: Arc<DashMap<String, HashSet<String>>>,
    
    // channel_id -> Set<user_id> - кто подписан на канал
    channel_subscribers: Arc<DashMap<String, HashSet<String>>>,
    
    // user_id -> User presence data
    presence: Arc<DashMap<String, UserPresence>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: String,
    pub username: String,
    pub display_name: String,
    pub status: String, // online, idle, dnd, offline
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(DashMap::new()),
            guild_members: Arc::new(DashMap::new()),
            channel_subscribers: Arc::new(DashMap::new()),
            presence: Arc::new(DashMap::new()),
        }
    }

    pub async fn add_connection(&self, user_id: String, username: String, display_name: String) -> broadcast::Receiver<ServerMessage> {
        let (tx, rx) = broadcast::channel(256);
        
        // Сохраняем connection
        self.connections.insert(user_id.clone(), tx);
        
        // Обновляем presence
        self.presence.insert(user_id.clone(), UserPresence {
            user_id: user_id.clone(),
            username: username.clone(),
            display_name: display_name.clone(),
            status: "online".to_string(),
            last_seen: chrono::Utc::now(),
        });
        
        info!("User {} connected (total: {})", user_id, self.connections.len());
        
        // Уведомляем всех о новом онлайн пользователе
        self.broadcast_presence_update(&user_id, "online").await;
        
        rx
    }

    pub async fn remove_connection(&self, user_id: &str) {
        self.connections.remove(user_id);
        
        // Обновляем presence на offline
        if let Some(mut presence) = self.presence.get_mut(user_id) {
            presence.status = "offline".to_string();
            presence.last_seen = chrono::Utc::now();
        }
        
        info!("User {} disconnected (remaining: {})", user_id, self.connections.len());
        
        // Уведомляем всех об offline статусе
        self.broadcast_presence_update(user_id, "offline").await;
    }

    pub async fn join_guild(&self, user_id: String, guild_id: String) {
        self.guild_members
            .entry(guild_id.clone())
            .or_insert_with(HashSet::new)
            .insert(user_id.clone());
        
        debug!("User {} joined guild {}", user_id, guild_id);
    }

    pub async fn leave_guild(&self, user_id: &str, guild_id: &str) {
        if let Some(mut members) = self.guild_members.get_mut(guild_id) {
            members.remove(user_id);
            debug!("User {} left guild {}", user_id, guild_id);
        }
    }

    pub async fn subscribe_channel(&self, user_id: String, channel_id: String) {
        self.channel_subscribers
            .entry(channel_id.clone())
            .or_insert_with(HashSet::new)
            .insert(user_id.clone());
        
        debug!("User {} subscribed to channel {}", user_id, channel_id);
    }

    pub async fn unsubscribe_channel(&self, user_id: &str, channel_id: &str) {
        if let Some(mut subscribers) = self.channel_subscribers.get_mut(channel_id) {
            subscribers.remove(user_id);
            debug!("User {} unsubscribed from channel {}", user_id, channel_id);
        }
    }

    pub async fn broadcast_to_channel(&self, channel_id: &str, message: ServerMessage) {
        if let Some(subscribers) = self.channel_subscribers.get(channel_id) {
            let mut sent_count = 0;
            for user_id in subscribers.iter() {
                if let Some(tx) = self.connections.get(user_id) {
                    if tx.send(message.clone()).is_ok() {
                        sent_count += 1;
                    }
                }
            }
            debug!("Broadcasted to {} users in channel {}", sent_count, channel_id);
        }
    }

    pub async fn broadcast_to_guild(&self, guild_id: &str, message: ServerMessage) {
        if let Some(members) = self.guild_members.get(guild_id) {
            let mut sent_count = 0;
            for user_id in members.iter() {
                if let Some(tx) = self.connections.get(user_id) {
                    if tx.send(message.clone()).is_ok() {
                        sent_count += 1;
                    }
                }
            }
            debug!("Broadcasted to {} users in guild {}", sent_count, guild_id);
        }
    }

    pub async fn send_to_user(&self, user_id: &str, message: ServerMessage) {
        if let Some(tx) = self.connections.get(user_id) {
            let _ = tx.send(message);
        }
    }

    async fn broadcast_presence_update(&self, user_id: &str, status: &str) {
        let message = ServerMessage::PresenceUpdate {
            user_id: user_id.to_string(),
            status: status.to_string(),
            timestamp: chrono::Utc::now(),
        };

        // Отправляем всем пользователям в гильдиях этого пользователя
        for guild in self.guild_members.iter() {
            if guild.value().contains(user_id) {
                self.broadcast_to_guild(&guild.key(), message.clone()).await;
            }
        }
    }

    pub fn get_online_users(&self, guild_id: &str) -> Vec<UserPresence> {
        let mut online = Vec::new();
        if let Some(members) = self.guild_members.get(guild_id) {
            for user_id in members.iter() {
                if self.connections.contains_key(user_id) {
                    if let Some(presence) = self.presence.get(user_id) {
                        online.push(presence.clone());
                    }
                }
            }
        }
        online
    }

    pub fn get_stats(&self) -> ConnectionStats {
        ConnectionStats {
            total_connections: self.connections.len(),
            total_guilds: self.guild_members.len(),
            total_channels: self.channel_subscribers.len(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ConnectionStats {
    pub total_connections: usize,
    pub total_guilds: usize,
    pub total_channels: usize,
}
