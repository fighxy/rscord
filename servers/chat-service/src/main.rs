mod handlers;
mod models;
mod events;

use axum::{
    routing::{get, post},
    Router,
};
use mongodb::Client as MongoClient;
use rscord_common::{load_config, AppConfig};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[derive(Clone)]
pub struct ChatState {
    pub mongo: MongoClient,
    pub config: AppConfig,
    pub event_publisher: Arc<events::EventPublisher>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RSCORD").expect("load config");
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

    let state = ChatState {
        mongo: mongo.clone(),
        config: cfg,
        event_publisher,
    };

    let app = Router::new()
        .route("/health", get(|| async { "Chat service is healthy" }))
        // Guild routes
        .route("/guilds", post(handlers::create_guild))
        .route("/guilds", get(handlers::get_user_guilds))
        .route("/guilds/:guild_id", get(handlers::get_guild))
        .route("/guilds/:guild_id/channels", get(handlers::get_guild_channels))
        .route("/guilds/:guild_id/members", get(handlers::get_guild_members))
        .route("/guilds/:guild_id/join", post(handlers::join_guild))
        .route("/guilds/:guild_id/leave", post(handlers::leave_guild))
        // Channel routes
        .route("/channels", post(handlers::create_channel))
        .route("/channels/:channel_id", get(handlers::get_channel))
        .route("/channels/:channel_id/messages", get(handlers::get_messages))
        .route("/channels/:channel_id/messages", post(handlers::create_message))
        .route("/channels/:channel_id/typing", post(handlers::typing_indicator))
        // Message routes
        .route("/messages/:message_id", get(handlers::get_message))
        .route("/messages/:message_id", axum::routing::delete(handlers::delete_message))
        .with_state(state)
        .layer(cors);

    info!("Chat service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
