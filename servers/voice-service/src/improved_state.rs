use anyhow::Result;
use livekit_api::{services::room::CreateRoomOptions, RoomClient};
use redis::aio::ConnectionManager;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

#[derive(Clone)]
pub struct VoiceServiceState {
    pub redis: Arc<RedisClient>,
    pub livekit: Arc<LiveKitClient>,
    pub rooms: Arc<RwLock<std::collections::HashMap<String, RoomState>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomState {
    pub room_id: String,
    pub name: String,
    pub participants: Vec<Participant>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub max_participants: usize,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participant {
    pub user_id: String,
    pub username: String,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub is_speaking: bool,
    pub is_muted: bool,
    pub is_deafened: bool,
}

// Redis client с connection pooling и retry logic
pub struct RedisClient {
    connection: ConnectionManager,
    pool_size: usize,
}

impl RedisClient {
    pub async fn new(redis_url: String) -> Result<Self> {
        info!("Connecting to Redis at {}", mask_url(&redis_url));
        
        let client = redis::Client::open(redis_url)?;
        let connection = ConnectionManager::new(client).await?;
        
        Ok(Self {
            connection,
            pool_size: 10,
        })
    }
    
    pub async fn get_room(&self, room_id: &str) -> Result<Option<RoomState>> {
        use redis::AsyncCommands;
        
        let key = format!("room:{}", room_id);
        let data: Option<String> = self.connection.clone().get(&key).await?;
        
        match data {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }
    
    pub async fn save_room(&self, room: &RoomState) -> Result<()> {
        use redis::AsyncCommands;
        
        let key = format!("room:{}", room.room_id);
        let json = serde_json::to_string(room)?;
        
        // Сохраняем с TTL 24 часа
        self.connection.clone()
            .set_ex(&key, json, 86400)
            .await?;
        
        Ok(())
    }
    
    pub async fn publish_event(&self, channel: &str, event: &VoiceEvent) -> Result<()> {
        use redis::AsyncCommands;
        
        let json = serde_json::to_string(event)?;
        self.connection.clone()
            .publish(channel, json)
            .await?;
        
        Ok(())
    }
}

// LiveKit client с retry и fallback
pub struct LiveKitClient {
    room_client: RoomClient,
    api_key: String,
    api_secret: String,
    url: String,
}

impl LiveKitClient {
    pub fn new(url: String, api_key: String, api_secret: String) -> Self {
        let room_client = RoomClient::new(&url, &api_key, &api_secret);
        
        Self {
            room_client,
            api_key,
            api_secret,
            url,
        }
    }
    
    pub async fn create_room(&self, name: &str, max_participants: u32) -> Result<String> {
        let options = CreateRoomOptions {
            name: name.to_string(),
            max_participants,
            empty_timeout: 300, // 5 минут
            ..Default::default()
        };
        
        // Retry logic для создания комнаты
        let mut retries = 3;
        let mut last_error = None;
        
        while retries > 0 {
            match self.room_client.create_room(&options.name, options.clone()).await {
                Ok(room) => {
                    info!("Created LiveKit room: {}", room.name);
                    return Ok(room.sid);
                }
                Err(e) => {
                    warn!("Failed to create room (retries left: {}): {}", retries - 1, e);
                    last_error = Some(e);
                    retries -= 1;
                    
                    if retries > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    }
                }
            }
        }
        
        Err(anyhow::anyhow!("Failed to create room after 3 attempts: {:?}", last_error))
    }
    
    pub async fn delete_room(&self, room_name: &str) -> Result<()> {
        self.room_client.delete_room(room_name).await?;
        info!("Deleted LiveKit room: {}", room_name);
        Ok(())
    }
    
    pub async fn list_participants(&self, room_name: &str) -> Result<Vec<String>> {
        let participants = self.room_client.list_participants(room_name).await?;
        Ok(participants.iter().map(|p| p.identity.clone()).collect())
    }
    
    pub fn generate_token(&self, room_name: &str, user_id: &str, username: &str) -> Result<String> {
        use livekit_api::access_token::{AccessToken, VideoGrants};
        use std::time::{Duration, SystemTime};
        
        let grants = VideoGrants {
            room_join: true,
            room: room_name.to_string(),
            can_publish: true,
            can_subscribe: true,
            can_publish_data: true,
            ..Default::default()
        };
        
        let token = AccessToken::with_api_key(&self.api_key, &self.api_secret)
            .with_identity(user_id)
            .with_name(username)
            .with_grants(grants)
            .with_ttl(Duration::from_secs(86400)) // 24 часа
            .to_jwt()?;
        
        Ok(token)
    }
}

// WebSocket events для real-time обновлений
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VoiceEvent {
    UserJoined {
        room_id: String,
        user_id: String,
        username: String,
    },
    UserLeft {
        room_id: String,
        user_id: String,
    },
    UserSpeaking {
        room_id: String,
        user_id: String,
        is_speaking: bool,
    },
    UserMuted {
        room_id: String,
        user_id: String,
        is_muted: bool,
    },
    RoomCreated {
        room_id: String,
        name: String,
    },
    RoomDeleted {
        room_id: String,
    },
}

impl VoiceServiceState {
    pub async fn new(
        redis_url: String,
        livekit_url: String,
        api_key: String,
        api_secret: String,
    ) -> Result<Self> {
        let redis = Arc::new(RedisClient::new(redis_url).await?);
        let livekit = Arc::new(LiveKitClient::new(livekit_url, api_key, api_secret));
        let rooms = Arc::new(RwLock::new(std::collections::HashMap::new()));
        
        Ok(Self {
            redis,
            livekit,
            rooms,
        })
    }
    
    pub async fn create_room(&self, name: &str, max_participants: usize) -> Result<RoomState> {
        // Создаем комнату в LiveKit
        let room_id = self.livekit.create_room(name, max_participants as u32).await?;
        
        // Создаем состояние комнаты
        let room = RoomState {
            room_id: room_id.clone(),
            name: name.to_string(),
            participants: Vec::new(),
            created_at: chrono::Utc::now(),
            max_participants,
            metadata: None,
        };
        
        // Сохраняем в Redis
        self.redis.save_room(&room).await?;
        
        // Сохраняем в локальный кеш
        self.rooms.write().await.insert(room_id.clone(), room.clone());
        
        // Публикуем событие
        self.redis.publish_event(
            "voice:events",
            &VoiceEvent::RoomCreated {
                room_id: room_id.clone(),
                name: name.to_string(),
            },
        ).await?;
        
        Ok(room)
    }
    
    pub async fn join_room(
        &self,
        room_id: &str,
        user_id: &str,
        username: &str,
    ) -> Result<String> {
        // Получаем комнату
        let mut rooms = self.rooms.write().await;
        let room = rooms.get_mut(room_id)
            .ok_or_else(|| anyhow::anyhow!("Room not found"))?;
        
        // Проверяем лимит участников
        if room.participants.len() >= room.max_participants {
            return Err(anyhow::anyhow!("Room is full"));
        }
        
        // Добавляем участника
        let participant = Participant {
            user_id: user_id.to_string(),
            username: username.to_string(),
            joined_at: chrono::Utc::now(),
            is_speaking: false,
            is_muted: false,
            is_deafened: false,
        };
        
        room.participants.push(participant);
        
        // Сохраняем в Redis
        self.redis.save_room(room).await?;
        
        // Генерируем токен для LiveKit
        let token = self.livekit.generate_token(&room.name, user_id, username)?;
        
        // Публикуем событие
        self.redis.publish_event(
            "voice:events",
            &VoiceEvent::UserJoined {
                room_id: room_id.to_string(),
                user_id: user_id.to_string(),
                username: username.to_string(),
            },
        ).await?;
        
        Ok(token)
    }
    
    pub async fn leave_room(&self, room_id: &str, user_id: &str) -> Result<()> {
        let mut rooms = self.rooms.write().await;
        
        if let Some(room) = rooms.get_mut(room_id) {
            // Удаляем участника
            room.participants.retain(|p| p.user_id != user_id);
            
            // Если комната пуста, удаляем её
            if room.participants.is_empty() {
                self.livekit.delete_room(&room.name).await?;
                rooms.remove(room_id);
                
                // Публикуем событие удаления комнаты
                self.redis.publish_event(
                    "voice:events",
                    &VoiceEvent::RoomDeleted {
                        room_id: room_id.to_string(),
                    },
                ).await?;
            } else {
                // Сохраняем обновленное состояние
                self.redis.save_room(room).await?;
                
                // Публикуем событие ухода пользователя
                self.redis.publish_event(
                    "voice:events",
                    &VoiceEvent::UserLeft {
                        room_id: room_id.to_string(),
                        user_id: user_id.to_string(),
                    },
                ).await?;
            }
        }
        
        Ok(())
    }
}

fn mask_url(url: &str) -> String {
    if let Some(at_pos) = url.find('@') {
        if let Some(protocol_end) = url.find("://") {
            let protocol = &url[..protocol_end + 3];
            let server = &url[at_pos..];
            format!("{}***{}", protocol, server)
        } else {
            url.to_string()
        }
    } else {
        url.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_room_creation() {
        // Мокаем зависимости для тестирования
        // В реальном проекте использовать mockall или similar
    }
}
