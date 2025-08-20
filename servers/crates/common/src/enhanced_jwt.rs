use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation, TokenData};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use axum::http::{header, HeaderMap, StatusCode};
use tracing::{error, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: String,      // user_id
    pub username: String, // username
    pub email: String,    // user email
    pub roles: Vec<String>, // user roles
    pub exp: usize,       // expiration time
    pub iat: usize,       // issued at
    pub iss: String,      // issuer
    pub aud: String,      // audience
}

#[derive(Debug, Clone)]
pub struct EnhancedJwtValidator {
    secret: String,
    issuer: String,
    audience: String,
    max_age_seconds: u64,
}

impl EnhancedJwtValidator {
    pub fn new(secret: String, issuer: Option<String>, audience: Option<String>) -> Self {
        Self {
            secret,
            issuer: issuer.unwrap_or_else(|| "rscord-auth".to_string()),
            audience: audience.unwrap_or_else(|| "rscord-api".to_string()),
            max_age_seconds: 3600, // 1 hour default
        }
    }

    pub fn validate_token(&self, token: &str) -> Result<JwtClaims, JwtValidationError> {
        // Basic format validation
        if token.is_empty() {
            return Err(JwtValidationError::EmptyToken);
        }

        if token.len() > 2048 {
            return Err(JwtValidationError::TokenTooLong);
        }

        // JWT structure validation (should have 3 parts)
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() != 3 {
            return Err(JwtValidationError::InvalidFormat);
        }

        // Configure validation rules
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[&self.issuer]);
        validation.set_audience(&[&self.audience]);
        validation.validate_exp = true;
        validation.validate_nbf = true;
        validation.leeway = 10; // 10 seconds leeway for clock skew

        // Decode and validate token
        let token_data: TokenData<JwtClaims> = decode(
            token,
            &DecodingKey::from_secret(self.secret.as_ref()),
            &validation,
        ).map_err(|e| {
            error!("JWT validation failed: {}", e);
            match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => JwtValidationError::Expired,
                jsonwebtoken::errors::ErrorKind::InvalidIssuer => JwtValidationError::InvalidIssuer,
                jsonwebtoken::errors::ErrorKind::InvalidAudience => JwtValidationError::InvalidAudience,
                jsonwebtoken::errors::ErrorKind::InvalidSignature => JwtValidationError::InvalidSignature,
                _ => JwtValidationError::InvalidToken(e.to_string()),
            }
        })?;

        let claims = token_data.claims;

        // Additional custom validations
        self.validate_claims(&claims)?;

        Ok(claims)
    }

    fn validate_claims(&self, claims: &JwtClaims) -> Result<(), JwtValidationError> {
        // Validate user_id format
        if claims.sub.is_empty() || claims.sub.len() > 100 {
            return Err(JwtValidationError::InvalidUserId);
        }

        // Validate username
        if claims.username.is_empty() || claims.username.len() > 100 {
            return Err(JwtValidationError::InvalidUsername);
        }

        // Validate email format (basic check)
        if !claims.email.contains('@') || claims.email.len() > 255 {
            return Err(JwtValidationError::InvalidEmail);
        }

        // Check token age
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize;

        if current_time.saturating_sub(claims.iat) > self.max_age_seconds as usize {
            return Err(JwtValidationError::TokenTooOld);
        }

        // Validate roles
        if claims.roles.len() > 10 {
            return Err(JwtValidationError::TooManyRoles);
        }

        for role in &claims.roles {
            if role.is_empty() || role.len() > 50 {
                return Err(JwtValidationError::InvalidRole);
            }
        }

        Ok(())
    }

    pub fn extract_user_info(&self, token: &str) -> Result<(String, String, Vec<String>), JwtValidationError> {
        let claims = self.validate_token(token)?;
        Ok((claims.sub, claims.username, claims.roles))
    }
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum JwtValidationError {
    #[error("Token is empty")]
    EmptyToken,
    #[error("Token is too long")]
    TokenTooLong,
    #[error("Invalid token format")]
    InvalidFormat,
    #[error("Token has expired")]
    Expired,
    #[error("Invalid token issuer")]
    InvalidIssuer,
    #[error("Invalid token audience")]
    InvalidAudience,
    #[error("Invalid token signature")]
    InvalidSignature,
    #[error("Invalid user ID format")]
    InvalidUserId,
    #[error("Invalid username format")]
    InvalidUsername,
    #[error("Invalid email format")]
    InvalidEmail,
    #[error("Token is too old")]
    TokenTooOld,
    #[error("Too many roles assigned")]
    TooManyRoles,
    #[error("Invalid role format")]
    InvalidRole,
    #[error("Invalid token: {0}")]
    InvalidToken(String),
    #[error("Token validation failed")]
    ValidationFailed,
}

impl From<JwtValidationError> for StatusCode {
    fn from(error: JwtValidationError) -> Self {
        match error {
            JwtValidationError::EmptyToken
            | JwtValidationError::InvalidFormat
            | JwtValidationError::InvalidSignature
            | JwtValidationError::InvalidToken(_)
            | JwtValidationError::ValidationFailed => StatusCode::UNAUTHORIZED,
            
            JwtValidationError::Expired
            | JwtValidationError::TokenTooOld => StatusCode::UNAUTHORIZED,
            
            JwtValidationError::InvalidIssuer
            | JwtValidationError::InvalidAudience => StatusCode::FORBIDDEN,
            
            JwtValidationError::TokenTooLong
            | JwtValidationError::InvalidUserId
            | JwtValidationError::InvalidUsername
            | JwtValidationError::InvalidEmail
            | JwtValidationError::TooManyRoles
            | JwtValidationError::InvalidRole => StatusCode::BAD_REQUEST,
        }
    }
}

// Enhanced helper function for extracting user from headers
pub fn extract_user_from_headers(
    headers: &HeaderMap,
    jwt_validator: &EnhancedJwtValidator,
) -> Result<(String, String, Vec<String>), (StatusCode, String)> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header".to_string()))?;

    let auth_str = auth_header
        .to_str()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid Authorization header format".to_string()))?;

    let token = auth_str
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::BAD_REQUEST, "Invalid Authorization scheme".to_string()))?;

    jwt_validator
        .extract_user_info(token)
        .map_err(|e| {
            let status_code = StatusCode::from(e.clone());
            let message = format!("JWT validation failed: {}", e);
            warn!("JWT validation error: {}", message);
            (status_code, message)
        })
}

// Secure user ID extraction with full validation
pub fn extract_user_id_secure(
    headers: &HeaderMap,
    jwt_validator: &EnhancedJwtValidator,
) -> Result<String, StatusCode> {
    match extract_user_from_headers(headers, jwt_validator) {
        Ok((user_id, _, _)) => Ok(user_id),
        Err((status_code, message)) => {
            error!("Failed to extract user ID: {}", message);
            Err(status_code)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};

    fn create_test_validator() -> EnhancedJwtValidator {
        EnhancedJwtValidator::new(
            "test_secret_key_12345".to_string(),
            Some("rscord-auth".to_string()),
            Some("rscord-api".to_string()),
        )
    }

    fn create_valid_claims() -> JwtClaims {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize;

        JwtClaims {
            sub: "user_123".to_string(),
            username: "testuser".to_string(),
            email: "test@example.com".to_string(),
            roles: vec!["user".to_string()],
            exp: now + 3600, // 1 hour from now
            iat: now,
            iss: "rscord-auth".to_string(),
            aud: "rscord-api".to_string(),
        }
    }

    #[test]
    fn test_valid_token_validation() {
        let validator = create_test_validator();
        let claims = create_valid_claims();
        
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("test_secret_key_12345".as_ref()),
        ).unwrap();

        let result = validator.validate_token(&token);
        assert!(result.is_ok());
    }

    #[test]
    fn test_empty_token_rejection() {
        let validator = create_test_validator();
        let result = validator.validate_token("");
        assert!(matches!(result, Err(JwtValidationError::EmptyToken)));
    }

    #[test]
    fn test_malformed_token_rejection() {
        let validator = create_test_validator();
        let result = validator.validate_token("invalid.token");
        assert!(matches!(result, Err(JwtValidationError::InvalidFormat)));
    }

    #[test]
    fn test_expired_token_rejection() {
        let validator = create_test_validator();
        let mut claims = create_valid_claims();
        claims.exp = 1000000; // Far in the past
        
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("test_secret_key_12345".as_ref()),
        ).unwrap();

        let result = validator.validate_token(&token);
        assert!(matches!(result, Err(JwtValidationError::Expired)));
    }
}
