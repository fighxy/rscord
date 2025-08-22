use axum::{
    extract::{Query, State},
    http::{header, Request},
    response::Json,
};
use livekit::prelude::*;
use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{error, info};

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

pub async fn get_voice_token(
    State(state): State<AppState>,
    Query(query): Query<VoiceTokenQuery>,
    req: Request<axum::body::Body>,
) -> Result<Json<VoiceTokenResponse>, axum::http::StatusCode> {
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

    // LiveKit configuration (should match docker-compose and livekit.yaml)
    let api_key = "devkey";
    let api_secret = "devsecret";
    let livekit_url = "ws://localhost:7880"; // WebSocket URL for frontend

    // Generate LiveKit access token
    let token = create_livekit_token(api_key, api_secret, &room_name, &user_id)
        .map_err(|e| {
            error!("Failed to create LiveKit token: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    info!("Generated LiveKit token for user {} in room {}", user_id, room_name);

    Ok(Json(VoiceTokenResponse {
        token,
        url: livekit_url.to_string(),
    }))
}

fn create_livekit_token(
    api_key: &str,
    api_secret: &str,
    room_name: &str,
    participant_identity: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?;
    let exp = now + Duration::from_secs(24 * 60 * 60); // 24 hours

    let token = AccessToken::new(api_key, api_secret)
        .with_identity(participant_identity)
        .with_name(participant_identity) // Use identity as display name for now
        .with_grants(VideoGrants {
            room_join: true,
            room: room_name.to_string(),
            can_publish: true,
            can_subscribe: true,
            can_publish_data: true,
            ..Default::default()
        })
        .with_ttl(Duration::from_secs(24 * 60 * 60));

    Ok(token.to_jwt()?)
}
