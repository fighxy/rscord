mod auth;
mod events;
use axum::{extract::{Path, State}, http::{header, Method, Request}, middleware::from_fn, routing::{delete, get, post, put}, Json, Router};
use rscord_common::{load_config, verify_jwt, AppConfig, Channel as ChannelModel, Guild as GuildModel, Id, User};
use std::net::SocketAddr;
use time::Duration;
use tower::{limit::RateLimitLayer, timeout::TimeoutLayer};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use ulid::Ulid;
use mongodb::{bson::doc, options::IndexOptions, Client, Collection, IndexModel};
use serde::{Deserialize, Serialize};
use chrono::Utc;

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
    let mongo_uri = cfg.mongodb_uri.clone().unwrap();
    let mongo = Client::with_uri_str(mongo_uri).await.expect("mongo");
    let bus = events::EventBus::connect(&cfg.rabbitmq_uri.clone().unwrap()).await.expect("rabbit");
    let state = AppState::new(mongo, cfg.jwt_secret.clone().unwrap(), bus);
    // ensure index on users.email
    let _ = state
        .users()
        .create_index(
            IndexModel::builder()
                .keys(doc! {"email": 1})
                .options(IndexOptions::builder().unique(true).build())
                .build(),
            None,
        )
        .await;

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/auth/register", post(register))
        .route("/auth/login", post(auth::login))
        .route("/guilds", get(list_guilds).post(create_guild))
        .route("/guilds/:id", get(get_guild).put(update_guild).delete(delete_guild))
        .route("/guilds/:guild_id/channels", get(list_channels).post(create_channel))
        .route("/channels/:id", get(get_channel).put(update_channel).delete(delete_channel))
        .route("/channels/:id/messages", get(list_messages).post(create_message))
        .with_state(state)
async fn list_guilds(State(state): State<AppState>) -> Json<Vec<GuildModel>> {
    let mut cursor = state.guilds().find(None, None).await.unwrap();
    let mut res = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        if let (Ok(id), Ok(owner_id)) = (Ulid::from_string(&doc.id), Ulid::from_string(&doc.owner_id)) {
            res.push(GuildModel { id: Id(id), name: doc.name, owner_id: Id(owner_id), created_at: doc.created_at });
        }
    }
    Json(res)
}

        .route_layer(from_fn(auth_middleware))
        .layer(cors)
        .layer(TimeoutLayer::new(Duration::seconds(10)))
        .layer(RateLimitLayer::new(100, std::time::Duration::from_secs(60)));

    info!("rscord-api listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn auth_middleware<B>(State(state): State<AppState>, mut req: Request<B>, next: axum::middleware::Next<B>) -> Result<axum::response::Response, axum::http::StatusCode> {
    // Allow unauthenticated for health and auth endpoints
    let path = req.uri().path();
    if path.starts_with("/health") || path.starts_with("/auth/") {
        return Ok(next.run(req).await);
    }
    // Expect Bearer token
    let Some(auth_header) = req.headers().get(header::AUTHORIZATION) else { return Err(axum::http::StatusCode::UNAUTHORIZED) };
    let s = auth_header.to_str().unwrap_or("");
    let token = s.strip_prefix("Bearer ").unwrap_or("");
    if token.is_empty() { return Err(axum::http::StatusCode::UNAUTHORIZED) }
    // Verify
    let secret = &state.jwt_secret;
    let _claims = verify_jwt(token, secret).map_err(|_| axum::http::StatusCode::UNAUTHORIZED)?;
    Ok(next.run(req).await)
}

#[derive(Clone)]
struct AppState {
    mongo: Client,
    jwt_secret: String,
    bus: events::EventBus,
}

impl AppState {
    fn new(mongo: Client, jwt_secret: String, bus: events::EventBus) -> Self { Self { mongo, jwt_secret, bus } }
    fn users(&self) -> Collection<UserDoc> { self.mongo.database("rscord").collection("users") }
    fn guilds(&self) -> Collection<GuildDoc> { self.mongo.database("rscord").collection("guilds") }
    fn channels(&self) -> Collection<ChannelDoc> { self.mongo.database("rscord").collection("channels") }
    fn messages(&self) -> Collection<MessageDoc> { self.mongo.database("rscord").collection("messages") }
}

#[derive(Deserialize)]
struct RegisterRequest { email: String, display_name: String, password: String }

#[derive(Serialize)]
struct RegisterResponse { user: User }

#[derive(Serialize, Deserialize, Clone)]
struct UserDoc {
    #[serde(rename = "_id")] id: String,
    email: String,
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

async fn create_guild(State(state): State<AppState>, Json(body): Json<CreateGuildRequest>) -> Json<GuildResponse> {
    let guild = GuildModel { id: Id(Ulid::new()), name: body.name, owner_id: Id(Ulid::from_string(&body.owner_id).unwrap_or_else(|_| Ulid::new())), created_at: Utc::now() };
    let doc = GuildDoc { id: guild.id.0.to_string(), name: guild.name.clone(), owner_id: guild.owner_id.0.to_string(), created_at: guild.created_at };
    let _ = state.guilds().insert_one(doc, None).await;
    let _ = state.bus.publish(&format!("guild.{}.created", guild.id.0), &guild).await;
    Json(GuildResponse { guild })
}

async fn get_guild(State(state): State<AppState>, Path(id): Path<String>) -> Option<Json<GuildResponse>> {
    let doc = state.guilds().find_one(doc!{"_id": id.clone()}, None).await.ok().flatten()?;
    let guild = GuildModel { id: Id(Ulid::from_string(&doc.id).ok()?), name: doc.name, owner_id: Id(Ulid::from_string(&doc.owner_id).ok()?), created_at: doc.created_at };
    Some(Json(GuildResponse { guild }))
}

#[derive(Deserialize)]
struct UpdateGuildRequest { name: Option<String> }
async fn update_guild(State(state): State<AppState>, Path(id): Path<String>, Json(body): Json<UpdateGuildRequest>) -> Option<Json<GuildResponse>> {
    if let Some(name) = body.name {
        let _ = state.guilds().update_one(doc!{"_id": &id}, doc!{"$set": {"name": name.clone()}}, None).await.ok()?;
    }
    let res = get_guild(State(state.clone()), Path(id.clone())).await;
    if let Some(Json(GuildResponse { guild })) = &res {
        let _ = state.bus.publish(&format!("guild.{}.updated", guild.id.0), &guild).await;
    }
    res
}

async fn delete_guild(State(state): State<AppState>, Path(id): Path<String>) -> Json<serde_json::Value> {
    let _ = state.guilds().delete_one(doc!{"_id": id}, None).await;
    let _ = state.bus.publish(&format!("guild.{}.deleted", id), &serde_json::json!({"id": id})).await;
    Json(serde_json::json!({"ok": true}))
}

#[derive(Deserialize)]
struct CreateChannelRequest { guild_id: String, name: String }
#[derive(Serialize)]
struct ChannelResponse { channel: ChannelModel }

async fn create_channel(State(state): State<AppState>, Json(body): Json<CreateChannelRequest>) -> Json<ChannelResponse> {
    let channel = ChannelModel { id: Id(Ulid::new()), guild_id: Id(Ulid::from_string(&body.guild_id).unwrap_or_else(|_| Ulid::new())), name: body.name, created_at: Utc::now() };
    let doc = ChannelDoc { id: channel.id.0.to_string(), guild_id: channel.guild_id.0.to_string(), name: channel.name.clone(), created_at: channel.created_at };
    let _ = state.channels().insert_one(doc, None).await;
    let _ = state.bus.publish(&format!("channel.{}.created", channel.id.0), &channel).await;
    Json(ChannelResponse { channel })
}

async fn list_channels(State(state): State<AppState>, Path(guild_id): Path<String>) -> Json<Vec<ChannelModel>> {
    let filter = doc! {"guild_id": &guild_id};
    let mut cursor = state.channels().find(Some(filter), None).await.unwrap();
    let mut res = Vec::new();
    while let Some(Ok(doc)) = cursor.next().await {
        if let (Ok(id), Ok(gid)) = (Ulid::from_string(&doc.id), Ulid::from_string(&doc.guild_id)) {
            res.push(ChannelModel { id: Id(id), guild_id: Id(gid), name: doc.name, created_at: doc.created_at });
        }
    }
    Json(res)
}

async fn get_channel(State(state): State<AppState>, Path(id): Path<String>) -> Option<Json<ChannelResponse>> {
    let doc = state.channels().find_one(doc!{"_id": id.clone()}, None).await.ok().flatten()?;
    let channel = ChannelModel { id: Id(Ulid::from_string(&doc.id).ok()?), guild_id: Id(Ulid::from_string(&doc.guild_id).ok()?), name: doc.name, created_at: doc.created_at };
    Some(Json(ChannelResponse { channel }))
}

#[derive(Deserialize)]
struct UpdateChannelRequest { name: Option<String> }
async fn update_channel(State(state): State<AppState>, Path(id): Path<String>, Json(body): Json<UpdateChannelRequest>) -> Option<Json<ChannelResponse>> {
    if let Some(name) = body.name {
        let _ = state.channels().update_one(doc!{"_id": &id}, doc!{"$set": {"name": name.clone()}}, None).await.ok()?;
    }
    let res = get_channel(State(state.clone()), Path(id.clone())).await;
    if let Some(Json(ChannelResponse { channel })) = &res {
        let _ = state.bus.publish(&format!("channel.{}.updated", channel.id.0), &channel).await;
    }
    res
}

async fn delete_channel(State(state): State<AppState>, Path(id): Path<String>) -> Json<serde_json::Value> {
    let _ = state.channels().delete_one(doc!{"_id": id}, None).await;
    let _ = state.bus.publish(&format!("channel.{}.deleted", id), &serde_json::json!({"id": id})).await;
    Json(serde_json::json!({"ok": true}))
}

#[derive(Deserialize)]
struct CreateMessageRequest { author_id: String, content: String }
#[derive(Serialize)]
struct MessageResponse { message: serde_json::Value }

async fn create_message(State(state): State<AppState>, Path(channel_id): Path<String>, Json(body): Json<CreateMessageRequest>) -> Json<MessageResponse> {
    let id = Ulid::new();
    let now = Utc::now();
    let doc = MessageDoc { id: id.to_string(), channel_id: channel_id.clone(), author_id: body.author_id, content: body.content, created_at: now };
    let _ = state.messages().insert_one(doc.clone(), None).await;
    let payload = serde_json::json!({
        "id": doc.id,
        "channel_id": doc.channel_id,
        "author_id": doc.author_id,
        "content": doc.content,
        "created_at": doc.created_at,
    });
    let _ = state.bus.publish(&format!("channel.{}.message_created", channel_id), &payload).await;
    Json(MessageResponse { message: payload })
}

async fn list_messages(State(state): State<AppState>, Path(channel_id): Path<String>) -> Json<Vec<serde_json::Value>> {
    let filter = doc! {"channel_id": &channel_id};
    let mut cursor = state.messages().find(Some(filter), None).await.unwrap();
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
    Json(res)
}

async fn register(State(state): State<AppState>, Json(body): Json<RegisterRequest>) -> Json<RegisterResponse> {
    let user = User {
        id: Id(Ulid::new()),
        email: body.email,
        display_name: body.display_name,
        created_at: Utc::now(),
    };
    // hash password
    let salt = argon2::password_hash::SaltString::generate(&mut rand_core::OsRng);
    let password_hash = argon2::Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .unwrap()
        .to_string();

    // persist to MongoDB
    let doc = UserDoc {
        id: user.id.0.to_string(),
        email: user.email.clone(),
        display_name: user.display_name.clone(),
        password_hash,
        created_at: user.created_at,
    };
    let _ = state.users().insert_one(doc, None).await;

    Json(RegisterResponse { user })
}


