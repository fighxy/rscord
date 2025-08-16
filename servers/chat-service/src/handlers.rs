use crate::{models::*, ChatState};
use axum::{
    extract::{Path, Query, Request, State},
    http::{header, StatusCode},
    response::Json,
};
use mongodb::{bson::doc, Collection};
use rscord_common::{verify_jwt, User};
use rscord_events::ChatEvent;
use serde_json::Value;
use tracing::{error, info};

// Helper function to extract user from JWT
async fn get_user_from_request(
    state: &ChatState,
    req: &Request,
) -> Result<String, StatusCode> {
    let Some(auth_header) = req.headers().get(header::AUTHORIZATION) else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    let s = auth_header.to_str().unwrap_or("");
    let token = s.strip_prefix("Bearer ").unwrap_or("");
    if token.is_empty() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let jwt_secret = state.config.jwt_secret.clone().unwrap_or_else(|| "secret".to_string());
    let claims = verify_jwt(token, &jwt_secret).map_err(|_| StatusCode::UNAUTHORIZED)?;

    Ok(claims.sub)
}

// Guild handlers
pub async fn create_guild(
    State(state): State<ChatState>,
    req: Request,
) -> Result<Json<Guild>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;
    
    let (parts, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX).await.map_err(|_| StatusCode::BAD_REQUEST)?;
    let create_req: CreateGuildRequest = serde_json::from_slice(&bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    let guild = Guild::new(create_req.name, create_req.description, user_id.clone());
    let member = GuildMember::new(guild.id.clone(), user_id);

    // Save guild and member to MongoDB
    let guilds: Collection<Guild> = state.mongo.database("rscord").collection("guilds");
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");

    guilds
        .insert_one(&guild)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    members
        .insert_one(&member)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create default channels
    let general_channel = Channel::new(
        guild.id.clone(),
        "general".to_string(),
        Some("General discussion".to_string()),
        ChannelType::Text,
        None,
    );

    let voice_channel = Channel::new(
        guild.id.clone(),
        "General Voice".to_string(),
        Some("General voice chat".to_string()),
        ChannelType::Voice,
        None,
    );

    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    channels
        .insert_many([&general_channel, &voice_channel])
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    info!("Created guild: {} by user: {}", guild.name, user_id);
    Ok(Json(guild))
}

pub async fn get_user_guilds(
    State(state): State<ChatState>,
    req: Request,
) -> Result<Json<Vec<Guild>>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    let guilds: Collection<Guild> = state.mongo.database("rscord").collection("guilds");

    // Find all guilds where user is a member
    let mut cursor = members
        .find(doc! {"user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut guild_ids = Vec::new();
    while cursor.advance().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        let member: GuildMember = cursor.deserialize_current().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        guild_ids.push(member.guild_id);
    }

    // Get guild details
    let mut cursor = guilds
        .find(doc! {"_id": {"$in": guild_ids}})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut user_guilds = Vec::new();
    while cursor.advance().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        let guild: Guild = cursor.deserialize_current().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        user_guilds.push(guild);
    }

    Ok(Json(user_guilds))
}

pub async fn get_guild(
    State(state): State<ChatState>,
    Path(guild_id): Path<String>,
    req: Request,
) -> Result<Json<GuildResponse>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Check if user is member of the guild
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    let member = members
        .find_one(doc! {"guild_id": &guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    // Get guild
    let guilds: Collection<Guild> = state.mongo.database("rscord").collection("guilds");
    let guild = guilds
        .find_one(doc! {"_id": &guild_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Get channels
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    let mut cursor = channels
        .find(doc! {"guild_id": &guild_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut guild_channels = Vec::new();
    while cursor.advance().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        let channel: Channel = cursor.deserialize_current().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        guild_channels.push(channel);
    }

    Ok(Json(GuildResponse {
        guild,
        channels: guild_channels,
        member_count: 0, // TODO: Calculate actual member count
    }))
}

pub async fn get_guild_channels(
    State(state): State<ChatState>,
    Path(guild_id): Path<String>,
    req: Request,
) -> Result<Json<Vec<Channel>>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Check if user is member of the guild
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    // Get channels
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    let mut cursor = channels
        .find(doc! {"guild_id": &guild_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut guild_channels = Vec::new();
    while cursor.advance().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        let channel: Channel = cursor.deserialize_current().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        guild_channels.push(channel);
    }

    Ok(Json(guild_channels))
}

pub async fn get_guild_members(
    State(state): State<ChatState>,
    Path(guild_id): Path<String>,
    req: Request,
) -> Result<Json<Vec<GuildMember>>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Check if user is member of the guild
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    // Get all members
    let mut cursor = members
        .find(doc! {"guild_id": &guild_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut guild_members = Vec::new();
    while cursor.advance().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        let member: GuildMember = cursor.deserialize_current().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        guild_members.push(member);
    }

    Ok(Json(guild_members))
}

pub async fn join_guild(
    State(state): State<ChatState>,
    Path(guild_id): Path<String>,
    req: Request,
) -> Result<Json<Value>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Check if guild exists
    let guilds: Collection<Guild> = state.mongo.database("rscord").collection("guilds");
    guilds
        .find_one(doc! {"_id": &guild_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check if user is already a member
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    if let Some(_) = members
        .find_one(doc! {"guild_id": &guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        return Err(StatusCode::CONFLICT);
    }

    // Add user as member
    let member = GuildMember::new(guild_id.clone(), user_id.clone());
    members
        .insert_one(&member)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Publish event
    if let Err(e) = state
        .event_publisher
        .publish_event(ChatEvent::UserJoined {
            guild_id,
            user_id,
        })
        .await
    {
        error!("Failed to publish user joined event: {}", e);
    }

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn leave_guild(
    State(state): State<ChatState>,
    Path(guild_id): Path<String>,
    req: Request,
) -> Result<Json<Value>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Remove user from guild
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    let result = members
        .delete_one(doc! {"guild_id": &guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.deleted_count == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    // Publish event
    if let Err(e) = state
        .event_publisher
        .publish_event(ChatEvent::UserLeft {
            guild_id,
            user_id,
        })
        .await
    {
        error!("Failed to publish user left event: {}", e);
    }

    Ok(Json(serde_json::json!({"success": true})))
}

// Channel handlers
pub async fn create_channel(
    State(state): State<ChatState>,
    req: Request,
) -> Result<Json<Channel>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    let (parts, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX).await.map_err(|_| StatusCode::BAD_REQUEST)?;
    let create_req: CreateChannelRequest = serde_json::from_slice(&bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Check if user is member of the guild
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &create_req.guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    let channel = Channel::new(
        create_req.guild_id,
        create_req.name,
        create_req.description,
        create_req.channel_type,
        create_req.parent_id,
    );

    // Save channel to MongoDB
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    channels
        .insert_one(&channel)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(channel))
}

pub async fn get_channel(
    State(state): State<ChatState>,
    Path(channel_id): Path<String>,
    req: Request,
) -> Result<Json<Channel>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Get channel
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    let channel = channels
        .find_one(doc! {"_id": &channel_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check if user is member of the guild
    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &channel.guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    Ok(Json(channel))
}

// Message handlers
pub async fn get_messages(
    State(state): State<ChatState>,
    Path(channel_id): Path<String>,
    Query(query): Query<GetMessagesQuery>,
    req: Request,
) -> Result<Json<Vec<Message>>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Check channel access
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    let channel = channels
        .find_one(doc! {"_id": &channel_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &channel.guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    // Get messages
    let messages: Collection<Message> = state.mongo.database("rscord").collection("messages");
    let limit = query.limit.unwrap_or(50).min(100) as i64;

    let mut cursor = messages
        .find(doc! {"channel_id": &channel_id})
        .sort(doc! {"created_at": -1})
        .limit(limit)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut channel_messages = Vec::new();
    while cursor.advance().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        let message: Message = cursor.deserialize_current().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        channel_messages.push(message);
    }

    // Reverse to get chronological order
    channel_messages.reverse();
    Ok(Json(channel_messages))
}

pub async fn create_message(
    State(state): State<ChatState>,
    Path(channel_id): Path<String>,
    req: Request,
) -> Result<Json<Message>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    let (parts, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, usize::MAX).await.map_err(|_| StatusCode::BAD_REQUEST)?;
    let create_req: CreateMessageRequest = serde_json::from_slice(&bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Check channel access
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    let channel = channels
        .find_one(doc! {"_id": &channel_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &channel.guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    let message = Message::new(channel_id.clone(), user_id.clone(), create_req.content);

    // Save message to MongoDB
    let messages: Collection<Message> = state.mongo.database("rscord").collection("messages");
    messages
        .insert_one(&message)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Publish event
    if let Err(e) = state
        .event_publisher
        .publish_event(ChatEvent::MessageCreated {
            channel_id,
            message_id: message.id.clone(),
            author_id: user_id,
            content: message.content.clone(),
        })
        .await
    {
        error!("Failed to publish message created event: {}", e);
    }

    Ok(Json(message))
}

pub async fn get_message(
    State(state): State<ChatState>,
    Path(message_id): Path<String>,
    req: Request,
) -> Result<Json<Message>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Get message
    let messages: Collection<Message> = state.mongo.database("rscord").collection("messages");
    let message = messages
        .find_one(doc! {"_id": &message_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check channel access
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    let channel = channels
        .find_one(doc! {"_id": &message.channel_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &channel.guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    Ok(Json(message))
}

pub async fn delete_message(
    State(state): State<ChatState>,
    Path(message_id): Path<String>,
    req: Request,
) -> Result<Json<Value>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Get message
    let messages: Collection<Message> = state.mongo.database("rscord").collection("messages");
    let message = messages
        .find_one(doc! {"_id": &message_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check if user is the author
    if message.author_id != user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    // Delete message
    messages
        .delete_one(doc! {"_id": &message_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Publish event
    if let Err(e) = state
        .event_publisher
        .publish_event(ChatEvent::MessageDeleted {
            channel_id: message.channel_id,
            message_id,
            author_id: user_id,
        })
        .await
    {
        error!("Failed to publish message deleted event: {}", e);
    }

    Ok(Json(serde_json::json!({"success": true})))
}

pub async fn typing_indicator(
    State(state): State<ChatState>,
    Path(channel_id): Path<String>,
    req: Request,
) -> Result<Json<Value>, StatusCode> {
    let user_id = get_user_from_request(&state, &req).await?;

    // Check channel access
    let channels: Collection<Channel> = state.mongo.database("rscord").collection("channels");
    let channel = channels
        .find_one(doc! {"_id": &channel_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let members: Collection<GuildMember> = state.mongo.database("rscord").collection("guild_members");
    members
        .find_one(doc! {"guild_id": &channel.guild_id, "user_id": &user_id})
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::FORBIDDEN)?;

    // Publish typing event
    if let Err(e) = state
        .event_publisher
        .publish_event(ChatEvent::TypingStarted {
            channel_id,
            user_id,
        })
        .await
    {
        error!("Failed to publish typing started event: {}", e);
    }

    Ok(Json(serde_json::json!({"success": true})))
}
