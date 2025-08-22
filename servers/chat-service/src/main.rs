mod handlers;
mod models;
mod events;
mod message_handlers;

use axum::{
    routing::{get, post},
    Router,
};
use mongodb::Client as MongoClient;
use radiate_common::{load_config, AppConfig};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[derive(Clone)]
pub struct ChatState {
    pub db: mongodb::Database,
    pub mongo: MongoClient,
    pub config: AppConfig,
    pub event_publisher: Arc<events::EventPublisher>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RADIATE").expect("load config");
    let addr: SocketAddr = "127.0.0.1:14703".parse().expect("bind addr");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Connect to MongoDB
    let mongo_uri = cfg.mongodb_uri.clone().expect("MongoDB URI not configured");
    let mongo = MongoClient::with_uri_str(mongo_uri)
        .await
        .expect("Failed to connect to MongoDB");

    // Initialize event publisher
    let event_publisher = Arc::new(events::EventPublisher::new().await.expect("Failed to create event publisher"));
    
    // Get database
    let db = mongo.database("radiate");

    let state = ChatState {
        db,
        mongo: mongo.clone(),
        config: cfg,
        event_publisher,
    };

    let app = Router::new()
        .route("/health", get(|| async { "Chat service is healthy" }))
        // Guild/Server routes
        .route("/api/servers", post(handlers::create_guild))
        .route("/api/servers", get(handlers::get_user_guilds))
        .route("/api/servers/:guild_id", get(handlers::get_guild))
        .route("/api/servers/:guild_id/channels", get(handlers::get_guild_channels))
        .route("/api/servers/:guild_id/members", get(handlers::get_guild_members))
        .route("/api/servers/:guild_id/join", post(handlers::join_guild))
        .route("/api/servers/:guild_id/leave", post(handlers::leave_guild))
        // Channel routes
        .route("/api/servers/:guild_id/channels", post(handlers::create_channel))
        .route("/api/channels/:channel_id", get(handlers::get_channel))
        .route("/api/channels/:channel_id/messages", get(handlers::get_messages))
        .route("/api/channels/:channel_id/messages", post(handlers::create_message))
        .route("/api/channels/:channel_id/typing", post(handlers::typing_indicator))
        // Message routes
        .route("/api/channels/:channel_id/messages/:message_id", get(handlers::get_message))
        .route("/api/channels/:channel_id/messages/:message_id", axum::routing::put(message_handlers::edit_message))
        .route("/api/channels/:channel_id/messages/:message_id", axum::routing::delete(message_handlers::delete_message))
        // Reaction routes
        .route("/api/channels/:channel_id/messages/:message_id/reactions", post(message_handlers::add_reaction))
        .route("/api/channels/:channel_id/messages/:message_id/reactions", get(message_handlers::get_reactions))
        .route("/api/channels/:channel_id/messages/:message_id/reactions/:emoji", axum::routing::delete(message_handlers::remove_reaction))
        // Attachment routes
        .route("/api/channels/:channel_id/messages/:message_id/attachments", post(message_handlers::add_attachment))
        // User routes
        .route("/api/users/profile", get(handlers::get_user_profile))
        .route("/api/users/update", post(handlers::update_user_profile))
        .route("/api/users/avatar", post(handlers::update_user_avatar))
        .route("/api/users/status", post(handlers::update_user_status))
        .route("/api/users/settings", post(handlers::update_user_settings))
        // File routes
        .route("/api/files/upload", post(handlers::upload_file))
        .route("/api/files/:file_id", get(handlers::get_file))
        .route("/api/files/:file_id", axum::routing::delete(handlers::delete_file))
        .with_state(state)
        .layer(cors);

    info!("Chat service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
