use mongodb::Client as MongoClient;
use rscord_common::{load_config, AppConfig};
use rscord_auth_service::{create_app, AuthState};
use std::net::SocketAddr;
use tracing::info;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RSCORD").expect("load config");
    let bind_address = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0".to_string());
    let auth_port = std::env::var("AUTH_PORT").unwrap_or_else(|_| "14701".to_string());
    let addr: SocketAddr = format!("{}:{}", bind_address, auth_port).parse().expect("bind addr");

    // Connect to MongoDB
    let mongo_uri = cfg.mongodb_uri.clone().expect("MongoDB URI not configured");
    let mongo = MongoClient::with_uri_str(mongo_uri)
        .await
        .expect("Failed to connect to MongoDB");

    let state = AuthState {
        mongo: mongo.clone(),
        jwt_secret: cfg.jwt_secret.clone().expect("JWT secret not configured"),
    };

    let app = create_app(state).await;

    info!("Auth service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}


