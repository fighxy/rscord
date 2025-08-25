use radiate_voice_service::{create_voice_router, start_background_tasks, VoiceServiceState};
use std::net::SocketAddr;
use tokio::signal;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing with better formatting
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "radiate_voice_service=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().with_target(false))
        .init();

    info!("Starting Radiate Voice Service...");

    // Load configuration from environment variables with fallbacks
    let config = VoiceServiceConfig::from_env()?;
    
    info!("Configuration loaded:");
    info!("  - Bind Address: {}", config.bind_address);
    info!("  - Voice Port: {}", config.voice_port);
    info!("  - Redis URL: {}", mask_redis_url(&config.redis_url));
    info!("  - LiveKit URL: {}", config.livekit_url);

    // Parse bind address
    let addr: SocketAddr = format!("{}:{}", config.bind_address, config.voice_port)
        .parse()
        .expect("Failed to parse bind address");

    // Initialize voice service state
    info!("Initializing voice service state...");
    let state = VoiceServiceState::new(
        config.redis_url,
        config.livekit_url,
        config.livekit_api_key,
        config.livekit_api_secret,
    ).await?;

    // Start background tasks
    info!("Starting background tasks...");
    start_background_tasks(state.clone()).await;

    // Create router
    let app = create_voice_router(state);

    info!("Voice service listening on {}", addr);
    info!("Health check available at: http://{}/health", addr);
    info!("Metrics available at: http://{}/metrics", addr);
    info!("WebSocket endpoint: ws://{}/ws/voice", addr);

    // Start server with graceful shutdown
    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Voice service shut down gracefully");
    Ok(())
}

#[derive(Debug)]
struct VoiceServiceConfig {
    pub bind_address: String,
    pub voice_port: String,
    pub redis_url: String,
    pub livekit_url: String,
    pub livekit_api_key: String,
    pub livekit_api_secret: String,
}

impl VoiceServiceConfig {
    fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            bind_address: std::env::var("BIND_ADDRESS")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
            voice_port: std::env::var("VOICE_PORT")
                .unwrap_or_else(|_| "14705".to_string()),
            redis_url: std::env::var("REDIS_URL")
                .or_else(|_| std::env::var("REDIS_CONNECTION_STRING"))
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            livekit_url: std::env::var("LIVEKIT_URL")
                .or_else(|_| std::env::var("LIVEKIT_SERVER_URL"))
                .unwrap_or_else(|_| "http://localhost:7880".to_string()),
            livekit_api_key: std::env::var("LIVEKIT_API_KEY")
                .or_else(|_| std::env::var("LIVEKIT_KEY"))
                .unwrap_or_else(|_| "devkey".to_string()),
            livekit_api_secret: std::env::var("LIVEKIT_API_SECRET")
                .or_else(|_| std::env::var("LIVEKIT_SECRET"))
                .unwrap_or_else(|_| "secret".to_string()),
        })
    }
}

fn mask_redis_url(url: &str) -> String {
    if let Some(at_pos) = url.find('@') {
        if let Some(protocol_end) = url.find("://") {
            let protocol_part = &url[..protocol_end + 3];
            let server_part = &url[at_pos..];
            format!("{}***:***{}", protocol_part, server_part)
        } else {
            "***:***@***".to_string()
        }
    } else {
        url.to_string()
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C signal");
        },
        _ = terminate => {
            info!("Received terminate signal");
        },
    }

    info!("Starting graceful shutdown...");
}
