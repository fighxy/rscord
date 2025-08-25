use bb8_redis::{bb8::Pool, RedisConnectionManager};
use redis::{aio::Connection, AsyncCommands, RedisResult};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tracing::{error, info};

#[derive(Error, Debug)]
pub enum RedisError {
    #[error("Connection error: {0}")]
    Connection(#[from] redis::RedisError),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Pool error: {0}")]
    Pool(#[from] bb8::RunError<redis::RedisError>),
    #[error("Room not found: {0}")]
    RoomNotFound(String),
    #[error("User not found: {0}")]
    UserNotFound(String),
}

pub type RedisPool = Arc<Pool<RedisConnectionManager>>;

#[derive(Debug, Clone)]
pub struct RedisManager {
    pool: RedisPool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomData {
    pub room_id: String,
    pub channel_id: String,
    pub guild_id: Option<String>,
    pub participants: Vec<ParticipantData>,
    pub max_participants: usize,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantData {
    pub user_id: String,
    pub username: String,
    pub identity: String,
    pub is_muted: bool,
    pub is_deafened: bool,
    pub is_streaming: bool,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub user_id: String,
    pub room_id: String,
    pub access_token: String,
    pub identity: String,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
}

impl RedisManager {
    pub async fn new(redis_url: &str) -> Result<Self, RedisError> {
        let manager = RedisConnectionManager::new(redis_url)?;
        let pool = Pool::builder()
            .max_size(15)
            .connection_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(Some(std::time::Duration::from_secs(600)))
            .retry_connection(true)
            .build(manager)
            .await?;

        info!("Connected to Redis: {}", redis_url);
        Ok(Self { pool: Arc::new(pool) })
    }

    /// Сохранить данные комнаты
    pub async fn set_room(&self, room_id: &str, room_data: &RoomData) -> Result<(), RedisError> {
        let mut conn = self.pool.get().await?;
        let key = format!("voice:room:{}", room_id);
        let data = serde_json::to_string(room_data)?;
        
        conn.set_ex(&key, &data, 3600).await?; // TTL: 1 час
        
        // Также добавляем в индекс активных комнат
        if room_data.is_active {
            conn.sadd("voice:rooms:active", room_id).await?;
        }
        
        Ok(())
    }

    /// Получить данные комнаты
    pub async fn get_room(&self, room_id: &str) -> Result<Option<RoomData>, RedisError> {
        let mut conn = self.pool.get().await?;
        let key = format!("voice:room:{}", room_id);
        
        let data: Option<String> = conn.get(&key).await?;
        match data {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }

    /// Удалить комнату
    pub async fn remove_room(&self, room_id: &str) -> Result<(), RedisError> {
        let mut conn = self.pool.get().await?;
        let key = format!("voice:room:{}", room_id);
        
        conn.del(&key).await?;
        conn.srem("voice:rooms:active", room_id).await?;
        
        Ok(())
    }

    /// Добавить участника в комнату
    pub async fn add_participant(&self, room_id: &str, participant: &ParticipantData) -> Result<(), RedisError> {
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| RedisError::RoomNotFound(room_id.to_string()))?;
        
        // Удаляем старую запись участника если есть
        room.participants.retain(|p| p.user_id != participant.user_id);
        room.participants.push(participant.clone());
        room.updated_at = chrono::Utc::now();
        
        self.set_room(room_id, &room).await?;
        
        // Обновляем индекс участников
        let mut conn = self.pool.get().await?;
        let participant_key = format!("voice:participant:{}:{}", room_id, participant.user_id);
        let participant_json = serde_json::to_string(participant)?;
        conn.set_ex(&participant_key, &participant_json, 3600).await?;
        
        Ok(())
    }

    /// Удалить участника из комнаты
    pub async fn remove_participant(&self, room_id: &str, user_id: &str) -> Result<(), RedisError> {
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| RedisError::RoomNotFound(room_id.to_string()))?;
        
        room.participants.retain(|p| p.user_id != user_id);
        room.updated_at = chrono::Utc::now();
        
        if room.participants.is_empty() {
            room.is_active = false;
            self.remove_room(room_id).await?;
        } else {
            self.set_room(room_id, &room).await?;
        }
        
        // Удаляем из индекса участников
        let mut conn = self.pool.get().await?;
        let participant_key = format!("voice:participant:{}:{}", room_id, user_id);
        conn.del(&participant_key).await?;
        
        Ok(())
    }

    /// Обновить состояние участника
    pub async fn update_participant_state(
        &self,
        room_id: &str,
        user_id: &str,
        is_muted: Option<bool>,
        is_deafened: Option<bool>,
        is_streaming: Option<bool>,
    ) -> Result<(), RedisError> {
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| RedisError::RoomNotFound(room_id.to_string()))?;
        
        if let Some(participant) = room.participants.iter_mut().find(|p| p.user_id == user_id) {
            if let Some(muted) = is_muted {
                participant.is_muted = muted;
            }
            if let Some(deafened) = is_deafened {
                participant.is_deafened = deafened;
                if deafened {
                    participant.is_muted = true; // Если глухой, то и немой
                }
            }
            if let Some(streaming) = is_streaming {
                participant.is_streaming = streaming;
            }
            participant.last_activity = chrono::Utc::now();
            room.updated_at = chrono::Utc::now();
            
            self.set_room(room_id, &room).await?;
            
            // Обновляем кеш участника
            let participant_key = format!("voice:participant:{}:{}", room_id, user_id);
            let participant_json = serde_json::to_string(participant)?;
            let mut conn = self.pool.get().await?;
            conn.set_ex(&participant_key, &participant_json, 3600).await?;
            
            Ok(())
        } else {
            Err(RedisError::UserNotFound(user_id.to_string()))
        }
    }

    /// Сохранить сессию пользователя
    pub async fn set_user_session(&self, user_id: &str, session: &UserSession) -> Result<(), RedisError> {
        let mut conn = self.pool.get().await?;
        let key = format!("voice:session:{}", user_id);
        let data = serde_json::to_string(session)?;
        
        // TTL основан на expires_at сессии
        let ttl = session.expires_at.timestamp() - chrono::Utc::now().timestamp();
        if ttl > 0 {
            conn.set_ex(&key, &data, ttl as u64).await?;
        }
        
        Ok(())
    }

    /// Получить сессию пользователя
    pub async fn get_user_session(&self, user_id: &str) -> Result<Option<UserSession>, RedisError> {
        let mut conn = self.pool.get().await?;
        let key = format!("voice:session:{}", user_id);
        
        let data: Option<String> = conn.get(&key).await?;
        match data {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }

    /// Удалить сессию пользователя
    pub async fn remove_user_session(&self, user_id: &str) -> Result<(), RedisError> {
        let mut conn = self.pool.get().await?;
        let key = format!("voice:session:{}", user_id);
        conn.del(&key).await?;
        Ok(())
    }

    /// Получить все активные комнаты
    pub async fn get_active_rooms(&self) -> Result<Vec<String>, RedisError> {
        let mut conn = self.pool.get().await?;
        let rooms: Vec<String> = conn.smembers("voice:rooms:active").await?;
        Ok(rooms)
    }

    /// Получить статистику
    pub async fn get_stats(&self) -> Result<VoiceServiceStats, RedisError> {
        let mut conn = self.pool.get().await?;
        let active_rooms: Vec<String> = conn.smembers("voice:rooms:active").await?;
        let total_participants = active_rooms.len();
        
        Ok(VoiceServiceStats {
            active_rooms: active_rooms.len(),
            total_participants,
            redis_connected: true,
        })
    }

    /// Очистка истёкших данных (background task)
    pub async fn cleanup_expired_data(&self) -> Result<(), RedisError> {
        let mut conn = self.pool.get().await?;
        
        // Получаем все активные комнаты
        let active_rooms: Vec<String> = conn.smembers("voice:rooms:active").await?;
        
        for room_id in active_rooms {
            if let Some(room) = self.get_room(&room_id).await? {
                // Если комната неактивна дольше часа - удаляем
                let inactive_duration = chrono::Utc::now() - room.updated_at;
                if inactive_duration.num_hours() > 1 {
                    info!("Removing inactive room: {}", room_id);
                    self.remove_room(&room_id).await?;
                }
            }
        }
        
        Ok(())
    }

    /// Publish event через Redis PubSub
    pub async fn publish_event(&self, channel: &str, event: &str) -> Result<(), RedisError> {
        let mut conn = self.pool.get().await?;
        conn.publish(channel, event).await?;
        Ok(())
    }

    /// Subscribe to Redis PubSub events
    pub async fn subscribe(&self, channels: &[String]) -> Result<redis::aio::PubSub, RedisError> {
        let conn = self.pool.get().await?;
        let mut pubsub = conn.into_pubsub();
        
        for channel in channels {
            pubsub.subscribe(channel).await?;
        }
        
        Ok(pubsub)
    }
}

#[derive(Debug, Serialize)]
pub struct VoiceServiceStats {
    pub active_rooms: usize,
    pub total_participants: usize,
    pub redis_connected: bool,
}
