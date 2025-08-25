use anyhow::{Context, Result};
use deadpool_redis::{Config as PoolConfig, Pool, Runtime};
use redis::{aio::MultiplexedConnection, AsyncCommands, Client, RedisResult, Value};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::config::RedisConfig;

/// Менеджер Redis с поддержкой кластеризации, sentinel и connection pooling
#[derive(Clone)]
pub struct RedisManager {
    pool: Pool,
    config: RedisConfig,
    pubsub_client: Arc<RwLock<Client>>,
    metrics: Arc<RedisMetrics>,
}

/// Метрики для мониторинга Redis операций
#[derive(Default)]
struct RedisMetrics {
    operations: prometheus::IntCounterVec,
    errors: prometheus::IntCounterVec,
    latency: prometheus::HistogramVec,
    pool_connections: prometheus::IntGauge,
}

impl RedisManager {
    /// Создает новый Redis manager с connection pooling
    pub async fn new(config: RedisConfig) -> Result<Self> {
        info!("Initializing Redis manager with database {}", config.database);
        
        // Создаем connection pool
        let pool = Self::create_pool(&config).await?;
        
        // Отдельный клиент для PubSub (не может использовать pooled connections)
        let pubsub_client = Arc::new(RwLock::new(
            Client::open(config.url.clone())
                .context("Failed to create Redis PubSub client")?
        ));
        
        // Инициализируем метрики
        let metrics = Arc::new(RedisMetrics::new());
        
        // Проверяем соединение
        let manager = Self {
            pool,
            config,
            pubsub_client,
            metrics,
        };
        
        manager.health_check().await?;
        
        Ok(manager)
    }
    
    /// Создает connection pool в зависимости от конфигурации
    async fn create_pool(config: &RedisConfig) -> Result<Pool> {
        let mut pool_config = PoolConfig::from_url(&config.url);
        pool_config.pool = Some(deadpool::managed::PoolConfig {
            max_size: config.pool_size as usize,
            timeouts: deadpool::managed::Timeouts {
                wait: Some(Duration::from_secs(10)),
                create: Some(Duration::from_secs(5)),
                recycle: Some(Duration::from_secs(5)),
            },
            ..Default::default()
        });
        
        let pool = pool_config
            .create_pool(Some(Runtime::Tokio1))
            .context("Failed to create Redis connection pool")?;
        
        Ok(pool)
    }
    
    /// Проверка здоровья Redis соединения
    pub async fn health_check(&self) -> Result<()> {
        let mut conn = self.pool.get().await
            .context("Failed to get connection from pool")?;
        
        let pong: String = redis::cmd("PING")
            .query_async(&mut conn)
            .await
            .context("Redis health check failed")?;
        
        if pong != "PONG" {
            return Err(anyhow::anyhow!("Unexpected PING response: {}", pong));
        }
        
        debug!("Redis health check passed");
        Ok(())
    }
    
    /// Получает значение по ключу с десериализацией
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        let result: Option<String> = conn.get(&full_key).await
            .context("Failed to get value from Redis")?;
        
        self.record_operation("get", start.elapsed());
        
        match result {
            Some(data) => {
                let value = serde_json::from_str(&data)
                    .context("Failed to deserialize Redis value")?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }
    
    /// Устанавливает значение с TTL
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl_seconds: Option<u64>) -> Result<()> {
        let full_key = self.make_key(key);
        let data = serde_json::to_string(value)
            .context("Failed to serialize value")?;
        
        let mut conn = self.get_connection().await?;
        let ttl = ttl_seconds.unwrap_or(self.config.ttl_seconds);
        
        let start = std::time::Instant::now();
        conn.set_ex(&full_key, data, ttl as usize).await
            .context("Failed to set value in Redis")?;
        
        self.record_operation("set", start.elapsed());
        Ok(())
    }
    
    /// Удаляет ключ
    pub async fn delete(&self, key: &str) -> Result<bool> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        let deleted: bool = conn.del(&full_key).await
            .context("Failed to delete key from Redis")?;
        
        self.record_operation("delete", start.elapsed());
        Ok(deleted)
    }
    
    /// Операции с хэш-таблицами
    pub async fn hset<T: Serialize>(&self, key: &str, field: &str, value: &T) -> Result<()> {
        let full_key = self.make_key(key);
        let data = serde_json::to_string(value)?;
        
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        conn.hset(&full_key, field, data).await?;
        
        self.record_operation("hset", start.elapsed());
        Ok(())
    }
    
    pub async fn hget<T: DeserializeOwned>(&self, key: &str, field: &str) -> Result<Option<T>> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        let result: Option<String> = conn.hget(&full_key, field).await?;
        
        self.record_operation("hget", start.elapsed());
        
        match result {
            Some(data) => Ok(Some(serde_json::from_str(&data)?)),
            None => Ok(None),
        }
    }
    
    pub async fn hgetall<T: DeserializeOwned>(&self, key: &str) -> Result<std::collections::HashMap<String, T>> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        let result: std::collections::HashMap<String, String> = conn.hgetall(&full_key).await?;
        
        self.record_operation("hgetall", start.elapsed());
        
        let mut deserialized = std::collections::HashMap::new();
        for (field, value) in result {
            let parsed: T = serde_json::from_str(&value)?;
            deserialized.insert(field, parsed);
        }
        
        Ok(deserialized)
    }
    
    /// Публикует сообщение в канал
    pub async fn publish<T: Serialize>(&self, channel: &str, message: &T) -> Result<()> {
        let data = serde_json::to_string(message)?;
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        conn.publish(channel, data).await
            .context("Failed to publish message")?;
        
        self.record_operation("publish", start.elapsed());
        Ok(())
    }
    
    /// Создает PubSub подписку
    pub async fn subscribe(&self, channels: Vec<String>) -> Result<PubSubStream> {
        let client = self.pubsub_client.read().await;
        let mut pubsub = client.get_async_pubsub().await
            .context("Failed to create PubSub connection")?;
        
        for channel in &channels {
            pubsub.subscribe(channel).await
                .context(format!("Failed to subscribe to channel: {}", channel))?;
        }
        
        info!("Subscribed to channels: {:?}", channels);
        
        Ok(PubSubStream { pubsub })
    }
    
    /// Атомарный инкремент
    pub async fn incr(&self, key: &str) -> Result<i64> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        let value: i64 = conn.incr(&full_key, 1).await?;
        
        self.record_operation("incr", start.elapsed());
        Ok(value)
    }
    
    /// Атомарный декремент
    pub async fn decr(&self, key: &str) -> Result<i64> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let start = std::time::Instant::now();
        let value: i64 = conn.decr(&full_key, 1).await?;
        
        self.record_operation("decr", start.elapsed());
        Ok(value)
    }
    
    /// Устанавливает значение с истечением срока действия
    pub async fn setex<T: Serialize>(&self, key: &str, seconds: u64, value: &T) -> Result<()> {
        self.set(key, value, Some(seconds)).await
    }
    
    /// Выполняет Lua скрипт для атомарных операций
    pub async fn eval_script(&self, script: &str, keys: Vec<String>, args: Vec<String>) -> Result<Value> {
        let mut conn = self.get_connection().await?;
        
        let full_keys: Vec<String> = keys.iter()
            .map(|k| self.make_key(k))
            .collect();
        
        let start = std::time::Instant::now();
        let result: Value = redis::Script::new(script)
            .key(full_keys)
            .arg(args)
            .invoke_async(&mut conn)
            .await?;
        
        self.record_operation("eval", start.elapsed());
        Ok(result)
    }
    
    /// Операции со списками
    pub async fn lpush<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        let full_key = self.make_key(key);
        let data = serde_json::to_string(value)?;
        let mut conn = self.get_connection().await?;
        
        conn.lpush(&full_key, data).await?;
        Ok(())
    }
    
    pub async fn rpop<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let result: Option<String> = conn.rpop(&full_key, None).await?;
        
        match result {
            Some(data) => Ok(Some(serde_json::from_str(&data)?)),
            None => Ok(None),
        }
    }
    
    /// Проверяет существование ключа
    pub async fn exists(&self, key: &str) -> Result<bool> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let exists: bool = conn.exists(&full_key).await?;
        Ok(exists)
    }
    
    /// Устанавливает TTL для ключа
    pub async fn expire(&self, key: &str, seconds: u64) -> Result<bool> {
        let full_key = self.make_key(key);
        let mut conn = self.get_connection().await?;
        
        let result: bool = conn.expire(&full_key, seconds as i64).await?;
        Ok(result)
    }
    
    /// Транзакционная операция
    pub async fn transaction<F, R>(&self, f: F) -> Result<R>
    where
        F: FnOnce(&mut redis::Pipeline) -> &mut redis::Pipeline,
        R: redis::FromRedisValue,
    {
        let mut conn = self.get_connection().await?;
        let mut pipe = redis::pipe();
        
        f(&mut pipe);
        
        let result: R = pipe.query_async(&mut conn).await?;
        Ok(result)
    }
    
    // Вспомогательные методы
    
    fn make_key(&self, key: &str) -> String {
        format!("{}{}", self.config.key_prefix, key)
    }
    
    async fn get_connection(&self) -> Result<deadpool_redis::Connection> {
        self.pool.get().await
            .context("Failed to get connection from pool")
    }
    
    fn record_operation(&self, operation: &str, duration: Duration) {
        self.metrics.operations
            .with_label_values(&[operation])
            .inc();
        
        self.metrics.latency
            .with_label_values(&[operation])
            .observe(duration.as_secs_f64());
    }
}

/// Stream для получения PubSub сообщений
pub struct PubSubStream {
    pubsub: redis::aio::PubSub,
}

impl PubSubStream {
    /// Получает следующее сообщение из подписки
    pub async fn next_message<T: DeserializeOwned>(&mut self) -> Result<Option<PubSubMessage<T>>> {
        use redis::Msg;
        
        let msg: Msg = self.pubsub.on_message().next_message().await?;
        
        let channel = msg.get_channel_name().to_string();
        let payload: String = msg.get_payload()?;
        let data: T = serde_json::from_str(&payload)?;
        
        Ok(Some(PubSubMessage { channel, data }))
    }
}

#[derive(Debug)]
pub struct PubSubMessage<T> {
    pub channel: String,
    pub data: T,
}

impl RedisMetrics {
    fn new() -> Self {
        let operations = prometheus::register_int_counter_vec!(
            "redis_operations_total",
            "Total number of Redis operations",
            &["operation"]
        ).unwrap();
        
        let errors = prometheus::register_int_counter_vec!(
            "redis_errors_total",
            "Total number of Redis errors",
            &["operation"]
        ).unwrap();
        
        let latency = prometheus::register_histogram_vec!(
            "redis_operation_duration_seconds",
            "Redis operation latency",
            &["operation"]
        ).unwrap();
        
        let pool_connections = prometheus::register_int_gauge!(
            "redis_pool_connections",
            "Number of active Redis connections"
        ).unwrap();
        
        Self {
            operations,
            errors,
            latency,
            pool_connections,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_redis_operations() {
        let config = RedisConfig {
            url: "redis://localhost:6379".to_string(),
            pool_size: 5,
            database: 0,
            key_prefix: "test:".to_string(),
            ttl_seconds: 60,
            cluster_enabled: false,
            sentinel_enabled: false,
            sentinel_master_name: None,
            sentinel_nodes: vec![],
        };
        
        let manager = RedisManager::new(config).await.unwrap();
        
        // Test set and get
        manager.set("test_key", &"test_value", None).await.unwrap();
        let value: Option<String> = manager.get("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));
        
        // Test delete
        let deleted = manager.delete("test_key").await.unwrap();
        assert!(deleted);
    }
}
