use axum::{extract::State, Json};
use chrono::{Duration as ChronoDuration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use mongodb::{bson::doc, Collection};
use password_hash::{PasswordHash, PasswordVerifier};
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::UserDoc;

#[derive(Deserialize)]
pub struct LoginRequest { pub email: String, pub password: String }

#[derive(Serialize)]
pub struct LoginResponse { pub access_token: String, pub expires_at: i64 }

#[derive(Serialize, Deserialize)]
pub struct Claims { pub sub: String, pub exp: i64 }

pub async fn login(State(state): State<AppState>, Json(body): Json<LoginRequest>) -> Result<Json<LoginResponse>, &'static str> {
    let users: Collection<UserDoc> = state.users();
    let filter = doc! {"email": &body.email};
    let Some(user) = users.find_one(filter).await.map_err(|_| "db")? else { return Err("invalid_credentials") };

    let parsed = PasswordHash::new(&user.password_hash).map_err(|_| "pwd")?;
    argon2::Argon2::default().verify_password(body.password.as_bytes(), &parsed).map_err(|_| "invalid_credentials")?;

    let exp = (Utc::now() + ChronoDuration::minutes(30)).timestamp();
    let claims = Claims { sub: user.id, exp };
    let token = encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(state.jwt_secret.as_bytes())).map_err(|_| "jwt")?;
    Ok(Json(LoginResponse { access_token: token, expires_at: exp }))
}


