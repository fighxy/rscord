mod auth;
mod events;
// mod livekit; // Disabled due to compilation issues
mod livekit_mock;
use axum::{
    extract::{Path, State},
    http::{header, Method, Request},
    response::Json,
    routing::{get, post},
    Router,
};
use rscord_common::{load_config, verify_jwt, AppConfig, Channel as ChannelModel, Guild as GuildModel, Id, User};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};
use ulid::Ulid;
use mongodb::{bson::doc, options::IndexOptions, Client, Collection, IndexModel};
use serde::{Deserialize, Serialize};
use chrono::Utc;
use futures_util::StreamExt;
use password_hash::PasswordHasher;
use crate::events::EventBus;

fn generate_username_from_display_name(display_name: &str) -> String {
    let base = display_name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect::<String>();
    
    if base.len() >= 3 {
        base
    } else {
        format!("user_{}", ulid::Ulid::new().to_string().to_lowercase()[..8].to_string())
    }
}


#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RSCORD").expect("load config");
    let addr: SocketAddr = cfg
        .bind_addr
        .as_deref()
        .unwrap_or("127.0.0.1:14702")
        .parse()
        .expect("bind addr");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    // Connect to MongoDB
    let mongo_uri = cfg.mongodb_uri.clone().expect("MongoDB URI not configured");
    let mongo = Client::with_uri_str(mongo_uri).await.expect("Failed to connect to MongoDB");
    
    // Connect to EventBus (RabbitMQ) - handle connection failure gracefully
    let bus = match cfg.rabbitmq_uri.as_ref() {
        Some(uri) => {
            match EventBus::connect(uri).await {
                Ok(bus) => {
                    info!("Connected to RabbitMQ event bus");
                    bus
                }
                Err(e) => {
                    warn!("Failed to connect to RabbitMQ event bus: {}. Events will not be published.", e);
                    // Create a dummy EventBus that does nothing
                    EventBus::dummy()
                }
            }
        }
        None => {
            warn!("No RabbitMQ URI configured. Events will not be published.");
            EventBus::dummy()
        }
    };
    
    let state = AppState::new(mongo, cfg.jwt_secret.clone().expect("JWT secret not configured"), bus.clone());
    
    // Log EventBus connection status
    if bus.is_connected() {
        info!("EventBus is connected and ready to publish events");
    } else {
        warn!("EventBus is in dummy mode - events will not be published");
    }
    // ensure index on users.email
    match state
        .users()
        .create_index(
            IndexModel::builder()
                .keys(doc! {"email": 1})
                .options(IndexOptions::builder().unique(true).build())
                .build(),
        )
        .await
    {
        Ok(_) => info!("Created unique index on users.email"),
        Err(e) => warn!("Failed to create index on users.email: {}", e),
    }

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/auth/register", post(register))
        .route("/auth/login", post(auth::login))
        .route("/auth/me", get(get_current_user))
        .route("/guilds", get(list_guilds).post(create_guild))
        .route("/guilds/:id", get(get_guild).delete(delete_guild))
        .route("/guilds/:guild_id/channels", get(list_channels).post(create_channel))
        .route("/channels/:id", get(get_channel).delete(delete_channel))
        .route("/channels/:id/messages", get(list_messages).post(create_message))
        .route("/voice/token", get(livekit_mock::get_voice_token_mock))
        .with_state(state)
        .layer(cors);

    info!("rscord-api listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[axum::debug_handler]
async fn list_guilds(State(state): State<AppState>) -> Result<Json<Vec<GuildModel>>, axum::http::StatusCode> {
    let mut cursor = state.guilds().find(doc!{}).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut res = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        if let (Ok(id), Ok(owner_id)) = (Ulid::from_string(&doc.id), Ulid::from_string(&doc.owner_id)) {
            res.push(GuildModel { id: Id(id), name: doc.name, owner_id: Id(owner_id), created_at: doc.created_at });
        }
    }
    Ok(Json(res))
}



#[derive(Clone)]
struct AppState {
    mongo: Client,
    jwt_secret: String,
    bus: EventBus,
}

impl AppState {
    fn new(mongo: Client, jwt_secret: String, bus: EventBus) -> Self { 
        Self { mongo, jwt_secret, bus } 
    }
    fn users(&self) -> Collection<UserDoc> { self.mongo.database("rscord").collection("users") }
    fn guilds(&self) -> Collection<GuildDoc> { self.mongo.database("rscord").collection("guilds") }
    fn channels(&self) -> Collection<ChannelDoc> { self.mongo.database("rscord").collection("channels") }
    fn messages(&self) -> Collection<MessageDoc> { self.mongo.database("rscord").collection("messages") }
}

#[derive(Deserialize)]
struct RegisterRequest { email: String, username: Option<String>, display_name: String, password: String }

#[derive(Serialize)]
struct RegisterResponse { user: User }

#[derive(Serialize, Deserialize, Clone)]
struct UserDoc {
    #[serde(rename = "_id")] id: String,
    email: String,
    username: String,
    display_name: String,
    password_hash: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone)]
struct GuildDoc {
    #[serde(rename = "_id")] id: String,
    name: String,
    owner_id: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChannelDoc {
    #[serde(rename = "_id")] id: String,
    guild_id: String,
    name: String,
    channel_type: String, // "text" или "voice"
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone)]
struct MessageDoc {
    #[serde(rename = "_id")] id: String,
    channel_id: String,
    author_id: String,
    content: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
struct CreateGuildRequest { name: String, owner_id: String }
#[derive(Serialize)]
struct GuildResponse { guild: GuildModel }

#[axum::debug_handler]
async fn create_guild(State(state): State<AppState>, Json(body): Json<CreateGuildRequest>) -> Result<Json<GuildResponse>, axum::http::StatusCode> {
    let guild = GuildModel { id: Id(Ulid::new()), name: body.name, owner_id: Id(Ulid::from_string(&body.owner_id).unwrap_or_else(|_| Ulid::new())), created_at: Utc::now() };
    let doc = GuildDoc { id: guild.id.0.to_string(), name: guild.name.clone(), owner_id: guild.owner_id.0.to_string(), created_at: guild.created_at };
    state.guilds().insert_one(doc).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.bus.publish(&format!("guild.{}.created", guild.id.0), &guild).await;
    Ok(Json(GuildResponse { guild }))
}

#[axum::debug_handler]
async fn get_guild(State(state): State<AppState>, Path(id): Path<String>) -> Result<Json<GuildResponse>, axum::http::StatusCode> {
    let doc = state.guilds().find_one(doc!{"_id": id.clone()}).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    let guild = GuildModel { 
        id: Id(Ulid::from_string(&doc.id).map_err(|_| axum::http::StatusCode::BAD_REQUEST)?), 
        name: doc.name, 
        owner_id: Id(Ulid::from_string(&doc.owner_id).map_err(|_| axum::http::StatusCode::BAD_REQUEST)?), 
        created_at: doc.created_at 
    };
    Ok(Json(GuildResponse { guild }))
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct UpdateGuildRequest { name: Option<String> }
#[allow(dead_code)]
async fn update_guild(State(state): State<AppState>, Path(id): Path<String>, Json(body): Json<UpdateGuildRequest>) -> Result<Json<GuildResponse>, axum::http::StatusCode> {
    if let Some(name) = body.name {
        state.guilds().update_one(doc!{"_id": &id}, doc!{"$set": {"name": name.clone()}}).await
            .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    let res = get_guild(State(state.clone()), Path(id.clone())).await?;
    let Json(GuildResponse { guild }) = &res;
    let _ = state.bus.publish(&format!("guild.{}.updated", guild.id.0), &guild).await;
    Ok(res)
}

async fn delete_guild(State(state): State<AppState>, Path(id): Path<String>) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    state.guilds().delete_one(doc!{"_id": id.clone()}).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.bus.publish(&format!("guild.{}.deleted", id), &serde_json::json!({"id": id})).await;
    Ok(Json(serde_json::json!({"ok": true})))
}

#[derive(Deserialize)]
struct CreateChannelRequest { 
    guild_id: String, 
    name: String,
    channel_type: Option<String> // По умолчанию "text"
}
#[derive(Serialize)]
struct ChannelResponse { channel: ChannelModel }

async fn create_channel(State(state): State<AppState>, Json(body): Json<CreateChannelRequest>) -> Result<Json<ChannelResponse>, axum::http::StatusCode> {
    let channel_type = body.channel_type.unwrap_or_else(|| "text".to_string());
    let channel = ChannelModel { 
        id: Id(Ulid::new()), 
        guild_id: Id(Ulid::from_string(&body.guild_id).unwrap_or_else(|_| Ulid::new())), 
        name: body.name, 
        channel_type: channel_type.clone(),
        created_at: Utc::now() 
    };
    let doc = ChannelDoc { 
        id: channel.id.0.to_string(), 
        guild_id: channel.guild_id.0.to_string(), 
        name: channel.name.clone(), 
        channel_type,
        created_at: channel.created_at 
    };
    state.channels().insert_one(doc).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.bus.publish(&format!("channel.{}.created", channel.id.0), &channel).await;
    Ok(Json(ChannelResponse { channel }))
}

async fn list_channels(State(state): State<AppState>, Path(guild_id): Path<String>) -> Result<Json<Vec<ChannelModel>>, axum::http::StatusCode> {
    let filter = doc! {"guild_id": &guild_id};
    let mut cursor = state.channels().find(filter).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut res = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        if let (Ok(id), Ok(gid)) = (Ulid::from_string(&doc.id), Ulid::from_string(&doc.guild_id)) {
            res.push(ChannelModel { id: Id(id), guild_id: Id(gid), name: doc.name, channel_type: doc.channel_type, created_at: doc.created_at });
        }
    }
    Ok(Json(res))
}

#[axum::debug_handler]
async fn get_channel(State(state): State<AppState>, Path(id): Path<String>) -> Result<Json<ChannelResponse>, axum::http::StatusCode> {
    let doc = state.channels().find_one(doc!{"_id": id.clone()}).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    let channel = ChannelModel { 
        id: Id(Ulid::from_string(&doc.id).map_err(|_| axum::http::StatusCode::BAD_REQUEST)?), 
        guild_id: Id(Ulid::from_string(&doc.guild_id).map_err(|_| axum::http::StatusCode::BAD_REQUEST)?), 
        name: doc.name, 
        channel_type: doc.channel_type,
        created_at: doc.created_at 
    };
    Ok(Json(ChannelResponse { channel }))
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct UpdateChannelRequest { name: Option<String> }
#[allow(dead_code)]
#[axum::debug_handler]
async fn update_channel(State(state): State<AppState>, Path(id): Path<String>, Json(body): Json<UpdateChannelRequest>) -> Result<Json<ChannelResponse>, axum::http::StatusCode> {
    if let Some(name) = body.name {
        state.channels().update_one(doc!{"_id": &id}, doc!{"$set": {"name": name.clone()}}).await
            .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    let res = get_channel(State(state.clone()), Path(id.clone())).await?;
    let Json(ChannelResponse { channel }) = &res;
    let _ = state.bus.publish(&format!("channel.{}.updated", channel.id.0), &channel).await;
    Ok(res)
}

async fn delete_channel(State(state): State<AppState>, Path(id): Path<String>) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    state.channels().delete_one(doc!{"_id": id.clone()}).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.bus.publish(&format!("channel.{}.deleted", id), &serde_json::json!({"id": id})).await;
    Ok(Json(serde_json::json!({"ok": true})))
}

#[derive(Deserialize)]
struct CreateMessageRequest { author_id: String, content: String }
#[derive(Serialize)]
struct MessageResponse { message: serde_json::Value }

async fn create_message(State(state): State<AppState>, Path(channel_id): Path<String>, Json(body): Json<CreateMessageRequest>) -> Result<Json<MessageResponse>, axum::http::StatusCode> {
    let id = Ulid::new();
    let now = Utc::now();
    let doc = MessageDoc { id: id.to_string(), channel_id: channel_id.clone(), author_id: body.author_id, content: body.content, created_at: now };
    state.messages().insert_one(doc.clone()).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let payload = serde_json::json!({
        "id": doc.id,
        "channel_id": doc.channel_id,
        "author_id": doc.author_id,
        "content": doc.content,
        "created_at": doc.created_at,
    });
    let _ = state.bus.publish(&format!("channel.{}.message_created", channel_id), &payload).await;
    Ok(Json(MessageResponse { message: payload }))
}

async fn list_messages(State(state): State<AppState>, Path(channel_id): Path<String>) -> Result<Json<Vec<serde_json::Value>>, axum::http::StatusCode> {
    let filter = doc! {"channel_id": &channel_id};
    let mut cursor = state.messages().find(filter).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut res = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        res.push(serde_json::json!({
            "id": doc.id,
            "channel_id": doc.channel_id,
            "author_id": doc.author_id,
            "content": doc.content,
            "created_at": doc.created_at,
        }));
    }
    Ok(Json(res))
}

async fn register(State(state): State<AppState>, Json(body): Json<RegisterRequest>) -> Result<Json<RegisterResponse>, axum::http::StatusCode> {
    // Валидация данных
    if body.email.is_empty() || body.display_name.is_empty() || body.password.is_empty() {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    
    if body.password.len() < 6 {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    
    // Проверяем, не существует ли уже пользователь с таким email
    let users: Collection<UserDoc> = state.users();
    let filter = doc! {"email": &body.email};
    if let Ok(Some(_)) = users.find_one(filter).await {
        return Err(axum::http::StatusCode::CONFLICT);
    }
    
    // Generate username if not provided
    let username = match body.username {
        Some(u) => u,
        None => generate_username_from_display_name(&body.display_name),
    };
    
    let user = User {
        id: Id(Ulid::new()),
        email: body.email,
        username: username.clone(),
        display_name: body.display_name,
        created_at: Utc::now(),
    };
    
    // hash password
    let salt = argon2::password_hash::SaltString::generate(&mut rand_core::OsRng);
    let password_hash = <argon2::Argon2 as PasswordHasher>::hash_password(
        &argon2::Argon2::default(),
        body.password.as_bytes(),
        &salt
    )
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
    .to_string();

    // persist to MongoDB
    let doc = UserDoc {
        id: user.id.0.to_string(),
        email: user.email.clone(),
        username: user.username.clone(),
        display_name: user.display_name.clone(),
        password_hash,
        created_at: user.created_at,
    };
    
    state.users().insert_one(doc).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(RegisterResponse { user }))
}

#[axum::debug_handler]
async fn get_current_user(State(state): State<AppState>, req: Request<axum::body::Body>) -> Result<Json<User>, axum::http::StatusCode> {
    // Получаем токен из заголовка Authorization
    let Some(auth_header) = req.headers().get(header::AUTHORIZATION) else { 
        return Err(axum::http::StatusCode::UNAUTHORIZED) 
    };
    
    let s = auth_header.to_str().unwrap_or("");
    let token = s.strip_prefix("Bearer ").unwrap_or("");
    if token.is_empty() { 
        return Err(axum::http::StatusCode::UNAUTHORIZED) 
    }
    
    // Верифицируем JWT токен
    let secret = &state.jwt_secret;
    let claims = verify_jwt(token, secret).map_err(|_| axum::http::StatusCode::UNAUTHORIZED)?;
    
    // Получаем пользователя из базы данных
    let users: Collection<UserDoc> = state.users();
    let filter = doc! {"_id": &claims.sub};
    let user_doc = users.find_one(filter).await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    
    let user = User {
        id: Id(Ulid::from_string(&user_doc.id).map_err(|_| axum::http::StatusCode::BAD_REQUEST)?),
        email: user_doc.email,
        username: user_doc.username,
        display_name: user_doc.display_name,
        created_at: user_doc.created_at,
    };
    
    Ok(Json(user))
}


