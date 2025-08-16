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

use crate::{AuthState, UserDoc};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
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

    // Check if user already exists
    let users: Collection<UserDoc> = state.mongo.database("rscord").collection("users");
    let filter = doc! {"email": &body.email};
    if let Ok(Some(_)) = users.find_one(filter).await {
        return Err(StatusCode::CONFLICT);
    }

    let user = User {
        id: Id(Ulid::new()),
        email: body.email,
        display_name: body.display_name,
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
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };

    Ok(Json(user))
}

pub async fn verify_token(
    State(state): State<AuthState>,
    Json(body): Json<VerifyTokenRequest>,
) -> Result<Json<VerifyTokenResponse>, StatusCode> {
    match verify_jwt(&body.token, &state.jwt_secret) {
        Ok(claims) => Ok(Json(VerifyTokenResponse {
            valid: true,
            user_id: Some(claims.sub),
        })),
        Err(_) => Ok(Json(VerifyTokenResponse {
            valid: false,
            user_id: None,
        })),
    }
}
