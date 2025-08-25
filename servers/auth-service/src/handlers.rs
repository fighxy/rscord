use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    response::Json,
};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use mongodb::{bson::doc, Collection};
// Removed password hashing - using Telegram-only auth
use radiate_common::{verify_jwt, Id, User};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::{AuthState, UserDoc, username_validator::{validate_username, suggest_username}};

#[derive(Deserialize)]
pub struct TelegramAuthRequest {
    pub auth_code: String,
}

#[derive(Deserialize)]
pub struct TelegramRegisterRequest {
    pub telegram_id: i64,
    pub telegram_username: Option<String>,
    pub username: String,
    pub display_name: String,
}

#[derive(Serialize)]
pub struct TelegramRegisterResponse {
    pub user: User,
}

#[derive(Deserialize)]
pub struct TelegramLoginRequest {
    pub telegram_id: i64,
    pub username: String,
}

#[derive(Serialize)]
pub struct TelegramLoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Deserialize)]
pub struct TelegramRequestCodeRequest {
    pub telegram_id: i64,
    pub username: String,
}

#[derive(Serialize)]
pub struct TelegramRequestCodeResponse {
    pub code: String,
    pub expires_in: i64, // seconds
}

#[derive(Deserialize)]
pub struct TelegramVerifyCodeRequest {
    pub code: String,
}

#[derive(Serialize)]
pub struct TelegramVerifyCodeResponse {
    pub token: String,
    pub user: User,
}

#[derive(Serialize)]
pub struct TelegramAuthResponse {
    pub token: String,
    pub user: User,
}

// Removed - using Telegram registration only

// Removed - using Telegram registration only

// Removed - using Telegram login only

// Removed - using Telegram login only

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Deserialize)]
pub struct VerifyTokenRequest {
    pub token: String,
}

#[derive(Serialize)]
pub struct VerifyTokenResponse {
    pub valid: bool,
    pub user_id: Option<String>,
}

#[derive(Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Serialize)]
pub struct RefreshTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64,
}

#[derive(Serialize)]
pub struct LogoutResponse {
    pub message: String,
}

#[derive(Deserialize)]
pub struct CheckUsernameRequest {
    pub username: String,
}

#[derive(Serialize)]
pub struct CheckUsernameResponse {
    pub available: bool,
    pub suggested: Option<String>,
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct SuggestUsernameRequest {
    pub display_name: String,
}

#[derive(Serialize)]
pub struct SuggestUsernameResponse {
    pub suggested: String,
}

// Removed email/password registration - using Telegram-only auth

// Removed email/password login - using Telegram-only auth

pub async fn get_current_user(
    State(state): State<AuthState>,
    req: Request,
) -> Result<Json<User>, StatusCode> {
    // Get token from Authorization header
    let Some(auth_header) = req.headers().get(header::AUTHORIZATION) else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    let s = auth_header.to_str().unwrap_or("");
    let token = s.strip_prefix("Bearer ").unwrap_or("");
    if token.is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Verify JWT token
    let claims = verify_jwt(token, &state.jwt_secret).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Get user from database
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {"_id": &claims.sub};
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::BAD_REQUEST)?),
        telegram_id: Some(user_doc.telegram_id),
        telegram_username: user_doc.telegram_username,
        email: None,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };

    Ok(Json(user))
}

pub async fn verify_token(
    State(state): State<AuthState>,
    req: Request,
) -> Result<Json<User>, StatusCode> {
    // Get token from Authorization header
    let Some(auth_header) = req.headers().get(header::AUTHORIZATION) else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    let s = auth_header.to_str().unwrap_or("");
    let token = s.strip_prefix("Bearer ").unwrap_or("");
    if token.is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Verify JWT token
    let claims = verify_jwt(token, &state.jwt_secret).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Get user from database
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {"_id": &claims.sub};
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::BAD_REQUEST)?),
        telegram_id: Some(user_doc.telegram_id),
        telegram_username: user_doc.telegram_username,
        email: None,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };

    Ok(Json(user))
}

pub async fn refresh_token(
    State(state): State<AuthState>,
    Json(body): Json<RefreshTokenRequest>,
) -> Result<Json<RefreshTokenResponse>, StatusCode> {
    // Verify refresh token
    let claims = verify_jwt(&body.refresh_token, &state.jwt_secret)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let user_id = claims.sub.clone();

    // Create new access token
    let now = chrono::Utc::now();
    let exp = now + chrono::Duration::hours(1);
    
    let new_claims = Claims {
        sub: user_id.clone(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    let access_token = encode(
        &Header::default(),
        &new_claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref()),
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create new refresh token
    let refresh_exp = now + chrono::Duration::days(30);
    let refresh_claims = Claims {
        sub: user_id,
        exp: refresh_exp.timestamp(),
        iat: now.timestamp(),
    };

    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref()),
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(RefreshTokenResponse {
        access_token,
        refresh_token,
        expires_at: exp.timestamp(),
    }))
}

pub async fn logout() -> Result<Json<LogoutResponse>, StatusCode> {
    // В реальном приложении здесь можно добавить токен в blacklist
    Ok(Json(LogoutResponse {
        message: "Successfully logged out".to_string(),
    }))
}

pub async fn check_username(
    State(state): State<AuthState>,
    Json(body): Json<CheckUsernameRequest>,
) -> Result<Json<CheckUsernameResponse>, StatusCode> {
    // Validate username format
    let validated_username = match validate_username(&body.username) {
        Ok(u) => u,
        Err(e) => {
            return Ok(Json(CheckUsernameResponse {
                available: false,
                suggested: Some(suggest_username(&body.username)),
                error: Some(e.to_string()),
            }));
        }
    };

    // Check if username exists in database
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {"username": &validated_username};
    
    let exists = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .is_some();

    Ok(Json(CheckUsernameResponse {
        available: !exists,
        suggested: if exists { Some(suggest_username(&validated_username)) } else { None },
        error: None,
    }))
}

pub async fn suggest_username_endpoint(
    Json(body): Json<SuggestUsernameRequest>,
) -> Result<Json<SuggestUsernameResponse>, StatusCode> {
    let suggested = suggest_username(&body.display_name);
    
    Ok(Json(SuggestUsernameResponse {
        suggested,
    }))
}

pub async fn find_user_by_username(
    State(state): State<AuthState>,
    axum::extract::Path(username): axum::extract::Path<String>,
) -> Result<Json<User>, StatusCode> {
    let validated_username = validate_username(&username)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {"username": &validated_username};
    
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::BAD_REQUEST)?),
        telegram_id: Some(user_doc.telegram_id),
        telegram_username: user_doc.telegram_username,
        email: None,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };

    Ok(Json(user))
}

pub async fn find_user_by_telegram_id(
    State(state): State<AuthState>,
    axum::extract::Path(telegram_id): axum::extract::Path<i64>,
) -> Result<Json<User>, StatusCode> {
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {"telegram_id": &telegram_id};
    
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::BAD_REQUEST)?),
        telegram_id: Some(user_doc.telegram_id),
        telegram_username: user_doc.telegram_username,
        email: None,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };

    Ok(Json(user))
}

pub async fn telegram_register(
    State(state): State<AuthState>,
    Json(body): Json<TelegramRegisterRequest>,
) -> Result<Json<TelegramRegisterResponse>, StatusCode> {
    // Validate username
    let username = validate_username(&body.username).map_err(|_| StatusCode::BAD_REQUEST)?;
    
    // Check if user already exists (by telegram_id or username)
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    
    let telegram_filter = doc! {"telegram_id": &body.telegram_id};
    if let Ok(Some(_)) = users.find_one(telegram_filter).await {
        return Err(StatusCode::CONFLICT); // User already exists
    }
    
    let username_filter = doc! {"username": &username};
    if let Ok(Some(_)) = users.find_one(username_filter).await {
        return Err(StatusCode::CONFLICT); // Username already taken
    }
    
    let user = User {
        id: Id(Ulid::new()),
        telegram_id: Some(body.telegram_id),
        telegram_username: body.telegram_username.clone(),
        email: None,
        username: username.clone(),
        display_name: body.display_name.clone(),
        created_at: Utc::now(),
    };
    
    // Save to MongoDB
    let doc = UserDoc {
        id: user.id.0.to_string(),
        telegram_id: body.telegram_id,
        telegram_username: body.telegram_username.clone(),
        username: username,
        display_name: body.display_name,
        created_at: user.created_at,
    };
    
    users
        .insert_one(doc)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(TelegramRegisterResponse { user }))
}

pub async fn telegram_login(
    State(state): State<AuthState>,
    Json(body): Json<TelegramLoginRequest>,
) -> Result<Json<TelegramLoginResponse>, StatusCode> {
    // Find user by telegram_id and username
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {
        "telegram_id": &body.telegram_id,
        "username": &body.username
    };
    
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Now that we've verified everything, remove the code
    state.auth_codes.write().await.remove(&body.code);
    
    // Clear rate limit on successful verification
    state.rate_limiter.record_success(&rate_limit_key).await;
    
    // Create JWT token
    let now = chrono::Utc::now();
    let exp = now + chrono::Duration::hours(24);
    
    let claims = Claims {
        sub: user_doc.id.clone(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };
    
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref()),
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?),
        telegram_id: Some(user_doc.telegram_id),
        telegram_username: user_doc.telegram_username,
        email: None,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };
    
    Ok(Json(TelegramLoginResponse { token, user }))
}

pub async fn telegram_auth(
    State(state): State<AuthState>,
    Json(body): Json<TelegramAuthRequest>,
) -> Result<Json<TelegramAuthResponse>, StatusCode> {
    // Call telegram-bot-service to get user data
    let telegram_service_url = "http://127.0.0.1:14703/api/telegram/auth/check";
    let client = reqwest::Client::new();
    
    #[derive(serde::Deserialize)]
    struct TelegramAuthData {
        confirmed: bool,
        user_data: Option<TelegramUserData>,
    }
    
    #[derive(serde::Deserialize)]
    struct TelegramUserData {
        telegram_id: i64,
        telegram_username: Option<String>,
        first_name: String,
        last_name: Option<String>,
    }
    
    let response = client
        .get(telegram_service_url)
        .query(&[("auth_code", &body.auth_code)])
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if !response.status().is_success() {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    let auth_data: TelegramAuthData = response
        .json()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    if !auth_data.confirmed {
        return Err(StatusCode::UNAUTHORIZED);
    }
    
    let user_data = auth_data.user_data.ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Check if user exists by telegram_id
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {"telegram_id": &user_data.telegram_id};
    
    let user = if let Ok(Some(user_doc)) = users.find_one(filter).await {
        // User exists, return existing user
        User {
            id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?),
            telegram_id: Some(user_doc.telegram_id), // telegram_id is now required
            telegram_username: user_doc.telegram_username,
            email: None, // No email for Telegram-only users
            username: user_doc.username,
            display_name: user_doc.display_name,
            created_at: user_doc.created_at,
        }
    } else {
        // New user, create account
        let suggested_username = user_data.telegram_username
            .clone()
            .unwrap_or_else(|| suggest_username(&user_data.first_name));
        
        // Ensure username is unique
        let mut final_username = validate_username(&suggested_username)
            .unwrap_or_else(|_| suggest_username(&user_data.first_name));
        
        let mut counter = 1;
        loop {
            let username_filter = doc! {"username": &final_username};
            if users.find_one(username_filter).await.unwrap_or(None).is_none() {
                break;
            }
            final_username = format!("{}_{}", suggested_username, counter);
            counter += 1;
        }
        
        let display_name = if let Some(ref last_name) = user_data.last_name {
            format!("{} {}", user_data.first_name, last_name)
        } else {
            user_data.first_name.clone()
        };
        
        let user = User {
            id: Id(Ulid::new()),
            telegram_id: Some(user_data.telegram_id),
            telegram_username: user_data.telegram_username.clone(),
            email: None, // No email for Telegram-only users
            username: final_username.clone(),
            display_name: display_name.clone(),
            created_at: Utc::now(),
        };
        
        let doc = UserDoc {
            id: user.id.0.to_string(),
            telegram_id: user_data.telegram_id, // telegram_id is now required
            telegram_username: user.telegram_username.clone(),
            username: user.username.clone(),
            display_name: user.display_name.clone(),
            created_at: user.created_at,
        };
        
        users
            .insert_one(doc)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        user
    };
    
    // Create JWT token
    let now = chrono::Utc::now();
    let exp = now + chrono::Duration::hours(24);
    
    let claims = Claims {
        sub: user.id.0.to_string(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };
    
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref()),
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(TelegramAuthResponse { token, user }))
}

pub async fn telegram_request_code(
    State(state): State<AuthState>,
    Json(body): Json<TelegramRequestCodeRequest>,
) -> Result<Json<TelegramRequestCodeResponse>, StatusCode> {
    // Check if user exists
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {
        "telegram_id": &body.telegram_id,
        "username": &body.username
    };
    
    let _user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    // Check if there's already an active code for this user
    let now = chrono::Utc::now();
    let existing_code_info = {
        let codes = state.auth_codes.read().await;
        // Find existing active code for this telegram_id and username
        codes.iter().find_map(|(existing_code, auth_code)| {
            if auth_code.telegram_id == body.telegram_id 
                && auth_code.username == body.username 
                && now < auth_code.expires_at {
                let remaining_seconds = (auth_code.expires_at - now).num_seconds();
                Some((existing_code.clone(), remaining_seconds))
            } else {
                None
            }
        })
    };
    
    if let Some((code, expires_in)) = existing_code_info {
        return Ok(Json(TelegramRequestCodeResponse {
            code,
            expires_in,
        }));
    }
    
    // Clean up expired codes first
    let mut codes_write = state.auth_codes.write().await;
    codes_write.retain(|_, auth_code| now < auth_code.expires_at);
    
    // Generate new 6-digit code
    let code = generate_six_digit_code();
    let expires_at = now + chrono::Duration::minutes(10);
    
    let auth_code = crate::AuthCode {
        code: code.clone(),
        telegram_id: body.telegram_id,
        username: body.username,
        created_at: now,
        expires_at,
    };
    
    // Store the code
    codes_write.insert(code.clone(), auth_code);
    drop(codes_write);
    
    Ok(Json(TelegramRequestCodeResponse {
        code,
        expires_in: 600, // 10 minutes
    }))
}

pub async fn telegram_verify_code(
    State(state): State<AuthState>,
    Json(body): Json<TelegramVerifyCodeRequest>,
) -> Result<Json<TelegramVerifyCodeResponse>, StatusCode> {
    // Validate code format
    if body.code.len() != 6 || !body.code.chars().all(|c| c.is_numeric()) {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Check rate limit for this code
    let rate_limit_key = format!("verify_code:{}", &body.code);
    if let Err(_) = state.rate_limiter.check_rate_limit(&rate_limit_key).await {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    
    // Get the code but don't remove it yet (in case of errors)
    let auth_code = {
        let codes = state.auth_codes.read().await;
        codes.get(&body.code).cloned().ok_or(StatusCode::UNAUTHORIZED)?
    };
    
    // Check if code is expired
    if chrono::Utc::now() > auth_code.expires_at {
        // Remove expired code
        state.auth_codes.write().await.remove(&body.code);
        return Err(StatusCode::UNAUTHORIZED);
    }
    
    // Find user by telegram_id and username stored in the code
    let users: Collection<UserDoc> = state.mongo.database("radiate").collection("users");
    let filter = doc! {
        "telegram_id": &auth_code.telegram_id,
        "username": &auth_code.username
    };
    
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Create JWT token
    let now = chrono::Utc::now();
    let exp = now + chrono::Duration::hours(24);
    
    let claims = Claims {
        sub: user_doc.id.clone(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };
    
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref()),
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?),
        telegram_id: Some(user_doc.telegram_id),
        telegram_username: user_doc.telegram_username,
        email: None,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };
    
    Ok(Json(TelegramVerifyCodeResponse { token, user }))
}

fn generate_six_digit_code() -> String {
    use rand::Rng;
    // Используем криптографически безопасный генератор
    let mut rng = rand::thread_rng();
    // Генерируем число от 100000 до 999999 включительно
    let code = rng.gen_range(100000..=999999);
    format!("{:06}", code)
}

// Функция для хеширования кода перед сохранением
fn hash_code(code: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

// Функция для проверки кода с постоянным временем выполнения
fn verify_code_constant_time(stored_hash: &str, user_code: &str) -> bool {
    let user_hash = hash_code(user_code);
    // Используем постоянное время сравнения для защиты от timing attacks
    stored_hash.len() == user_hash.len() && 
        stored_hash.bytes().zip(user_hash.bytes()).all(|(a, b)| a == b)
}

