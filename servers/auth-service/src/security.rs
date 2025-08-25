use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, TokenData, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use time::{Duration, OffsetDateTime};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // user_id
    pub username: String,
    pub exp: i64,          // expiration
    pub iat: i64,          // issued at
    pub jti: String,       // JWT ID для отзыва токенов
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

pub struct JwtManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    access_token_duration: Duration,
    refresh_token_duration: Duration,
    revoked_tokens: Arc<tokio::sync::RwLock<std::collections::HashSet<String>>>,
}

impl JwtManager {
    pub fn new(secret: &str) -> Self {
        // Проверяем длину секрета
        if secret.len() < 32 {
            panic!("JWT secret must be at least 32 characters long for security");
        }
        
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
            access_token_duration: Duration::minutes(15),  // Короткий access token
            refresh_token_duration: Duration::days(30),    // Длинный refresh token
            revoked_tokens: Arc::new(tokio::sync::RwLock::new(std::collections::HashSet::new())),
        }
    }
    
    pub async fn create_token_pair(&self, user_id: &str, username: &str) -> Result<TokenPair, TokenError> {
        let now = OffsetDateTime::now_utc();
        let access_jti = uuid::Uuid::new_v4().to_string();
        let refresh_jti = uuid::Uuid::new_v4().to_string();
        
        // Access token (15 минут)
        let access_claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            exp: (now + self.access_token_duration).unix_timestamp(),
            iat: now.unix_timestamp(),
            jti: access_jti,
        };
        
        // Refresh token (30 дней)
        let refresh_claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            exp: (now + self.refresh_token_duration).unix_timestamp(),
            iat: now.unix_timestamp(),
            jti: refresh_jti,
        };
        
        let access_token = encode(&Header::default(), &access_claims, &self.encoding_key)
            .map_err(|_| TokenError::EncodingError)?;
            
        let refresh_token = encode(&Header::default(), &refresh_claims, &self.encoding_key)
            .map_err(|_| TokenError::EncodingError)?;
        
        Ok(TokenPair {
            access_token,
            refresh_token,
            expires_in: self.access_token_duration.whole_seconds(),
        })
    }
    
    pub async fn verify_token(&self, token: &str) -> Result<Claims, TokenError> {
        // Декодируем токен
        let token_data = decode::<Claims>(token, &self.decoding_key, &Validation::default())
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => TokenError::ExpiredToken,
                _ => TokenError::InvalidToken,
            })?;
        
        // Проверяем, не отозван ли токен
        if self.revoked_tokens.read().await.contains(&token_data.claims.jti) {
            return Err(TokenError::RevokedToken);
        }
        
        Ok(token_data.claims)
    }
    
    pub async fn revoke_token(&self, jti: String) {
        self.revoked_tokens.write().await.insert(jti);
    }
    
    pub async fn refresh_access_token(&self, refresh_token: &str) -> Result<TokenPair, TokenError> {
        let claims = self.verify_token(refresh_token).await?;
        
        // Отзываем старый refresh token
        self.revoke_token(claims.jti).await;
        
        // Создаем новую пару токенов
        self.create_token_pair(&claims.sub, &claims.username).await
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TokenError {
    #[error("Token encoding failed")]
    EncodingError,
    
    #[error("Invalid token")]
    InvalidToken,
    
    #[error("Token has expired")]
    ExpiredToken,
    
    #[error("Token has been revoked")]
    RevokedToken,
}

// Middleware для проверки JWT
pub async fn auth_middleware(
    State(jwt_manager): State<Arc<JwtManager>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Извлекаем токен из заголовка Authorization
    let auth_header = req.headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Проверяем токен
    let claims = jwt_manager.verify_token(token).await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    // Добавляем claims в request extensions для использования в handlers
    req.extensions_mut().insert(claims);
    
    Ok(next.run(req).await)
}

// Rate limiting для защиты от брутфорса
pub struct RateLimiter {
    attempts: Arc<tokio::sync::RwLock<std::collections::HashMap<String, Vec<OffsetDateTime>>>>,
    max_attempts: usize,
    window: Duration,
    lockout_duration: Duration,
}

impl RateLimiter {
    pub fn new(max_attempts: usize, window_minutes: i64, lockout_minutes: i64) -> Self {
        Self {
            attempts: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
            max_attempts,
            window: Duration::minutes(window_minutes),
            lockout_duration: Duration::minutes(lockout_minutes),
        }
    }
    
    pub async fn check_rate_limit(&self, key: &str) -> Result<(), RateLimitError> {
        let now = OffsetDateTime::now_utc();
        let mut attempts = self.attempts.write().await;
        
        let user_attempts = attempts.entry(key.to_string()).or_insert_with(Vec::new);
        
        // Удаляем старые попытки
        user_attempts.retain(|&attempt| now - attempt < self.window);
        
        // Проверяем lockout
        if user_attempts.len() >= self.max_attempts {
            let oldest_attempt = user_attempts.first().unwrap();
            let lockout_ends = *oldest_attempt + self.lockout_duration;
            
            if now < lockout_ends {
                let remaining = (lockout_ends - now).whole_seconds();
                return Err(RateLimitError::TooManyAttempts { retry_after: remaining });
            }
            
            // Lockout истек, очищаем попытки
            user_attempts.clear();
        }
        
        // Добавляем новую попытку
        user_attempts.push(now);
        
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RateLimitError {
    #[error("Too many attempts. Retry after {retry_after} seconds")]
    TooManyAttempts { retry_after: i64 },
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_jwt_token_creation_and_verification() {
        let jwt_manager = JwtManager::new("this_is_a_very_secure_secret_key_for_testing_only");
        
        let token_pair = jwt_manager.create_token_pair("123", "testuser").await.unwrap();
        
        // Проверяем access token
        let claims = jwt_manager.verify_token(&token_pair.access_token).await.unwrap();
        assert_eq!(claims.sub, "123");
        assert_eq!(claims.username, "testuser");
        
        // Проверяем refresh token
        let refresh_claims = jwt_manager.verify_token(&token_pair.refresh_token).await.unwrap();
        assert_eq!(refresh_claims.sub, "123");
    }
    
    #[tokio::test]
    async fn test_token_revocation() {
        let jwt_manager = JwtManager::new("this_is_a_very_secure_secret_key_for_testing_only");
        
        let token_pair = jwt_manager.create_token_pair("123", "testuser").await.unwrap();
        let claims = jwt_manager.verify_token(&token_pair.access_token).await.unwrap();
        
        // Отзываем токен
        jwt_manager.revoke_token(claims.jti).await;
        
        // Проверяем, что токен больше не валиден
        let result = jwt_manager.verify_token(&token_pair.access_token).await;
        assert!(matches!(result, Err(TokenError::RevokedToken)));
    }
    
    #[tokio::test]
    async fn test_rate_limiter() {
        let rate_limiter = RateLimiter::new(3, 1, 1);
        let key = "test_user";
        
        // Первые 3 попытки должны пройти
        for _ in 0..3 {
            assert!(rate_limiter.check_rate_limit(key).await.is_ok());
        }
        
        // 4-я попытка должна быть заблокирована
        let result = rate_limiter.check_rate_limit(key).await;
        assert!(matches!(result, Err(RateLimitError::TooManyAttempts { .. })));
    }
}
