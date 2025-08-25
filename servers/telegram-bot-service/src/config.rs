use serde::Deserialize;
use std::env;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub bot_token: String,
    pub auth_service_url: String,
    pub redis_url: Option<String>,
    pub http_port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        // Обязательный токен бота из переменной окружения
        let bot_token = env::var("TELEGRAM_BOT_TOKEN")
            .map_err(|_| "TELEGRAM_BOT_TOKEN environment variable not set")?;
        
        // Проверяем формат токена
        if !bot_token.contains(':') || bot_token.len() < 35 {
            return Err("Invalid bot token format".into());
        }
        
        Ok(Config {
            bot_token,
            auth_service_url: env::var("AUTH_SERVICE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:14701".to_string()),
            redis_url: env::var("REDIS_URL").ok(),
            http_port: env::var("TELEGRAM_HTTP_PORT")
                .unwrap_or_else(|_| "14703".to_string())
                .parse()?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation() {
        env::set_var("TELEGRAM_BOT_TOKEN", "invalid");
        assert!(Config::from_env().is_err());
        
        env::set_var("TELEGRAM_BOT_TOKEN", "123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890");
        assert!(Config::from_env().is_ok());
    }
}
