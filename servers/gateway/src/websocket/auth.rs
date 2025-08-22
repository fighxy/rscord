use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use tracing::error;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // user_id
    pub username: String,
    pub exp: usize,       // expiration time
    pub iat: usize,       // issued at
}

pub struct JwtValidator {
    secret: String,
}

impl JwtValidator {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, String> {
        let validation = Validation::new(Algorithm::HS256);
        
        match decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_ref()),
            &validation,
        ) {
            Ok(token_data) => {
                // Проверяем, не истек ли токен
                let now = chrono::Utc::now().timestamp() as usize;
                if token_data.claims.exp < now {
                    return Err("Token expired".to_string());
                }
                
                Ok(token_data.claims)
            }
            Err(e) => {
                error!("JWT validation error: {}", e);
                Err(format!("Invalid token: {}", e))
            }
        }
    }

    pub fn extract_user_info(&self, token: &str) -> Result<(String, String), String> {
        let claims = self.validate_token(token)?;
        Ok((claims.sub, claims.username))
    }
}

// Простая валидация токена без библиотеки JWT (fallback)
pub fn simple_token_validation(token: &str) -> Result<(String, String), String> {
    if token.len() < 10 {
        return Err("Token too short".to_string());
    }
    
    // Простая проверка для разработки
    let user_id = format!("user_{}", &token[..8]);
    let username = format!("User_{}", &token[token.len()-4..]);
    
    Ok((user_id, username))
}
