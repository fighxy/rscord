use redis::aio::{ConnectionManager, PubSub};
use redis::{AsyncCommands, Client, RedisResult};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use futures_util::StreamExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RedisMessage {
    // Channel messages
    MessageCreate {
        channel_id: String,
        message_id: String,
        author_id: String,
        author_name: String,
        content: String,
        timestamp: i64,
    },
    MessageUpdate {
        channel_id: String,
        message_id: String,
        content: String,
        edited_at: i64,
    },
    MessageDelete {
        channel_id: String,
        message_id: String,
    },
    
    // Typing indicators
    TypingStart {
        channel_id: String,
        user_id: String,
        username: String,
    },
    TypingStop {
        channel_id: String,
        user_id: String,
    },
    
    // Presence updates
    PresenceUpdate {
        user_id: String,
        status: String,
        last_seen: i64,
    },
    
    // Voice state
    VoiceStateUpdate {
        channel_id: String,
        user_id: String,
        muted: bool,
        deafened: bool,
    },
    
    // Channel events
    UserJoinChannel {
        channel_id: String,
        user_id: String,
        username: String,
    },
    UserLeaveChannel {
        channel_id: String,
        user_id: String,
    },
}

pub struct RedisPubSubManager {
    client: Client,
    connection: Arc<RwLock<ConnectionManager>>,
    pubsub: Arc<RwLock<PubSub>>,
}

impl RedisPubSubManager {
    pub async fn new(redis_url: &str) -> RedisResult<Self> {
        let client = Client::open(redis_url)?;
        let connection = ConnectionManager::new(client.clone()).await?;
        let pubsub = client.get_async_pubsub().await?;
        
        info!("Redis PubSub manager initialized");
        
        Ok(Self {
            client,
            connection: Arc::new(RwLock::new(connection)),
            pubsub: Arc::new(RwLock::new(pubsub)),
        })
    }
    
    /// Subscribe to a channel pattern (e.g., "channel:*" for all channels)
    pub async fn subscribe_pattern(&self, pattern: &str) -> RedisResult<()> {
        let mut pubsub = self.pubsub.write().await;
        pubsub.psubscribe(pattern).await?;
        info!("Subscribed to pattern: {}", pattern);
        Ok(())
    }
    
    /// Subscribe to specific channels
    pub async fn subscribe_channels(&self, channels: Vec<String>) -> RedisResult<()> {
        let mut pubsub = self.pubsub.write().await;
        for channel in &channels {
            pubsub.subscribe(channel).await?;
        }
        info!("Subscribed to {} channels", channels.len());
        Ok(())
    }
    
    /// Unsubscribe from channels
    pub async fn unsubscribe_channels(&self, channels: Vec<String>) -> RedisResult<()> {
        let mut pubsub = self.pubsub.write().await;
        for channel in &channels {
            pubsub.unsubscribe(channel).await?;
        }
        info!("Unsubscribed from {} channels", channels.len());
        Ok(())
    }
    
    /// Publish a message to a channel
    pub async fn publish(&self, channel: &str, message: &RedisMessage) -> RedisResult<()> {
        let msg_json = serde_json::to_string(message).map_err(|e| {
            redis::RedisError::from((
                redis::ErrorKind::TypeError,
                "Failed to serialize message",
                e.to_string(),
            ))
        })?;
        
        let mut conn = self.connection.write().await;
        let _: () = conn.publish(channel, msg_json).await?;
        Ok(())
    }
    
    /// Publish to multiple channels
    pub async fn publish_to_many(&self, channels: Vec<String>, message: &RedisMessage) -> RedisResult<()> {
        let msg_json = serde_json::to_string(message).map_err(|e| {
            redis::RedisError::from((
                redis::ErrorKind::TypeError,
                "Failed to serialize message",
                e.to_string(),
            ))
        })?;
        
        let mut conn = self.connection.write().await;
        for channel in channels {
            let _: () = conn.publish(&channel, &msg_json).await?;
        }
        Ok(())
    }
    
    /// Get messages from subscription (non-blocking)
    pub async fn get_message(&self) -> RedisResult<Option<(String, RedisMessage)>> {
        let mut pubsub = self.pubsub.write().await;
        let mut msg_stream = pubsub.on_message();
        
        let result = match msg_stream.next().await {
            Some(msg) => {
                let channel = msg.get_channel_name().to_string();
                let payload: String = msg.get_payload()?;
                
                match serde_json::from_str::<RedisMessage>(&payload) {
                    Ok(redis_msg) => Ok(Some((channel, redis_msg))),
                    Err(e) => {
                        warn!("Failed to deserialize message: {}", e);
                        Ok(None)
                    }
                }
            }
            None => Ok(None)
        };
        
        result
    }
    
    // Session management
    pub async fn set_user_session(&self, user_id: &str, session_data: &str, ttl_seconds: u64) -> RedisResult<()> {
        let mut conn = self.connection.write().await;
        let key = format!("session:{}", user_id);
        conn.set_ex(key, session_data, ttl_seconds).await
    }
    
    pub async fn get_user_session(&self, user_id: &str) -> RedisResult<Option<String>> {
        let mut conn = self.connection.write().await;
        let key = format!("session:{}", user_id);
        conn.get(key).await
    }
    
    pub async fn delete_user_session(&self, user_id: &str) -> RedisResult<()> {
        let mut conn = self.connection.write().await;
        let key = format!("session:{}", user_id);
        conn.del(key).await
    }
    
    // Online users tracking
    pub async fn add_online_user(&self, guild_id: &str, user_id: &str) -> RedisResult<()> {
        let mut conn = self.connection.write().await;
        let key = format!("online:guild:{}", guild_id);
        conn.sadd(key, user_id).await
    }
    
    pub async fn remove_online_user(&self, guild_id: &str, user_id: &str) -> RedisResult<()> {
        let mut conn = self.connection.write().await;
        let key = format!("online:guild:{}", guild_id);
        conn.srem(key, user_id).await
    }
    
    pub async fn get_online_users(&self, guild_id: &str) -> RedisResult<Vec<String>> {
        let mut conn = self.connection.write().await;
        let key = format!("online:guild:{}", guild_id);
        conn.smembers(key).await
    }
    
    // Message caching
    pub async fn cache_message(&self, message_id: &str, message_data: &str, ttl_seconds: u64) -> RedisResult<()> {
        let mut conn = self.connection.write().await;
        let key = format!("msg:{}", message_id);
        conn.set_ex(key, message_data, ttl_seconds).await
    }
    
    pub async fn get_cached_message(&self, message_id: &str) -> RedisResult<Option<String>> {
        let mut conn = self.connection.write().await;
        let key = format!("msg:{}", message_id);
        conn.get(key).await
    }
    
    // Rate limiting
    pub async fn check_rate_limit(&self, user_id: &str, action: &str, max_requests: u32, window_seconds: u64) -> RedisResult<bool> {
        let mut conn = self.connection.write().await;
        let key = format!("rate:{}:{}", user_id, action);
        
        let count: u32 = conn.incr(&key, 1).await?;
        
        if count == 1 {
            conn.expire::<_, ()>(&key, window_seconds as i64).await?;
        }
        
        Ok(count <= max_requests)
    }
}

// Helper for broadcasting to guild members
impl RedisPubSubManager {
    pub async fn broadcast_to_guild(&self, guild_id: &str, message: &RedisMessage) -> RedisResult<()> {
        let channel = format!("guild:{}", guild_id);
        self.publish(&channel, message).await
    }
    
    pub async fn broadcast_to_channel(&self, channel_id: &str, message: &RedisMessage) -> RedisResult<()> {
        let channel = format!("channel:{}", channel_id);
        self.publish(&channel, message).await
    }
    
    pub async fn broadcast_to_user(&self, user_id: &str, message: &RedisMessage) -> RedisResult<()> {
        let channel = format!("user:{}", user_id);
        self.publish(&channel, message).await
    }
}
