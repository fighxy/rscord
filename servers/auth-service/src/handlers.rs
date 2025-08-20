use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    response::Json,
};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use mongodb::{bson::doc, Collection};
use password_hash::{PasswordHash, PasswordHasher, PasswordVerifier};
use rscord_common::{verify_jwt, Id, User};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::{AuthState, UserDoc, username_validator::{validate_username, suggest_username}};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub username: Option<String>,
    pub display_name: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub user: User,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

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

pub async fn register(
    State(state): State<AuthState>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<RegisterResponse>, StatusCode> {
    // Validation
    if body.email.is_empty() || body.display_name.is_empty() || body.password.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if body.password.len() < 6 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Validate and process username
    let username = match body.username {
        Some(u) => validate_username(&u).map_err(|_| StatusCode::BAD_REQUEST)?,
        None => suggest_username(&body.display_name),
    };

    // Check if user already exists (by email or username)
    let users: Collection<UserDoc> = state.mongo.database("rscord").collection("users");
    let email_filter = doc! {"email": &body.email};
    if let Ok(Some(_)) = users.find_one(email_filter).await {
        return Err(StatusCode::CONFLICT);
    }

    let username_filter = doc! {"username": &username};
    if let Ok(Some(_)) = users.find_one(username_filter).await {
        return Err(StatusCode::CONFLICT);
    }

    let user = User {
        id: Id(Ulid::new()),
        email: body.email.clone(),
        username: username.clone(),
        display_name: body.display_name.clone(),
        created_at: Utc::now(),
    };

    // Hash password
    let salt = argon2::password_hash::SaltString::generate(&mut rand_core::OsRng);
    let password_hash = argon2::Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .to_string();

    // Save to MongoDB
    let doc = UserDoc {
        id: user.id.0.to_string(),
        email: user.email.clone(),
        username: user.username.clone(),
        display_name: user.display_name.clone(),
        password_hash,
        created_at: user.created_at,
    };

    users
        .insert_one(doc)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(RegisterResponse { user }))
}

pub async fn login(
    State(state): State<AuthState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // Find user by email
    let users: Collection<UserDoc> = state.mongo.database("rscord").collection("users");
    let filter = doc! {"email": &body.email};
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Verify password
    let parsed_hash = PasswordHash::new(&user_doc.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    argon2::Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed_hash)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

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
        email: user_doc.email,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };

    Ok(Json(LoginResponse { token, user }))
}

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
    let users: Collection<UserDoc> = state.mongo.database("rscord").collection("users");
    let filter = doc! {"_id": &claims.sub};
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::BAD_REQUEST)?),
        email: user_doc.email,
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
    let users: Collection<UserDoc> = state.mongo.database("rscord").collection("users");
    let filter = doc! {"_id": &claims.sub};
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::BAD_REQUEST)?),
        email: user_doc.email,
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
    let users: Collection<UserDoc> = state.mongo.database("rscord").collection("users");
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

    let users: Collection<UserDoc> = state.mongo.database("rscord").collection("users");
    let filter = doc! {"username": &validated_username};
    
    let user_doc = users
        .find_one(filter)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| StatusCode::BAD_REQUEST)?),
        email: user_doc.email,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };

    Ok(Json(user))
}
