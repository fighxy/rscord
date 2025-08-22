// Mock LiveKit token generation for development
// This is a temporary solution while the LiveKit crate has compilation issues

use axum::{
    extract::{Query, State},
    http::{header, Request},
    response::Json,
};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};
use std::time::{SystemTime, UNIX_EPOCH};
use base64::Engine;

use crate::AppState;

#[derive(Deserialize)]
pub struct VoiceTokenQuery {
    channel_id: String,
    user_id: Option<String>,
}

#[derive(Serialize)]
pub struct VoiceTokenResponse {
    token: String,
    url: String,
}

pub async fn get_voice_token_mock(
    State(state): State<AppState>,
    Query(query): Query<VoiceTokenQuery>,
    req: Request<axum::body::Body>,
) -> Result<Json<VoiceTokenResponse>, axum::http::StatusCode> {
    warn!("Using MOCK LiveKit token generation - not for production!");
    
    // Extract user from JWT token (similar to get_current_user)
    let Some(auth_header) = req.headers().get(header::AUTHORIZATION) else {
        return Err(axum::http::StatusCode::UNAUTHORIZED);
    };

    let s = auth_header.to_str().unwrap_or("");
    let token = s.strip_prefix("Bearer ").unwrap_or("");
    if token.is_empty() {
        return Err(axum::http::StatusCode::UNAUTHORIZED);
    }

    let secret = &state.jwt_secret;
    let claims = radiate_common::verify_jwt(token, secret)
        .map_err(|_| axum::http::StatusCode::UNAUTHORIZED)?;

    let user_id = query.user_id.unwrap_or(claims.sub);
    let room_name = query.channel_id;
    let livekit_url = "ws://localhost:7880";

    // Generate a MOCK token (this won't work with real LiveKit server)
    let mock_token = generate_mock_jwt_token(&user_id, &room_name);

    info!("Generated MOCK LiveKit token for user {} in room {} - THIS IS FOR DEVELOPMENT ONLY", user_id, room_name);

    Ok(Json(VoiceTokenResponse {
        token: mock_token,
        url: livekit_url.to_string(),
    }))
}

fn generate_mock_jwt_token(user_id: &str, room_name: &str) -> String {
    // This is a mock JWT token that looks like a real one but won't work with LiveKit
    // In production, you need to compile with the real LiveKit crate
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let header = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(
        r#"{"alg":"HS256","typ":"JWT"}"#
    );
    
    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(
        &format!(r#"{{"iss":"devkey","sub":"{}","aud":"{}","exp":{},"nbf":{},"iat":{},"jti":"mock-token","video":{{"room":"{}","roomJoin":true,"canPublish":true,"canSubscribe":true}}}}"#, 
            user_id, user_id, now + 86400, now, now, room_name)
    );
    
    let signature = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode("mock-signature");
    
    format!("{}.{}.{}", header, payload, signature)
}
