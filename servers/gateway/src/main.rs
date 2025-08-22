use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, Method, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{any, get},
    Router,
};
use http_body_util::BodyExt;
use hyper_util::client::legacy::Client;
use hyper_util::rt::TokioExecutor;
use radiate_common::{load_config, AppConfig};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any as CorsAny, CorsLayer};
use tracing::{error, info};

mod websocket;
mod routes;
mod redis_pubsub;

use routes::websocket_handler;

type HttpClient = Client<hyper_util::client::legacy::connect::HttpConnector, Body>;

pub type AppState = GatewayState;

#[derive(Clone)]
pub struct GatewayState {
    client: HttpClient,
    services: Arc<HashMap<String, String>>,
    jwt_secret: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg: AppConfig = load_config("RADIATE").expect("load config");
    
    // Читаем конфигурацию из переменной окружения или используем по умолчанию
    let bind_address = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0".to_string());
    let gateway_port = std::env::var("GATEWAY_PORT").unwrap_or_else(|_| "14700".to_string());
    
    let addr: SocketAddr = format!("{}:{}", bind_address, gateway_port)
        .parse()
        .expect("bind addr");

    // Настройка маршрутизации к микросервисам
    let mut services = HashMap::new();
    services.insert("/api/auth".to_string(), "http://127.0.0.1:14701".to_string());
    services.insert("/api/voice".to_string(), "http://127.0.0.1:14705".to_string());
    services.insert("/api/chat".to_string(), "http://127.0.0.1:14703".to_string());
    services.insert("/api/guilds".to_string(), "http://127.0.0.1:14703".to_string());
    services.insert("/api/servers".to_string(), "http://127.0.0.1:14703".to_string());
    services.insert("/api/channels".to_string(), "http://127.0.0.1:14703".to_string());
    services.insert("/api/messages".to_string(), "http://127.0.0.1:14703".to_string());
    services.insert("/api/users".to_string(), "http://127.0.0.1:14703".to_string());
    services.insert("/api/files".to_string(), "http://127.0.0.1:14703".to_string());
    services.insert("/api/presence".to_string(), "http://127.0.0.1:14706".to_string());

    let cors = CorsLayer::new()
        .allow_origin(CorsAny)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers(CorsAny);

    let client = Client::builder(TokioExecutor::new()).build_http();

    let state = GatewayState {
        client,
        services: Arc::new(services),
        jwt_secret: cfg.jwt_secret.clone().unwrap_or_else(|| "secret".to_string()),
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(websocket_handler))
        .fallback(any(proxy_handler))
        .layer(cors)
        .with_state(state);

    info!("API Gateway listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    "Gateway is healthy"
}

async fn proxy_handler(
    State(state): State<GatewayState>,
    mut req: Request,
) -> Result<Response, StatusCode> {
    let path = req.uri().path();
    let path_query = req
        .uri()
        .path_and_query()
        .map(|v| v.as_str())
        .unwrap_or(path);

    // Определяем целевой сервис
    let target_service = determine_target_service(&state.services, path)?;
    
    info!("Proxying {} to {}", path, target_service);

    // Создаем новый URI для проксирования
    let new_uri = format!("{}{}", target_service, path_query);
    
    // Пересоздаем запрос с новым URI
    let uri = new_uri.parse::<Uri>().map_err(|_| StatusCode::BAD_REQUEST)?;
    
    *req.uri_mut() = uri;
    
    // Прокидываем заголовки аутентификации
    if let Some(auth_header) = req.headers().get(header::AUTHORIZATION).cloned() {
        req.headers_mut().insert(header::AUTHORIZATION, auth_header);
    }

    // Отправляем запрос к целевому сервису
    match state.client.request(req).await {
        Ok(response) => {
            let (parts, incoming_body) = response.into_parts();
            
            // Collect the body to bytes
            let bytes = incoming_body
                .collect()
                .await
                .map_err(|_| StatusCode::BAD_GATEWAY)?
                .to_bytes();
            
            // Create a new body from the bytes
            let body = Body::from(bytes);
            
            Ok(Response::from_parts(parts, body))
        }
        Err(e) => {
            error!("Proxy error: {}", e);
            Err(StatusCode::BAD_GATEWAY)
        }
    }
}

fn determine_target_service(
    services: &HashMap<String, String>,
    path: &str,
) -> Result<String, StatusCode> {
    // Находим подходящий сервис по префиксу пути
    for (prefix, service_url) in services.iter() {
        if path.starts_with(prefix) {
            return Ok(service_url.clone());
        }
    }
    
    // По умолчанию направляем на chat-service
    services
        .get("/api/chat")
        .cloned()
        .ok_or(StatusCode::NOT_FOUND)
}
