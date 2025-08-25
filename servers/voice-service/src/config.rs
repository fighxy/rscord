use config::{Config, ConfigError, Environment, File};
use serde::{Deserialize, Serialize};
use std::env;
use std::time::Duration;

/// Основная конфигурация сервиса с security-first подходом
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ServiceConfig {
    pub server: ServerConfig,
    pub redis: RedisConfig,
    pub livekit: LiveKitConfig,
    pub turn: TurnConfig,
    pub jwt: JwtConfig,
    pub database: DatabaseConfig,
    pub monitoring: MonitoringConfig,
    pub rate_limiting: RateLimitConfig,
    pub telegram: TelegramConfig,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub allowed_origins: Vec<String>,
    pub max_connections: usize,
    pub request_timeout_secs: u64,
    pub graceful_shutdown_timeout_secs: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RedisConfig {
    #[serde(skip_serializing)]
    pub url: String,
    pub pool_size: u32,
    pub database: u8,
    pub key_prefix: String,
    pub ttl_seconds: u64,
    pub cluster_enabled: bool,
    pub sentinel_enabled: bool,
    pub sentinel_master_name: Option<String>,
    pub sentinel_nodes: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct LiveKitConfig {
    pub url: String,
    #[serde(skip_serializing)]
    pub api_key: String,
    #[serde(skip_serializing)]
    pub api_secret: String,
    pub webhook_url: String,
    #[serde(skip_serializing)]
    pub webhook_secret: String,
    pub room_empty_timeout_secs: u64,
    pub max_participants_per_room: u32,
    pub default_room_options: RoomOptions,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RoomOptions {
    pub codec: String,
    pub bitrate: u32,
    pub sample_rate: u32,
    pub channels: u8,
    pub enable_dtx: bool,
    pub enable_red: bool,
    pub enable_simulcast: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TurnConfig {
    pub enabled: bool,
    pub urls: Vec<String>,
    #[serde(skip_serializing)]
    pub static_auth_secret: String,
    pub ttl_seconds: u64,
    pub min_port: u16,
    pub max_port: u16,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct JwtConfig {
    #[serde(skip_serializing)]
    pub secret: String,
    pub issuer: String,
    pub audience: String,
    pub access_token_ttl_secs: u64,
    pub refresh_token_ttl_secs: u64,
    pub algorithm: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DatabaseConfig {
    #[serde(skip_serializing)]
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connect_timeout_secs: u64,
    pub acquire_timeout_secs: u64,
    pub idle_timeout_secs: u64,
    pub max_lifetime_secs: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct MonitoringConfig {
    pub enabled: bool,
    pub metrics_path: String,
    pub health_check_path: String,
    pub prometheus_port: u16,
    pub export_interval_secs: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RateLimitConfig {
    pub enabled: bool,
    pub requests_per_second: u32,
    pub burst_size: u32,
    pub cleanup_interval_secs: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TelegramConfig {
    #[serde(skip_serializing)]
    pub bot_token: String,
    #[serde(skip_serializing)]
    pub webhook_secret: String,
    pub webhook_url: String,
}

impl ServiceConfig {
    /// Загружает конфигурацию с приоритетом: ENV > файл > defaults
    pub fn from_env() -> Result<Self, ConfigError> {
        let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "development".into());
        
        let config = Config::builder()
            // Начинаем с дефолтов
            .set_default("server.host", "0.0.0.0")?
            .set_default("server.port", 14705)?
            .set_default("server.max_connections", 10000)?
            .set_default("server.request_timeout_secs", 30)?
            .set_default("server.graceful_shutdown_timeout_secs", 30)?
            
            // Redis defaults
            .set_default("redis.database", 0)?
            .set_default("redis.pool_size", 10)?
            .set_default("redis.key_prefix", "voice:")?
            .set_default("redis.ttl_seconds", 3600)?
            .set_default("redis.cluster_enabled", false)?
            .set_default("redis.sentinel_enabled", false)?
            
            // LiveKit defaults
            .set_default("livekit.room_empty_timeout_secs", 300)?
            .set_default("livekit.max_participants_per_room", 100)?
            .set_default("livekit.default_room_options.codec", "opus")?
            .set_default("livekit.default_room_options.bitrate", 64000)?
            .set_default("livekit.default_room_options.sample_rate", 48000)?
            .set_default("livekit.default_room_options.channels", 2)?
            .set_default("livekit.default_room_options.enable_dtx", true)?
            .set_default("livekit.default_room_options.enable_red", true)?
            .set_default("livekit.default_room_options.enable_simulcast", false)?
            
            // TURN defaults
            .set_default("turn.enabled", true)?
            .set_default("turn.ttl_seconds", 86400)?
            .set_default("turn.min_port", 10000)?
            .set_default("turn.max_port", 20000)?
            
            // JWT defaults
            .set_default("jwt.issuer", "voice-service")?
            .set_default("jwt.audience", "radiate")?
            .set_default("jwt.access_token_ttl_secs", 3600)?
            .set_default("jwt.refresh_token_ttl_secs", 2592000)?
            .set_default("jwt.algorithm", "HS256")?
            
            // Database defaults
            .set_default("database.max_connections", 10)?
            .set_default("database.min_connections", 2)?
            .set_default("database.connect_timeout_secs", 10)?
            .set_default("database.acquire_timeout_secs", 10)?
            .set_default("database.idle_timeout_secs", 600)?
            .set_default("database.max_lifetime_secs", 1800)?
            
            // Monitoring defaults
            .set_default("monitoring.enabled", true)?
            .set_default("monitoring.metrics_path", "/metrics")?
            .set_default("monitoring.health_check_path", "/health")?
            .set_default("monitoring.prometheus_port", 9090)?
            .set_default("monitoring.export_interval_secs", 10)?
            
            // Rate limiting defaults
            .set_default("rate_limiting.enabled", true)?
            .set_default("rate_limiting.requests_per_second", 100)?
            .set_default("rate_limiting.burst_size", 200)?
            .set_default("rate_limiting.cleanup_interval_secs", 60)?
            
            // Загружаем файл конфигурации если существует
            .add_source(
                File::with_name(&format!("config/{}", environment))
                    .required(false)
            )
            
            // Переопределяем переменными окружения с префиксом VOICE_
            .add_source(
                Environment::with_prefix("VOICE")
                    .separator("__")
                    .try_parsing(true)
            )
            
            .build()?;
        
        let mut cfg: ServiceConfig = config.try_deserialize()?;
        
        // Валидация критических полей
        cfg.validate()?;
        
        Ok(cfg)
    }
    
    /// Валидирует конфигурацию на наличие обязательных полей
    fn validate(&mut self) -> Result<(), ConfigError> {
        // Проверяем что критические secrets не пустые
        if self.jwt.secret.is_empty() {
            self.jwt.secret = env::var("VOICE__JWT__SECRET")
                .or_else(|_| env::var("JWT_SECRET"))
                .map_err(|_| ConfigError::Message("JWT secret is required".into()))?;
        }
        
        if self.redis.url.is_empty() {
            self.redis.url = env::var("VOICE__REDIS__URL")
                .or_else(|_| env::var("REDIS_URL"))
                .unwrap_or_else(|_| "redis://localhost:6379".into());
        }
        
        if self.database.url.is_empty() {
            self.database.url = env::var("VOICE__DATABASE__URL")
                .or_else(|_| env::var("DATABASE_URL"))
                .map_err(|_| ConfigError::Message("Database URL is required".into()))?;
        }
        
        if self.livekit.api_key.is_empty() {
            self.livekit.api_key = env::var("VOICE__LIVEKIT__API_KEY")
                .or_else(|_| env::var("LIVEKIT_API_KEY"))
                .map_err(|_| ConfigError::Message("LiveKit API key is required".into()))?;
        }
        
        if self.livekit.api_secret.is_empty() {
            self.livekit.api_secret = env::var("VOICE__LIVEKIT__API_SECRET")
                .or_else(|_| env::var("LIVEKIT_API_SECRET"))
                .map_err(|_| ConfigError::Message("LiveKit API secret is required".into()))?;
        }
        
        if self.turn.enabled && self.turn.static_auth_secret.is_empty() {
            self.turn.static_auth_secret = env::var("VOICE__TURN__STATIC_AUTH_SECRET")
                .or_else(|_| env::var("TURN_SECRET"))
                .map_err(|_| ConfigError::Message("TURN secret is required when TURN is enabled".into()))?;
        }
        
        Ok(())
    }
    
    /// Генерирует TTL credentials для TURN сервера
    pub fn generate_turn_credentials(&self, username: &str) -> (String, String) {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        
        let timestamp = chrono::Utc::now().timestamp() + self.turn.ttl_seconds as i64;
        let temp_username = format!("{}:{}", timestamp, username);
        
        let mut mac = Hmac::<Sha256>::new_from_slice(self.turn.static_auth_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(temp_username.as_bytes());
        
        let credential = base64::encode(mac.finalize().into_bytes());
        
        (temp_username, credential)
    }
}

/// Безопасно загружает конфигурацию с маскированием sensitive данных в логах
pub async fn load_config() -> Result<ServiceConfig, Box<dyn std::error::Error>> {
    let config = ServiceConfig::from_env()?;
    
    // Логируем конфигурацию без sensitive данных
    tracing::info!(
        "Configuration loaded: server={}:{}, redis_db={}, livekit_url={}, monitoring_enabled={}",
        config.server.host,
        config.server.port,
        config.redis.database,
        config.livekit.url,
        config.monitoring.enabled
    );
    
    Ok(config)
}

// Base64 encoding helper
mod base64 {
    use std::fmt;
    
    pub fn encode<T: AsRef<[u8]>>(input: T) -> String {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.encode(input)
    }
    
    pub fn decode<T: AsRef<[u8]>>(input: T) -> Result<Vec<u8>, base64::DecodeError> {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD.decode(input)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_config_loading() {
        std::env::set_var("VOICE__JWT__SECRET", "test_secret");
        std::env::set_var("VOICE__DATABASE__URL", "postgres://localhost/test");
        std::env::set_var("VOICE__LIVEKIT__API_KEY", "test_key");
        std::env::set_var("VOICE__LIVEKIT__API_SECRET", "test_secret");
        
        let config = ServiceConfig::from_env();
        assert!(config.is_ok());
    }
    
    #[test]
    fn test_turn_credentials_generation() {
        let mut config = ServiceConfig::from_env().unwrap_or_else(|_| {
            let mut cfg = serde_json::from_str::<ServiceConfig>("{}").unwrap();
            cfg.turn.static_auth_secret = "test_secret".to_string();
            cfg
        });
        
        let (username, credential) = config.generate_turn_credentials("testuser");
        assert!(username.contains("testuser"));
        assert!(!credential.is_empty());
    }
}
