use axum::extract::ws::{Message, WebSocket};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use redis::{aio::ConnectionManager, AsyncCommands, Client as RedisClient};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, RwLock};
use tracing::{error, info, warn};
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserStatus {
    Online,
    Away,
    DoNotDisturb,
    Invisible,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPresence {
    pub user_id: String,
    pub status: UserStatus,
    pub activity: Option<String>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
    pub guild_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceUpdate {
    pub user_id: String,
    pub status: UserStatus,
    pub activity: Option<String>,
    pub guild_id: Option<String>,
}

pub struct PresenceManager {
    // In-memory cache for fast access
    presence_cache: Arc<DashMap<String, UserPresence>>,
    // Redis for persistence and cross-service communication
    redis: Option<ConnectionManager>,
    // Broadcast channel for real-time updates
    presence_tx: broadcast::Sender<PresenceUpdate>,
    // Active WebSocket connections
    connections: Arc<DashMap<String, tokio::sync::mpsc::UnboundedSender<Message>>>,
}

impl PresenceManager {
    pub async fn new() -> Result<Self> {
        let (presence_tx, _) = broadcast::channel(1000);

        // Try to connect to Redis, but don't fail if it's not available
        let redis = match Self::connect_redis().await {
            Ok(conn) => Some(conn),
            Err(e) => {
                warn!("Failed to connect to Redis: {}. Using in-memory cache only.", e);
                None
            }
        };

        let manager = Self {
            presence_cache: Arc::new(DashMap::new()),
            redis,
            presence_tx,
            connections: Arc::new(DashMap::new()),
        };

        // Start cleanup task for offline users
        let cleanup_manager = manager.clone();
        tokio::spawn(async move {
            cleanup_manager.cleanup_task().await;
        });

        Ok(manager)
    }

    async fn connect_redis() -> Result<ConnectionManager> {
        let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        let client = RedisClient::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        info!("Connected to Redis for presence management");
        Ok(conn)
    }

    pub async fn update_presence(&self, mut presence: UserPresence) -> Result<()> {
        presence.last_seen = chrono::Utc::now();
        
        // Update in-memory cache
        self.presence_cache.insert(presence.user_id.clone(), presence.clone());

        // Update in Redis if available
        if let Some(ref mut redis) = self.redis.as_ref().map(|r| r.clone()) {
            let key = format!("presence:{}", presence.user_id);
            let value = serde_json::to_string(&presence)?;
            let _: () = redis.set_ex(key, value, 3600).await?; // 1 hour TTL
        }

        // Broadcast update to subscribers
        let update = PresenceUpdate {
            user_id: presence.user_id.clone(),
            status: presence.status.clone(),
            activity: presence.activity.clone(),
            guild_id: presence.guild_id.clone(),
        };

        if let Err(e) = self.presence_tx.send(update) {
            error!("Failed to broadcast presence update: {}", e);
        }

        // Notify WebSocket connections
        self.notify_connections(&presence).await;

        info!("Updated presence for user: {}", presence.user_id);
        Ok(())
    }

    pub async fn get_presence(&self, user_id: &str) -> Option<UserPresence> {
        // Check in-memory cache first
        if let Some(presence) = self.presence_cache.get(user_id) {
            return Some(presence.clone());
        }

        // Fall back to Redis if available
        if let Some(ref mut redis) = self.redis.as_ref().map(|r| r.clone()) {
            let key = format!("presence:{}", user_id);
            if let Ok(value) = redis.get::<_, Option<String>>(key).await {
                if let Some(value) = value {
                    if let Ok(presence) = serde_json::from_str::<UserPresence>(&value) {
                        // Cache it for future use
                        self.presence_cache.insert(user_id.to_string(), presence.clone());
                        return Some(presence);
                    }
                }
            }
        }

        None
    }

    pub async fn get_guild_presence(&self, guild_id: &str) -> Vec<UserPresence> {
        let mut guild_presence = Vec::new();

        // Get from in-memory cache
        for entry in self.presence_cache.iter() {
            let presence = entry.value();
            if let Some(ref user_guild_id) = presence.guild_id {
                if user_guild_id == guild_id {
                    guild_presence.push(presence.clone());
                }
            }
        }

        // TODO: Also fetch from Redis if needed for better consistency
        guild_presence
    }

    pub async fn set_user_offline(&self, user_id: &str) -> Result<()> {
        if let Some(mut presence) = self.presence_cache.get_mut(user_id) {
            presence.status = UserStatus::Offline;
            presence.last_seen = chrono::Utc::now();

            // Update Redis if available
            if let Some(ref mut redis) = self.redis.as_ref().map(|r| r.clone()) {
                let key = format!("presence:{}", user_id);
                let value = serde_json::to_string(&*presence)?;
                let _: () = redis.set_ex(key, value, 3600).await?;
            }

            // Broadcast update
            let update = PresenceUpdate {
                user_id: presence.user_id.clone(),
                status: presence.status.clone(),
                activity: presence.activity.clone(),
                guild_id: presence.guild_id.clone(),
            };

            if let Err(e) = self.presence_tx.send(update) {
                error!("Failed to broadcast offline status: {}", e);
            }
        }

        Ok(())
    }

    pub fn subscribe_to_updates(&self) -> broadcast::Receiver<PresenceUpdate> {
        self.presence_tx.subscribe()
    }

    async fn notify_connections(&self, presence: &UserPresence) {
        let message = Message::Text(serde_json::to_string(presence).unwrap_or_default());
        
        // Notify all connected clients
        let mut to_remove = Vec::new();
        for entry in self.connections.iter() {
            if let Err(_) = entry.value().send(message.clone()) {
                to_remove.push(entry.key().clone());
            }
        }

        // Clean up dead connections
        for key in to_remove {
            self.connections.remove(&key);
        }
    }

    pub async fn add_connection(&self, user_id: String, sender: tokio::sync::mpsc::UnboundedSender<Message>) {
        self.connections.insert(user_id, sender);
    }

    pub async fn remove_connection(&self, user_id: &str) {
        self.connections.remove(user_id);
    }

    async fn cleanup_task(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes

        loop {
            interval.tick().await;
            
            let now = chrono::Utc::now();
            let mut to_cleanup = Vec::new();

            // Find users who haven't been seen for more than 10 minutes
            for entry in self.presence_cache.iter() {
                let presence = entry.value();
                if now.signed_duration_since(presence.last_seen).num_seconds() > 600 {
                    to_cleanup.push(presence.user_id.clone());
                }
            }

            // Set them as offline
            for user_id in to_cleanup {
                if let Err(e) = self.set_user_offline(&user_id).await {
                    error!("Failed to set user {} offline during cleanup: {}", user_id, e);
                }
            }
        }
    }
}

impl Clone for PresenceManager {
    fn clone(&self) -> Self {
        Self {
            presence_cache: Arc::clone(&self.presence_cache),
            redis: self.redis.clone(),
            presence_tx: self.presence_tx.clone(),
            connections: Arc::clone(&self.connections),
        }
    }
}

pub async fn handle_websocket(socket: WebSocket, presence_manager: Arc<PresenceManager>) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

    // Task to send messages to the WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Subscribe to presence updates
    let mut presence_updates = presence_manager.subscribe_to_updates();
    let presence_update_tx = tx.clone();
    let presence_update_task = tokio::spawn(async move {
        while let Ok(update) = presence_updates.recv().await {
            let message = Message::Text(serde_json::to_string(&update).unwrap_or_default());
            if presence_update_tx.send(message).is_err() {
                break;
            }
        }
    });

    let mut user_id: Option<String> = None;

    // Handle incoming messages
    while let Some(msg) = receiver.next().await {
        if let Ok(msg) = msg {
            match msg {
                Message::Text(text) => {
                    // Try to parse as presence update
                    if let Ok(presence) = serde_json::from_str::<UserPresence>(&text) {
                        user_id = Some(presence.user_id.clone());
                        presence_manager.add_connection(presence.user_id.clone(), tx.clone()).await;
                        
                        if let Err(e) = presence_manager.update_presence(presence).await {
                            error!("Failed to update presence: {}", e);
                        }
                    }
                }
                Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }
    }

    // Cleanup
    if let Some(user_id) = user_id {
        presence_manager.remove_connection(&user_id).await;
        if let Err(e) = presence_manager.set_user_offline(&user_id).await {
            error!("Failed to set user offline: {}", e);
        }
    }

    send_task.abort();
    presence_update_task.abort();
}
