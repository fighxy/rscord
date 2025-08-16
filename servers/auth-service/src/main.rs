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
    let addr: SocketAddr = "127.0.0.1:14701".parse().expect("bind addr");

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


